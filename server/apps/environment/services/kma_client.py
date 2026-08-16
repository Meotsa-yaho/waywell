"""기상청 클라이언트 — 초단기실황(기온·습도·풍속·강수) + 자외선지수."""
import os
from datetime import datetime, timedelta

import requests

from .grid import latlng_to_grid
from .kakao_geo import to_region_code

_NCST_URL = "http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst"
_UV_URL = "http://apis.data.go.kr/1360000/LivingWthrIdxServiceV4/getUVIdxV4"


def _with_key(base_url: str, key_env: str) -> str:
    """data.go.kr 키는 URL-encoded 형태 → params로 넘기면 이중 인코딩되므로 URL에 직접 붙인다."""
    return f"{base_url}?serviceKey={os.getenv(key_env)}"


def _ncst_base_time() -> tuple[str, str]:
    """초단기실황은 매시 정각 관측, 약 40분 뒤 제공. 40분 이전이면 이전 시각."""
    now = datetime.now()
    if now.minute < 40:
        now -= timedelta(hours=1)
    return now.strftime("%Y%m%d"), now.strftime("%H00")


def get_weather(lat: float, lng: float) -> dict:
    """기온·습도·풍속·강수형태. 실패 시 예외."""
    nx, ny = latlng_to_grid(lat, lng)
    base_date, base_time = _ncst_base_time()
    r = requests.get(
        _with_key(_NCST_URL, "KMA_API_KEY"),
        params={
            "pageNo": 1, "numOfRows": 100, "dataType": "JSON",
            "base_date": base_date, "base_time": base_time, "nx": nx, "ny": ny,
        },
        timeout=6,
    )
    r.raise_for_status()
    items = r.json()["response"]["body"]["items"]["item"]
    vals = {it["category"]: it["obsrValue"] for it in items}
    return {
        "temp": float(vals["T1H"]),
        "humidity": float(vals["REH"]),
        "wind": float(vals["WSD"]),
        "pty": int(vals.get("PTY", 0)),
        "rn1": vals.get("RN1", "0"),
    }


def get_uv(lat: float, lng: float) -> int:
    """자외선지수(현재 시각 h0). 실패 시 예외."""
    area_no = to_region_code(lat, lng)
    now = datetime.now()
    # 자외선지수는 3시간 단위 발표 → 현재 시각 이하의 짝수 발표시각 사용
    time_str = now.strftime("%Y%m%d") + f"{(now.hour // 3) * 3:02d}"
    r = requests.get(
        _with_key(_UV_URL, "KMA_UV_API_KEY"),
        params={"pageNo": 1, "numOfRows": 10, "dataType": "JSON", "areaNo": area_no, "time": time_str},
        timeout=6,
    )
    r.raise_for_status()
    item = r.json()["response"]["body"]["items"]["item"][0]
    # h0 = 현재, 없으면 가장 가까운 값
    for k in ("h0", "h3", "h6"):
        if item.get(k):
            return int(item[k])
    raise ValueError("UV 값 없음")
