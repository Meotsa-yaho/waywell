"""카카오 좌표 변환 — 에어코리아 TM 좌표, 자외선 지역코드 매핑용."""
import os
import requests


def _headers() -> dict:
    return {"Authorization": f"KakaoAK {os.getenv('KAKAO_REST_API_KEY')}"}


def to_tm(lat: float, lng: float) -> tuple[float, float]:
    """WGS84 → TM(에어코리아 근접 측정소 조회용)."""
    r = requests.get(
        "https://dapi.kakao.com/v2/local/geo/transcoord.json",
        params={"x": lng, "y": lat, "input_coord": "WGS84", "output_coord": "TM"},
        headers=_headers(),
        timeout=5,
    )
    r.raise_for_status()
    doc = r.json()["documents"][0]
    return doc["x"], doc["y"]


def to_region_code(lat: float, lng: float) -> str | None:
    """WGS84 → 법정동 코드(자외선지수 areaNo 후보)."""
    r = requests.get(
        "https://dapi.kakao.com/v2/local/geo/coord2regioncode.json",
        params={"x": lng, "y": lat},
        headers=_headers(),
        timeout=5,
    )
    r.raise_for_status()
    docs = r.json().get("documents", [])
    for d in docs:
        if d.get("region_type") == "B":  # 법정동
            return d["code"]
    return docs[0]["code"] if docs else None
