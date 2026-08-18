"""GET /api/routes — 경로 후보 + 노출부하 + 예측등급 (B-04~B-10)."""
from datetime import datetime, timezone, timedelta

from rest_framework.views import APIView
from rest_framework.response import Response

from apps.common.response import error_response
from apps.environment.services.snapshot import env_for_exposure
from .services import odsay_client
from .services.exposure import calc_exposure_load, env_severity

KST = timezone(timedelta(hours=9))

# E-06 데모 모드: 실제 날씨와 무관하게 조건을 강제 (킬러 장면)
DEMO_ENV = {
    "uv_high": {"uv": 9, "feels_like": 35, "pm10": 40, "pm10_grade": "보통", "precipitation": "none"},
    "clear": {"uv": 2, "feels_like": 23, "pm10": 30, "pm10_grade": "좋음", "precipitation": "none"},
}


def _parse_coord(raw: str) -> tuple[float, float]:
    lat, lng = raw.split(",")
    return float(lat), float(lng)


class RoutesView(APIView):
    def get(self, request):
        q = request.query_params
        try:
            from_lat, from_lng = _parse_coord(q["from"])
            to_lat, to_lng = _parse_coord(q["to"])
        except (KeyError, ValueError):
            return error_response("VALIDATION_ERROR", "출발/도착 좌표(from, to)가 필요해요.", 400)

        preset = q.get("preset", "normal")
        sort = q.get("sort", "recommend")  # 기본 = 추천순(시간+노출 복합)
        demo = q.get("demo_weather")

        env = DEMO_ENV.get(demo) or env_for_exposure(from_lat, from_lng)

        with_geometry = q.get("geometry") in ("1", "true")  # 상세 화면만 실제 선로 좌표 요청
        try:
            candidates = odsay_client.search_routes(from_lat, from_lng, to_lat, to_lng, with_geometry=with_geometry)
        except Exception:
            return error_response("UPSTREAM_TIMEOUT", "경로 정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요.", 504)

        if not candidates:
            return error_response("ROUTE_NOT_FOUND", "이 구간은 대중교통 경로를 찾지 못했어요", 404)

        # 버스 '대기'를 TAGO 실시간 도착으로 보정(노출부하 계산 전). realtime_wait=0 이면 생략.
        if q.get("realtime_wait", "1") != "0":
            odsay_client.apply_realtime_waits(candidates)

        try:
            depart_at = datetime.fromisoformat(q["depart_at"]) if q.get("depart_at") else datetime.now(KST)
        except ValueError:
            depart_at = datetime.now(KST)
        if depart_at.tzinfo is None:
            depart_at = depart_at.replace(tzinfo=KST)

        routes = []
        for i, c in enumerate(candidates):
            load = calc_exposure_load(c["segments_engine"], env, preset)
            total = c["total_minutes"]
            outdoor = load["outdoor_minutes"]
            indoor_ratio = round(max(0.0, min(1.0, 1 - (outdoor / total))), 2) if total else 1.0

            # B-11 예측 등급: 버스 대기를 실시간(TAGO)으로 채웠으면 realtime, 폴백(추정)이면 estimated.
            # 버스 없는(지하철·도보) 경로는 ODsay 시간 신뢰 → realtime.
            bus_waits_api = [s for s in c["segments_api"] if s["type"] == "bus_wait"]
            if bus_waits_api and not any(s.get("realtime") for s in bus_waits_api):
                grade, notice = "estimated", "실시간 버스 도착 정보가 없어 추정 배차로 안내해요."
            else:
                grade, notice = "realtime", None

            routes.append({
                "route_id": f"r_{i}",
                "exposure_load": load["score"],
                "exposure_breakdown": load["breakdown"],
                "outdoor_minutes": outdoor,
                "indoor_ratio": indoor_ratio,
                "total_minutes": total,
                "arrival_time": (depart_at + timedelta(minutes=total)).replace(microsecond=0).isoformat(),
                "transfers": c["transfers"],
                "prediction_grade": grade,
                "data_source": "odsay",
                "notice": notice,
                "llm_comment": None,
                "polyline": c["polyline"],
                "path_segments": c["path_segments"],
                "segments": c["segments_api"],
            })

        # 추천 = 시간 + 노출×날씨강도 최소 (킬러 장면: 맑으면 빠른 길, 더우면 노출 적은 길)
        factor = env_severity(env) * 10
        for r in routes:
            r["_cost"] = r["total_minutes"] + r["exposure_load"] * factor
        recommended_id = min(routes, key=lambda r: r["_cost"])["route_id"]

        if sort == "duration":
            routes.sort(key=lambda r: r["total_minutes"])
        elif sort == "exposure":
            routes.sort(key=lambda r: r["exposure_load"])
        else:  # recommend (기본)
            routes.sort(key=lambda r: r["_cost"])
        for rank, r in enumerate(routes, start=1):
            r["rank"] = rank
            r["recommended"] = r["route_id"] == recommended_id
            del r["_cost"]

        return Response({
            "query": {
                "from": {"lat": from_lat, "lng": from_lng, "name": q.get("from_name", "출발지")},
                "to": {"lat": to_lat, "lng": to_lng, "name": q.get("to_name", "도착지")},
                "depart_at": depart_at.replace(microsecond=0).isoformat(),
                "preset": preset,
            },
            "environment": {
                "uv": env.get("uv"),
                "feels_like": env.get("feels_like"),
                "pm10_grade": env.get("pm10_grade", "보통"),
                "precipitation": env.get("precipitation", "none"),
            },
            "routes": routes,
        })
