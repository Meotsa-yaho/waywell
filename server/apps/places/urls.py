from django.urls import path

app_name = 'places'

urlpatterns = [
    path('places/search/', lambda request: None, name='search'),
    path('shelters/', lambda request: None, name='shelters'),
]