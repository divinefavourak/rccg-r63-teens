from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'payments', views.PaymentViewSet, basename='payment')
router.register(r'payment-plans', views.PaymentPlanViewSet, basename='payment-plan')

urlpatterns = [
    path('', include(router.urls)),
    
    # Dashboard
    path('dashboard/', views.PaymentDashboardView.as_view(), name='payment_dashboard'),
    
    # Webhook (no trailing slash for Paystack)
    path('webhook', views.PaystackWebhookView.as_view(), name='paystack_webhook'),
    
    # Callback
    path('callback/', views.PaymentCallbackView.as_view(), name='payment_callback'),
]
