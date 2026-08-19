from django.urls import path

from .views import PlaceSearchView, SheltersView, ShadesView

app_name = 'places'

urlpatterns = [
    path('places/search/', PlaceSearchView.as_view(), name='search'),
    path('shelters/', SheltersView.as_view(), name='shelters'),
    path('shades/', ShadesView.as_view(), name='shades'),
]