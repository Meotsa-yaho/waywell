"""ODsay 대중교통 경로 탐색 + 구간 파싱.

ODsay는 경로 후보와 각 구간(도보/버스/지하철·시간·좌표)을 준다.
버스 '대기' 시간은 경로 응답에 없어 추정 상수로 붙인다 (노출부하의 최대 발생원).
지하철 환승 통로 도보는 실내로 판정.
"""
import os
from concurrent.futures import ThreadPoolExecutor, wait

import requests

from . import bus_wait

_URL = "https://api.odsay.com/v1/api/searchPubTransPathT"
_LANE_URL = "https://api.odsay.com/v1/api/loadLane"

# ponytail: 버스 대기 추정 상수. 실시간 도착(TAGO) 붙으면 교체.
EST_BUS_WAIT = 5


class OdsayError(Exception):
    pass


def _lane_name(sp: dict) -> str | None:
    lanes = sp.get("lane") or [{}]
    lane = lanes[0]
    return lane.get("busNo") or lane.get("busName") or lane.get("name")


def _pt(sp: dict, which: str) -> list[float] | None:
    x, y = sp.get(f"{which}X"), sp.get(f"{which}Y")
    return [float(y), float(x)] if x and y else None


def _parse_path(path: dict, origin: list[float] | None = None, dest: list[float] | None = None) -> dict:
    info = path["info"]
    sub = path["subPath"]
    seg_api: list[dict] = []
    seg_engine: list[dict] = []
    polyline: list[list[float]] = []
    path_segments: list[dict] = []  # 모드별(도보/버스/전철) 좌표 → 지도 색상 구분용
    bus_waits: list[dict] = []  # 버스 대기 위치(실시간 보정용): api/engine 인덱스 + 승차 좌표 + 노선번호
    seq = 0

    _MODE = {1: "subway", 2: "bus", 3: "walk"}
    # 도보 연결선 합성용: 각 구간의 시작/끝 좌표 미리 수집
    ends = [(_pt(sp, "start"), _pt(sp, "end")) for sp in sub]

    def prev_end(i):
        for j in range(i - 1, -1, -1):
            if ends[j][1]:
                return ends[j][1]
        return origin

    def next_start(i):
        for j in range(i + 1, len(sub)):
            if ends[j][0]:
                return ends[j][0]
        return dest

    for i, sp in enumerate(sub):
        tt = sp.get("trafficType")
        st = int(sp.get("sectionTime", 0) or 0)
        start, end = ends[i]
        if start:
            polyline.append(start)
        if end:
            polyline.append(end)

        # 도보 실내/실외 판정 (지하철↔지하철 환승통로만 실내), 탑승 구간은 실내로 취급
        if tt == 3:
            prev_tt = sub[i - 1].get("trafficType") if i > 0 else None
            next_tt = sub[i + 1].get("trafficType") if i < len(sub) - 1 else None
            seg_outdoor = not (prev_tt == 1 and next_tt == 1)
        else:
            seg_outdoor = False

        if tt in (1, 2) and start and end:  # 전철·버스: 실제 좌표(직선→geometry로 교체)
            path_segments.append({"type": _MODE[tt], "outdoor": False, "coords": [start, end]})
        elif tt == 3 and st > 0:  # 도보: 앞뒤 좌표로 연결선 합성
            a, b = prev_end(i), next_start(i)
            if a and b:
                path_segments.append({"type": "walk", "outdoor": seg_outdoor, "coords": [a, b]})

        if tt == 3:  # 도보
            if st == 0:
                continue
            seq += 1
            seg_api.append({"seq": seq, "type": "transfer_walk" if not seg_outdoor else "walk",
                            "minutes": st, "outdoor": seg_outdoor, "exposure_minutes": st if seg_outdoor else 0})
            seg_engine.append({"outdoor": seg_outdoor, "minutes": st, "kind": "walk_out" if seg_outdoor else "walk_in"})

        elif tt == 2:  # 버스: 대기(야외) + 탑승(실내)
            seq += 1
            bw_seg = {"seq": seq, "type": "bus_wait", "minutes": EST_BUS_WAIT, "outdoor": True,
                      "exposure_minutes": EST_BUS_WAIT, "station": sp.get("startName"), "realtime": False}
            if start:
                bw_seg["lat"] = start[0]
                bw_seg["lng"] = start[1]
            seg_api.append(bw_seg)
            seg_engine.append({"outdoor": True, "minutes": EST_BUS_WAIT, "kind": "bus_wait"})
            if start:  # 실시간 보정 대상: 승차 정류소 좌표 + 노선번호
                bus_waits.append({"api": len(seg_api) - 1, "engine": len(seg_engine) - 1,
                                  "lat": start[0], "lng": start[1], "bus_no": _lane_name(sp)})
            seq += 1
            bus_from = {"name": sp.get("startName")}
            bus_to = {"name": sp.get("endName")}
            if start:
                bus_from["lat"], bus_from["lng"] = start[0], start[1]
            if end:
                bus_to["lat"], bus_to["lng"] = end[0], end[1]
            seg_api.append({"seq": seq, "type": "bus", "route_name": _lane_name(sp), "minutes": st,
                            "outdoor": False, "exposure_minutes": 0,
                            "from": bus_from, "to": bus_to})
            seg_engine.append({"outdoor": False, "minutes": st, "kind": "bus"})

        elif tt == 1:  # 지하철: 탑승(실내)
            seq += 1
            sub_from = {"name": sp.get("startName")}
            sub_to = {"name": sp.get("endName")}
            if start:
                sub_from["lat"], sub_from["lng"] = start[0], start[1]
            if end:
                sub_to["lat"], sub_to["lng"] = end[0], end[1]
            seg_api.append({"seq": seq, "type": "subway", "line": _lane_name(sp), "minutes": st,
                            "outdoor": False, "exposure_minutes": 0,
                            "from": sub_from, "to": sub_to})
            seg_engine.append({"outdoor": False, "minutes": st, "kind": "subway"})

    transfers = max(0, info.get("busTransitCount", 0) + info.get("subwayTransitCount", 0) - 1)
    return {
        "total_minutes": int(info.get("totalTime", 0)),
        "transfers": transfers,
        "segments_api": seg_api,
        "segments_engine": seg_engine,
        "polyline": polyline,
        "path_segments": path_segments,
        "bus_waits": bus_waits,
        "map_obj": info.get("mapObj"),
    }


