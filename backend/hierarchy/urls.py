from django.urls import path

from . import views

urlpatterns = [
    path('public/children/', views.PublicChildrenView.as_view(),
         name='hierarchy-public-children'),
    path('nodes/', views.NodeListView.as_view(), name='hierarchy-nodes'),
    path('nodes/<uuid:pk>/', views.NodeDetailView.as_view(),
         name='hierarchy-node-detail'),
    path('nodes/<uuid:pk>/move/', views.NodeMoveView.as_view(),
         name='hierarchy-node-move'),
]
