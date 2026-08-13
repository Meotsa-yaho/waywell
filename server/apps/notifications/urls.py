from django.urls import path

app_name = 'notifications'

urlpatterns = [
    path('push/subscribe/', lambda request: None, name='subscribe'),
]