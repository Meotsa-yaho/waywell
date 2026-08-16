"""ODsay 대중교통 경로 탐색 + 구간 파싱.

ODsay는 경로 후보와 각 구간(도보/버스/지하철·시간·좌표)을 준다.
버스 '대기' 시간은 경로 응답에 없어 추정 상수로 붙인다 (노출부하의 최대 발생원).
지하철 환승 통로 도보는 실내로 판정.
"""
import os

import requests

_URL = "https://api.odsay.com/v1/api/searchPubTransPathT"

# ponytail: 버스 대기 추정 상수. 실시간 도착(TAGO) 붙으면 교체.
EST_BUS_WAIT = 5


class OdsayError(Exception):
    pass


def _lane_name(sp: dict) -> str | None:
    lanes = sp.get("lane") or [{}]
    lane = lanes[0]
    return lane.get("busNo") or lane.get("busName") or lane.get("name")


def _parse_path(path: dict) -> dict:
    info = path["info"]
    sub = path["subPath"]
    seg_api: list[dict] = []
    seg_engine: list[dict] = []
    polyline: list[list[float]] = []
    seq = 0

    for i, sp in enumerate(sub):
        tt = sp.get("trafficType")
        st = int(sp.get("sectionTime", 0) or 0)
        if sp.get("startX") and sp.get("startY"):
            polyline.append([float(sp["startY"]), float(sp["startX"])])
        if sp.get("endX") and sp.get("endY"):
            polyline.append([float(sp["endY"]), float(sp["endX"])])

        if tt == 3:  # 도보
            if st == 0:
                continue
            prev_tt = sub[i - 1].get("trafficType") if i > 0 else None
            next_tt = sub[i + 1].get("trafficType") if i < len(sub) - 1 else None
            outdoor = not (prev_tt == 1 and next_tt == 1)  # 지하철↔지하철 환승통로만 실내
            seq += 1
            seg_api.append({"seq": seq, "type": "transfer_walk" if not outdoor else "walk",
                            "minutes": st, "outdoor": outdoor, "exposure_minutes": st if outdoor else 0})
            seg_engine.append({"outdoor": outdoor, "minutes": st})

        elif tt == 2:  # 버스: 대기(야외) + 탑승(실내)
            seq += 1
            seg_api.append({"seq": seq, "type": "bus_wait", "minutes": EST_BUS_WAIT, "outdoor": True,
                            "exposure_minutes": EST_BUS_WAIT, "station": sp.get("startName")})
            seg_engine.append({"outdoor": True, "minutes": EST_BUS_WAIT})
            seq += 1
            seg_api.append({"seq": seq, "type": "bus", "route_name": _lane_name(sp), "minutes": st,
                            "outdoor": False, "exposure_minutes": 0,
                            "from": {"name": sp.get("startName")}, "to": {"name": sp.get("endName")}})
            seg_engine.append({"outdoor": False, "minutes": st})

        elif tt == 1:  # 지하철: 탑승(실내)
            seq += 1
            seg_api.append({"seq": seq, "type": "subway", "line": _lane_name(sp), "minutes": st,
                            "outdoor": False, "exposure_minutes": 0,
                            "from": {"name": sp.get("startName")}, "to": {"name": sp.get("endName")}})
            seg_engine.append({"outdoor": False, "minutes": st})

    transfers = max(0, info.get("busTransitCount", 0) + info.get("subwayTransitCount", 0) - 1)
    return {
        "total_minutes": int(info.get("totalTime", 0)),
        "transfers": transfers,
        "segments_api": seg_api,
        "segments_engine": seg_engine,
        "polyline": polyline,
    }


def search_routes(from_lat: float, from_lng: float, to_lat: float, to_lng: float, limit: int = 3) -> list[dict]:
    r = requests.get(
        _URL,
        params={"apiKey": os.getenv("ODSAY_API_KEY"),
                "SX": from_lng, "SY": from_lat, "EX": to_lng, "EY": to_lat},
        # ODsay 키는 등록 도메인(Referer) 검증 → 서버 호출 시 등록 URI를 Referer로 보낸다.
        headers={"Referer": os.getenv("ODSAY_REFERER", "http://localhost:5173")},
        timeout=8,
    )
    r.raise_for_status()
    data = r.json()
    err = data.get("error")
    if err:  # ODsay 오류는 {"error":[{"code","message"}]} (리스트) 형태
        msg = err[0].get("message") if isinstance(err, list) else err.get("message")
        raise OdsayError(msg or "ODsay 오류")
    paths = data.get("result", {}).get("path", [])
    if not paths:
        return []
    return [_parse_path(p) for p in paths[:limit]]
