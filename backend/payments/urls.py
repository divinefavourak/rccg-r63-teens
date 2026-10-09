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

    # Event registrations: open a checkout, and ask Paystack how it went
    path('registrations/<uuid:pk>/checkout/',
         views.RegistrationCheckoutView.as_view(), name='registration_checkout'),
    path('registrations/<uuid:pk>/check/',
         views.RegistrationPaymentCheckView.as_view(), name='registration_payment_check'),
    # Pages a payer opens in a browser: the link sent to a parent, and where
    # Paystack sends anyone back to
    path('pay/<str:token>/', views.RegistrationPayLinkView.as_view(), name='registration_pay_link'),
    path('return/', views.PaymentReturnView.as_view(), name='payment_return'),
]
