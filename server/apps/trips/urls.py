from django.urls import path

app_name = 'trips'

urlpatterns = [
    path('arrival/', lambda request: None, name='arrival'),
    path('trips/', lambda request: None, name='list'),
    path('trips/<str:trip_id>/', lambda request, trip_id: None, name='detail'),
    path('report/weekly/', lambda request: None, name='weekly_report'),
]