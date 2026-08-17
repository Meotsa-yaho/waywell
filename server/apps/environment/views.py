"""GET /api/environment — 현재 위치의 환경 상태 (SC-03, B-06)."""
import logging
from datetime import datetime, timezone, timedelta

from django.core.cache import cache
from rest_framework.views import APIView

from rest_framework.response import Response

from apps.common.response import error_response
from .services import kma_client, airkorea_client
from .services.grid import latlng_to_grid, apparent_temperature

_log = logging.getLogger("environment")
KST = timezone(timedelta(hours=9))

_PTY = {0: "none", 1: "rain", 2: "rain_snow", 3: "snow", 5: "shower", 6: "rain_snow", 7: "snow"}


def _uv_grade(idx: int) -> str:
    if idx >= 11:
        return "위험"
    if idx >= 8:
        return "매우높음"
    if idx >= 6:
        return "높음"
    if idx >= 3:
        return "보통"
    return "낮음"


def _comment(uv, feels, pm10_grade) -> str:
    if uv is not None and uv >= 8:
        return "자외선이 매우 높아요. 그늘에서 기다릴 수 있는 경로를 추천할게요."
    if feels is not None and feels >= 33:
        return "무더워요. 실내 대기 구간이 많은 경로가 편해요."
    if pm10_grade in ("나쁨", "매우나쁨"):
        return "미세먼지가 많아요. 야외 노출이 적은 경로를 추천할게요."
    return "야외 활동하기 괜찮은 날이에요."


class EnvironmentView(APIView):
    def get(self, request):
        try:
            lat = float(request.query_params["lat"])
            lng = float(request.query_params["lng"])
        except (KeyError, ValueError):
            return error_response("VALIDATION_ERROR", "위치 정보(lat, lng)가 필요해요.", 400)

        nx, ny = latlng_to_grid(lat, lng)
        cache_key = f"env:{nx}:{ny}"
        cached = cache.get(cache_key)
        if cached:
            return Response(cached)

        partial = False

        # 날씨 (기온·습도·풍속·강수)
        temperature = precipitation = None
        try:
            w = kma_client.get_weather(lat, lng)
            feels = apparent_temperature(w["temp"], w["humidity"], w["wind"])
            temperature = {"current": w["temp"], "feels_like": feels, "humidity": int(w["humidity"])}
            precipitation = {"type": _PTY.get(w["pty"], "none"), "probability": 0 if w["pty"] == 0 else 80}
        except Exception as e:
            partial = True
            feels = None
            _log.warning("weather fetch failed: %s", e)

        # 자외선
        uv = None
        try:
            idx = kma_client.get_uv(lat, lng)
            uv = {"index": idx, "grade": _uv_grade(idx)}
        except Exception as e:
            partial = True
            _log.warning("uv fetch failed: %s", e)

        # 미세먼지
        air = None
        try:
            a = airkorea_client.get_air(lat, lng)
            air = {"pm10": a["pm10"], "pm10_grade": a["pm10_grade"], "pm25": a["pm25"], "pm25_grade": a["pm25_grade"]}
        except Exception as e:
            partial = True
            _log.warning("air fetch failed: %s", e)

        body = {
            "observed_at": datetime.now(KST).replace(microsecond=0).isoformat(),
            "uv": uv,
            "temperature": temperature,
            "air": air,
            "precipitation": precipitation,
            "comment": _comment(uv["index"] if uv else None, feels, air["pm10_grade"] if air else None),
            "partial": partial,
        }
        # 완전 응답만 10분 캐시. 부분실패(외부 API 일시 오류)는 60초만 → 곧 재시도되게.
        cache.set(cache_key, body, 60 if partial else 600)
        return Response(body)
