"""전국 그늘막쉼터(행안부 표준데이터, data.go.kr 12,000여개) 로컬 저장 + 근처 조회.

거의 정적 데이터(지자체 등록)라 매 요청마다 외부 API를 치지 않는다:
  수집(refresh) → 로컬 JSON 저장 → 인메모리 로드 → 좌표 반경 필터(haversine).
갱신은 `python manage.py import_shades` 재실행. 파일 없으면 최초 조회 때 자동 수집.
API 키는 data.go.kr 공용키(SHADE_API_KEY, 없으면 TAGO/AIRKOREA 키와 동일 계정).
"""
import json
import math
import os
import threading
from pathlib import Path

import requests

_URL = "https://api.data.go.kr/openapi/tn_pubr_public_shade_canopy_api"
_FILE = Path(__file__).resolve().parent.parent / "data" / "shades.json"
_WALK_M_PER_MIN = 67  # 도보 약 4km/h

_cache: list[dict] | None = None
_lock = threading.Lock()


def _key() -> str:
    return os.getenv("SHADE_API_KEY") or os.getenv("TAGO_API_KEY") or os.getenv("AIRKOREA_API_KEY") or ""


def _fetch_all() -> list[dict]:
    """API 전량 수집(페이지네이션). 좌표 없는 행은 건너뜀."""
    key = _key()
    out: list[dict] = []
    page, per = 1, 1000
    while True:
        r = requests.get(f"{_URL}?serviceKey={key}",
                         params={"pageNo": page, "numOfRows": per, "type": "json"}, timeout=15)
        r.raise_for_status()
        body = r.json().get("body", {})
        items = (body.get("items") or {}).get("item") or []
        for it in items:
            try:
                lat, lng = float(it["lat"]), float(it["lot"])
            except (TypeError, ValueError, KeyError):
                continue
            if not (33 < lat < 39 and 124 < lng < 132):  # 한반도 밖(좌표 오류) 제외
                continue
            out.append({
                "name": (it.get("instlPlcNm") or "그늘막").strip(),
                "address": (it.get("lctnRoadNm") or it.get("lctnLotnoAddr") or "").strip(),
                "lat": lat, "lng": lng,
                "type": (it.get("shadeCanopyType") or "").strip(),
            })
        total = int(body.get("totalCount") or 0)
        if not items or page * per >= total:
            break
        page += 1
    return out


def refresh() -> int:
    """API에서 다시 받아 파일에 저장하고 캐시 갱신. 반환: 저장 건수."""
    data = _fetch_all()
    _FILE.parent.mkdir(parents=True, exist_ok=True)
    _FILE.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    global _cache
    _cache = data
    return len(data)


def _load() -> list[dict]:
    global _cache
    if _cache is not None:
        return _cache
    with _lock:
        if _cache is not None:
            return _cache
        if _FILE.exists():
            _cache = json.loads(_FILE.read_text(encoding="utf-8"))
        else:
            _cache = refresh()  # 최초 요청 시 자동 수집·저장 (한 번만 느림)
        return _cache


def _dist_m(la1: float, lo1: float, la2: float, lo2: float) -> float:
    dla, dlo = math.radians(la2 - la1), math.radians(lo2 - lo1)
    a = math.sin(dla / 2) ** 2 + math.cos(math.radians(la1)) * math.cos(math.radians(la2)) * math.sin(dlo / 2) ** 2
    return 2 * 6371000 * math.asin(math.sqrt(a))


def nearby(lat: float, lng: float, radius_m: int = 500, limit: int = 8) -> list[dict]:
    """반경 내 그늘막을 도보 가까운 순으로. bbox 선필터 후 haversine."""
    data = _load()
    dlat = radius_m / 111000.0
    dlng = radius_m / (111000.0 * max(0.1, math.cos(math.radians(lat))))
    out: list[dict] = []
    for s in data:
        if abs(s["lat"] - lat) > dlat or abs(s["lng"] - lng) > dlng:
            continue
        d = _dist_m(lat, lng, s["lat"], s["lng"])
        if d <= radius_m:
            out.append({**s, "distance_m": round(d), "walk_minutes": max(1, math.ceil(d / _WALK_M_PER_MIN))})
    out.sort(key=lambda s: s["distance_m"])
    return out[:limit]


if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parents[3] / ".env")
    # 강남역 근처 그늘막 스모크 (파일 없으면 자동 수집)
    r = nearby(37.4979, 127.0276, radius_m=800)
    assert all(x["distance_m"] <= 800 and x["walk_minutes"] >= 1 for x in r), r
    assert r == sorted(r, key=lambda x: x["distance_m"]), "거리순 아님"
    print("ok", len(_load()), "loaded;", len(r), "near 강남역; nearest:", r[0] if r else None)
