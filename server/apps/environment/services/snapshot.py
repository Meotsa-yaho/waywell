"""노출부하 계산용 환경 스냅샷 — 실패 항목은 None(우아한 실패).

날씨·UV·미세먼지는 서로 독립된 외부 호출이라 동시 실행한다.
총 소요 = 순차 합계(~7초)가 아니라 셋 중 최댓값(~3초) → 경로 검색 지연 대폭 감소.
"""
import logging
from concurrent.futures import ThreadPoolExecutor

from .grid import apparent_temperature
from . import kma_client, airkorea_client

_log = logging.getLogger("environment.snapshot")

_PTY = {0: "none", 1: "rain", 2: "rain_snow", 3: "snow", 5: "shower", 6: "rain_snow", 7: "snow"}


def _weather(lat: float, lng: float) -> tuple[float, str]:
    w = kma_client.get_weather(lat, lng)
    return apparent_temperature(w["temp"], w["humidity"], w["wind"]), _PTY.get(w["pty"], "none")


def env_for_exposure(lat: float, lng: float) -> dict:
    out = {"uv": None, "feels_like": None, "pm10": None, "pm10_grade": "보통", "precipitation": "none"}
    with ThreadPoolExecutor(max_workers=3) as ex:  # 컨텍스트 종료 시 셋 다 완료 대기
        f_weather = ex.submit(_weather, lat, lng)
        f_uv = ex.submit(kma_client.get_uv, lat, lng)
        f_air = ex.submit(airkorea_client.get_air, lat, lng)

    try:
        out["feels_like"], out["precipitation"] = f_weather.result()
    except Exception as e:
        _log.warning("weather fetch failed: %s", e)
    try:
        out["uv"] = f_uv.result()
    except Exception as e:
        _log.warning("uv fetch failed: %s", e)
    try:
        a = f_air.result()
        out["pm10"] = a["pm10"]
        out["pm10_grade"] = a["pm10_grade"]
    except Exception as e:
        _log.warning("air fetch failed: %s", e)
    return out
