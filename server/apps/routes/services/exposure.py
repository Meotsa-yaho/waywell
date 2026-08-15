"""노출부하 엔진 v1 — 기능명세서 6장. 순수 룰 기반(ML 아님).

노출부하 = Σ_구간 (야외시간 × 환경강도 × 프리셋가중치)
환경강도 = w1·UV정규화 + w2·체감온도부담 + w3·미세먼지정규화
0~100 정규화. breakdown(uv/heat/air)의 합 = score (API 명세서 요건).
"""

# 환경 성분 가중치 (튜닝 대상 — 담당 조아람 확정 전 v1 상수)
W_UV, W_HEAT, W_AIR = 0.5, 0.3, 0.2
# 0~100 스케일 상수 (야외 ~30분 극한조건 ≈ 90점 되도록)
SCALE = 2.5

# 프리셋별 성분 가중치 (기능명세서 3장)
PRESET_WEIGHTS = {
    "normal": {"uv": 1.0, "heat": 1.0, "air": 1.0},
    "skin": {"uv": 1.5, "heat": 1.0, "air": 1.0},
    "respiratory": {"uv": 1.0, "heat": 1.0, "air": 1.5},
}


def _uv_norm(uv):
    return min(uv / 11.0, 1.0) if uv is not None else 0.0


def _heat_norm(feels):
    # 체감온도 24℃(쾌적)~38℃(극한) 사이를 0~1로. 더위 부담만 본다(여름 v1).
    if feels is None:
        return 0.0
    return max(0.0, min((feels - 24.0) / 14.0, 1.0))


def _air_norm(pm10):
    return min(pm10 / 150.0, 1.0) if pm10 is not None else 0.0  # 150+ = 매우나쁨


def env_severity(env: dict) -> float:
    """환경 심각도 0~1. 추천(시간 vs 노출) 균형에 쓴다 — 클수록 노출을 더 중시."""
    return W_UV * _uv_norm(env.get("uv")) + W_HEAT * _heat_norm(env.get("feels_like")) + W_AIR * _air_norm(env.get("pm10"))


def calc_exposure_load(segments: list[dict], env: dict, preset: str) -> dict:
    """segments: [{outdoor: bool, minutes: int}], env: {uv, feels_like, pm10}

    반환: {"score": int, "breakdown": {"uv": int, "heat": int, "air": int},
           "outdoor_minutes": int}
    """
    pw = PRESET_WEIGHTS.get(preset, PRESET_WEIGHTS["normal"])
    uv_i = _uv_norm(env.get("uv"))
    heat_i = _heat_norm(env.get("feels_like"))
    air_i = _air_norm(env.get("pm10"))

    outdoor_min = sum(s["minutes"] for s in segments if s.get("outdoor"))

    raw_uv = outdoor_min * W_UV * uv_i * pw["uv"]
    raw_heat = outdoor_min * W_HEAT * heat_i * pw["heat"]
    raw_air = outdoor_min * W_AIR * air_i * pw["air"]

    uv_p, heat_p, air_p = raw_uv * SCALE, raw_heat * SCALE, raw_air * SCALE
    total = uv_p + heat_p + air_p
    if total > 100.0:  # 0~100 클램프 (성분 비율 유지)
        f = 100.0 / total
        uv_p, heat_p, air_p = uv_p * f, heat_p * f, air_p * f

    uv_s, heat_s, air_s = round(uv_p), round(heat_p), round(air_p)
    return {
        "score": uv_s + heat_s + air_s,
        "breakdown": {"uv": uv_s, "heat": heat_s, "air": air_s},
        "outdoor_minutes": outdoor_min,
    }
