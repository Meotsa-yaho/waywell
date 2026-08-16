from django.urls import path

from .views import ArrivalView, TripsView, TripDetailView, WeeklyReportView

app_name = 'trips'

urlpatterns = [
    path('arrival/', ArrivalView.as_view(), name='arrival'),
    path('trips/', TripsView.as_view(), name='list'),
    path('trips/<str:trip_id>/', TripDetailView.as_view(), name='detail'),
    path('report/weekly/', WeeklyReportView.as_view(), name='weekly_report'),
]