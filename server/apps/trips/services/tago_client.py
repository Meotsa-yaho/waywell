"""TAGO 버스도착정보 클라이언트 (국토부, data.go.kr).

정류소(nodeId) 기준 다음 버스 도착 예정. route_id 주면 해당 노선만 필터.
반환은 API 명세서 Arrival 스키마의 arrivals[] 형태로 정규화한다.
"""
import math
import os

import requests

_URL = "http://apis.data.go.kr/1613000/ArvlInfoInqireService/getSttnAcctoArvlPrearngeInfoList"


def _as_list(items) -> list:
    """data.go.kr은 항목 1개면 dict, 여러 개면 list로 준다 → 항상 list."""
    if not items:
        return []
    return items if isinstance(items, list) else [items]


def get_arrivals(city_code: str, node_id: str, route_id: str | None = None) -> list[dict]:
    """정류소 도착 예정 목록. 실패 시 예외.

    arrtime(초) → minutes(올림). corrected=False(원값 그대로), raw_minutes 동일.
    """
    r = requests.get(
        f"{_URL}?serviceKey={os.getenv('TAGO_API_KEY')}",
        params={"cityCode": city_code, "nodeId": node_id, "numOfRows": 20, "pageNo": 1, "_type": "json"},
        timeout=6,
    )
    r.raise_for_status()
    items = _as_list(r.json().get("response", {}).get("body", {}).get("items", {}).get("item"))
    if route_id:
        items = [it for it in items if str(it.get("routeid")) == str(route_id)]
    items.sort(key=lambda it: it.get("arrtime", 10**9))
    return [
        {
            "seq": i + 1,
            "minutes": max(0, math.ceil(int(it["arrtime"]) / 60)),
            "raw_minutes": max(0, math.ceil(int(it["arrtime"]) / 60)),
            "corrected": False,
            "vehicle_id": None,
            "route_name": str(it.get("routeno", "")),
            "route_id": str(it.get("routeid", "")),
            "stations_left": it.get("arrprevstationcnt"),
        }
        for i, it in enumerate(items)
    ]


if __name__ == "__main__":
    # 문서 샘플 정류소(세종 송강전통시장)로 스모크 체크
    from pathlib import Path
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parents[3] / ".env")
    out = get_arrivals("25", "DJB8001793")
    assert out and all(a["minutes"] >= 0 and a["seq"] == i + 1 for i, a in enumerate(out)), out
    print("ok", len(out), "arrivals; first:", out[0])
