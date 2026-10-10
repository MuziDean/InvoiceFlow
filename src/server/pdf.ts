import PDFDocument from 'pdfkit';
import { Response } from 'express';
import { BusinessSettings, Invoice } from './db';

function formatAmount(amount: number, currency: string) {
  const formatted = new Intl.NumberFormat('en-ZW', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0);
  return `${currency} ${formatted}`;
}

function formatInvoiceDate(date: string) {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString('en-ZW', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function generateInvoicePdf(invoice: Invoice, settings: BusinessSettings, res: Response) {
  const doc = new PDFDocument({ margin: 45, size: 'A4' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="Invoice-${invoice.invoice_number}.pdf"`
  );

  doc.pipe(res);

  // Brand / Header Colors
  const primaryColor = '#0f172a'; // slate-900
  const secondaryColor = '#475569'; // slate-600
  const accentColor = '#2563eb'; // blue-600
  const borderColor = '#e2e8f0'; // slate-200
  const lightBg = '#f8fafc'; // slate-50

  let hasLogo = false;
  const logoMatch = settings.logo?.match(/^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/);
  if (logoMatch) {
    const imageBuffer = Buffer.from(logoMatch[2], 'base64');
    const alignment = settings.logo_position === 'left' ? undefined : settings.logo_position;
    doc.image(imageBuffer, 45, 42, { fit: [505, 56], align: alignment, valign: 'center' });
    hasLogo = true;
  }
  const headerOffset = hasLogo ? 65 : 0;
  const headerY = 45 + headerOffset;

  // 1. Header: Business Name & INVOICE Title
  doc
    .fontSize(22)
    .font('Helvetica-Bold')
    .fillColor(primaryColor)
    .text(settings.business_name, 45, headerY, { width: 270 });

  doc
    .fontSize(10)
    .font('Helvetica')
    .fillColor(secondaryColor)
    .text(settings.address, 45, headerY + 30, { width: 250, lineGap: 3 });

  doc
    .text(`Email: ${settings.email}`, 45, doc.y + 4)
    .text(`Phone: ${settings.phone}`, 45, doc.y + 2);
  if (settings.vat_number) {
    doc.text(`ZIMRA VAT Registration No: ${settings.vat_number}`, 45, doc.y + 2, { width: 270 });
  }

  // Right column: Invoice Number and Status Badge
  const rightColX = 350;
  doc
    .fontSize(24)
    .font('Helvetica-Bold')
    .fillColor(primaryColor)
    .text('INVOICE', rightColX, headerY, { align: 'right', width: 200 });

  doc
    .fontSize(12)
    .font('Helvetica-Bold')
    .fillColor(accentColor)
    .text(invoice.invoice_number, rightColX, headerY + 30, { align: 'right', width: 200 });

  // Status Pill / Tag
  const statusUpper = invoice.status.toUpperCase();
  let statusColor = '#0284c7'; // default blue
  if (invoice.status === 'paid') statusColor = '#16a34a'; // green
  if (invoice.status === 'overdue') statusColor = '#dc2626'; // red
  if (invoice.status === 'void') statusColor = '#64748b'; // slate

  doc
    .fontSize(9)
    .font('Helvetica-Bold')
    .fillColor(statusColor)
    .text(`STATUS: ${statusUpper}`, rightColX, headerY + 50, { align: 'right', width: 200 });

  doc
    .fontSize(9)
    .font('Helvetica')
    .fillColor(secondaryColor)
    .text(`Issue Date: ${formatInvoiceDate(invoice.issue_date)}`, rightColX, headerY + 65, { align: 'right', width: 200 })
    .text(`Due Date: ${formatInvoiceDate(invoice.due_date)}`, rightColX, headerY + 80, { align: 'right', width: 200 });

  // Divider Line
  const dividerY = 160 + headerOffset;
  doc
    .strokeColor(borderColor)
    .lineWidth(1)
    .moveTo(45, dividerY)
    .lineTo(550, dividerY)
    .stroke();

  // 2. Bill To & Payment Info
  const billToY = 175 + headerOffset;
  doc
    .fontSize(9)
    .font('Helvetica-Bold')
    .fillColor(secondaryColor)
    .text('BILLED TO:', 45, billToY);

  const client = invoice.client;
  doc
    .fontSize(11)
    .font('Helvetica-Bold')
    .fillColor(primaryColor)
    .text(client?.name || 'Valued Client', 45, billToY + 14);

  if (client?.company) {
    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor(secondaryColor)
      .text(client.company, 45, doc.y + 2);
  }

  if (client?.address) {
    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor(secondaryColor)
      .text(client.address, 45, doc.y + 2, { width: 240, lineGap: 2 });
  }

  if (client?.email) {
    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor(secondaryColor)
      .text(client.email, 45, doc.y + 2);
  }

  // Invoice Meta on Right
  doc
    .fontSize(9)
    .font('Helvetica-Bold')
    .fillColor(secondaryColor)
    .text('PAYMENT DETAILS:', rightColX, billToY, { align: 'right', width: 200 });

  doc
    .fontSize(9)
    .font('Helvetica')
    .fillColor(secondaryColor)
    .text(`Currency: ${invoice.currency}`, rightColX, billToY + 14, { align: 'right', width: 200 })
    .text(`Terms: ${invoice.terms || 'Net 14'}`, rightColX, billToY + 28, { align: 'right', width: 200 });

  // 3. Table Header
  const tableTop = 265 + headerOffset;
  doc
    .rect(45, tableTop, 505, 24)
    .fill(lightBg);

  doc
    .strokeColor(borderColor)
    .lineWidth(1)
    .rect(45, tableTop, 505, 24)
    .stroke();

  doc
    .fontSize(8)
    .font('Helvetica-Bold')
    .fillColor(primaryColor)
    .text('ITEM / DESCRIPTION', 55, tableTop + 7, { width: 235 })
    .text('QTY', 300, tableTop + 7, { width: 45, align: 'right' })
    .text(`UNIT PRICE (${invoice.currency})`, 350, tableTop + 7, { width: 90, align: 'right' })
    .text('AMOUNT', 450, tableTop + 7, { width: 90, align: 'right' });

  // 4. Line Items
  let curY = tableTop + 24;
  const items = invoice.items || [];
  
  items.forEach((item, index) => {
    const itemHeight = 24;
    
    // Alternating background for legibility
    if (index % 2 === 1) {
      doc.rect(45, curY, 505, itemHeight).fill('#fafafa');
    }

    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor(primaryColor)
      .text(item.description, 55, curY + 7, { width: 235, lineBreak: false, ellipsis: true })
      .text(Number(item.quantity).toFixed(2), 300, curY + 7, { width: 45, align: 'right' })
      .text(formatAmount(item.unit_price, invoice.currency), 350, curY + 7, { width: 90, align: 'right' })
      .font('Helvetica-Bold')
      .text(formatAmount(item.line_total, invoice.currency), 450, curY + 7, { width: 90, align: 'right' });

    curY += itemHeight;

    // Bottom border for row
    doc
      .strokeColor(borderColor)
      .lineWidth(0.5)
      .moveTo(45, curY)
      .lineTo(550, curY)
      .stroke();
  });

  // 5. Totals Box (Right Aligned)
  const totalsTop = curY + 15;
  const totalLabelsX = 350;
  const totalValuesX = 450;
  const totalsWidth = 100;

  doc
    .fontSize(9)
    .font('Helvetica')
    .fillColor(secondaryColor)
    .text('Subtotal:', totalLabelsX, totalsTop, { align: 'right', width: 90 })
    .fillColor(primaryColor)
    .text(formatAmount(invoice.subtotal, invoice.currency), totalValuesX, totalsTop, { align: 'right', width: totalsWidth });

  let nextTotalY = totalsTop + 16;

  if (invoice.discount_value > 0) {
    const discountLabel = invoice.discount_type === 'percentage' 
      ? `Discount (${invoice.discount_value}%):` 
      : 'Discount (Fixed):';
    const discountAmount = invoice.discount_type === 'percentage'
      ? (invoice.subtotal * invoice.discount_value) / 100
      : invoice.discount_value;

    doc
      .fillColor(secondaryColor)
      .text(discountLabel, totalLabelsX, nextTotalY, { align: 'right', width: 90 })
      .fillColor('#dc2626')
      .text(`-${formatAmount(discountAmount, invoice.currency)}`, totalValuesX, nextTotalY, { align: 'right', width: totalsWidth });
    nextTotalY += 16;
  }

  if (invoice.tax_rate > 0) {
    doc
      .fillColor(secondaryColor)
      .text(`VAT (${invoice.tax_rate}%):`, totalLabelsX, nextTotalY, { align: 'right', width: 90 })
      .fillColor(primaryColor)
      .text(formatAmount(invoice.tax_amount, invoice.currency), totalValuesX, nextTotalY, { align: 'right', width: totalsWidth });
    nextTotalY += 16;
  }

  // Grand Total highlight bar
  nextTotalY += 4;
  doc
    .rect(340, nextTotalY - 4, 210, 28)
    .fill('#f1f5f9');

  doc
    .fontSize(11)
    .font('Helvetica-Bold')
    .fillColor(primaryColor)
    .text('Total Due:', totalLabelsX, nextTotalY + 3, { align: 'right', width: 90 })
    .fontSize(12)
    .fillColor(accentColor)
    .text(formatAmount(invoice.total, invoice.currency), totalValuesX, nextTotalY + 2, { align: 'right', width: totalsWidth });

  // 6. Notes & Terms
  const notesY = totalsTop;
  if (invoice.notes || invoice.terms) {
    doc
      .fontSize(9)
      .font('Helvetica-Bold')
      .fillColor(secondaryColor)
      .text('NOTES & INSTRUCTIONS:', 45, notesY);

    if (invoice.notes) {
      doc
        .fontSize(9)
        .font('Helvetica')
        .fillColor(primaryColor)
        .text(invoice.notes, 45, notesY + 14, { width: 280 });
    }

    if (invoice.terms) {
      doc
        .fontSize(8)
        .font('Helvetica-Oblique')
        .fillColor(secondaryColor)
        .text(`Terms: ${invoice.terms}`, 45, doc.y + 6, { width: 280 });
    }
  }

  // 7. Footer
  const footerY = 770;
  doc
    .strokeColor(borderColor)
    .lineWidth(1)
    .moveTo(45, footerY)
    .lineTo(550, footerY)
    .stroke();

  doc
    .fontSize(8)
    .font('Helvetica')
    .fillColor(secondaryColor)
    .text(settings.footer_note || 'Thank you for your business.', 45, footerY + 8, {
      align: 'center',
      width: 505,
    });

  doc.end();
}

export function generateReceiptPdf(invoice: Invoice, settings: BusinessSettings, res: Response) {
  const doc = new PDFDocument({ margin: 45, size: 'A4' });
  const rightColX = 350;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="Receipt-${invoice.invoice_number}.pdf"`
  );
  doc.pipe(res);

  const primaryColor = '#0f172a';
  const secondaryColor = '#475569';
  const accentColor = '#15803d';
  const borderColor = '#e2e8f0';
  const logoMatch = settings.logo?.match(/^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/);
  const hasLogo = Boolean(logoMatch);

  if (logoMatch) {
    const imageBuffer = Buffer.from(logoMatch[2], 'base64');
    const alignment = settings.logo_position === 'left' ? undefined : settings.logo_position;
    doc.image(imageBuffer, 45, 42, { fit: [505, 56], align: alignment, valign: 'center' });
  }

  const headerY = hasLogo ? 110 : 45;
  doc
    .fontSize(20)
    .font('Helvetica-Bold')
    .fillColor(primaryColor)
    .text(settings.business_name, 45, headerY, { width: 270 });

  doc
    .fontSize(9)
    .font('Helvetica')
    .fillColor(secondaryColor)
    .text(settings.address, 45, headerY + 27, { width: 250, lineGap: 2 })
    .text(`Email: ${settings.email}`, 45, doc.y + 3)
    .text(`Phone: ${settings.phone}`, 45, doc.y + 2);
  if (settings.vat_number) {
    doc.text(`ZIMRA VAT Registration No: ${settings.vat_number}`, 45, doc.y + 2, { width: 270 });
  }

  doc
    .fontSize(22)
    .font('Helvetica-Bold')
    .fillColor(primaryColor)
    .text('PAYMENT RECEIPT', rightColX, headerY, { align: 'right', width: 200 })
    .fontSize(11)
    .fillColor(accentColor)
    .text(`RCPT-${invoice.invoice_number}`, rightColX, headerY + 30, { align: 'right', width: 200 })
    .fontSize(9)
    .font('Helvetica')
    .fillColor(secondaryColor)
    .text(`Invoice: ${invoice.invoice_number}`, rightColX, headerY + 50, { align: 'right', width: 200 })
    .text(
      `Date paid: ${invoice.paid_at ? formatInvoiceDate(invoice.paid_at.slice(0, 10)) : 'Not recorded'}`,
      rightColX,
      headerY + 65,
      { align: 'right', width: 200 }
    );

  const dividerY = headerY + 98;
  doc
    .strokeColor(borderColor)
    .lineWidth(1)
    .moveTo(45, dividerY)
    .lineTo(550, dividerY)
    .stroke();

  const billToY = dividerY + 15;
  const client = invoice.client;
  doc
    .fontSize(9)
    .font('Helvetica-Bold')
    .fillColor(secondaryColor)
    .text('PAYMENT RECEIVED FROM:', 45, billToY)
    .fontSize(11)
    .fillColor(primaryColor)
    .text(client?.name || 'Valued Client', 45, billToY + 14);

  if (client?.company) {
    doc.fontSize(9).font('Helvetica').fillColor(secondaryColor).text(client.company, 45, doc.y + 2);
  }
  if (client?.address) {
    doc.fontSize(9).font('Helvetica').fillColor(secondaryColor).text(client.address, 45, doc.y + 2, { width: 240 });
  }

  doc
    .fontSize(9)
    .font('Helvetica-Bold')
    .fillColor(secondaryColor)
    .text('PAYMENT STATUS:', rightColX, billToY, { align: 'right', width: 200 })
    .fontSize(10)
    .fillColor(accentColor)
    .text('PAID IN FULL', rightColX, billToY + 14, { align: 'right', width: 200 })
    .fontSize(9)
    .font('Helvetica')
    .fillColor(secondaryColor)
    .text(`Currency: ${invoice.currency}`, rightColX, billToY + 30, { align: 'right', width: 200 });

  const tableTop = dividerY + 105;
  doc
    .rect(45, tableTop, 505, 24)
    .fill('#f8fafc');
  doc
    .strokeColor(borderColor)
    .lineWidth(1)
    .rect(45, tableTop, 505, 24)
    .stroke();
  doc
    .fontSize(9)
    .font('Helvetica-Bold')
    .fillColor(primaryColor)
    .text('ITEM / DESCRIPTION', 55, tableTop + 7)
    .text('QTY', 365, tableTop + 7, { width: 45, align: 'right' })
    .text('AMOUNT', 440, tableTop + 7, { width: 100, align: 'right' });

  let currentY = tableTop + 24;
  for (const item of invoice.items || []) {
    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor(primaryColor)
      .text(item.description, 55, currentY + 7, { width: 290, lineBreak: false, ellipsis: true })
      .text(Number(item.quantity).toFixed(2), 365, currentY + 7, { width: 45, align: 'right' })
      .text(formatAmount(item.line_total, invoice.currency), 440, currentY + 7, { width: 100, align: 'right' });
    currentY += 24;
    doc.strokeColor(borderColor).lineWidth(0.5).moveTo(45, currentY).lineTo(550, currentY).stroke();
  }

  const labelsX = 350;
  const valuesX = 440;
  const valuesWidth = 100;
  let totalY = currentY + 16;
  doc
    .fontSize(9)
    .font('Helvetica')
    .fillColor(secondaryColor)
    .text('Subtotal:', labelsX, totalY, { align: 'right', width: 80 })
    .fillColor(primaryColor)
    .text(formatAmount(invoice.subtotal, invoice.currency), valuesX, totalY, { align: 'right', width: valuesWidth });
  totalY += 16;

  if (invoice.discount_value > 0) {
    const discount = invoice.discount_type === 'percentage'
      ? invoice.subtotal * invoice.discount_value / 100
      : invoice.discount_value;
    doc
      .fillColor(secondaryColor)
      .text('Discount:', labelsX, totalY, { align: 'right', width: 80 })
      .fillColor('#dc2626')
      .text(`-${formatAmount(discount, invoice.currency)}`, valuesX, totalY, { align: 'right', width: valuesWidth });
    totalY += 16;
  }

  if (invoice.tax_rate > 0) {
    doc
      .fillColor(secondaryColor)
      .text(`VAT (${invoice.tax_rate}%):`, labelsX, totalY, { align: 'right', width: 80 })
      .fillColor(primaryColor)
      .text(formatAmount(invoice.tax_amount, invoice.currency), valuesX, totalY, { align: 'right', width: valuesWidth });
    totalY += 16;
  }

  totalY += 4;
  doc.rect(340, totalY - 4, 210, 30).fill('#f0fdf4');
  doc
    .fontSize(10)
    .font('Helvetica-Bold')
    .fillColor(primaryColor)
    .text('Amount Received:', labelsX, totalY + 4, { align: 'right', width: 90 })
    .fillColor(accentColor)
    .text(formatAmount(invoice.total, invoice.currency), valuesX, totalY + 3, { align: 'right', width: valuesWidth });

  doc
    .fontSize(9)
    .font('Helvetica')
    .fillColor(secondaryColor)
    .text('Balance Due:', labelsX, totalY + 38, { align: 'right', width: 90 })
    .fillColor(primaryColor)
    .text(formatAmount(0, invoice.currency), valuesX, totalY + 38, { align: 'right', width: valuesWidth });

  const footerY = 770;
  doc.strokeColor(borderColor).lineWidth(1).moveTo(45, footerY).lineTo(550, footerY).stroke();
  doc
    .fontSize(8)
    .font('Helvetica')
    .fillColor(secondaryColor)
    .text(settings.footer_note || 'Payment received with thanks.', 45, footerY + 8, { align: 'center', width: 505 });

  doc.end();
}
