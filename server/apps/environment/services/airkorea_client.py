"""에어코리아 클라이언트 — 근접 측정소 → 실시간 미세먼지."""
import os
import time

import requests

from .kakao_geo import to_tm

_NEARBY_URL = "http://apis.data.go.kr/B552584/MsrstnInfoInqireSvc/getNearbyMsrstnList"
# 서비스명은 ArpltnInforInqireSvc (Infor 포함). ArpltnInqireSvc는 없는 서비스 → code 12.
_DUST_URL = "http://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getMsrstnAcctoRltmMesureDnsty"

_GRADE = {"1": "좋음", "2": "보통", "3": "나쁨", "4": "매우나쁨"}


def _url_with_key(base_url: str) -> str:
    return f"{base_url}?serviceKey={os.getenv('AIRKOREA_API_KEY')}"


def _get_json(url: str, params: dict, tries: int = 3) -> dict:
    """data.go.kr은 504(SERVICETIMEOUT)를 산발적으로 뱉음 → 짧게 재시도."""
    last = None
    for i in range(tries):
        try:
            r = requests.get(url, params=params, timeout=6)
            r.raise_for_status()
            return r.json()
        except requests.RequestException as e:
            last = e
            time.sleep(0.4 * (i + 1))
    raise last


def _nearest_station(lat: float, lng: float) -> str:
    tm_x, tm_y = to_tm(lat, lng)
    data = _get_json(
        _url_with_key(_NEARBY_URL),
        {"returnType": "json", "tmX": tm_x, "tmY": tm_y, "ver": "1.1"},
    )
    return data["response"]["body"]["items"][0]["stationName"]


def get_air(lat: float, lng: float) -> dict:
    """PM10/PM2.5 농도 + 등급. 실패 시 예외."""
    station = _nearest_station(lat, lng)
    data = _get_json(
        _url_with_key(_DUST_URL),
        {"returnType": "json", "stationName": station, "dataTerm": "DAILY", "ver": "1.3", "numOfRows": 1},
    )
    it = data["response"]["body"]["items"][0]

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
