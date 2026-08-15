"""에어코리아 클라이언트 — 근접 측정소 → 실시간 미세먼지."""
import os

import requests

from .kakao_geo import to_tm

_NEARBY_URL = "http://apis.data.go.kr/B552584/MsrstnInfoInqireSvc/getNearbyMsrstnList"
_DUST_URL = "http://apis.data.go.kr/B552584/ArpltnInqireSvc/getMsrstnAcctoRltmMesureDnsty"

_GRADE = {"1": "좋음", "2": "보통", "3": "나쁨", "4": "매우나쁨"}


def _url_with_key(base_url: str) -> str:
    return f"{base_url}?serviceKey={os.getenv('AIRKOREA_API_KEY')}"


def _nearest_station(lat: float, lng: float) -> str:
    tm_x, tm_y = to_tm(lat, lng)
    r = requests.get(
        _url_with_key(_NEARBY_URL),
        params={"returnType": "json", "tmX": tm_x, "tmY": tm_y, "ver": "1.1"},
        timeout=6,
    )
    r.raise_for_status()
    return r.json()["response"]["body"]["items"][0]["stationName"]


def get_air(lat: float, lng: float) -> dict:
    """PM10/PM2.5 농도 + 등급. 실패 시 예외."""
    station = _nearest_station(lat, lng)
    r = requests.get(
        _url_with_key(_DUST_URL),
        params={"returnType": "json", "stationName": station, "dataTerm": "DAILY", "ver": "1.3", "numOfRows": 1},
        timeout=6,
    )
    r.raise_for_status()
    it = r.json()["response"]["body"]["items"][0]

    def _num(v):
        try:
            return int(float(v))
        except (TypeError, ValueError):
            return None

    return {
        "pm10": _num(it.get("pm10Value")),
        "pm10_grade": _GRADE.get(it.get("pm10Grade"), "보통"),
        "pm25": _num(it.get("pm25Value")),
        "pm25_grade": _GRADE.get(it.get("pm25Grade"), "보통"),
        "station": station,
    }
