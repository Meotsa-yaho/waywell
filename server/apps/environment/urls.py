from django.urls import path

from .views import EnvironmentView

app_name = 'environment'

urlpatterns = [
    path('environment/', EnvironmentView.as_view(), name='environment'),
]