def _referer() -> dict:
    return {"Referer": os.getenv("ODSAY_REFERER", "http://localhost:5173")}


def _load_lanes(map_obj: str) -> list[list[list[float]]]:
    """loadLane으로 실제 노선 그래픽 좌표를 가져온다. 레인 순서 = 대중교통 구간 순서.

    반환: 레인별 [[lat, lng], ...]. 실패 시 빈 리스트(직선 폴백).
    """
    try:
        r = requests.get(
            _LANE_URL,
            params={"apiKey": os.getenv("ODSAY_API_KEY"), "mapObject": "0:0@" + map_obj},
            headers=_referer(),
            timeout=8,
        )
        r.raise_for_status()
        lanes = r.json().get("result", {}).get("lane", [])
    except Exception:
        return []
    out: list[list[list[float]]] = []
    for ln in lanes:
        pts: list[list[float]] = []
        for sec in ln.get("section", []):
            for g in sec.get("graphPos", []):
                pts.append([g["y"], g["x"]])
        out.append(pts)
    return out


def _apply_geometry(parsed: dict) -> None:
    """전철/버스 구간의 직선 좌표를 실제 선로/도로 좌표로 교체 (제자리 수정)."""
    map_obj = parsed.get("map_obj")
    if not map_obj:
        return
    lanes = _load_lanes(map_obj)
    if not lanes:
        return
    transit = [s for s in parsed["path_segments"] if s["type"] in ("bus", "subway")]
    for seg, lane in zip(transit, lanes):  # 순서 일치 (mapObj가 구간 순서로 구성됨)
        if len(lane) >= 2:
            seg["coords"] = lane


def apply_realtime_waits(candidates: list[dict], deadline_s: float = 5, budget: int = 8) -> None:
    """버스 '대기'를 TAGO 실시간 도착으로 교체(제자리). 미커버/타임아웃은 추정치 유지.

    ponytail: 전체 지연 상한 = deadline_s (버스 개수와 무관, 동시 실행).
    """
    tasks = [(c, bw) for c in candidates for bw in c.get("bus_waits", [])][:budget]
    if not tasks:
        return
    ex = ThreadPoolExecutor(max_workers=min(8, len(tasks)))
    futmap = {ex.submit(bus_wait.realtime_wait, bw["lat"], bw["lng"], bw["bus_no"]): (c, bw) for c, bw in tasks}
    done, _ = wait(futmap, timeout=deadline_s)
    for fut in done:
        c, bw = futmap[fut]
        try:
            minutes = fut.result()
        except Exception:
            minutes = None
        if minutes is not None:
            api_seg = c["segments_api"][bw["api"]]
            api_seg["minutes"] = minutes
            api_seg["exposure_minutes"] = minutes
            api_seg["realtime"] = True
            c["segments_engine"][bw["engine"]]["minutes"] = minutes
    ex.shutdown(wait=False, cancel_futures=True)  # 남은 느린 콜은 기다리지 않음


def apply_geometry(candidates: list[dict]) -> None:
    """선택된 경로들에만 실제 선로 좌표(loadLane)를 동시 호출로 붙인다 (제자리 수정)."""
    if not candidates:
        return
    with ThreadPoolExecutor(max_workers=min(len(candidates), 4)) as ex:
        list(ex.map(_apply_geometry, candidates))


def search_routes(from_lat: float, from_lng: float, to_lat: float, to_lng: float,
                  limit: int = 3, with_geometry: bool = False) -> list[dict]:
    r = requests.get(
        _URL,
        params={"apiKey": os.getenv("ODSAY_API_KEY"),
                "SX": from_lng, "SY": from_lat, "EX": to_lng, "EY": to_lat},
        # ODsay 키는 등록 도메인(Referer) 검증 → 서버 호출 시 등록 URI를 Referer로 보낸다.
        headers=_referer(),
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
    origin, dest = [from_lat, from_lng], [to_lat, to_lng]
    parsed = [_parse_path(p, origin, dest) for p in paths[:limit]]
    if with_geometry and parsed:  # 상세 화면에서만 실제 선로 좌표 추가 (경로당 loadLane 호출을 동시 실행)
        with ThreadPoolExecutor(max_workers=min(len(parsed), 4)) as ex:
            list(ex.map(_apply_geometry, parsed))
    return parsed
