"""B-09 설명 생성 자체 검증(외부 호출 없음). 실행: python apps/routes/services/test_explain.py"""
import os
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[3]))  # server/ 를 import 경로에
os.environ.pop("OPENAI_API_KEY", None)  # 폴백 경로를 결정적으로 검증 (실 호출 방지)

from apps.routes.services import explain  # noqa: E402

HOT = {"uv": 9, "feels_like": 35, "pm10_grade": "보통", "precipitation": "none"}
MILD = {"uv": 2, "feels_like": 23, "pm10_grade": "좋음", "precipitation": "none"}

ROUTES = [
    {  # 추천 = 노출 최소, 대신 6분 느림
        "route_id": "r_0", "recommended": True, "total_minutes": 44, "outdoor_minutes": 7,
        "exposure_load": 21, "exposure_breakdown": {"uv": 12, "heat": 6, "air": 3}, "transfers": 1,
        "polyline": [[37.1, 127.1]] * 500,
        "segments": [
            {"type": "walk", "minutes": 4, "outdoor": True},
            {"type": "subway", "minutes": 35, "line": "2호선", "outdoor": False},
            {"type": "walk", "minutes": 5, "outdoor": True},
        ],
    },
    {  # 최속, 대신 노출 큼
        "route_id": "r_1", "recommended": False, "total_minutes": 38, "outdoor_minutes": 18,
        "exposure_load": 52, "exposure_breakdown": {"uv": 30, "heat": 15, "air": 7}, "transfers": 0,
        "segments": [
            {"type": "bus_wait", "minutes": 12, "station": "송강전통시장", "outdoor": True},
            {"type": "bus", "minutes": 26, "route_name": "5100", "outdoor": False},
        ],
    },
    {
        "route_id": "r_2", "recommended": False, "total_minutes": 50, "outdoor_minutes": 12,
        "exposure_load": 35, "exposure_breakdown": {"uv": 20, "heat": 10, "air": 5}, "transfers": 2,
        "segments": [{"type": "walk", "minutes": 12, "outdoor": True}],
    },
]


def test_template_covers_every_route():
    c = explain.template_comments(ROUTES, HOT, "skin")
    assert set(c) == {"r_0", "r_1", "r_2"}, c


def test_template_within_banner_length():
    for env in (HOT, MILD):
        for preset in ("normal", "skin", "respiratory", "heat"):
            for rid, text in explain.template_comments(ROUTES, env, preset).items():
                assert 0 < len(text) <= explain.MAX_LEN, (preset, rid, len(text), text)


def test_template_flags_fastest_and_lowest():
    c = explain.template_comments(ROUTES, HOT, "normal")
    assert "가장 빠르" in c["r_1"], c["r_1"]      # r_1 = 최속
    assert "7분" in c["r_0"] or "가장 적" in c["r_0"], c["r_0"]  # r_0 = 노출 최소


def test_env_prefix_only_when_severe():
    assert explain.template_comments(ROUTES, HOT, "skin")["r_0"].startswith("자외선 지수 9")
    assert not explain.template_comments(ROUTES, MILD, "skin")["r_0"].startswith("자외선")


def test_compact_drops_heavy_fields():
    c = explain.compact_routes(ROUTES)[0]
    assert "polyline" not in c and "segments" not in c, c
    assert c["lines"] == ["2호선"] and c["walk_minutes"] == 9, c


def test_compact_digests_bus_wait():
    c = explain.compact_routes(ROUTES)[1]
    assert c["max_bus_wait_minutes"] == 12 and c["max_bus_wait_station"] == "송강전통시장", c


def test_compact_caps_route_count():
    many = [dict(ROUTES[0], route_id=f"r_{i}") for i in range(10)]
    assert len(explain.compact_routes(many)) == explain.MAX_ROUTES


def test_prompt_has_no_secrets_and_is_json():
    import json
    p = json.loads(explain.build_user_prompt(ROUTES, HOT, "skin"))
    assert p["environment"]["uv_index"] == 9 and len(p["routes"]) == 3


def test_parse_accepts_both_shapes():
    ids = ["r_0", "r_1"]
    wrapped = explain.parse_comments({"comments": {"r_0": "짧은 문구예요.", "r_1": "다른 문구예요."}}, ids)
    flat = explain.parse_comments({"r_0": "짧은 문구예요.", "r_1": "다른 문구예요."}, ids)
    assert wrapped == flat and len(wrapped) == 2


def test_parse_rejects_bad_values():
    ids = ["r_0", "r_1", "r_2"]
    out = explain.parse_comments({"r_0": "x" * 200, "r_1": 42, "r_2": "  줄바꿈\n정리돼요.  ", "r_9": "무시"}, ids)
    assert out == {"r_2": "줄바꿈 정리돼요."}, out


def test_no_key_falls_back_to_template():
    comments, by = explain.explain_routes(ROUTES, HOT, "skin")
    assert by == "template" and set(comments) == {"r_0", "r_1", "r_2"}


