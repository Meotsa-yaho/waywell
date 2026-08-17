"""카카오 로컬 카테고리 반경검색 — 실내 대기 장소(C-04).

더울 때/미세먼지 심할 때 근처에서 잠깐 대피할 카페·편의점·지하철역을 도보 가까운 순으로 준다.
"""
import math
import os

import requests

_URL = "https://dapi.kakao.com/v2/local/search/category.json"
_KEYWORD_URL = "https://dapi.kakao.com/v2/local/search/keyword.json"
_WALK_M_PER_MIN = 67  # 도보 약 4km/h


def search_places(q: str, lat: float | None = None, lng: float | None = None, size: int = 10) -> list[dict]:
    """키워드 장소 검색(B-02). 좌표 주면 거리순 정렬 + 거리 표기."""
    params: dict = {"query": q, "size": size}
    if lat is not None and lng is not None:
        params.update(x=lng, y=lat, sort="distance")
    r = requests.get(
        _KEYWORD_URL,
        params=params,
        headers={"Authorization": f"KakaoAK {os.getenv('KAKAO_REST_API_KEY')}"},
        timeout=6,
    )
    r.raise_for_status()
    out = []
    for d in r.json().get("documents", []):
        out.append({
            "place_id": d["id"],
            "name": d["place_name"],
            "address": d.get("road_address_name") or d.get("address_name") or "",
            "category": d.get("category_group_name") or "",
            "lat": float(d["y"]),
            "lng": float(d["x"]),
            "distance_m": int(d["distance"]) if d.get("distance") else None,
        })
    return out

# 실내 대기에 적합한 카테고리 (카카오 코드 → 우리 category)
_CATEGORIES = [("CE7", "cafe"), ("CS2", "convenience"), ("SW8", "subway_station"), ("MT1", "mart")]


def _shelter(doc: dict, category: str) -> dict:
    dist = int(doc.get("distance") or 0)
    return {
        "place_id": doc["id"],
        "name": doc["place_name"],
        "category": category,
        "address": doc.get("road_address_name") or doc.get("address_name") or "",
        "lat": float(doc["y"]),
        "lng": float(doc["x"]),
        "distance_m": dist,
        "walk_minutes": max(1, math.ceil(dist / _WALK_M_PER_MIN)),
        "map_url": doc.get("place_url", ""),
    }


def search_shelters(lat: float, lng: float, radius: int = 400, limit: int = 6) -> list[dict]:
    """반경 내 실내 대기 장소를 도보 가까운 순으로. 실패한 카테고리는 건너뜀."""
    headers = {"Authorization": f"KakaoAK {os.getenv('KAKAO_REST_API_KEY')}"}
    found: list[dict] = []
    for code, category in _CATEGORIES:
        try:
            r = requests.get(
                _URL,
                params={"category_group_code": code, "x": lng, "y": lat,
                        "radius": radius, "sort": "distance", "size": 5},
                headers=headers,
                timeout=6,
            )
            r.raise_for_status()
            for doc in r.json().get("documents", []):
                found.append(_shelter(doc, category))
        except Exception:
            continue
    found.sort(key=lambda s: s["distance_m"])
    return found[:limit]


if __name__ == "__main__":
    from pathlib import Path
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parents[3] / ".env")
    out = search_shelters(37.4979, 127.0276)  # 강남역
    assert out and all(s["walk_minutes"] >= 1 and s["distance_m"] >= 0 for s in out), out
    assert out == sorted(out, key=lambda s: s["distance_m"]), "거리순 정렬 아님"
    print("ok", len(out), "shelters; nearest:", out[0]["name"], out[0]["distance_m"], "m", out[0]["walk_minutes"], "분")
