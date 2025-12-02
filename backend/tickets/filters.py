import django_filters
from django import forms
from .models import Ticket

class TicketFilter(django_filters.FilterSet):
    province = django_filters.CharFilter(
        field_name='province',
        lookup_expr='iexact',
        label='Province'
    )
    status = django_filters.ChoiceFilter(
        choices=Ticket.Status.choices,
        field_name='status',
        label='Status'
    )
    category = django_filters.ChoiceFilter(
        choices=Ticket.Category.choices,
        field_name='category',
        label='Category'
    )
    gender = django_filters.ChoiceFilter(
        choices=Ticket.Gender.choices,
        field_name='gender',
        label='Gender'
    )
    zone = django_filters.CharFilter(
        field_name='zone',
        lookup_expr='icontains',
        label='Zone'
    )
    
    registered_at_start = django_filters.DateFilter(
        field_name='registered_at',
        lookup_expr='gte',
        label='Registered From',
        widget=forms.DateInput(attrs={'type': 'date'})
    )
    registered_at_end = django_filters.DateFilter(
        field_name='registered_at',
        lookup_expr='lte',
        label='Registered To',
        widget=forms.DateInput(attrs={'type': 'date'})
    )
    
    class Meta:
        model = Ticket
        fields = {
            'province': ['exact'],
            'status': ['exact'],
            'category': ['exact'],
            'gender': ['exact'],
            'zone': ['exact', 'icontains'],
        }