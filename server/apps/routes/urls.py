from django.urls import path

from .views import RoutesExplainView, RoutesView

app_name = 'routes'

urlpatterns = [
    path('routes/', RoutesView.as_view(), name='routes'),
    path('routes/explain/', RoutesExplainView.as_view(), name='routes-explain'),  # B-09 LLM 설명
]
