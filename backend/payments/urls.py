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
    
    # Webhook (no trailing slash: this is the address given to Squad)
    path('webhook', views.SquadWebhookView.as_view(), name='squad_webhook'),
    
    # Callback
    path('callback/', views.PaymentCallbackView.as_view(), name='payment_callback'),

    # Event registrations: open a checkout, and ask Squad how it went
    path('registrations/<uuid:pk>/checkout/',
         views.RegistrationCheckoutView.as_view(), name='registration_checkout'),
    path('registrations/<uuid:pk>/check/',
         views.RegistrationPaymentCheckView.as_view(), name='registration_payment_check'),
    # Pages a payer opens in a browser: the link sent to a parent, and where
    # Squad sends anyone back to
    path('pay/<str:token>/', views.RegistrationPayLinkView.as_view(), name='registration_pay_link'),
    path('return/<str:reference>/', views.PaymentReturnView.as_view(), name='payment_return'),
    path('return/', views.PaymentReturnView.as_view(), name='payment_return_query'),
]
