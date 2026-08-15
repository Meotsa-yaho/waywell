"""공통 응답 헬퍼 — API 명세서 2장 에러 포맷 통일."""
from rest_framework.response import Response


def error_response(code: str, message: str, status: int, detail=None) -> Response:
    """모든 4xx·5xx를 동일 형태로 내려준다.

    { "error": { "code", "message", "detail" } }
    message는 사용자에게 그대로 노출 가능한 한국어 문구.
    """
    return Response(
        {"error": {"code": code, "message": message, "detail": detail}},
        status=status,
    )
