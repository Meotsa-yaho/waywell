"""trips 앱 뷰 — 실시간 도착(C-02), 이동 기록(C-01/C-06), 주간 리포트(D)."""
from datetime import datetime, timezone, timedelta

from django.conf import settings
from django.utils import timezone as dj_tz
from rest_framework.views import APIView
from rest_framework.response import Response

from apps.common.response import error_response
from apps.accounts.models import Account
from apps.accounts.services.jwt_util import decode_token
from .models import Trip, ArrivalSnapshot
from .services import tago_client
from .services import report as report_service

KST = timezone(timedelta(hours=9))


def _device_id(request):
    return request.headers.get("X-Device-Id")


def _account(request):
    """로그인 상태면 Account, 아니면 None."""
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        aid = decode_token(auth[7:])
        if aid:
            return Account.objects.filter(id=aid).first()
    return None


class TripsView(APIView):
    """GET /api/trips — 이동 기록 목록(SC-13). POST — 이동 시작(C-01)."""

    def get(self, request):
        account = _account(request)
        device_id = _device_id(request)
        if account:
            qs = Trip.objects.filter(account=account)
        elif device_id:
            qs = Trip.objects.filter(device_id=device_id, account__isnull=True)
        else:
            return error_response("VALIDATION_ERROR", "이동 기록에 필요한 정보가 없어요.", 400)

        def _iso(dt):
            return dt.astimezone(KST).replace(microsecond=0).isoformat() if dt else None

        trips = [{
            "id": str(t.id),
            "from_name": t.from_name,
            "to_name": t.to_name,
            "status": t.status,
            "total_minutes": t.total_minutes,
            "exposure_load": t.exposure_load,
            "outdoor_minutes": t.outdoor_minutes,
            "started_at": _iso(t.started_at),
            "completed_at": _iso(t.completed_at),
        } for t in qs[:50]]
        return Response({"trips": trips})

    def post(self, request):
        account = _account(request)
        device_id = _device_id(request)
        if not account and not device_id:
            return error_response("VALIDATION_ERROR", "이동 기록에 필요한 정보가 없어요.", 400)
        b = request.data

        def _int(k):
            try:
                return int(b.get(k, 0) or 0)
            except (TypeError, ValueError):
                return 0

        outdoor = _int("outdoor_minutes")
        trip = Trip.objects.create(
            account=account,
            device_id=device_id or "",
            from_name=str(b.get("from_name", ""))[:120],
            to_name=str(b.get("to_name", ""))[:120],
            total_minutes=_int("total_minutes"),
            exposure_load=_int("exposure_load"),
            outdoor_minutes=outdoor,
            uv_minutes=outdoor,  # UV 노출 분 ≈ 야외 분 (근사)
        )
        return Response({"trip_id": str(trip.id), "status": trip.status}, status=201)

    def delete(self, request):
        """DELETE /api/trips/ — 모든 이동 기록 전체 삭제."""
        account = _account(request)
        device_id = _device_id(request)
        if account:
            deleted_count, _ = Trip.objects.filter(account=account).delete()
        elif device_id:
            deleted_count, _ = Trip.objects.filter(device_id=device_id, account__isnull=True).delete()
        else:
            return error_response("VALIDATION_ERROR", "이동 기록에 필요한 정보가 없어요.", 400)
        return Response({"deleted": True, "count": deleted_count})


class TripDetailView(APIView):
    """PATCH /api/trips/{id} — 이동 완료/취소 처리(C-06). DELETE — 단일 기록 삭제."""

    def patch(self, request, trip_id):
        account = _account(request)
        owner = {"account": account} if account else {"device_id": _device_id(request) or ""}
        try:
            trip = Trip.objects.get(id=trip_id, **owner)
        except Exception:
            return error_response("NOT_FOUND", "이동 기록을 찾을 수 없어요.", 404)
        new_status = request.data.get("status")
        if new_status in ("completed", "cancelled"):
            trip.status = new_status
            if new_status == "completed":
                trip.completed_at = dj_tz.now()
            trip.save(update_fields=["status", "completed_at"])
        return Response({"trip_id": str(trip.id), "status": trip.status})

    def delete(self, request, trip_id):
        """DELETE /api/trips/{id}/ — 특정 이동 기록 삭제."""
        account = _account(request)
        owner = {"account": account} if account else {"device_id": _device_id(request) or ""}
        try:
            trip = Trip.objects.get(id=trip_id, **owner)
        except Exception:
            return error_response("NOT_FOUND", "이동 기록을 찾을 수 없어요.", 404)
        trip.delete()
        return Response({"deleted": True, "trip_id": str(trip_id)})


class WeeklyReportView(APIView):
    """GET /api/report/weekly — 오늘 요약 + 7일 추이 + 전주 대비(D-01~03)."""

    def get(self, request):
        return Response(report_service.weekly_report(_account(request), _device_id(request)))

# TAGO cityCode 미지정 시 기본값. 데모 정류소(세종)용. 실서비스는 정류소→cityCode 매핑 필요.
DEFAULT_CITY_CODE = "25"


def _snapshot_arrivals(node_id: str, route_id: str | None) -> list[dict]:
    """E-04 크롤러 스냅샷에서 최근 수집분을 Arrival 형태로 복원. 없으면 빈 리스트."""
    ttl = getattr(settings, "ARRIVAL_SNAPSHOT_TTL", 300)
    qs = ArrivalSnapshot.objects.filter(node_id=node_id, collected_at__gte=dj_tz.now() - timedelta(seconds=ttl))
    if route_id:
        qs = qs.filter(route_id=route_id)
    latest = qs.first()
    if not latest:
        return []
    recent = qs.filter(collected_at__gte=latest.collected_at - timedelta(seconds=30))
    items = sorted(recent, key=lambda s: s.minutes)
    return [{
        "seq": i + 1, "minutes": s.minutes, "raw_minutes": s.minutes, "corrected": False,
        "vehicle_id": None, "route_name": s.route_no, "route_id": s.route_id, "stations_left": s.stations_left,
    } for i, s in enumerate(items)]


class ArrivalView(APIView):
    """GET /api/arrival?station_id=&route_id=&city_code=  → 다음 버스 도착 예정.

    live TAGO 실패/빈 응답이면 E-04 크롤러 스냅샷으로 폴백(우아한 실패).
    """

    def get(self, request):
        q = request.query_params
        station_id = q.get("station_id")
        if not station_id:
            return error_response("VALIDATION_ERROR", "정류소 ID(station_id)가 필요해요.", 400)
        route_id = q.get("route_id")
        city_code = q.get("city_code", DEFAULT_CITY_CODE)

        data_source, grade, notice = "tago", "realtime", None
        try:
            arrivals = tago_client.get_arrivals(city_code, station_id, route_id)
        except Exception:
            arrivals = []

        if not arrivals:  # live 실패/없음 → 크롤러 스냅샷 폴백
            cached = _snapshot_arrivals(station_id, route_id)
            if cached:
                arrivals, data_source, grade = cached, "tago_cache", "estimated"
                notice = "실시간 연결이 지연돼 최근 수집 정보로 안내해요."
            else:
                notice = "곧 도착 예정인 차량이 없어요."

        return Response({
            "station_id": station_id,
            "route_id": route_id,
            "route_name": arrivals[0]["route_name"] if arrivals else None,
            "arrivals": arrivals,
            "prediction_grade": grade,
            "data_source": data_source,
            "notice": notice,
            "polled_at": datetime.now(KST).replace(microsecond=0).isoformat(),
        })
