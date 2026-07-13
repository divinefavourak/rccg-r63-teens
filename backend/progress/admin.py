"""
Admin for the Progress domain.

`SpiritualAction` is an append-only audit stream and `StreakState` is a
machine-maintained cache: both are registered read-only so a well-meaning edit
in the admin can't desynchronise the streak from the events that produced it.
"""
from django.contrib import admin

from .models import SpiritualAction, StreakState


class ReadOnlyAdmin(admin.ModelAdmin):
    """View-only: no add, change or delete from the admin."""

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(SpiritualAction)
class SpiritualActionAdmin(ReadOnlyAdmin):
    list_display = ('user', 'action_type', 'occurred_on', 'occurred_at', 'source_reference')
    list_filter = ('action_type', 'occurred_on')
    search_fields = ('user__username', 'user__email', 'source_reference')
    date_hierarchy = 'occurred_on'
    ordering = ('-occurred_at',)


@admin.register(StreakState)
class StreakStateAdmin(ReadOnlyAdmin):
    list_display = ('user', 'current_length', 'longest_length', 'last_active_on', 'started_on')
    search_fields = ('user__username', 'user__email')
    ordering = ('-current_length',)
