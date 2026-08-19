from django.urls import path

from .views import KakaoLoginView, MeView

app_name = 'accounts'

urlpatterns = [
    path('auth/kakao/', KakaoLoginView.as_view(), name='kakao'),
    path('me/', MeView.as_view(), name='me'),
]

