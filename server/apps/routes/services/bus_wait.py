"""ODsay 버스 구간의 '대기' 시간을 TAGO 실시간 도착으로 보정.

좌표 → TAGO 근접 정류소(nodeid·citycode) → 해당 노선 다음 도착(분).
실패/미커버(서울 등)/미발견 시 None → 호출부가 추정치(EST_BUS_WAIT)로 폴백.

ponytail: 버스당 근접(1)+도착(최대 2) TAGO 콜, 각 fast-fail(timeout 3, 재시도 X).
실시간 정확도보다 빠른 폴백 우선.
"""
import os

import requests

from apps.trips.services.tago_client import get_arrivals

_PRXMT_URL = "http://apis.data.go.kr/1613000/BusSttnInfoInqireService/getCrdntPrxmtSttnList"


def _nearby_nodes(lat: float, lng: float, n: int = 3) -> list[dict]:
    """좌표 → 가까운 정류소들 [{nodeid, citycode}]. 실패 시 빈 리스트."""
    try:
        r = requests.get(
            f"{_PRXMT_URL}?serviceKey={os.getenv('TAGO_API_KEY')}",
            params={"gpsLati": lat, "gpsLong": lng, "numOfRows": n, "pageNo": 1, "_type": "json"},
            timeout=3,
        )
        r.raise_for_status()
        items = r.json()["response"]["body"]["items"]["item"]
        items = items if isinstance(items, list) else [items]
        return [{"nodeid": it["nodeid"], "citycode": str(it["citycode"])} for it in items if it.get("nodeid")]
    except Exception:
        return []


def _norm(no) -> str:
    """노선명 정규화: ODsay 'B7(굿모닝병원)' ↔ TAGO 'B7' 매칭 위해 괄호 설명 제거."""
    return str(no or "").split("(")[0].strip()


def realtime_wait(lat: float, lng: float, bus_no) -> int | None:
    """근접 정류소들에서 해당 노선의 다음 도착(분). 실패/미발견 시 None."""
    target = _norm(bus_no)
    if not target or lat is None or lng is None:
        return None
    for node in _nearby_nodes(lat, lng)[:3]:
        try:
            arrivals = get_arrivals(node["citycode"], node["nodeid"])
        except Exception:
            continue
        for a in arrivals:
            if _norm(a["route_name"]) == target:
                return a["minutes"]
    return None


if __name__ == "__main__":
    # 노선명 정규화 매칭 (ODsay ↔ TAGO 표기 차이) 자체 점검
    assert _norm("B7(굿모닝병원)") == "B7"
    assert _norm("272(공영버스)") == "272"
    assert _norm(" 1000 ") == "1000"
    assert _norm(None) == ""
    print("bus_wait norm ok")
