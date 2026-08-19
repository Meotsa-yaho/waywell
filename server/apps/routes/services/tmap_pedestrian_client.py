"""Tmap 보행자 경로 클라이언트.

용도 2가지:
  1) '걸어서만' 후보 1개(search_walk_route) — 짧은 거리 대체 선택지.
  2) 대중교통 경로의 도보 구간을 실제 보행로로 채우기(apply_walk_geometry) —
     ODsay 폴백은 도보를 직선 2점으로 합성하므로, 그 구간만 실 보행로 좌표로 교체.
응답 leg에 좌표 내장 → geometry 불필요. ODsay/Tmap대중교통과 동일한 결과 형태 반환.
"""
import os
from concurrent.futures import ThreadPoolExecutor, wait

import requests

_URL = "https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1&format=json"

# ponytail: 이 시간(분) 초과 도보는 후보에서 제외(2시간 도보 = 노이즈). 필요 시 상향.
MAX_WALK_MIN = 45


def _coords(geometry: dict) -> list[list[float]]:
    """LineString [[lon,lat],...] → [[lat,lng],...]. Point는 무시."""
    if geometry.get("type") != "LineString":
        return []
    return [[c[1], c[0]] for c in geometry.get("coordinates", []) if len(c) >= 2]


def _request(from_lat: float, from_lng: float, to_lat: float, to_lng: float) -> tuple[int, list[list[float]]] | None:
    """보행자 경로 호출 → (분, [[lat,lng],...]). 실패/무경로 시 None."""
    try:
        r = requests.post(
            _URL,
            headers={"appKey": os.getenv("TMAP_APP_KEY"), "Content-Type": "application/json"},
            json={"startX": from_lng, "startY": from_lat, "endX": to_lng, "endY": to_lat,
                  "startName": "출발", "endName": "도착",
                  "reqCoordType": "WGS84GEO", "resCoordType": "WGS84GEO", "searchOption": 0},
            timeout=8,
        )
        r.raise_for_status()
        feats = r.json().get("features", [])
    except Exception:
        return None
    if not feats:
        return None
    minutes = round(feats[0].get("properties", {}).get("totalTime", 0) / 60)
    coords: list[list[float]] = []
    for f in feats:
        coords += _coords(f.get("geometry", {}))
    return minutes, coords


def search_walk_route(from_lat: float, from_lng: float, to_lat: float, to_lng: float,
                      max_minutes: int = MAX_WALK_MIN) -> dict | None:
    """도보 전용 후보. 실패/무경로/너무 긺 → None(후보에서 제외)."""
    res = _request(from_lat, from_lng, to_lat, to_lng)
    if not res:
        return None
    minutes, coords = res
    if minutes <= 0 or minutes > max_minutes:
        return None

    seg = {"seq": 1, "type": "walk", "minutes": minutes, "outdoor": True, "exposure_minutes": minutes}
    return {
        "total_minutes": minutes,
        "transfers": 0,
        "segments_api": [seg],
        "segments_engine": [{"outdoor": True, "minutes": minutes, "kind": "walk_out"}],
        "polyline": coords,
        "path_segments": [{"type": "walk", "outdoor": True, "coords": coords}] if coords else [],
        "bus_waits": [],
        "walk_only": True,
    }


def apply_walk_geometry(candidates: list[dict], deadline_s: float = 5, budget: int = 8) -> None:
    """대중교통 경로의 직선 도보 구간(coords 2점)을 실제 보행로 좌표로 교체(제자리).

    이미 실좌표가 있는 도보(Tmap대중교통 leg·도보전용 후보 = 다점)는 건너뜀.
    동시 실행 + deadline 상한. 실패/타임아웃은 직선 유지.
    """
    tasks = [seg for c in candidates for seg in c.get("path_segments", [])
             if seg["type"] == "walk" and len(seg.get("coords", [])) == 2][:budget]
    if not tasks:
        return
    ex = ThreadPoolExecutor(max_workers=min(8, len(tasks)))
    futs = {ex.submit(_request, s["coords"][0][0], s["coords"][0][1], s["coords"][1][0], s["coords"][1][1]): s
            for s in tasks}
    done, _ = wait(futs, timeout=deadline_s)
    for f in done:
        s = futs[f]
        try:
            res = f.result()
        except Exception:
            res = None
        if res and len(res[1]) >= 2:
            s["coords"] = res[1]
    ex.shutdown(wait=False, cancel_futures=True)
