from django.db import models, transaction
from django.utils import timezone
from decimal import Decimal
import datetime

class BusinessSettings(models.Model):
    business_name = models.CharField(max_length=255, default='Acme Digital Solutions Ltd')
    address = models.TextField(default='742 Evergreen Terrace, Suite 400\nSan Francisco, CA 94107')
    email = models.EmailField(default='billing@acmedigital.io')
    phone = models.CharField(max_length=64, default='+1 (555) 234-5678')
    logo = models.CharField(max_length=500, blank=True, default='')
    default_currency = models.CharField(max_length=10, default='USD')
    default_tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('10.00'))
    default_payment_terms_days = models.PositiveIntegerField(default=14)
    invoice_prefix = models.CharField(max_length=20, default='INV')
    include_year = models.BooleanField(default=True)
    zero_padding = models.PositiveIntegerField(default=4)
    separator = models.CharField(max_length=5, default='-')
    footer_note = models.TextField(blank=True, default='Thank you for your business! Please remit payment within terms stated.')

    class Meta:
        verbose_name = 'Business Settings'
        verbose_name_plural = 'Business Settings'

    def __str__(self):
        return self.business_name

    @classmethod
    def get_settings(cls):
        settings, _ = cls.objects.get_or_create(id=1)
        return settings


class Client(models.Model):
    name = models.CharField(max_length=255)
    email = models.EmailField(blank=True, default='')
    phone = models.CharField(max_length=64, blank=True, default='')
    address = models.TextField(blank=True, default='')
    company = models.CharField(max_length=255, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.company})" if self.company else self.name


class InvoiceCounter(models.Model):
    year = models.IntegerField(primary_key=True)
    last_number = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name = 'Invoice Counter'
        verbose_name_plural = 'Invoice Counters'

    def __str__(self):
        return f"Year {self.year}: last={self.last_number}"

    @classmethod
    def get_next_number_for_date(cls, issue_date=None, settings=None):
        """
        Atomically increments and returns the formatted sequential invoice number.
        Uses select_for_update inside an atomic transaction to ensure zero collisions
        or duplicate numbers under simultaneous requests.
        """
        if settings is None:
            settings = BusinessSettings.get_settings()

        if issue_date is None:
            issue_date = timezone.now().date()
        elif isinstance(issue_date, str):
            issue_date = datetime.date.fromisoformat(issue_date)

        counter_year = issue_date.year if settings.include_year else 0

        # Dedicated atomic transaction with select_for_update lock
        with transaction.atomic():
            counter, created = cls.objects.select_for_update().get_or_create(
                year=counter_year,
                defaults={'last_number': 0}
            )
            counter.last_number += 1
            counter.save(update_fields=['last_number'])

            padded_seq = str(counter.last_number).zfill(settings.zero_padding)
            prefix = settings.invoice_prefix
            sep = settings.separator

            if settings.include_year:
                invoice_number = f"{prefix}{sep}{counter_year}{sep}{padded_seq}"
            else:
                invoice_number = f"{prefix}{sep}{padded_seq}"

            return invoice_number


class Invoice(models.Model):
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('sent', 'Sent'),
        ('paid', 'Paid'),
        ('overdue', 'Overdue'),
        ('void', 'Void'),
    ]

    DISCOUNT_TYPE_CHOICES = [
        ('percentage', 'Percentage'),
        ('fixed', 'Fixed Amount'),
    ]

    invoice_number = models.CharField(
        max_length=64,
        unique=True,
        editable=False,
        help_text="Unique sequential number auto-assigned by the server upon creation."
    )
    client = models.ForeignKey(Client, on_delete=models.PROTECT, related_name='invoices')
    issue_date = models.DateField()
    due_date = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    currency = models.CharField(max_length=10, default='USD')
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    discount_type = models.CharField(max_length=20, choices=DISCOUNT_TYPE_CHOICES, default='percentage')
    discount_value = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    notes = models.TextField(blank=True, default='')
    terms = models.TextField(blank=True, default='')

    # Computed server-side financial totals
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    tax_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    total = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-id']

    def __str__(self):
        return f"{self.invoice_number} - {self.client.name} (${self.total})"

    def update_overdue_status_if_needed(self):
        """Automatically checks if a sent invoice is past its due date."""
        if self.status == 'sent' and self.due_date < timezone.now().date():
            self.status = 'overdue'
            self.save(update_fields=['status'])

    def void(self):
        """
        Marks invoice as void without freeing up its assigned number.
        Numbers are monotonically increasing and never reused.
        """
        self.status = 'void'
        self.save(update_fields=['status'])


class InvoiceItem(models.Model):
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='items')
    description = models.CharField(max_length=255)
    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    line_total = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        ordering = ['id']

    def __str__(self):
        return f"{self.description} ({self.quantity} @ ${self.unit_price})"

    def save(self, *args, **kwargs):
        self.line_total = (self.quantity * self.unit_price).quantize(Decimal('0.01'))
        super().save(*args, **kwargs)
