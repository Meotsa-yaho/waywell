from django.urls import path

app_name = 'routes'

urlpatterns = [
    path('routes/', lambda request: None, name='routes'),
    path('routes/explain/', lambda request: None, name='explain'),
]