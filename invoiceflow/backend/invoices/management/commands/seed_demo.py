from django.core.management.base import BaseCommand
from django.utils import timezone
from decimal import Decimal
import datetime

from invoices.models import BusinessSettings, Client, Invoice, InvoiceItem, InvoiceCounter


class Command(BaseCommand):
    help = 'Seeds database with realistic demo business, 5 clients, and 12 invoices with mixed statuses.'

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE("Clearing existing invoice records for pristine demo..."))
        InvoiceItem.objects.all().delete()
        Invoice.objects.all().delete()
        Client.objects.all().delete()
        InvoiceCounter.objects.all().delete()

        current_year = timezone.now().date().year

        # 1. Business Profile Settings
        settings = BusinessSettings.get_settings()
        settings.business_name = 'Acme Digital Solutions Ltd'
        settings.address = '742 Evergreen Terrace, Suite 400\nSan Francisco, CA 94107'
        settings.email = 'billing@acmedigital.io'
        settings.phone = '+1 (555) 234-5678'
        settings.default_currency = 'USD'
        settings.default_tax_rate = Decimal('10.00')
        settings.default_payment_terms_days = 14
        settings.invoice_prefix = 'INV'
        settings.include_year = True
        settings.zero_padding = 4
        settings.separator = '-'
        settings.footer_note = 'Thank you for your business! Please remit payment within terms stated.'
        settings.save()

        # 2. 5 Realistic Clients
        clients_data = [
            {
                'name': 'Marcus Vance',
                'email': 'm.vance@nexustechlabs.com',
                'phone': '+1 (415) 890-1200',
                'address': '100 Montgomery St, Suite 1800, San Francisco, CA 94104',
                'company': 'Nexus Tech Labs Inc.'
            },
            {
                'name': 'Elena Rostova',
                'email': 'elena@cloudscale-ops.io',
                'phone': '+1 (206) 450-9321',
                'address': '400 Pine Street, 12th Floor, Seattle, WA 98101',
                'company': 'CloudScale Infrastructure LLC'
            },
            {
                'name': 'Sarah Jenkins',
                'email': 'sjenkins@horizonmediagroup.net',
                'phone': '+1 (212) 330-8740',
                'address': '350 5th Avenue, Suite 4400, New York, NY 10118',
                'company': 'Horizon Media Group'
            },
            {
                'name': 'David Chen',
                'email': 'dchen@beaconbiohealth.org',
                'phone': '+1 (617) 720-4100',
                'address': '75 Cambridge Parkway, Cambridge, MA 02142',
                'company': 'Beacon BioHealth Solutions'
            },
            {
                'name': 'Amina Patel',
                'email': 'amina@apexlogisticsglobal.com',
                'phone': '+1 (312) 550-6211',
                'address': '233 S Wacker Dr, Suite 5200, Chicago, IL 60606',
                'company': 'Apex Logistics Global'
            },
        ]

        clients = []
        for c in clients_data:
            client = Client.objects.create(**c)
            clients.append(client)
        self.stdout.write(self.style.SUCCESS(f"Created {len(clients)} demo clients."))

        # 3. 12 Invoices with realistic line items and statuses
        demo_invoices = [
            {
                'client': clients[0],
                'issue_date': datetime.date(current_year, 1, 15),
                'due_date': datetime.date(current_year, 2, 14),
                'status': 'paid',
                'tax_rate': Decimal('10.00'),
                'discount_type': 'percentage',
                'discount_value': Decimal('0.00'),
                'notes': 'Initial SaaS Architecture Phase 1 delivery.',
                'terms': 'Net 30. Payment received via Wire.',
                'items': [
                    {'desc': 'Cloud Architecture Discovery & Planning', 'qty': Decimal('25.00'), 'price': Decimal('150.00')},
                    {'desc': 'Multi-Tenant Database Schema Implementation', 'qty': Decimal('30.00'), 'price': Decimal('160.00')}
                ]
            },
            {
                'client': clients[1],
                'issue_date': datetime.date(current_year, 1, 20),
                'due_date': datetime.date(current_year, 2, 4),
                'status': 'paid',
                'tax_rate': Decimal('8.50'),
                'discount_type': 'fixed',
                'discount_value': Decimal('200.00'),
                'notes': 'Kubernetes Cluster Hardening & CI/CD pipeline modernization.',
                'terms': 'Net 15 days.',
                'items': [
                    {'desc': 'Production Kubernetes Cluster Audit', 'qty': Decimal('1.00'), 'price': Decimal('3200.00')},
                    {'desc': 'GitOps Pipeline Automation (ArgoCD)', 'qty': Decimal('20.00'), 'price': Decimal('175.00')},
                    {'desc': 'Prometheus & Grafana Alerting Setup', 'qty': Decimal('12.00'), 'price': Decimal('150.00')}
                ]
            },
            {
                'client': clients[2],
                'issue_date': datetime.date(current_year, 2, 1),
                'due_date': datetime.date(current_year, 3, 3),
                'status': 'paid',
                'tax_rate': Decimal('8.88'),
                'discount_type': 'percentage',
                'discount_value': Decimal('5.00'),
                'notes': 'Brand Guidelines & Digital Asset Design Kit.',
                'terms': 'Net 30 days.',
                'items': [
                    {'desc': 'Enterprise Design System Components', 'qty': Decimal('35.00'), 'price': Decimal('120.00')},
                    {'desc': 'Figma Library Documentation', 'qty': Decimal('10.00'), 'price': Decimal('110.00')}
                ]
            },
            {
                'client': clients[3],
                'issue_date': datetime.date(current_year, 2, 15),
                'due_date': datetime.date(current_year, 3, 1),
                'status': 'paid',
                'tax_rate': Decimal('6.25'),
                'discount_type': 'percentage',
                'discount_value': Decimal('0.00'),
                'notes': 'HIPAA Compliance Security Assessment.',
                'terms': 'Net 14 days.',
                'items': [
                    {'desc': 'PHI Data Pipeline Compliance Audit', 'qty': Decimal('40.00'), 'price': Decimal('195.00')},
                    {'desc': 'KMS Key Rotation Review', 'qty': Decimal('15.00'), 'price': Decimal('210.00')}
                ]
            },
            {
                'client': clients[4],
                'issue_date': datetime.date(current_year, 3, 1),
                'due_date': datetime.date(current_year, 3, 31),
                'status': 'paid',
                'tax_rate': Decimal('10.00'),
                'discount_type': 'percentage',
                'discount_value': Decimal('0.00'),
                'notes': 'Fleet Tracking Telemetry Ingestion Engine.',
                'terms': 'Net 30 days.',
                'items': [
                    {'desc': 'Kafka Event Streaming Ingestion Layer', 'qty': Decimal('32.00'), 'price': Decimal('180.00')},
                    {'desc': 'Geofence Calculation Worker', 'qty': Decimal('16.00'), 'price': Decimal('175.00')}
                ]
            },
            {
                'client': clients[0],
                'issue_date': datetime.date(current_year, 3, 10),
                'due_date': datetime.date(current_year, 4, 9),
                'status': 'sent',
                'tax_rate': Decimal('10.00'),
                'discount_type': 'percentage',
                'discount_value': Decimal('0.00'),
                'notes': 'Sprint 5 Deliverables: Authentication & RBAC.',
                'terms': 'Net 30 days.',
                'items': [
                    {'desc': 'OAuth2 & SSO Federation Integration', 'qty': Decimal('24.00'), 'price': Decimal('165.00')},
                    {'desc': 'RBAC Permissions Matrix Implementation', 'qty': Decimal('18.00'), 'price': Decimal('160.00')}
                ]
            },
            {
                'client': clients[1],
                'issue_date': datetime.date(current_year, 2, 20),
                'due_date': datetime.date(current_year, 3, 6), # Overdue
                'status': 'overdue',
                'tax_rate': Decimal('8.50'),
                'discount_type': 'percentage',
                'discount_value': Decimal('0.00'),
                'notes': 'Emergency Incident Response & Database Recovery.',
                'terms': 'Net 14 days. Second reminder sent.',
                'items': [
                    {'desc': '24/7 Priority Emergency SRE Callout', 'qty': Decimal('16.00'), 'price': Decimal('250.00')},
                    {'desc': 'Post-Mortem Root Cause Analysis', 'qty': Decimal('8.00'), 'price': Decimal('175.00')}
                ]
            },
            {
                'client': clients[2],
                'issue_date': datetime.date(current_year, 2, 25),
                'due_date': datetime.date(current_year, 3, 11), # Overdue
                'status': 'overdue',
                'tax_rate': Decimal('8.88'),
                'discount_type': 'percentage',
                'discount_value': Decimal('0.00'),
                'notes': 'Interactive Marketing Campaign Microsite.',
                'terms': 'Net 14 days. Past due.',
                'items': [
                    {'desc': 'WebGL 3D Interactive Showcase Page', 'qty': Decimal('45.00'), 'price': Decimal('150.00')},
                    {'desc': 'Mobile Optimization & CDN Deployment', 'qty': Decimal('12.00'), 'price': Decimal('140.00')}
                ]
            },
            {
                'client': clients[3],
                'issue_date': datetime.date(current_year, 3, 20),
                'due_date': datetime.date(current_year, 4, 19),
                'status': 'sent',
                'tax_rate': Decimal('6.25'),
                'discount_type': 'percentage',
                'discount_value': Decimal('5.00'),
                'notes': 'Clinical Trial Analytics Dashboard Enhancement.',
                'terms': 'Net 30 days.',
                'items': [
                    {'desc': 'Cohort Visualization Widgets', 'qty': Decimal('22.00'), 'price': Decimal('185.00')},
                    {'desc': 'Automated PDF Export Report Service', 'qty': Decimal('14.00'), 'price': Decimal('160.00')}
                ]
            },
            {
                'client': clients[4],
                'issue_date': datetime.date(current_year, 3, 25),
                'due_date': datetime.date(current_year, 4, 24),
                'status': 'draft',
                'tax_rate': Decimal('10.00'),
                'discount_type': 'percentage',
                'discount_value': Decimal('0.00'),
                'notes': 'Internal draft: Route Optimization Engine v2.',
                'terms': 'Net 30 days upon final approval.',
                'items': [
                    {'desc': 'Dispatch Optimizer Module', 'qty': Decimal('15.00'), 'price': Decimal('190.00')}
                ]
            },
            {
                'client': clients[1],
                'issue_date': datetime.date(current_year, 1, 10),
                'due_date': datetime.date(current_year, 1, 24),
                'status': 'void',
                'tax_rate': Decimal('8.50'),
                'discount_type': 'percentage',
                'discount_value': Decimal('0.00'),
                'notes': 'VOID: Superseded by revised scope agreement in INV-2026-0002. Number retained for audit compliance.',
                'terms': 'Voided - Do not remit.',
                'items': [
                    {'desc': 'Preliminary Container Migration Scoping', 'qty': Decimal('10.00'), 'price': Decimal('150.00')}
                ]
            },
            {
                'client': clients[0],
                'issue_date': datetime.date(current_year, 3, 28),
                'due_date': datetime.date(current_year, 4, 27),
                'status': 'sent',
                'tax_rate': Decimal('10.00'),
                'discount_type': 'percentage',
                'discount_value': Decimal('0.00'),
                'notes': 'API Gateway Rate Limiting & Throttling System.',
                'terms': 'Net 30 days.',
                'items': [
                    {'desc': 'Redis Token Bucket Rate Limiter', 'qty': Decimal('20.00'), 'price': Decimal('175.00')},
                    {'desc': 'Telemetry & Webhook Event Relay', 'qty': Decimal('16.00'), 'price': Decimal('160.00')}
                ]
            },
        ]

        for inv_data in demo_invoices:
            # Atomically mint number
            inv_number = InvoiceCounter.get_next_number_for_date(inv_data['issue_date'], settings)

            # Calculate totals
            subtotal = Decimal('0.00')
            for it in inv_data['items']:
                subtotal += (it['qty'] * it['price']).quantize(Decimal('0.01'))

            disc_val = inv_data['discount_value']
            if inv_data['discount_type'] == 'percentage':
                disc_amount = ((subtotal * disc_val) / Decimal('100')).quantize(Decimal('0.01'))
            else:
                disc_amount = min(subtotal, disc_val)

            taxable = max(Decimal('0.00'), subtotal - disc_amount)
            tax_amount = ((taxable * inv_data['tax_rate']) / Decimal('100')).quantize(Decimal('0.01'))
            total = taxable + tax_amount

            inv = Invoice.objects.create(
                invoice_number=inv_number,
                client=inv_data['client'],
                issue_date=inv_data['issue_date'],
                due_date=inv_data['due_date'],
                status=inv_data['status'],
                currency='USD',
                tax_rate=inv_data['tax_rate'],
                discount_type=inv_data['discount_type'],
                discount_value=inv_data['discount_value'],
                notes=inv_data['notes'],
                terms=inv_data['terms'],
                subtotal=subtotal,
                tax_amount=tax_amount,
                total=total,
            )

            for it in inv_data['items']:
                line_total = (it['qty'] * it['price']).quantize(Decimal('0.01'))
                InvoiceItem.objects.create(
                    invoice=inv,
                    description=it['desc'],
                    quantity=it['qty'],
                    unit_price=it['price'],
                    line_total=line_total,
                )

        counter = InvoiceCounter.objects.get(year=current_year)
        self.stdout.write(self.style.SUCCESS(
            f"Successfully seeded 12 invoices! Current counter for {current_year} is at #{counter.last_number}. "
            f"Next invoice created will be automatically assigned #{settings.invoice_prefix}-{current_year}-{(counter.last_number+1):04d}."
        ))
