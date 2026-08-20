"""GET /api/routes — 경로 후보 + 노출부하 + 예측등급 (B-04~B-10).
POST /api/routes/explain — 경로별 LLM 코멘트 (B-09).
"""
import hashlib
import logging
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone, timedelta

from django.core.cache import cache
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from apps.common.response import error_response
from apps.environment.services.snapshot import env_for_exposure
from .services import explain, odsay_client, tmap_transit_client, tmap_pedestrian_client
from .services.exposure import calc_exposure_load, env_severity

_log = logging.getLogger("routes")
KST = timezone(timedelta(hours=9))

# E-06 데모 모드: 실제 날씨와 무관하게 조건을 강제 (킬러 장면)
DEMO_ENV = {
    "uv_high": {"uv": 9, "feels_like": 35, "pm10": 40, "pm10_grade": "보통", "precipitation": "none"},
    "clear": {"uv": 2, "feels_like": 23, "pm10": 30, "pm10_grade": "좋음", "precipitation": "none"},
}


def _parse_coord(raw: str) -> tuple[float, float]:
    lat, lng = raw.split(",")
    return float(lat), float(lng)


def _route_sig(cand: dict) -> tuple:
    """경로 동일성 판정용 서명: 교통수단(전철/버스) 노선 시퀀스 + 총시간 + 환승."""
    transit = tuple(
        (s["type"], s.get("line") or s.get("route_name") or "")
        for s in cand["segments_api"] if s["type"] in ("subway", "bus")
    )
    return (cand["total_minutes"], cand["transfers"], transit)


def _dedup_routes(candidates: list[dict]) -> list[dict]:
    """서명이 같은 사실상 동일 경로는 첫 번째만 남긴다 (추천 1=2번 중복 방지)."""
    seen, out = set(), []
    for c in candidates:
        sig = _route_sig(c)
        if sig in seen:
            continue
        seen.add(sig)
        out.append(c)
    return out


