from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ClientViewSet, InvoiceViewSet, BusinessSettingsView, DashboardView

router = DefaultRouter()
router.register(r'clients', ClientViewSet, basename='client')
router.register(r'invoices', InvoiceViewSet, basename='invoice')

urlpatterns = [
    path('settings/', BusinessSettingsView.as_view(), name='business-settings'),
    path('dashboard/', DashboardView.as_view(), name='dashboard-summary'),
    path('', include(router.urls)),
]
