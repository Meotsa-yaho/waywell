"""주간 리포트 집계 (D-01 오늘요약 / D-02 주간그래프 / D-03 전주대비)."""
from datetime import timedelta

from django.utils import timezone

from ..models import Trip

_FIELDS = ("outdoor_minutes", "exposure_load", "uv_minutes")


def _empty_day(date_iso: str) -> dict:
    return {"date": date_iso, "outdoor_minutes": 0, "exposure_load": 0, "uv_minutes": 0, "trip_count": 0}


def _bucket(trips, days: list) -> dict[str, dict]:
    """완료 트립을 날짜별(KST)로 합산."""
    buckets = {d.isoformat(): _empty_day(d.isoformat()) for d in days}
    for t in trips:
        d = timezone.localtime(t.started_at).date().isoformat()
        if d in buckets:
            b = buckets[d]
            for f in _FIELDS:
                b[f] += getattr(t, f)
            b["trip_count"] += 1
    return buckets


def _sum(days_data: list, field: str) -> int:
    return sum(d[field] for d in days_data)


def _pct(cur: int, prev: int):
    if not prev:
        return None
    return round((cur - prev) / prev * 100)


def _coaching(today: dict, uv_change) -> str:
    if today["trip_count"] == 0:
        return "오늘은 아직 이동 기록이 없어요. 외출 시 노출 부하를 확인해보세요."
    if uv_change is not None and uv_change < 0:
        return f"이번 주 UV 노출이 지난주보다 {abs(uv_change)}% 줄었어요. 잘하고 있어요!"
    if today["outdoor_minutes"] >= 30:
        return f"오늘 야외 {today['outdoor_minutes']}분 노출됐어요. 자외선 차단제를 챙기세요."
    return "실내 위주로 잘 이동했어요. 이 페이스를 유지해보세요."


def weekly_report(device_id: str | None) -> dict:
    now = timezone.localtime()
    today = now.date()
    this_days = [today - timedelta(days=i) for i in range(6, -1, -1)]     # 최근 7일
    prev_days = [today - timedelta(days=i) for i in range(13, 6, -1)]     # 그 전 7일

    if not device_id:
        daily = [_empty_day(d.isoformat()) for d in this_days]
        return {
            "period": {"start": this_days[0].isoformat(), "end": today.isoformat()},
            "today": daily[-1], "daily": daily,
            "comparison": {"previous_period": {"start": prev_days[0].isoformat(), "end": prev_days[-1].isoformat()},
                           "uv_minutes_change_pct": None, "outdoor_minutes_change_pct": None, "exposure_load_change_pct": None},
            "coaching": _coaching(daily[-1], None), "is_guest": True, "has_data": False,
        }

    start = this_days[0]
    trips = Trip.objects.filter(device_id=device_id, status="completed",
                                started_at__gte=timezone.make_aware(
                                    timezone.datetime.combine(prev_days[0], timezone.datetime.min.time())))
    this_b = _bucket(trips, this_days)
    prev_b = _bucket(trips, prev_days)
    daily = [this_b[d.isoformat()] for d in this_days]
    prev_daily = [prev_b[d.isoformat()] for d in prev_days]
    today_data = daily[-1]

    uv_change = _pct(_sum(daily, "uv_minutes"), _sum(prev_daily, "uv_minutes"))
    return {
        "period": {"start": start.isoformat(), "end": today.isoformat()},
        "today": today_data,
        "daily": daily,
        "comparison": {
            "previous_period": {"start": prev_days[0].isoformat(), "end": prev_days[-1].isoformat()},
            "uv_minutes_change_pct": uv_change,
            "outdoor_minutes_change_pct": _pct(_sum(daily, "outdoor_minutes"), _sum(prev_daily, "outdoor_minutes")),
            "exposure_load_change_pct": _pct(_sum(daily, "exposure_load"), _sum(prev_daily, "exposure_load")),
        },
        "coaching": _coaching(today_data, uv_change),
        "is_guest": True,
        "has_data": _sum(daily, "trip_count") > 0,
    }
