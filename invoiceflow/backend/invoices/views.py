from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone
from django.http import HttpResponse
from django.db.models import Sum, Q, Count
from decimal import Decimal
import datetime
import io

from .models import BusinessSettings, Client, Invoice, InvoiceCounter
from .serializers import BusinessSettingsSerializer, ClientSerializer, InvoiceSerializer


class BusinessSettingsView(APIView):
    def get(self, request):
        settings = BusinessSettings.get_settings()
        serializer = BusinessSettingsSerializer(settings)
        return Response(serializer.data)

    def put(self, request):
        settings = BusinessSettings.get_settings()
        serializer = BusinessSettingsSerializer(settings, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ClientViewSet(viewsets.ModelViewSet):
    queryset = Client.objects.all().order_by('name')
    serializer_class = ClientSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        search = self.request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(
                Q(name__icontains=search) |
                Q(company__icontains=search) |
                Q(email__icontains=search)
            )
        return qs

    def destroy(self, request, *args, **kwargs):
        client = self.get_object()
        linked_invoices = client.invoices.count()
        if linked_invoices > 0:
            return Response(
                {"error": f"Cannot delete client with {linked_invoices} existing invoice(s)."},
                status=status.HTTP_400_BAD_REQUEST
            )
        return super().destroy(request, *args, **kwargs)


class InvoiceViewSet(viewsets.ModelViewSet):
    queryset = Invoice.objects.all().select_related('client').prefetch_related('items')
    serializer_class = InvoiceSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        today = timezone.now().date()

        # Update any overdue invoices
        qs.filter(status='sent', due_date__lt=today).update(status='overdue')

        status_param = self.request.query_params.get('status')
        if status_param and status_param != 'all':
            qs = qs.filter(status=status_param)

        client_id = self.request.query_params.get('client')
        if client_id:
            qs = qs.filter(client_id=client_id)

        start_date = self.request.query_params.get('start_date')
        if start_date:
            qs = qs.filter(issue_date__gte=start_date)

        end_date = self.request.query_params.get('end_date')
        if end_date:
            qs = qs.filter(issue_date__lte=end_date)

        search = self.request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(
                Q(invoice_number__icontains=search) |
                Q(client__name__icontains=search) |
                Q(client__company__icontains=search)
            )

        return qs

    @action(detail=True, methods=['post'], url_path='mark-paid')
    def mark_paid(self, request, pk=None):
        invoice = self.get_object()
        invoice.status = 'paid'
        invoice.save(update_fields=['status'])
        return Response(InvoiceSerializer(invoice).data)

    @action(detail=True, methods=['post'], url_path='mark-sent')
    def mark_sent(self, request, pk=None):
        invoice = self.get_object()
        if invoice.due_date < timezone.now().date():
            invoice.status = 'overdue'
        else:
            invoice.status = 'sent'
        invoice.save(update_fields=['status'])
        return Response(InvoiceSerializer(invoice).data)

    @action(detail=True, methods=['post'], url_path='void')
    def void(self, request, pk=None):
        invoice = self.get_object()
        invoice.void()
        return Response({
            'message': f'Invoice {invoice.invoice_number} voided successfully.',
            'invoice': InvoiceSerializer(invoice).data
        })

    @action(detail=True, methods=['get'], url_path='pdf')
    def pdf(self, request, pk=None):
        invoice = self.get_object()
        settings = BusinessSettings.get_settings()

        # Generate PDF using ReportLab
        from reportlab.lib.pagesizes import letter
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib import colors

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36)
        elements = []
        styles = getSampleStyleSheet()

        # Styles
        title_style = ParagraphStyle(
            'TitleStyle',
            parent=styles['Heading1'],
            fontSize=20,
            leading=24,
            textColor=colors.HexColor('#0f172a')
        )
        sub_style = ParagraphStyle(
            'SubStyle',
            parent=styles['Normal'],
            fontSize=9,
            leading=13,
            textColor=colors.HexColor('#475569')
        )

        # Header Table: Business on left, Invoice # on right
        header_data = [
            [
                Paragraph(f"<b>{settings.business_name}</b><br/>{settings.address.replace(chr(10), '<br/>')}<br/>Email: {settings.email} | Phone: {settings.phone}", sub_style),
                Paragraph(f"<font size=18 color='#0f172a'><b>INVOICE</b></font><br/><font size=12 color='#2563eb'><b>{invoice.invoice_number}</b></font><br/><b>Status:</b> {invoice.status.upper()}<br/><b>Issue Date:</b> {invoice.issue_date}<br/><b>Due Date:</b> {invoice.due_date}", sub_style)
            ]
        ]
        header_table = Table(header_data, colWidths=[300, 240])
        header_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('ALIGN', (1, 0), (1, 0), 'RIGHT'),
        ]))
        elements.append(header_table)
        elements.append(Spacer(1, 20))

        # Client Bill To
        client_data = [
            [
                Paragraph(f"<b>BILLED TO:</b><br/><b>{invoice.client.name}</b><br/>{invoice.client.company}<br/>{invoice.client.address.replace(chr(10), '<br/>')}<br/>{invoice.client.email}", sub_style),
                Paragraph(f"<b>PAYMENT TERMS:</b><br/>Currency: {invoice.currency}<br/>Terms: {invoice.terms or 'Net 14'}", sub_style)
            ]
        ]
        client_table = Table(client_data, colWidths=[300, 240])
        client_table.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP')]))
        elements.append(client_table)
        elements.append(Spacer(1, 20))

        # Items Table
        item_rows = [["Item / Description", "Qty", "Unit Price", "Line Total"]]
        for it in invoice.items.all():
            item_rows.append([
                it.description,
                f"{it.quantity:.2f}",
                f"${it.unit_price:.2f}",
                f"${it.line_total:.2f}"
            ])

        items_table = Table(item_rows, colWidths=[280, 70, 90, 100])
        items_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f8fafc')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#0f172a')),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ]))
        elements.append(items_table)
        elements.append(Spacer(1, 15))

        # Totals
        totals_rows = [
            ["Subtotal:", f"${invoice.subtotal:.2f}"],
            ["Tax Amount:", f"${invoice.tax_amount:.2f}"],
            ["Total Due:", f"${invoice.total:.2f}"],
        ]
        totals_table = Table(totals_rows, colWidths=[120, 100])
        totals_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'RIGHT'),
            ('FONTNAME', (0, 2), (-1, 2), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('TEXTCOLOR', (0, 2), (-1, 2), colors.HexColor('#2563eb')),
        ]))
        totals_wrapper = Table([["", totals_table]], colWidths=[320, 220])
        elements.append(totals_wrapper)
        elements.append(Spacer(1, 30))

        # Footer note
        if settings.footer_note:
            elements.append(Paragraph(settings.footer_note, sub_style))

        doc.build(elements)
        buffer.seek(0)

        response = HttpResponse(buffer.getvalue(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="Invoice-{invoice.invoice_number}.pdf"'
        return response


class DashboardView(APIView):
    def get(self, request):
        today = timezone.now().date()
        Invoice.objects.filter(status='sent', due_date__lt=today).update(status='overdue')

        invoices = Invoice.objects.exclude(status='void')
        total_invoiced = sum(i.total for i in invoices)
        total_paid = sum(i.total for i in invoices.filter(status='paid'))
        outstanding = sum(i.total for i in invoices.filter(status__in=['sent', 'overdue']))
        overdue_invoices = invoices.filter(status='overdue')
        overdue_amount = sum(i.total for i in overdue_invoices)
        overdue_count = overdue_invoices.count()

        recent_invoices = Invoice.objects.select_related('client').order_by('-id')[:5]

        settings = BusinessSettings.get_settings()
        next_number = BusinessSettingsSerializer(settings).data.get('next_invoice_number')

        return Response({
            'summary': {
                'total_invoiced': total_invoiced,
                'total_paid': total_paid,
                'outstanding': outstanding,
                'overdue_amount': overdue_amount,
                'overdue_count': overdue_count,
                'active_invoices_count': invoices.count(),
            },
            'recent_invoices': InvoiceSerializer(recent_invoices, many=True).data,
            'next_invoice_number': next_number,
        })
