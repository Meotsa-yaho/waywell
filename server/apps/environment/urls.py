from django.urls import path

app_name = 'environment'

urlpatterns = [
    path('environment/', lambda request: None, name='environment'),
]