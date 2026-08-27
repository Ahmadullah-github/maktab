from django.urls import path

from .views import ActivateView, DeactivateView, LatestUpdateView, RefreshView, ResetActivationView

urlpatterns = [
    path("activations", ActivateView.as_view()),
    path("activations/refresh", RefreshView.as_view()),
    path("activations/deactivate", DeactivateView.as_view()),
    path("admin/activations/<int:activation_id>/reset", ResetActivationView.as_view()),
    path("updates/windows/x64/<str:channel>/latest", LatestUpdateView.as_view()),
]
