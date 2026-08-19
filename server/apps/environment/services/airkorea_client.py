"""에어코리아 클라이언트 — 근접 측정소 → 실시간 미세먼지."""
import os
import time

import requests
from django.core.cache import cache

from .kakao_geo import to_tm

_NEARBY_URL = "http://apis.data.go.kr/B552584/MsrstnInfoInqireSvc/getNearbyMsrstnList"
# 서비스명은 ArpltnInforInqireSvc (Infor 포함). ArpltnInqireSvc는 없는 서비스 → code 12.
_DUST_URL = "http://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getMsrstnAcctoRltmMesureDnsty"

_GRADE = {"1": "좋음", "2": "보통", "3": "나쁨", "4": "매우나쁨"}


def _url_with_key(base_url: str) -> str:
    return f"{base_url}?serviceKey={os.getenv('AIRKOREA_API_KEY')}"


def _get_json(url: str, params: dict, tries: int = 3) -> dict:
    """data.go.kr은 504(SERVICETIMEOUT)를 산발적으로 뱉음 → 짧게 재시도.

    단, 429(트래픽 초과)는 재시도할수록 쿼터만 더 태우므로 즉시 중단.
    """
    last = None
    for i in range(tries):
        try:
            r = requests.get(url, params=params, timeout=6)
            r.raise_for_status()
            return r.json()
        except requests.RequestException as e:
            last = e
            if getattr(e.response, "status_code", None) == 429:
                break  # 레이트리밋은 재시도 금지
            time.sleep(0.4 * (i + 1))
    raise last


def _nearest_station(lat: float, lng: float) -> str:
    key = f"air:stn:{round(lat, 2)}:{round(lng, 2)}"  # 측정소 위치는 정적 → 좌표 반올림 캐시
    stn = cache.get(key)
    if stn:
        return stn
    tm_x, tm_y = to_tm(lat, lng)
    data = _get_json(
        _url_with_key(_NEARBY_URL),
        {"returnType": "json", "tmX": tm_x, "tmY": tm_y, "ver": "1.1"},
    )
    stn = data["response"]["body"]["items"][0]["stationName"]
    cache.set(key, stn, 86400)  # 24h: 근접 측정소 조회 콜(429 유발원)을 사실상 제거
    return stn


def get_air(lat: float, lng: float) -> dict:
    """PM10/PM2.5 농도 + 등급. 일시 실패(429 등) 시 최근 정상값으로 폴백, 없으면 예외."""
    station = _nearest_station(lat, lng)
    last_key = f"air:last:{station}"
    try:
        data = _get_json(
            _url_with_key(_DUST_URL),
            {"returnType": "json", "stationName": station, "dataTerm": "DAILY", "ver": "1.3", "numOfRows": 6},
        )
        items = data["response"]["body"]["items"]
    except Exception:
        stale = cache.get(last_key)  # 429/일시장애: 미세먼지는 완만 변화 → 최근값으로 우아하게 폴백
        if stale:
            return stale
        raise

    def _pick(value_key: str, grade_key: str):
        """최신 행부터 유효한 숫자값을 찾는다 (최신 행이 '-' 측정공백이어도 이전 시간값 사용)."""
        for it in items:
            try:
                num = int(float(it.get(value_key)))
            except (TypeError, ValueError):
                continue
            return num, _GRADE.get(it.get(grade_key), "보통")
        return None, "보통"

    pm10, pm10_grade = _pick("pm10Value", "pm10Grade")
    pm25, pm25_grade = _pick("pm25Value", "pm25Grade")
    result = {
        "pm10": pm10, "pm10_grade": pm10_grade,
        "pm25": pm25, "pm25_grade": pm25_grade,
        "station": station,
    }
    if pm10 is not None:  # 유효한 측정값만 최근값으로 1h 보관 (일시장애 시 폴백용)
        cache.set(last_key, result, 3600)
    return result
