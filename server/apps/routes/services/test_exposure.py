"""노출부하 엔진 자체 검증. 실행: python apps/routes/services/test_exposure.py"""
from exposure import calc_exposure_load

MILD = {"uv": 2, "feels_like": 23, "pm10": 30}
HOT = {"uv": 9, "feels_like": 35, "pm10": 40}
DUSTY = {"uv": 3, "feels_like": 24, "pm10": 140}

BUS = [  # 야외 18분
    {"outdoor": True, "minutes": 6}, {"outdoor": True, "minutes": 8},
    {"outdoor": False, "minutes": 38}, {"outdoor": True, "minutes": 4},
]
SUBWAY = [  # 야외 7분
    {"outdoor": True, "minutes": 4}, {"outdoor": False, "minutes": 3},
    {"outdoor": False, "minutes": 22}, {"outdoor": True, "minutes": 3},
    {"outdoor": False, "minutes": 25}, {"outdoor": False, "minutes": 5},
]
INDOOR = [{"outdoor": False, "minutes": 40}]


def test_breakdown_sums_to_score():
    r = calc_exposure_load(BUS, HOT, "skin")
    b = r["breakdown"]
    assert b["uv"] + b["heat"] + b["air"] == r["score"]


def test_more_outdoor_higher_score():
    assert calc_exposure_load(BUS, HOT, "normal")["score"] > calc_exposure_load(SUBWAY, HOT, "normal")["score"]


def test_indoor_only_zero():
    assert calc_exposure_load(INDOOR, HOT, "skin")["score"] == 0


def test_skin_preset_amplifies_uv():
    # 자외선 높을 때 피부 프리셋이 일반보다 점수가 높아야
    assert calc_exposure_load(BUS, HOT, "skin")["score"] > calc_exposure_load(BUS, HOT, "normal")["score"]


def test_respiratory_preset_amplifies_pm():
    assert calc_exposure_load(BUS, DUSTY, "respiratory")["score"] > calc_exposure_load(BUS, DUSTY, "normal")["score"]


def test_weather_changes_score():
    # 같은 경로라도 폭염이면 점수가 오른다 (킬러 장면 근거)
    assert calc_exposure_load(BUS, HOT, "skin")["score"] > calc_exposure_load(BUS, MILD, "skin")["score"]


def test_score_capped():
    huge = [{"outdoor": True, "minutes": 300}]
    assert calc_exposure_load(huge, HOT, "skin")["score"] <= 100


if __name__ == "__main__":
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            fn()
            print(f"  ok  {name}")
    print("all passed")
