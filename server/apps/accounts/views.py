"""회원가입·로그인·카카오 로그인·프로필 (A-05/06/09, /me)."""
from django.contrib.auth.hashers import check_password, make_password
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from rest_framework.views import APIView
from rest_framework.response import Response

from apps.common.response import error_response
from apps.trips.models import Trip
from .models import Account
from .services import jwt_util, kakao_auth


def account_from_request(request):
    """Authorization: Bearer <jwt> → Account 또는 None."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    aid = jwt_util.decode_token(auth[7:])
    return Account.objects.filter(id=aid).first() if aid else None


def _me(account) -> dict:
    return {"id": str(account.id), "type": "user", "email": account.email,
            "preset": account.preset, "created_at": account.created_at.isoformat()}


def _auth_response(account, request) -> Response:
    """JWT + user + 게스트 데이터 이관(A-07): 이 기기 게스트 기록을 계정으로."""
    device_id = request.headers.get("X-Device-Id")
    migrated = 0
    if device_id:
        if not account.device_id:
            account.device_id = device_id
            account.save(update_fields=["device_id"])
        migrated = Trip.objects.filter(device_id=device_id, account__isnull=True).update(account=account)
    trip_count = Trip.objects.filter(account=account).count()
    return Response({
        "access_token": jwt_util.make_token(account.id),
        "user": {"id": str(account.id), "email": account.email, "preset": account.preset},
        "migration": {"migrated": migrated > 0, "trip_count": trip_count},
    })


class SignupView(APIView):
    def post(self, request):
        email = (request.data.get("email") or "").strip().lower()
        password = request.data.get("password") or ""
        if not email:
            return error_response("VALIDATION_ERROR", "이메일이 필요해요.", 400)
        try:
            validate_password(password)  # Django 검증기(길이·흔한비번·숫자전용 등)
        except ValidationError as e:
            return error_response("WEAK_PASSWORD", " ".join(e.messages), 400)
        if Account.objects.filter(email=email).exists():
            return error_response("EMAIL_TAKEN", "이미 가입된 이메일이에요.", 409)
        account = Account.objects.create(
            email=email, password=make_password(password),
            preset=request.data.get("preset", "normal"),
        )
        return _auth_response(account, request)


class LoginView(APIView):
    def post(self, request):
        email = (request.data.get("email") or "").strip().lower()
        password = request.data.get("password") or ""
        account = Account.objects.filter(email=email).first()
        if not account or not account.password or not check_password(password, account.password):
            return error_response("INVALID_CREDENTIALS", "이메일 또는 비밀번호가 올바르지 않아요.", 401)
        return _auth_response(account, request)


class KakaoLoginView(APIView):
    def post(self, request):
        code = request.data.get("code")
        redirect_uri = request.data.get("redirect_uri")
        if not code or not redirect_uri:
            return error_response("VALIDATION_ERROR", "카카오 인가 코드가 필요해요.", 400)
        try:
            info = kakao_auth.exchange_code(code, redirect_uri)
        except Exception:
            return error_response("KAKAO_AUTH_FAILED", "카카오 로그인에 실패했어요. 잠시 후 다시 시도해주세요.", 401)

        account = Account.objects.filter(kakao_id=info["kakao_id"]).first()
        if not account:
            email = info.get("email")
            if email and Account.objects.filter(email=email).exists():
                email = None  # 이미 이메일 계정이 있으면 충돌 회피 (카카오는 kakao_id로 식별)
            account = Account.objects.create(kakao_id=info["kakao_id"], email=email,
                                             nickname=info.get("nickname", ""))
        return _auth_response(account, request)


class MeView(APIView):
    def get(self, request):
        account = account_from_request(request)
        if account:
            return Response(_me(account))
        # 비로그인 = 게스트
        return Response({"id": request.headers.get("X-Device-Id") or "guest", "type": "guest",
                         "email": None, "preset": "normal", "created_at": None})

    def patch(self, request):
        account = account_from_request(request)
        if not account:
            return error_response("UNAUTHORIZED", "로그인이 필요해요.", 401)
        preset = request.data.get("preset")
        if preset:
            account.preset = preset
            account.save(update_fields=["preset"])
        return Response(_me(account))

    def delete(self, request):
        """회원 탈퇴 (A-08). 계정·이동기록 전체 삭제(FK CASCADE)."""
        account = account_from_request(request)
        if not account:
            return error_response("UNAUTHORIZED", "로그인이 필요해요.", 401)
        account.delete()
        return Response({"deleted": True})