def _diverse_select(cands: list[dict], n: int = 3) -> list[dict]:
    """넓은 후보 풀에서 서로 다른 축의 경로를 골라 다양성 확보 (B-08 개선).

    추천(균형 min cost) → 최속(min 시간) → 최소노출(min 부하) 순으로 서명이 겹치지 않게 선택.
    각 후보는 미리 _cost/_total/_load/_sig 가 채워져 있어야 함.
    """
    if len(cands) <= n:
        return cands
    picked: list[dict] = []
    picked_sigs: set = set()

    def take(c):
        picked.append(c)
        picked_sigs.add(c["_sig"])

    take(min(cands, key=lambda c: c["_cost"]))  # 1. 추천(균형)
    for key in (lambda c: c["_total"], lambda c: c["_load"]["score"]):  # 2. 최속 3. 최소노출
        if len(picked) >= n:
            break
        rest = [c for c in cands if c["_sig"] not in picked_sigs]
        if not rest:
            break
        take(min(rest, key=key))
    for c in sorted(cands, key=lambda c: c["_cost"]):  # 부족하면 저비용 순으로 채움
        if len(picked) >= n:
            break
        if c["_sig"] not in picked_sigs:
            take(c)
    return picked


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
        # 도보 전용 후보는 대중교통과 독립 호출이라 동시에 (지연 추가 0)
        ex = ThreadPoolExecutor(max_workers=1)
        f_walk = ex.submit(tmap_pedestrian_client.search_walk_route, from_lat, from_lng, to_lat, to_lng)

        source = "tmap"
        upstream_error = False  # 업스트림 장애(429/쿼터/타임아웃)와 '진짜 무경로'를 구분
        try:  # Tmap 대중교통 우선 (후보 많고 좌표 내장 → geometry 불필요)
            candidates = tmap_transit_client.search_transit_routes(from_lat, from_lng, to_lat, to_lng, limit=8)
        except Exception as e:
            _log.warning("tmap transit failed: %s", e)
            upstream_error = True
            candidates = []
        if not candidates:  # 폴백: ODsay (Tmap 실패/무경로/쿼터소진 시)
            source = "odsay"
            try:
                candidates = odsay_client.search_routes(from_lat, from_lng, to_lat, to_lng, limit=8, with_geometry=False)
                upstream_error = False  # 폴백이 정상 응답(빈 결과 포함)하면 '진짜 무경로'로 확정
            except Exception as e:
                _log.warning("odsay fallback failed: %s", e)
                upstream_error = True
                candidates = []
        try:
            walk = f_walk.result()  # 도보 후보(짧은 거리만) 또는 None
        except Exception as e:
            _log.warning("tmap walk failed: %s", e)
            walk = None
        ex.shutdown(wait=False)

        if not candidates and not walk:
            # 업스트림 장애(429/쿼터/타임아웃)면 재시도 가능한 503, 정상 응답인데 경로가 없으면 404
            if upstream_error:
                return error_response("UPSTREAM_UNAVAILABLE", "지금은 경로를 불러올 수 없어요. 잠시 후 다시 시도해주세요.", 503)
            return error_response("ROUTE_NOT_FOUND", "이 구간은 경로를 찾지 못했어요", 404)

        candidates = _dedup_routes(candidates)  # 사실상 동일한 경로 제거

        # 후보 채점(버스대기는 우선 추정치) → 다양 선별(추천/최속/최소노출)
        factor = env_severity(env) * 10  # 날씨 심각할수록 노출 중시 (킬러 장면)
        for c in candidates:
            c["_load"] = calc_exposure_load(c["segments_engine"], env, preset)
            c["_total"] = c["total_minutes"]
            c["_cost"] = c["_total"] + c["_load"]["score"] * factor
            c["_sig"] = _route_sig(c)
        selected = _diverse_select(candidates, 3)

        if walk:  # 도보 전용은 항상 별도 선택지로 추가(추천 경쟁에도 참여)
            walk["_load"] = calc_exposure_load(walk["segments_engine"], env, preset)
            walk["_total"] = walk["total_minutes"]
            walk["_cost"] = walk["_total"] + walk["_load"]["score"] * factor
            walk["_sig"] = _route_sig(walk)
            selected.append(walk)

        # 실시간 보정(TAGO)·지오메트리는 최종 선택 3개에만 → 지연 최소화. 실시간 반영해 재채점.
        if q.get("realtime_wait", "1") != "0":
            odsay_client.apply_realtime_waits(selected)
            for c in selected:
                c["_load"] = calc_exposure_load(c["segments_engine"], env, preset)
                c["_cost"] = c["_total"] + c["_load"]["score"] * factor
        if with_geometry:  # 상세 화면: 실 선로(ODsay) + 실 보행로(도보 직선 구간) 동시 보강
            with ThreadPoolExecutor(max_workers=2) as gx:
                if source == "odsay":  # Tmap대중교통은 선로 좌표 내장 → loadLane 불필요
                    gx.submit(odsay_client.apply_geometry, selected)
                gx.submit(tmap_pedestrian_client.apply_walk_geometry, selected)  # 도보만(전철/버스와 무간섭)

        try:
            depart_at = datetime.fromisoformat(q["depart_at"]) if q.get("depart_at") else datetime.now(KST)
        except ValueError:
            depart_at = datetime.now(KST)
        if depart_at.tzinfo is None:
            depart_at = depart_at.replace(tzinfo=KST)

        routes = []
        for i, c in enumerate(selected):
            load = c["_load"]
            total = c["_total"]
            outdoor = load["outdoor_minutes"]
            indoor_ratio = round(max(0.0, min(1.0, 1 - (outdoor / total))), 2) if total else 1.0

            # B-11 예측 등급: 버스 대기를 실시간(TAGO)으로 채웠으면 realtime, 폴백(추정)이면 estimated.
            bus_waits_api = [s for s in c["segments_api"] if s["type"] == "bus_wait"]
            if bus_waits_api and not any(s.get("realtime") for s in bus_waits_api):
                grade, notice = "estimated", "실시간 버스 도착 정보가 없어 추정 배차로 안내해요."
            else:
                grade, notice = "realtime", None

            # C-05계열 출발시각 넛지: 실시간 대기가 긴 첫 버스에 한해 "N분 늦게 나가면 노변 대기 절감"
            depart_nudge = None
            for s in c["segments_api"]:
                if s["type"] == "bus_wait" and s.get("realtime") and s["minutes"] >= 6:
                    delay = s["minutes"] - 3  # 3분 여유 남기고 정류장 도착
                    station = s.get("station") or "정류장"
                    depart_nudge = {
                        "delay_minutes": delay,
                        "station": station,
                        "text": f"'{station}'에서 다음 버스까지 약 {s['minutes']}분. 출발을 {delay}분 늦추면 노변 야외 대기를 그만큼 줄일 수 있어요.",
                    }
                    break

            routes.append({
                "route_id": f"r_{i}",
                "route_type": "walk" if c.get("walk_only") else "transit",
                "exposure_load": load["score"],
                "exposure_breakdown": load["breakdown"],
                "outdoor_minutes": outdoor,
                "indoor_ratio": indoor_ratio,
                "total_minutes": total,
                "arrival_time": (depart_at + timedelta(minutes=total)).replace(microsecond=0).isoformat(),
                "transfers": c["transfers"],
                "prediction_grade": grade,
                "data_source": "tmap" if c.get("walk_only") else source,
                "notice": notice,
                "depart_nudge": depart_nudge,
                "llm_comment": None,
                "polyline": c["polyline"],
                "path_segments": c["path_segments"],
                "segments": c["segments_api"],
                "_cost": c["_cost"],
            })

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


class RoutesExplainView(APIView):
    """POST /api/routes/explain — 경로 비교 JSON → 경로별 자연어 코멘트 (B-09).

    GET /api/routes 와 분리한 이유: 경로 카드는 즉시 그려야 하고 문구는 나중에 채워도 된다.
    한 번에 붙이면 LLM 지연(수 초)이 경로 응답 전체를 붙잡는다.

    유료 호출이라 남용 방지 2겹: 스코프 레이트리밋 + 동일 입력 캐시.
    """
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "llm"

    def post(self, request):
        body = request.data if isinstance(request.data, dict) else {}
        routes = body.get("routes")
        if not isinstance(routes, list) or not routes:
            return error_response("VALIDATION_ERROR", "설명할 경로(routes)가 필요해요.", 400)
        if not all(isinstance(r, dict) and r.get("route_id") for r in routes):
            return error_response("VALIDATION_ERROR", "각 경로에 route_id가 필요해요.", 400)

        env = body.get("environment") if isinstance(body.get("environment"), dict) else {}
        preset = body.get("preset") or "normal"

        # 같은 경로 조합을 다시 열어도(뒤로가기·재조회) 유료 호출이 반복되지 않게.
        key = "routes:explain:" + hashlib.sha256(
            explain.fingerprint(routes, env, preset).encode()
        ).hexdigest()
        cached = cache.get(key)
        if cached:
            return Response(cached)

        comments, generated_by = explain.explain_routes(routes, env, preset)
        payload = {"comments": comments, "generated_by": generated_by}
        if generated_by == "llm":  # 템플릿 결과는 계산이 싸므로 캐시할 이유가 없다
            cache.set(key, payload, 600)
        return Response(payload)
