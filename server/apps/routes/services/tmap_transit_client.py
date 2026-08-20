"""Tmap 대중교통 통합경로 클라이언트.

ODsay와 동일한 파싱 결과 형태를 반환한다(노출엔진·다양선별·실시간대기 레이어 재사용).
좌표(선로/도보)가 응답 leg에 내장돼 있어 별도 geometry(loadLane) 호출이 필요 없다 → 빠름.
후보를 count(기본 8)개까지 줘서 경로 다양성이 ODsay보다 풍부.
"""
import os

import requests

from .odsay_client import EST_BUS_WAIT

_URL = "https://apis.openapi.sk.com/transit/routes"


def _coords(linestring: str) -> list[list[float]]:
    """'lon,lat lon,lat ...' → [[lat, lng], ...]."""
    out: list[list[float]] = []
    for pair in (linestring or "").split():
        try:
            lon, lat = pair.split(",")
            out.append([float(lat), float(lon)])
        except ValueError:
            continue
    return out


def _walk_coords(leg: dict) -> list[list[float]]:
    if leg.get("steps"):
        pts: list[list[float]] = []
        for s in leg["steps"]:
            pts += _coords(s.get("linestring", ""))
        return pts
    return _coords(leg.get("passShape", {}).get("linestring", ""))


def _parse_itinerary(it: dict) -> dict:
    legs = it.get("legs", [])
    modes = [leg.get("mode") for leg in legs]
    seg_api: list[dict] = []
    seg_engine: list[dict] = []
    path_segments: list[dict] = []
    polyline: list[list[float]] = []
    bus_waits: list[dict] = []
    seq = 0

    for i, leg in enumerate(legs):
        m = leg.get("mode")
        st = round(leg.get("sectionTime", 0) / 60)
        start, end = leg.get("start", {}), leg.get("end", {})

        if m == "WALK":
            coords = _walk_coords(leg)
            polyline += coords
            # 지하철↔지하철 사이 도보만 실내(역사 환승통로)로, 나머지 도보는 실외
            indoor = (i > 0 and modes[i - 1] == "SUBWAY") and (i < len(modes) - 1 and modes[i + 1] == "SUBWAY")
            if st == 0:
                continue
            seq += 1
            seg_api.append({"seq": seq, "type": "transfer_walk" if indoor else "walk", "minutes": st,
                            "outdoor": not indoor, "exposure_minutes": 0 if indoor else st})
            seg_engine.append({"outdoor": not indoor, "minutes": st, "kind": "walk_in" if indoor else "walk_out"})
            if coords:
                path_segments.append({"type": "walk", "outdoor": not indoor, "coords": coords})

        elif m == "BUS":
            bus_no = str(leg.get("route", "")).split(":")[-1].strip()
            coords = _coords(leg.get("passShape", {}).get("linestring", ""))
            polyline += coords
            seq += 1
            bw_seg = {"seq": seq, "type": "bus_wait", "minutes": EST_BUS_WAIT, "outdoor": True,
                      "exposure_minutes": EST_BUS_WAIT, "station": start.get("name"), "realtime": False}
            if start.get("lat") and start.get("lon"):
                bw_seg["lat"] = float(start["lat"])
                bw_seg["lng"] = float(start["lon"])
            seg_api.append(bw_seg)
            seg_engine.append({"outdoor": True, "minutes": EST_BUS_WAIT, "kind": "bus_wait"})
            if start.get("lat"):
                bus_waits.append({"api": len(seg_api) - 1, "engine": len(seg_engine) - 1,
                                  "lat": float(start["lat"]), "lng": float(start["lon"]), "bus_no": bus_no})
            seq += 1
            bus_from = {"name": start.get("name")}
            bus_to = {"name": end.get("name")}
            if start.get("lat") and start.get("lon"):
                bus_from["lat"], bus_from["lng"] = float(start["lat"]), float(start["lon"])
            if end.get("lat") and end.get("lon"):
                bus_to["lat"], bus_to["lng"] = float(end["lat"]), float(end["lon"])
            seg_api.append({"seq": seq, "type": "bus", "route_name": bus_no, "minutes": st, "outdoor": False,
                            "exposure_minutes": 0, "from": bus_from, "to": bus_to})
            seg_engine.append({"outdoor": False, "minutes": st, "kind": "bus"})
            if coords:
                path_segments.append({"type": "bus", "outdoor": False, "coords": coords})

        elif m == "SUBWAY":
            coords = _coords(leg.get("passShape", {}).get("linestring", ""))
            polyline += coords
            seq += 1
            sub_from = {"name": start.get("name")}
            sub_to = {"name": end.get("name")}
            if start.get("lat") and start.get("lon"):
                sub_from["lat"], sub_from["lng"] = float(start["lat"]), float(start["lon"])
            if end.get("lat") and end.get("lon"):
                sub_to["lat"], sub_to["lng"] = float(end["lat"]), float(end["lon"])
            seg_api.append({"seq": seq, "type": "subway", "line": leg.get("route"), "minutes": st, "outdoor": False,
                            "exposure_minutes": 0, "from": sub_from, "to": sub_to})
            seg_engine.append({"outdoor": False, "minutes": st, "kind": "subway"})
            if coords:
                path_segments.append({"type": "subway", "outdoor": False, "coords": coords})

    return {
        "total_minutes": round(it.get("totalTime", 0) / 60),
        "transfers": it.get("transferCount", 0),
        "segments_api": seg_api,
        "segments_engine": seg_engine,
        "polyline": polyline,
        "path_segments": path_segments,
        "bus_waits": bus_waits,
    }


def search_transit_routes(from_lat: float, from_lng: float, to_lat: float, to_lng: float,
                          limit: int = 8) -> list[dict]:
    """Tmap 대중교통 경로 후보. 실패/무경로 시 빈 리스트(→ ODsay 폴백)."""
    r = requests.post(
        _URL,
        headers={"appKey": os.getenv("TMAP_APP_KEY"), "Content-Type": "application/json"},
        json={"startX": str(from_lng), "startY": str(from_lat), "endX": str(to_lng), "endY": str(to_lat),
              "count": limit, "format": "json"},
        timeout=8,
    )
    r.raise_for_status()
    its = r.json().get("metaData", {}).get("plan", {}).get("itineraries")
    if not its:
        return []
    return [_parse_itinerary(it) for it in its[:limit]]
