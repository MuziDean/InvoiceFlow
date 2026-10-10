import PDFDocument from 'pdfkit';
import { Response } from 'express';
import { BusinessSettings, Invoice } from './db';

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

  // 1. Header: Business Name & INVOICE Title
  doc
    .fontSize(22)
    .font('Helvetica-Bold')
    .fillColor(primaryColor)
    .text(settings.business_name, 45, 45);

  doc
    .fontSize(10)
    .font('Helvetica')
    .fillColor(secondaryColor)
    .text(settings.address, 45, 75, { width: 250, lineGap: 3 });

  doc
    .text(`Email: ${settings.email}`, 45, doc.y + 4)
    .text(`Phone: ${settings.phone}`, 45, doc.y + 2);

  // Right column: Invoice Number and Status Badge
  const rightColX = 350;
  doc
    .fontSize(24)
    .font('Helvetica-Bold')
    .fillColor(primaryColor)
    .text('INVOICE', rightColX, 45, { align: 'right', width: 200 });

  doc
    .fontSize(12)
    .font('Helvetica-Bold')
    .fillColor(accentColor)
    .text(invoice.invoice_number, rightColX, 75, { align: 'right', width: 200 });

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
    .text(`STATUS: ${statusUpper}`, rightColX, 95, { align: 'right', width: 200 });

  doc
    .fontSize(9)
    .font('Helvetica')
    .fillColor(secondaryColor)
    .text(`Issue Date: ${invoice.issue_date}`, rightColX, 110, { align: 'right', width: 200 })
    .text(`Due Date: ${invoice.due_date}`, rightColX, 125, { align: 'right', width: 200 });

  // Divider Line
  const dividerY = 160;
  doc
    .strokeColor(borderColor)
    .lineWidth(1)
    .moveTo(45, dividerY)
    .lineTo(550, dividerY)
    .stroke();

  // 2. Bill To & Payment Info
  const billToY = 175;
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
  const tableTop = 265;
  doc
    .rect(45, tableTop, 505, 24)
    .fill(lightBg);

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
    .text('QTY', 330, tableTop + 7, { width: 40, align: 'right' })
    .text('UNIT PRICE', 390, tableTop + 7, { width: 60, align: 'right' })
    .text('AMOUNT', 470, tableTop + 7, { width: 70, align: 'right' });

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
      .text(item.description, 55, curY + 7, { width: 260, lineBreak: false, ellipsis: true })
      .text(Number(item.quantity).toFixed(2), 330, curY + 7, { width: 40, align: 'right' })
      .text(`$${Number(item.unit_price).toFixed(2)}`, 390, curY + 7, { width: 60, align: 'right' })
      .font('Helvetica-Bold')
      .text(`$${Number(item.line_total).toFixed(2)}`, 470, curY + 7, { width: 70, align: 'right' });

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
  const totalValuesX = 460;
  const totalsWidth = 80;

  doc
    .fontSize(9)
    .font('Helvetica')
    .fillColor(secondaryColor)
    .text('Subtotal:', totalLabelsX, totalsTop, { align: 'right', width: 90 })
    .fillColor(primaryColor)
    .text(`$${Number(invoice.subtotal).toFixed(2)}`, totalValuesX, totalsTop, { align: 'right', width: totalsWidth });

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
      .text(`-$${Number(discountAmount).toFixed(2)}`, totalValuesX, nextTotalY, { align: 'right', width: totalsWidth });
    nextTotalY += 16;
  }

  if (invoice.tax_rate > 0) {
    doc
      .fillColor(secondaryColor)
      .text(`Tax (${invoice.tax_rate}%):`, totalLabelsX, nextTotalY, { align: 'right', width: 90 })
      .fillColor(primaryColor)
      .text(`$${Number(invoice.tax_amount).toFixed(2)}`, totalValuesX, nextTotalY, { align: 'right', width: totalsWidth });
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
    .text(`$${Number(invoice.total).toFixed(2)}`, totalValuesX, nextTotalY + 2, { align: 'right', width: totalsWidth });

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
