"""OpenAI Chat Completions 얇은 래퍼 — B-09 LLM 추천 설명 전용.

프로젝트의 다른 외부 연동(kakao_local·kma_client 등)과 같이 requests로만 호출한다.
openai SDK를 넣지 않는 이유: 의존성 1개(+전이 의존성)를 늘릴 만큼 쓰는 기능이 없고,
requirements.txt를 얇게 유지해야 EC2 배포·pip-audit이 단순하다.
"""
import json
import logging
import os

import requests

_log = logging.getLogger("routes.openai")

_URL = "https://api.openai.com/v1/chat/completions"
_DEFAULT_MODEL = "gpt-4o-mini"  # 문장 2개 생성용 — 싼 모델로 충분. OPENAI_MODEL로 교체 가능.
_TIMEOUT = 8  # 경로 목록은 이미 그려진 뒤 채워 넣는 문구라 오래 기다릴 이유가 없다.


class LLMUnavailable(RuntimeError):
    """키 미설정·타임아웃·상태코드 오류 — 호출부는 템플릿 폴백으로 넘어간다."""


def is_configured() -> bool:
    return bool(os.getenv("OPENAI_API_KEY"))


def chat_json(system: str, user: str, *, max_tokens: int = 400) -> dict:
    """JSON 모드로 한 번 호출하고 파싱된 dict를 반환. 실패는 전부 LLMUnavailable."""
    key = os.getenv("OPENAI_API_KEY")
    if not key:
        raise LLMUnavailable("OPENAI_API_KEY 미설정")

    model = os.getenv("OPENAI_MODEL", _DEFAULT_MODEL)
    body: dict = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "response_format": {"type": "json_object"},
    }
    # gpt-5 / o 계열은 max_tokens를 거부(max_completion_tokens)하고 temperature=1만 허용한다.
    # 모델을 env로 바꿔 끼워도 400이 나지 않도록 파라미터를 모델에 맞춰 보낸다.
    if model.startswith(("gpt-5", "o1", "o3", "o4")):
        body["max_completion_tokens"] = max_tokens
    else:
        body["max_tokens"] = max_tokens
        body["temperature"] = 0.4  # 문구가 매번 크게 흔들리면 데모에서 불안 → 낮게

    try:
        r = requests.post(
            _URL,
            json=body,
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            timeout=_TIMEOUT,
        )
    except requests.RequestException as e:
        raise LLMUnavailable(f"요청 실패: {e}") from e

    if r.status_code != 200:
        # 429(쿼터/레이트리밋)·401(키 오류)이 대부분. 본문은 앞부분만 남긴다(키 노출 방지).
        raise LLMUnavailable(f"HTTP {r.status_code}: {r.text[:200]}")

    try:
        content = r.json()["choices"][0]["message"]["content"]
        return json.loads(content)
    except (KeyError, IndexError, ValueError, TypeError) as e:
        raise LLMUnavailable(f"응답 파싱 실패: {e}") from e
