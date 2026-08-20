"""B-09 LLM 추천 설명 — 경로 비교 JSON을 자연어 1~2문장으로.

원칙
  1) 숫자는 만들어내지 않는다. 프롬프트에 넣은 값(분·점수·지수)만 쓰게 하고,
     길이·형식이 어긋난 응답은 버리고 템플릿으로 대체한다.
  2) LLM은 '있으면 좋은 것'이다. 키 미설정·쿼터 소진·타임아웃 어디서 실패해도
     템플릿 문구로 같은 모양의 응답을 돌려준다(generated_by로 구분).
  3) 경로 N개를 한 번의 호출로 처리한다. 경로마다 호출하면 비용·지연이 N배.

이 모듈은 Django에 의존하지 않는다(순수 함수) → test_explain.py 단독 실행 가능.
"""
import json
import logging

from .openai_client import LLMUnavailable, chat_json, is_configured

_log = logging.getLogger("routes.explain")

MAX_LEN = 80  # 카드 위 한 줄 배너 — 넘어가면 UI가 깨진다(RouteCandidatesView 11px 배너)
MAX_ROUTES = 5  # 프론트가 주는 후보는 3~4개. 상한을 둬 프롬프트 크기를 고정.

PRESET_LABEL = {
    "normal": "일반",
    "skin": "민감성 피부(자외선에 민감)",
    "respiratory": "호흡기 주의(미세먼지에 민감)",
    "heat": "더위 주의",
}
# 프리셋별로 강조할 환경 성분 — 템플릿 폴백에서 어떤 수치를 언급할지 고른다.
PRESET_FOCUS = {"skin": "uv", "respiratory": "air", "heat": "heat"}

SYSTEM_PROMPT = """너는 대중교통 경로를 골라주는 한국어 웰니스 내비게이션 코치다.
사용자가 야외 노출(자외선·더위·미세먼지)을 줄이도록 경로마다 짧은 코멘트를 쓴다.

규칙:
- 각 경로당 한국어 1~2문장, 공백 포함 80자 이내. 존댓말(~예요/~해요).
- 반드시 입력의 구체적 수치(분·지수·점수)를 최소 1개 인용한다. 두루뭉술한 형용사만 쓰지 않는다.
- 입력 JSON에 있는 숫자만 사용한다. 없는 수치를 지어내지 않는다.
- 경로끼리 비교해서 차이를 짚는다. recommended=true면 '왜 이걸 고르는지'(다른 경로 대비 몇 분 이득),
  나머지는 '감수할 점'(몇 분 더 걸림 / 야외 몇 분 더 많음)을 쓴다.
- 사용자 프리셋(민감성 피부/호흡기/더위)에 해당하면 그 성분을 우선 언급한다.
- 문장을 '이 경로는'으로 시작하지 않는다. 경로마다 다른 표현을 쓴다.
- 이모지, 마크다운, 줄바꿈, 따옴표 금지. 인사말·사족 금지.

좋은 예:
  "자외선 지수 8 — 6분 늦지만 야외 노출이 11분 적은 지하철 경로를 추천해요."
  "가장 빠르지만 환승 대기 18분이 모두 뙤약볕이에요."
  "노출은 가장 적지만 6분 더 걸려요."
나쁜 예(수치 없음·중복 표현):
  "이 경로는 자외선 노출이 적어 민감성 피부에 좋아요."

출력은 JSON 객체 하나: {"comments": {"<route_id>": "<문장>", ...}}
입력에 있는 모든 route_id를 빠짐없이 포함한다."""


# ---------- 입력 압축 ----------

def _segment_digest(segments: list[dict]) -> dict:
    """구간 배열에서 문구에 쓸 만한 것만 추린다(전체를 넣으면 토큰만 커진다)."""
    lines, walk_min, wait_max, wait_station = [], 0, 0, None
    for s in segments or []:
        t = s.get("type")
        if t in ("subway", "bus"):
            name = s.get("line") or s.get("route_name")
            if name and name not in lines:
                lines.append(name)
        elif t == "walk":
            walk_min += s.get("minutes") or 0
        elif t == "bus_wait":
            m = s.get("minutes") or 0
            if m > wait_max:
                wait_max, wait_station = m, s.get("station")
    d: dict = {"lines": lines[:4], "walk_minutes": walk_min}
    if wait_max:
        d["max_bus_wait_minutes"] = wait_max
        if wait_station:
            d["max_bus_wait_station"] = wait_station
    return d


def compact_routes(routes: list[dict]) -> list[dict]:
    """GET /api/routes 응답의 route 객체 → 프롬프트용 최소 필드."""
    out = []
    for r in routes[:MAX_ROUTES]:
        out.append({
            "route_id": r.get("route_id"),
            "recommended": bool(r.get("recommended")),
            "total_minutes": r.get("total_minutes"),
            "outdoor_minutes": r.get("outdoor_minutes"),
            "exposure_load": r.get("exposure_load"),
            "exposure_breakdown": r.get("exposure_breakdown"),
            "transfers": r.get("transfers"),
            **_segment_digest(r.get("segments") or []),
        })
    return out


def build_user_prompt(routes: list[dict], env: dict, preset: str) -> str:
    payload = {
        "preset": PRESET_LABEL.get(preset, PRESET_LABEL["normal"]),
        "environment": {
            "uv_index": env.get("uv"),
            "feels_like_c": env.get("feels_like"),
            "pm10_grade": env.get("pm10_grade"),
            "precipitation": env.get("precipitation"),
        },
        "routes": compact_routes(routes),
        "note": "exposure_load는 0~100 야외 노출 부하 점수이며 낮을수록 좋다.",
    }
    return json.dumps(payload, ensure_ascii=False)


