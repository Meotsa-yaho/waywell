"""카카오 로그인 (A-09) — 인가 코드 → 카카오 사용자 정보."""
import logging
import os

import requests

_TOKEN_URL = "https://kauth.kakao.com/oauth/token"
_USER_URL = "https://kapi.kakao.com/v2/user/me"
_log = logging.getLogger("kakao")


def exchange_code(code: str, redirect_uri: str) -> dict:
    """인가 코드로 액세스 토큰 교환 → 사용자 정보 {kakao_id, email, nickname}. 실패 시 예외."""
    data = {
        "grant_type": "authorization_code",
        "client_id": os.getenv("KAKAO_REST_API_KEY"),
        "redirect_uri": redirect_uri,
        "code": code,
    }
    secret = os.getenv("KAKAO_CLIENT_SECRET")  # 콘솔에서 Client Secret '사용함'이면 필수
    if secret:
        data["client_secret"] = secret

    r = requests.post(_TOKEN_URL, data=data, timeout=6)
    if r.status_code != 200:
        _log.error("kakao token exchange failed: %s %s (redirect_uri=%s)", r.status_code, r.text, redirect_uri)
        raise RuntimeError(f"kakao token {r.status_code}: {r.text}")
    access = r.json()["access_token"]

    u = requests.get(_USER_URL, headers={"Authorization": f"Bearer {access}"}, timeout=6)
    u.raise_for_status()
    data = u.json()
    account = data.get("kakao_account", {})
    return {
        "kakao_id": str(data["id"]),
        "email": account.get("email"),
        "nickname": account.get("profile", {}).get("nickname", ""),
    }
