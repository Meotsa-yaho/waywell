"""JWT 발급/검증 (A-06). 서명키는 Django SECRET_KEY 재사용."""
from datetime import datetime, timedelta, timezone

import jwt
from django.conf import settings

_ALG = "HS256"
_TTL_DAYS = 30


def make_token(account_id) -> str:
    payload = {"sub": str(account_id), "exp": datetime.now(timezone.utc) + timedelta(days=_TTL_DAYS)}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=_ALG)


def decode_token(token: str) -> str | None:
    """유효하면 account_id(sub), 아니면 None."""
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[_ALG]).get("sub")
    except jwt.PyJWTError:
        return None
