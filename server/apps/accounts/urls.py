from django.urls import path

from .views import SignupView, LoginView, KakaoLoginView, MeView

app_name = 'accounts'

urlpatterns = [
    path('auth/signup/', SignupView.as_view(), name='signup'),
    path('auth/login/', LoginView.as_view(), name='login'),
    path('auth/kakao/', KakaoLoginView.as_view(), name='kakao'),
    path('me/', MeView.as_view(), name='me'),
]