def test_llm_partial_result_is_filled_in():
    # LLM이 r_0만 채워줘도 나머지는 템플릿으로 메워야 한다.
    orig_cfg, orig_chat = explain.is_configured, explain.chat_json
    explain.is_configured = lambda: True
    explain.chat_json = lambda system, user, **kw: {"comments": {"r_0": "그늘 위주 경로예요."}}
    try:
        comments, by = explain.explain_routes(ROUTES, HOT, "skin")
    finally:
        explain.is_configured, explain.chat_json = orig_cfg, orig_chat
    assert by == "llm" and comments["r_0"] == "그늘 위주 경로예요."
    assert set(comments) == {"r_0", "r_1", "r_2"} and comments["r_1"]


def test_llm_failure_falls_back():
    from apps.routes.services.openai_client import LLMUnavailable
    orig_cfg, orig_chat = explain.is_configured, explain.chat_json

    def boom(*a, **kw):
        raise LLMUnavailable("429 quota")

    explain.is_configured, explain.chat_json = (lambda: True), boom
    try:
        comments, by = explain.explain_routes(ROUTES, HOT, "normal")
    finally:
        explain.is_configured, explain.chat_json = orig_cfg, orig_chat
    assert by == "template" and len(comments) == 3


# --- openai_client: 실제 HTTP는 가짜로 대체하고 요청 형태만 검증 ---

class _FakeResp:
    def __init__(self, status=200, payload=None, text=""):
        self.status_code, self._payload, self.text = status, payload, text

    def json(self):
        return self._payload


def _capture(status=200, content='{"comments": {"r_0": "문구예요."}}'):
    """requests.post를 가로채 (보낸 body, 응답) 을 돌려주는 가짜."""
    from apps.routes.services import openai_client
    sent = {}

    def fake_post(url, json=None, headers=None, timeout=None):
        sent.update(url=url, body=json, headers=headers, timeout=timeout)
        return _FakeResp(status, {"choices": [{"message": {"content": content}}]}, text="err body")

    openai_client.requests.post = fake_post
    return openai_client, sent


def test_client_sends_json_mode_and_max_tokens():
    from apps.routes.services import openai_client
    orig = openai_client.requests.post
    oc, sent = _capture()
    os.environ["OPENAI_API_KEY"] = "sk-test"
    os.environ["OPENAI_MODEL"] = "gpt-4o-mini"
    try:
        out = oc.chat_json("sys", "user")
    finally:
        openai_client.requests.post = orig
        os.environ.pop("OPENAI_API_KEY"), os.environ.pop("OPENAI_MODEL")
    assert out == {"comments": {"r_0": "문구예요."}}
    assert sent["body"]["response_format"] == {"type": "json_object"}
    assert "max_tokens" in sent["body"] and "max_completion_tokens" not in sent["body"]
    assert sent["headers"]["Authorization"] == "Bearer sk-test"


def test_client_switches_params_for_gpt5_family():
    # gpt-5/o 계열은 max_tokens·temperature를 거부한다 → 모델만 바꿔도 400이 나면 안 됨
    from apps.routes.services import openai_client
    orig = openai_client.requests.post
    oc, sent = _capture()
    os.environ["OPENAI_API_KEY"] = "sk-test"
    os.environ["OPENAI_MODEL"] = "gpt-5-mini"
    try:
        oc.chat_json("sys", "user")
    finally:
        openai_client.requests.post = orig
        os.environ.pop("OPENAI_API_KEY"), os.environ.pop("OPENAI_MODEL")
    assert "max_completion_tokens" in sent["body"], sent["body"]
    assert "max_tokens" not in sent["body"] and "temperature" not in sent["body"]


def test_client_raises_on_error_status():
    from apps.routes.services import openai_client
    orig = openai_client.requests.post
    oc, _ = _capture(status=429)
    os.environ["OPENAI_API_KEY"] = "sk-test"
    try:
        oc.chat_json("sys", "user")
    except oc.LLMUnavailable as e:
        assert "429" in str(e)
    else:
        raise AssertionError("429에서 LLMUnavailable이 나야 한다")
    finally:
        openai_client.requests.post = orig
        os.environ.pop("OPENAI_API_KEY")


def test_client_raises_without_key():
    from apps.routes.services import openai_client
    os.environ.pop("OPENAI_API_KEY", None)
    try:
        openai_client.chat_json("sys", "user")
    except openai_client.LLMUnavailable:
        return
    raise AssertionError("키 없으면 LLMUnavailable이 나야 한다")


def test_fingerprint_ignores_route_order():
    # 정렬 토글(추천순/노출순/시간순)은 같은 경로를 순서만 바꿔 보낸다 → 캐시가 살아야 함
    a = explain.fingerprint(ROUTES, HOT, "skin")
    b = explain.fingerprint(list(reversed(ROUTES)), HOT, "skin")
    assert a == b


def test_fingerprint_changes_with_preset_and_env():
    base = explain.fingerprint(ROUTES, HOT, "skin")
    assert base != explain.fingerprint(ROUTES, HOT, "respiratory")
    assert base != explain.fingerprint(ROUTES, MILD, "skin")


def test_empty_routes_safe():
    assert explain.explain_routes([], HOT, "normal") == ({}, "template")


if __name__ == "__main__":
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            fn()
            print(f"  ok  {name}")
    print("all passed")
