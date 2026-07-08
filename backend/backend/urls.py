"""
URL configuration for backend project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/4.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.conf import settings
from django.conf.urls.static import static
from django.urls import path, include
from django.http import JsonResponse
from drf_spectacular.views import SpectacularAPIView, SpectacularRedocView, SpectacularSwaggerView

def health(request):
    """Simple health check endpoint"""
    return JsonResponse({
        "status": "active",
        "service": "RCCG R63 Ticketing App"
    })

urlpatterns = [
    # Health check - put this FIRST to avoid conflicts
    path('health/', health, name='health'),
    path('health', health, name='health-root'),  # Add this for root-level access
    
    # Admin
    path('admin/', admin.site.urls),
    
    # API v1 endpoints - New Platform
    path('api/v1/auth/', include('users.urls')),
    path('api/v1/identity/', include('identity.urls')),
    path('api/v1/profiles/', include('profiles.urls')),
    path('api/v1/content/', include('content.urls')),
    path('api/v1/media/', include('media.urls')),
    path('api/v1/events/', include('events.urls')),
    path('api/v1/payments/', include('payments.urls')),
    
    # Legacy API endpoints (for backward compatibility with frontend)
    path('api/auth/', include('users.urls')),
    path('api/users/', include('users.urls')),  # Added for AdminUsers page
    path('api/content/', include('content.urls')),  # Added for content pages
    path('api/media/', include('media.urls')),  # Added for media pages
    path('api/events/', include('events.urls')),  # Added for events pages
    path('api/profiles/', include('profiles.urls')),  # Added for profiles
    path('api/', include('tickets.urls')),
    path('api/payments/', include('payments.urls')),
    
    # New platform APIs
    path('api/content/', include('content.urls')),
    path('api/profiles/', include('profiles.urls')),
    
    # Documentation
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/schema/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)