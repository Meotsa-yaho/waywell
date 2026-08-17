from django.http import JsonResponse
from django.urls import path
from django.views.decorators.csrf import csrf_exempt

app_name = 'notifications'


# C-07 Web Push 미구현 — 호출돼도 500(None 반환) 대신 501로 명확히 응답.
# API 엔드포인트라 CSRF 면제(다른 DRF 뷰와 동일).
@csrf_exempt
def _not_implemented(request):
    return JsonResponse({"detail": "웹 푸시 구독은 준비 중이에요."}, status=501)


urlpatterns = [
    path('push/subscribe/', _not_implemented, name='subscribe'),
]
