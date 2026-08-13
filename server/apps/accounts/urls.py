from django.urls import path

app_name = 'accounts'

urlpatterns = [
    path('auth/signup/', lambda request: None, name='signup'),
    path('auth/login/', lambda request: None, name='login'),
    path('me/', lambda request: None, name='me'),
]