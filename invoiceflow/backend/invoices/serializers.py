from rest_framework import serializers
from decimal import Decimal
from django.utils import timezone
from .models import BusinessSettings, Client, Invoice, InvoiceItem, InvoiceCounter
import datetime

class BusinessSettingsSerializer(serializers.ModelSerializer):
    next_invoice_number = serializers.SerializerMethodField()

    class Meta:
        model = BusinessSettings
        fields = [
            'id',
            'business_name',
            'address',
            'email',
            'phone',
            'logo',
            'default_currency',
            'default_tax_rate',
            'default_payment_terms_days',
            'invoice_prefix',
            'include_year',
            'zero_padding',
            'separator',
            'footer_note',
            'next_invoice_number',
        ]

    def get_next_invoice_number(self, obj):
        current_year = timezone.now().date().year
        counter_year = current_year if obj.include_year else 0
        counter = InvoiceCounter.objects.filter(year=counter_year).first()
        next_num = (counter.last_number if counter else 0) + 1
        padded = str(next_num).zfill(obj.zero_padding)
        if obj.include_year:
            return f"{obj.invoice_prefix}{obj.separator}{current_year}{obj.separator}{padded}"
        return f"{obj.invoice_prefix}{obj.separator}{padded}"


class ClientSerializer(serializers.ModelSerializer):
    invoice_count = serializers.SerializerMethodField()
    total_billed = serializers.SerializerMethodField()

    class Meta:
        model = Client
        fields = [
            'id',
            'name',
            'email',
            'phone',
            'address',
            'company',
            'created_at',
            'invoice_count',
            'total_billed',
        ]

    def get_invoice_count(self, obj):
        return obj.invoices.count()

    def get_total_billed(self, obj):
        invoices = obj.invoices.exclude(status='void')
        return sum(inv.total for inv in invoices)


class InvoiceItemSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)
    line_total = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = InvoiceItem
        fields = ['id', 'description', 'quantity', 'unit_price', 'line_total']

    def validate_quantity(self, value):
        if value <= Decimal('0'):
            raise serializers.ValidationError("Quantity must be greater than 0.")
        return value

    def validate_unit_price(self, value):
        if value < Decimal('0'):
            raise serializers.ValidationError("Unit price cannot be negative.")
        return value


class InvoiceSerializer(serializers.ModelSerializer):
    items = InvoiceItemSerializer(many=True)
    client_detail = ClientSerializer(source='client', read_only=True)
    client_id = serializers.PrimaryKeyRelatedField(
        queryset=Client.objects.all(), source='client', write_only=True
    )
    invoice_number = serializers.CharField(read_only=True)
    subtotal = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    tax_amount = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    total = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = Invoice
        fields = [
            'id',
            'invoice_number',
            'client_id',
            'client_detail',
            'issue_date',
            'due_date',
            'status',
            'currency',
            'tax_rate',
            'discount_type',
            'discount_value',
            'notes',
            'terms',
            'subtotal',
            'tax_amount',
            'total',
            'created_at',
            'items',
        ]

    def validate(self, data):
        issue_date = data.get('issue_date')
        due_date = data.get('due_date')
        if issue_date and due_date and due_date < issue_date:
            raise serializers.ValidationError({
                'due_date': "Due date cannot be earlier than issue date."
            })

        items_data = self.initial_data.get('items', [])
        if not items_data or len(items_data) == 0:
            raise serializers.ValidationError({
                'items': "An invoice must contain at least one line item."
            })

        return data

    def calculate_totals(self, items_data, discount_type, discount_value, tax_rate):
        subtotal = Decimal('0.00')
        for item in items_data:
            qty = Decimal(str(item.get('quantity', 0)))
            price = Decimal(str(item.get('unit_price', 0)))
            line_total = (qty * price).quantize(Decimal('0.01'))
            subtotal += line_total

        disc_val = Decimal(str(discount_value or 0))
        if discount_type == 'percentage':
            discount_amount = ((subtotal * disc_val) / Decimal('100')).quantize(Decimal('0.01'))
        else:
            discount_amount = min(subtotal, disc_val)

        taxable = max(Decimal('0.00'), subtotal - discount_amount)
        rate = Decimal(str(tax_rate or 0))
        tax_amount = ((taxable * rate) / Decimal('100')).quantize(Decimal('0.01'))
        total = taxable + tax_amount

        return subtotal, tax_amount, total

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        settings = BusinessSettings.get_settings()

        # 1. ATOMIC GUARANTEED SEQUENTIAL NUMBER GENERATION
        # The number is assigned server-side inside transaction.atomic()
        issue_date = validated_data.get('issue_date', timezone.now().date())
        invoice_number = InvoiceCounter.get_next_number_for_date(issue_date, settings)

        # 2. Server-side totals calculation
        subtotal, tax_amount, total = self.calculate_totals(
            items_data,
            validated_data.get('discount_type', 'percentage'),
            validated_data.get('discount_value', 0),
            validated_data.get('tax_rate', 0),
        )

        status = validated_data.get('status', 'draft')
        due_date = validated_data.get('due_date')
        if status == 'sent' and due_date and due_date < timezone.now().date():
            status = 'overdue'

        invoice = Invoice.objects.create(
            invoice_number=invoice_number,
            subtotal=subtotal,
            tax_amount=tax_amount,
            total=total,
            status=status,
            **validated_data
        )

        for item_data in items_data:
            qty = Decimal(str(item_data['quantity']))
            price = Decimal(str(item_data['unit_price']))
            line_total = (qty * price).quantize(Decimal('0.01'))
            InvoiceItem.objects.create(
                invoice=invoice,
                description=item_data['description'],
                quantity=qty,
                unit_price=price,
                line_total=line_total,
            )

        return invoice

    def update(self, instance, validated_data):
        if instance.status == 'void':
            raise serializers.ValidationError("Voided invoices cannot be edited.")

        # Protected field: invoice_number is NEVER modified on update
        validated_data.pop('invoice_number', None)
        items_data = validated_data.pop('items', None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if items_data is not None:
            subtotal, tax_amount, total = self.calculate_totals(
                items_data,
                instance.discount_type,
                instance.discount_value,
                instance.tax_rate,
            )
            instance.subtotal = subtotal
            instance.tax_amount = tax_amount
            instance.total = total

            # Replace items
            instance.items.all().delete()
            for item_data in items_data:
                qty = Decimal(str(item_data['quantity']))
                price = Decimal(str(item_data['unit_price']))
                line_total = (qty * price).quantize(Decimal('0.01'))
                InvoiceItem.objects.create(
                    invoice=instance,
                    description=item_data['description'],
                    quantity=qty,
                    unit_price=price,
                    line_total=line_total,
                )

        instance.save()
        return instance