def fingerprint(routes: list[dict], env: dict, preset: str) -> str:
    """캐시 키용 정규화 문자열 — 경로 순서만 바뀐 요청은 같은 값이 나온다.

    프론트의 정렬 토글(추천순/노출순/시간순)은 같은 경로를 순서만 바꿔 다시 보낸다.
    순서를 그대로 해싱하면 토글할 때마다 유료 호출이 발생한다.
    """
    body = {
        "preset": preset,
        "env": [env.get(k) for k in ("uv", "feels_like", "pm10_grade", "precipitation")],
        "routes": sorted(compact_routes(routes), key=lambda r: r["route_id"] or ""),
    }
    return json.dumps(body, ensure_ascii=False, sort_keys=True)


# ---------- 출력 검증 ----------

def _clean(text) -> str | None:
    """모델이 뭘 주든 배너에 넣어도 안전한 한 줄로. 규격 밖이면 None(→ 템플릿 대체)."""
    if not isinstance(text, str):
        return None
    t = " ".join(text.split()).strip().strip('"').strip("'")
    if not t or len(t) > MAX_LEN:
        return None
    return t


def parse_comments(raw: dict, route_ids: list[str]) -> dict[str, str]:
    """{"comments": {...}} 또는 {route_id: ...} 둘 다 받아준다. 모르는 키는 버린다."""
    body = raw.get("comments") if isinstance(raw.get("comments"), dict) else raw
    if not isinstance(body, dict):
        return {}
    out = {}
    for rid in route_ids:
        c = _clean(body.get(rid))
        if c:
            out[rid] = c
    return out


# ---------- 템플릿 폴백 ----------

def _env_prefix(env: dict, preset: str) -> str:
    """지금 환경이 실제로 나쁠 때만 근거 수치를 앞에 붙인다(평범하면 군더더기)."""
    focus = PRESET_FOCUS.get(preset)
    uv, feels, grade = env.get("uv"), env.get("feels_like"), env.get("pm10_grade")
    if env.get("precipitation") not in (None, "none"):
        return "비가 내리고 있어요 — "
    if uv is not None and (uv >= 8 or (focus == "uv" and uv >= 6)):
        return f"자외선 지수 {round(uv)} — "
    if grade in ("나쁨", "매우나쁨") and focus in (None, "air"):
        return f"미세먼지 {grade} — "
    if feels is not None and (feels >= 33 or (focus == "heat" and feels >= 30)):
        return f"체감 {round(feels)}도 — "
    return ""


def template_comments(routes: list[dict], env: dict, preset: str) -> dict[str, str]:
    """LLM 없이도 화면이 비지 않게 하는 규칙 기반 문구. 수치는 전부 계산된 값."""
    if not routes:
        return {}
    fastest = min(routes, key=lambda r: r.get("total_minutes") or 0)
    lowest = min(routes, key=lambda r: r.get("exposure_load") or 0)
    prefix = _env_prefix(env, preset)

    out = {}
    for r in routes:
        rid = r.get("route_id")
        if not rid:
            continue
        outdoor = r.get("outdoor_minutes") or 0
        total = r.get("total_minutes") or 0
        d_time = total - (fastest.get("total_minutes") or 0)
        d_out = outdoor - (lowest.get("outdoor_minutes") or 0)

        if r.get("recommended"):
            if rid == fastest.get("route_id") and rid == lowest.get("route_id"):
                body = f"가장 빠르면서 야외 노출도 {outdoor}분으로 가장 적은 경로예요."
            elif rid == lowest.get("route_id"):
                body = f"야외 노출이 {outdoor}분으로 가장 적어요."
                if d_time > 0:
                    body += f" 최속 경로보다 {d_time}분 더 걸려요."
            else:
                body = f"{total}분에 야외 {outdoor}분 — 시간과 노출의 균형이 가장 좋아요."
        elif rid == fastest.get("route_id"):
            body = f"가장 빠르지만 야외 노출이 {outdoor}분이에요."
        elif rid == lowest.get("route_id"):
            body = f"노출은 가장 적지만 {d_time}분 더 걸려요." if d_time > 0 else f"야외 노출이 {outdoor}분으로 가장 적어요."
        else:
            body = f"{total}분 걸리고 야외 노출은 {outdoor}분이에요."
            if d_out > 0:
                body = f"{total}분 걸리고 야외 노출이 {d_out}분 더 많아요."

        text = f"{prefix}{body}" if r.get("recommended") else body
        out[rid] = text if len(text) <= MAX_LEN else body
    return out


# ---------- 진입점 ----------

def explain_routes(routes: list[dict], env: dict, preset: str) -> tuple[dict[str, str], str]:
    """(comments, generated_by) 반환. generated_by: 'llm' | 'template'.

    LLM이 일부 경로만 채워줘도 나머지는 템플릿으로 메운다(빈 배너 방지).
    """
    fallback = template_comments(routes, env, preset)
    if not routes or not is_configured():
        return fallback, "template"

    route_ids = [r["route_id"] for r in routes[:MAX_ROUTES] if r.get("route_id")]
    try:
        raw = chat_json(SYSTEM_PROMPT, build_user_prompt(routes, env, preset))
    except LLMUnavailable as e:
        _log.warning("LLM 설명 실패 → 템플릿 폴백: %s", e)
        return fallback, "template"

    comments = parse_comments(raw, route_ids)
    if not comments:
        _log.warning("LLM 응답에 쓸 수 있는 문구가 없음 → 템플릿 폴백")
        return fallback, "template"
    return {**fallback, **comments}, "llm"
