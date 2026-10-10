from django.contrib import admin
from .models import BusinessSettings, Client, Invoice, InvoiceItem, InvoiceCounter

@admin.register(BusinessSettings)
class BusinessSettingsAdmin(admin.ModelAdmin):
    list_display = ['business_name', 'email', 'phone', 'default_currency', 'invoice_prefix', 'include_year']

@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ['name', 'company', 'email', 'phone', 'created_at']
    search_fields = ['name', 'company', 'email']

class InvoiceItemInline(admin.TabularInline):
    model = InvoiceItem
    extra = 1

@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ['invoice_number', 'client', 'issue_date', 'due_date', 'status', 'total']
    list_filter = ['status', 'currency', 'issue_date']
    search_fields = ['invoice_number', 'client__name', 'client__company']
    readonly_fields = ['invoice_number', 'subtotal', 'tax_amount', 'total', 'created_at']
    inlines = [InvoiceItemInline]

@admin.register(InvoiceCounter)
class InvoiceCounterAdmin(admin.ModelAdmin):
    list_display = ['year', 'last_number']
