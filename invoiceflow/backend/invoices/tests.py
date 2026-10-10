from django.test import TestCase, TransactionTestCase
from rest_framework.test import APIClient
from rest_framework import status
from decimal import Decimal
import datetime
import threading
import queue

from .models import BusinessSettings, Client, Invoice, InvoiceCounter, InvoiceItem


class SequentialNumberingTests(TestCase):
    def setUp(self):
        self.settings = BusinessSettings.objects.create(
            business_name="Acme Corp",
            invoice_prefix="INV",
            include_year=True,
            zero_padding=4,
            separator="-"
        )
        self.client_obj = Client.objects.create(name="Test Client", company="Test Co")

    def test_sequential_numbering(self):
        """Verifies that consecutive invoices strictly receive sequential numbers."""
        current_year = datetime.date.today().year

        num1 = InvoiceCounter.get_next_number_for_date(datetime.date.today(), self.settings)
        num2 = InvoiceCounter.get_next_number_for_date(datetime.date.today(), self.settings)
        num3 = InvoiceCounter.get_next_number_for_date(datetime.date.today(), self.settings)

        self.assertEqual(num1, f"INV-{current_year}-0001")
        self.assertEqual(num2, f"INV-{current_year}-0002")
        self.assertEqual(num3, f"INV-{current_year}-0003")


class YearResetTests(TestCase):
    def setUp(self):
        self.settings = BusinessSettings.objects.create(
            business_name="Acme Corp",
            invoice_prefix="INV",
            include_year=True,
            zero_padding=4,
            separator="-"
        )

    def test_year_reset(self):
        """Verifies counter resets to 1 for a new calendar year when include_year is True."""
        date_2025 = datetime.date(2025, 6, 15)
        date_2026 = datetime.date(2026, 1, 10)

        num_2025_1 = InvoiceCounter.get_next_number_for_date(date_2025, self.settings)
        num_2025_2 = InvoiceCounter.get_next_number_for_date(date_2025, self.settings)
        self.assertEqual(num_2025_1, "INV-2025-0001")
        self.assertEqual(num_2025_2, "INV-2025-0002")

        # When new year 2026 arrives, counter resets to 1
        num_2026_1 = InvoiceCounter.get_next_number_for_date(date_2026, self.settings)
        self.assertEqual(num_2026_1, "INV-2026-0001")


class NoDuplicatesConcurrentCreationTests(TransactionTestCase):
    """Uses TransactionTestCase to support multi-threaded database transactions."""

    def setUp(self):
        self.settings = BusinessSettings.objects.create(
            business_name="Acme Corp",
            invoice_prefix="INV",
            include_year=True,
            zero_padding=4,
            separator="-"
        )

    def test_no_duplicates_under_concurrent_creation(self):
        """
        Simulates simultaneous worker threads acquiring numbers concurrently.
        Verifies that every generated invoice number is unique with zero collisions.
        """
        results_queue = queue.Queue()
        errors_queue = queue.Queue()

        def worker():
            try:
                num = InvoiceCounter.get_next_number_for_date(
                    datetime.date(2026, 5, 1), self.settings
                )
                results_queue.put(num)
            except Exception as e:
                errors_queue.put(e)

        threads = [threading.Thread(target=worker) for _ in range(15)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        self.assertTrue(errors_queue.empty(), f"Encountered errors: {list(errors_queue.queue)}")

        numbers = []
        while not results_queue.empty():
            numbers.append(results_queue.get())

        self.assertEqual(len(numbers), 15)
        # Unique constraint check: no duplicates
        self.assertEqual(len(numbers), len(set(numbers)))


class ReadOnlyInvoiceNumberApiTests(TestCase):
    def setUp(self):
        self.api_client = APIClient()
        self.settings = BusinessSettings.objects.create(
            business_name="Acme Corp",
            invoice_prefix="INV",
            include_year=True,
            zero_padding=4,
            separator="-"
        )
        self.client_obj = Client.objects.create(name="Acme Client", company="Acme Co")

    def test_invoice_number_cannot_be_edited_via_api(self):
        """Verifies that invoice_number cannot be modified via PUT or PATCH."""
        payload = {
            "client_id": self.client_obj.id,
            "issue_date": "2026-04-01",
            "due_date": "2026-04-15",
            "status": "draft",
            "currency": "USD",
            "tax_rate": 10.0,
            "discount_type": "percentage",
            "discount_value": 0,
            "items": [
                {"description": "Backend API Development", "quantity": 10, "unit_price": 100}
            ]
        }

        # Create invoice
        resp = self.api_client.post('/api/invoices/', payload, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        original_number = resp.data['invoice_number']
        invoice_id = resp.data['id']

        # Attempt to spoof or alter invoice_number via PUT
        update_payload = {
            "invoice_number": "FORGED-9999",
            "client_id": self.client_obj.id,
            "issue_date": "2026-04-01",
            "due_date": "2026-04-15",
            "notes": "Updated note",
            "items": [
                {"description": "Backend API Development", "quantity": 10, "unit_price": 100}
            ]
        }
        put_resp = self.api_client.put(f'/api/invoices/{invoice_id}/', update_payload, format='json')
        self.assertEqual(put_resp.status_code, status.HTTP_200_OK)

        # Confirm the invoice number was NOT overwritten
        inv = Invoice.objects.get(id=invoice_id)
        self.assertEqual(inv.invoice_number, original_number)
        self.assertNotEqual(inv.invoice_number, "FORGED-9999")

    def test_void_does_not_free_or_reuse_number(self):
        """Verifies voiding an invoice does not cause the next invoice to reuse the number."""
        payload = {
            "client_id": self.client_obj.id,
            "issue_date": "2026-04-01",
            "due_date": "2026-04-15",
            "items": [{"description": "Service A", "quantity": 1, "unit_price": 500}]
        }
        res1 = self.api_client.post('/api/invoices/', payload, format='json')
        num1 = res1.data['invoice_number']

        # Void first invoice
        void_res = self.api_client.post(f"/api/invoices/{res1.data['id']}/void/")
        self.assertEqual(void_res.status_code, status.HTTP_200_OK)

        # Create second invoice
        res2 = self.api_client.post('/api/invoices/', payload, format='json')
        num2 = res2.data['invoice_number']

        self.assertNotEqual(num1, num2)
        # Sequential progression maintained
        seq1 = int(num1.split('-')[-1])
        seq2 = int(num2.split('-')[-1])
        self.assertEqual(seq2, seq1 + 1)
