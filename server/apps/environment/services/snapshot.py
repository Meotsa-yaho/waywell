"""노출부하 계산용 환경 스냅샷 — 실패 항목은 None(우아한 실패)."""
import logging

from .grid import apparent_temperature
from . import kma_client, airkorea_client

_log = logging.getLogger("environment.snapshot")

_PTY = {0: "none", 1: "rain", 2: "rain_snow", 3: "snow", 5: "shower", 6: "rain_snow", 7: "snow"}


def env_for_exposure(lat: float, lng: float) -> dict:
    out = {"uv": None, "feels_like": None, "pm10": None, "pm10_grade": "보통", "precipitation": "none"}
    try:
        w = kma_client.get_weather(lat, lng)
        out["feels_like"] = apparent_temperature(w["temp"], w["humidity"], w["wind"])
        out["precipitation"] = _PTY.get(w["pty"], "none")
    except Exception as e:
        _log.warning("weather fetch failed: %s", e)
    try:
        out["uv"] = kma_client.get_uv(lat, lng)
    except Exception as e:
        _log.warning("uv fetch failed: %s", e)
    try:
        a = airkorea_client.get_air(lat, lng)
        out["pm10"] = a["pm10"]
        out["pm10_grade"] = a["pm10_grade"]
    except Exception as e:
        _log.warning("air fetch failed: %s", e)
    return out
