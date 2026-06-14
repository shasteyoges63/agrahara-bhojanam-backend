import PDFDocument from 'pdfkit';

const COLORS = {
  maroon: '#5c1a1b',
  gold: '#c9a227',
  cream: '#fff8f0',
  ink: '#2c1810',
  muted: '#6b5b4f',
};

function formatInr(amount) {
  return `Rs. ${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatInvoiceDate(iso) {
  return new Date(iso).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function paymentLabel(method) {
  if (method === 'COD') return 'Cash on delivery';
  if (method === 'UPI') return 'UPI';
  if (method === 'WhatsAppLink') return 'WhatsApp payment link';
  return method;
}

/**
 * Generate a royal-themed tax invoice PDF buffer for an order.
 */
export function generateOrderInvoicePdf(order) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 36 });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = doc.page.margins.left;
    const pageW = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    // Header band
    const headerTop = doc.y;
    doc.rect(left, headerTop, pageW, 90).fill(COLORS.maroon);

    doc.fillColor(COLORS.gold).font('Helvetica').fontSize(8).text(
      'ROYAL TRADITIONAL FOODS · MADURAI',
      left + 16,
      headerTop + 14,
      { characterSpacing: 1.5 },
    );
    doc.fillColor('#fff8f0').font('Helvetica-Bold').fontSize(22).text(
      'Agrahara Bhojanam',
      left + 16,
      headerTop + 28,
    );
    doc.fillColor('#e8d48b').font('Helvetica').fontSize(8).text(
      'Temple Road, Srirangam, Madurai, Tamil Nadu 625001\nadmin@agraharabhojanam.com · FSSAI 22421008000213',
      left + 16,
      headerTop + 54,
      { width: pageW * 0.55 },
    );

    const metaX = left + pageW - 156;
    doc.fillColor(COLORS.gold).font('Helvetica-Bold').fontSize(8).text('TAX INVOICE', metaX, headerTop + 14, {
      width: 140,
      align: 'right',
    });
    doc.fillColor('#f5e6b8').font('Helvetica').fontSize(8).text(
      `No: ${order.invoiceNumber}\nDate: ${formatInvoiceDate(order.orderDate)}\nPlace of Supply: Tamil Nadu (33)`,
      metaX,
      headerTop + 28,
      { width: 140, align: 'right' },
    );

    doc.y = headerTop + 102;

    // Bill / Ship cards
    const cardW = (pageW - 12) / 2;
    const cardY = doc.y;

    doc.roundedRect(left, cardY, cardW, 74, 6).fillAndStroke(COLORS.cream, '#e8dcc8');
    doc.fillColor(COLORS.maroon).font('Helvetica-Bold').fontSize(8).text('BILL TO', left + 10, cardY + 10);
    doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(10).text(order.customerName, left + 10, cardY + 24);
    doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted).text(
      `${order.customerEmail}\n${order.customerPhone}`,
      left + 10,
      cardY + 40,
    );

    doc.roundedRect(left + cardW + 12, cardY, cardW, 74, 6).fillAndStroke(COLORS.cream, '#e8dcc8');
    doc.fillColor(COLORS.maroon).font('Helvetica-Bold').fontSize(8).text('SHIP TO', left + cardW + 22, cardY + 10);
    doc.font('Helvetica').fontSize(8).fillColor(COLORS.ink).text(order.customerAddress, left + cardW + 22, cardY + 24, {
      width: cardW - 20,
    });

    doc.y = cardY + 88;

    // Table
    const cols = [
      { label: '#', w: 24, align: 'center' },
      { label: 'Item Description', w: pageW - 232, align: 'left' },
      { label: 'HSN', w: 50, align: 'center' },
      { label: 'Rate', w: 52, align: 'right' },
      { label: 'Qty', w: 44, align: 'center' },
      { label: 'Amount', w: 62, align: 'right' },
    ];

    const headerY = doc.y;
    doc.rect(left, headerY, pageW, 22).fill('#f0e6d8');
    doc.fillColor(COLORS.maroon).font('Helvetica-Bold').fontSize(7);

    let x = left;
    for (const col of cols) {
      doc.text(col.label, x + 4, headerY + 7, { width: col.w - 8, align: col.align });
      x += col.w;
    }
    doc.y = headerY + 26;

    doc.font('Helvetica').fontSize(8).fillColor(COLORS.ink);
    order.items.forEach((item, idx) => {
      const rowY = doc.y;
      if (idx % 2 === 1) {
        doc.rect(left, rowY - 2, pageW, 20).fill('#fffcf8');
        doc.fillColor(COLORS.ink);
      }

      const lineTotal = item.price * item.quantity;
      const values = [
        String(idx + 1),
        item.productName,
        '21069099',
        formatInr(item.price),
        String(item.quantity),
        formatInr(lineTotal),
      ];

      x = left;
      cols.forEach((col, i) => {
        doc.text(values[i], x + 4, rowY, { width: col.w - 8, align: col.align, lineBreak: false });
        x += col.w;
      });
      doc.y = rowY + 18;
    });

    doc.moveTo(left, doc.y + 4).lineTo(left + pageW, doc.y + 4).strokeColor('#e8dcc8').stroke();
    doc.y += 12;

    const summaryX = left + pageW - 220;
    doc.fontSize(8).fillColor(COLORS.muted);
    doc.text('CGST (2.5% included)', summaryX, doc.y, { width: 130, align: 'right' });
    doc.text('Incl.', summaryX + 140, doc.y, { width: 60, align: 'right' });
    doc.y += 14;
    doc.text('SGST (2.5% included)', summaryX, doc.y, { width: 130, align: 'right' });
    doc.text('Incl.', summaryX + 140, doc.y, { width: 60, align: 'right' });
    doc.y += 14;
    doc.text('Shipping', summaryX, doc.y, { width: 130, align: 'right' });
    doc.fillColor('#1b4332').text('FREE', summaryX + 140, doc.y, { width: 60, align: 'right' });
    doc.y += 18;
    doc.fillColor(COLORS.maroon).font('Helvetica-Bold').fontSize(11);
    doc.text('GRAND TOTAL', summaryX, doc.y, { width: 130, align: 'right' });
    doc.text(formatInr(order.totalPrice), summaryX + 140, doc.y, { width: 60, align: 'right' });

    doc.y += 36;
    doc.roundedRect(left, doc.y, pageW, 90, 6).fillAndStroke('#fffcf8', '#e8dcc8');
    const footY = doc.y + 10;

    doc.fillColor(COLORS.maroon).font('Helvetica-Bold').fontSize(7).text('DECLARATION', left + 12, footY);
    doc.fillColor(COLORS.muted).font('Helvetica-Oblique').fontSize(7).text(
      'We certify that the particulars above are true and correct. All items are pure vegetarian, handcrafted in our agraharam kitchen without preservatives.',
      left + 12,
      footY + 14,
      { width: pageW * 0.62 },
    );
    doc.font('Helvetica').fontSize(7).fillColor(COLORS.muted);
    doc.text(`Status: ${order.status || 'Pending'}`, left + 12, footY + 46);
    doc.text(`Payment: ${order.paymentStatus || 'Pending'}`, left + 12, footY + 58);
    doc.text(`Method: ${paymentLabel(order.paymentMethod)}`, left + 12, footY + 70);

    doc.fillColor(COLORS.maroon).font('Helvetica-Bold').fontSize(7).text(
      'Authorized Signatory\nAgrahara Bhojanam Kitchens',
      left + pageW - 140,
      footY + 46,
      { width: 128, align: 'right' },
    );

    doc.end();
  });
}

export function invoicePdfFilename(order) {
  const safe = String(order.invoiceNumber || 'invoice').replace(/[^\w-]+/g, '_');
  return `Agrahara_Bhojanam_Invoice_${safe}.pdf`;
}
