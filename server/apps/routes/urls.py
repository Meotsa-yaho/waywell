from django.urls import path

from .views import RoutesView

app_name = 'routes'

urlpatterns = [
    path('routes/', RoutesView.as_view(), name='routes'),
    # path('routes/explain/', ...),  # LLM 설명 (추후)
]
