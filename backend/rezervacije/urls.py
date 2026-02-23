from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    admin_dashboard,
    prijava,
    registracija,
    SalonViewSet,
    FrizerViewSet,
    TerminViewSet,
    RezervacijaViewSet,
)

router = DefaultRouter()
router.register('saloni', SalonViewSet, basename='saloni')
router.register('frizeri', FrizerViewSet, basename='frizeri')
router.register('termini', TerminViewSet, basename='termini')
router.register('rezervacije', RezervacijaViewSet, basename='rezervacije')

urlpatterns = [
    path('auth/registracija/', registracija, name='registracija'),
    path('auth/prijava/', prijava, name='prijava'),
    path('admin-dashboard/', admin_dashboard, name='admin-dashboard'),
    path('', include(router.urls)),
]
