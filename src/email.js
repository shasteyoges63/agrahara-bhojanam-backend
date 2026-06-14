import nodemailer from 'nodemailer';
import { generateOrderInvoicePdf, invoicePdfFilename } from './invoicePdf.js';

let transporter = null;
let activeConfig = null;
let lastSmtpError = null;

export function isSmtpReady() {
  return Boolean(transporter && activeConfig);
}

export function getLastSmtpError() {
  return lastSmtpError;
}

function maskEmail(email) {
  const [user, domain] = email.split('@');
  if (!domain) return '***';
  const visible = user.slice(0, Math.min(3, user.length));
  return `${visible}***@${domain}`;
}

function normalizeAppPassword(value) {
  return value?.trim().replace(/\s+/g, '') || '';
}

export function resolveSmtpConfig(dbConfig) {
  const password =
    normalizeAppPassword(process.env.SMTP_PASS) ||
    normalizeAppPassword(dbConfig?.password);
  const host = process.env.SMTP_HOST?.trim() || dbConfig?.host?.trim();
  const port = Number(process.env.SMTP_PORT || dbConfig?.port || 465);
  let secure = process.env.SMTP_SECURE !== undefined
    ? process.env.SMTP_SECURE !== 'false'
    : (dbConfig?.secure ?? port === 465);
  // Gmail: 465 = SSL, 587 = STARTTLS (secure=false on 465 causes "Connection closed")
  if (port === 465) secure = true;
  if (port === 587) secure = false;
  const senderEmail =
    process.env.SMTP_FROM?.trim() ||
    process.env.SMTP_USER?.trim() ||
    dbConfig?.senderEmail?.trim() ||
    dbConfig?.username?.trim();
  const username =
    process.env.SMTP_USER?.trim() ||
    dbConfig?.username?.trim() ||
    senderEmail;

  if (!host || !username || !password || !senderEmail) return null;

  return { host, port, secure, username, password, senderEmail };
}

export function getActiveSmtpConfig() {
  return activeConfig;
}

export async function initEmailService(db) {
  const doc = await db.collection('configs').findOne({ _id: 'smtp' });
  const config = resolveSmtpConfig(doc);

  console.log('\n--- SMTP Email (Gmail) ---');
  if (!config) {
    lastSmtpError = 'SMTP not configured';
    console.log('Status: not configured');
    console.log('Add to backend/.env:');
    console.log('  SMTP_HOST=smtp.gmail.com');
    console.log('  SMTP_PORT=465');
    console.log('  SMTP_SECURE=true');
    console.log('  SMTP_USER=your@gmail.com');
    console.log('  SMTP_PASS=your-gmail-app-password');
    console.log('  SMTP_FROM=your@gmail.com');
    console.log('--------------------------\n');
    transporter = null;
    activeConfig = null;
    return false;
  }

  lastSmtpError = null;
  console.log(`Host:   ${config.host}`);
  console.log(`Port:   ${config.port} (${config.secure ? 'SSL' : 'STARTTLS'})`);
  console.log(`From:   ${config.senderEmail}`);
  console.log(`User:   ${maskEmail(config.username)}`);
  const passSource = process.env.SMTP_PASS?.trim() ? '.env' : 'database';
  console.log(`Pass:   **** (from ${passSource})`);

  const mailer = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.username,
      pass: config.password,
    },
    tls: {
      minVersion: 'TLSv1.2',
    },
  });

  try {
    await mailer.verify();
    transporter = mailer;
    activeConfig = config;
    lastSmtpError = null;
    console.log('Status: ready — order & contact emails enabled');
    console.log('--------------------------\n');
    return true;
  } catch (err) {
    transporter = null;
    activeConfig = null;
    const message = err instanceof Error ? err.message : String(err);
    lastSmtpError = message.includes('BadCredentials')
      ? 'Gmail rejected the App Password. Generate a new one for this account (Google Account → Security → App passwords) and update backend/.env, then restart.'
      : message;
    console.log(`Status: failed — ${message}`);
    console.log('Check SMTP_USER / SMTP_PASS (use a Gmail App Password, 16 chars, quotes if it contains spaces)');
    console.log('--------------------------\n');
    return false;
  }
}

async function sendMail(options) {
  if (!transporter || !activeConfig) return false;

  try {
    await transporter.sendMail({
      from: `"Agrahara Bhojanam" <${activeConfig.senderEmail}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      attachments: options.attachments,
    });
    return true;
  } catch (err) {
    console.error('Email send failed:', err instanceof Error ? err.message : err);
    return false;
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatInr(amount) {
  return `₹${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatOrderDate(iso) {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function paymentMethodLabel(method) {
  if (method === 'COD') return 'Cash on delivery';
  if (method === 'UPI') return 'UPI';
  if (method === 'WhatsAppLink') return 'WhatsApp payment link';
  return method;
}

const EMAIL = {
  maroon: '#5c1a1b',
  gold: '#c9a227',
  cream: '#fff8f0',
  paper: '#fffbf5',
  ink: '#2c1810',
  muted: '#6b5b4f',
  border: '#e8dcc8',
};

function orderItemRows(items) {
  return items
    .map((item) => {
      const lineTotal = item.price * item.quantity;
      const img = item.imageUrl
        ? `<img src="${escapeHtml(item.imageUrl)}" alt="" width="52" height="52" style="display:block;border-radius:8px;object-fit:cover;border:1px solid ${EMAIL.border};" />`
        : `<div style="width:52px;height:52px;border-radius:8px;background:${EMAIL.cream};border:1px solid ${EMAIL.border};text-align:center;line-height:52px;font-size:18px;color:${EMAIL.gold};">🌿</div>`;

      return `
        <tr>
          <td style="padding:14px 0;border-bottom:1px solid ${EMAIL.border};">
            <table cellpadding="0" cellspacing="0" width="100%" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${EMAIL.ink};">
              <tr>
                <td width="64" valign="top">${img}</td>
                <td valign="top" style="padding-left:12px;">
                  <strong style="color:${EMAIL.maroon};font-family:Georgia,serif;">${escapeHtml(item.productName)}</strong>
                </td>
                <td width="56" valign="top" align="center" style="color:${EMAIL.muted};">×${item.quantity}</td>
                <td width="88" valign="top" align="right" style="font-weight:bold;">${formatInr(lineTotal)}</td>
              </tr>
            </table>
          </td>
        </tr>`;
    })
    .join('');
}

function buildOrderEmailHtml(order, variant) {
  const isStore = variant === 'store';
  const orderRef = escapeHtml(order.invoiceNumber);
  const orderDate = formatOrderDate(order.orderDate);
  const subtotal = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const itemsHtml = orderItemRows(order.items);

  const headline = isStore
    ? `New order: ${orderRef}`
    : 'Thank you for your order!';
  const intro = isStore
    ? `You've received a new order from <strong style="color:${EMAIL.maroon};">${escapeHtml(order.customerName)}</strong>:`
    : `Dear <strong style="color:${EMAIL.maroon};">${escapeHtml(order.customerName)}</strong>, we've received your order and our kitchen team is preparing your traditional items with care.`;

  const addressTitle = isStore ? 'Billing address' : 'Delivery address';

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f0e8;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f5f0e8;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%;background:${EMAIL.paper};border:1px solid ${EMAIL.border};border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(44,24,16,0.08);">

        <!-- Brand header -->
        <tr>
          <td style="background:${EMAIL.maroon};padding:28px 32px 24px;text-align:center;border-bottom:3px solid ${EMAIL.gold};">
            <p style="margin:0 0 10px;font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:4px;text-transform:uppercase;color:${EMAIL.gold};">Agrahara Bhojanam</p>
            <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:normal;color:#fff8f0;line-height:1.3;">${headline}</h1>
          </td>
        </tr>

        <!-- Intro -->
        <tr>
          <td style="padding:28px 32px 8px;font-family:Georgia,serif;font-size:15px;line-height:1.65;color:${EMAIL.ink};">
            <p style="margin:0;">${intro}</p>
          </td>
        </tr>

        <!-- Order summary -->
        <tr>
          <td style="padding:16px 32px 8px;">
            <h2 style="margin:0 0 12px;font-family:Georgia,serif;font-size:18px;color:${EMAIL.maroon};">Order summary</h2>
            <p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${EMAIL.muted};">
              Order <strong style="color:${EMAIL.ink};">${orderRef}</strong>
              <span style="color:#bbb;"> · </span>${orderDate}
            </p>

            <!-- Column headers -->
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-bottom:2px solid ${EMAIL.gold};padding-bottom:8px;margin-bottom:4px;">
              <tr style="font-family:Arial,Helvetica,sans-serif;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:${EMAIL.muted};">
                <td>Product</td>
                <td width="56" align="center">Qty</td>
                <td width="88" align="right">Price</td>
              </tr>
            </table>

            <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
              ${itemsHtml}
            </table>
          </td>
        </tr>

        <!-- Totals -->
        <tr>
          <td style="padding:8px 32px 24px;">
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${EMAIL.ink};">
              <tr>
                <td style="padding:8px 0;color:${EMAIL.muted};">Subtotal</td>
                <td align="right" style="padding:8px 0;">${formatInr(subtotal)}</td>
              </tr>
              <tr>
                <td style="padding:12px 0 8px;font-family:Georgia,serif;font-size:17px;font-weight:bold;color:${EMAIL.maroon};border-top:1px solid ${EMAIL.border};">Total</td>
                <td align="right" style="padding:12px 0 8px;font-family:Georgia,serif;font-size:17px;font-weight:bold;color:${EMAIL.maroon};border-top:1px solid ${EMAIL.border};">${formatInr(order.totalPrice)}</td>
              </tr>
              <tr>
                <td colspan="2" style="padding:12px 0 0;font-size:13px;color:${EMAIL.muted};">
                  Payment method: <strong style="color:${EMAIL.ink};">${escapeHtml(paymentMethodLabel(order.paymentMethod))}</strong>
                  ${order.paymentStatus ? ` <span style="color:#bbb;">·</span> ${escapeHtml(order.paymentStatus)}` : ''}
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Address -->
        <tr>
          <td style="padding:0 32px 28px;">
            <div style="background:${EMAIL.cream};border:1px solid ${EMAIL.border};border-radius:10px;padding:20px 22px;">
              <h3 style="margin:0 0 12px;font-family:Georgia,serif;font-size:16px;color:${EMAIL.maroon};">${addressTitle}</h3>
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.7;color:${EMAIL.ink};">
                <strong>${escapeHtml(order.customerName)}</strong><br />
                ${escapeHtml(order.customerAddress)}<br />
                <a href="tel:${escapeHtml(order.customerPhone)}" style="color:${EMAIL.maroon};text-decoration:none;">${escapeHtml(order.customerPhone)}</a><br />
                <a href="mailto:${escapeHtml(order.customerEmail)}" style="color:${EMAIL.maroon};text-decoration:underline;">${escapeHtml(order.customerEmail)}</a>
              </p>
            </div>
          </td>
        </tr>

        <!-- PDF attachment note -->
        <tr>
          <td style="padding:0 32px 24px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${EMAIL.ink};">
            <div style="background:#fffcf8;border:1px dashed ${EMAIL.gold};border-radius:10px;padding:14px 18px;">
              📎 <strong>Tax invoice PDF attached</strong> — ${orderRef} (${formatInr(order.totalPrice)})
            </div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:${EMAIL.cream};padding:20px 32px;text-align:center;border-top:1px solid ${EMAIL.border};">
            <p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:${EMAIL.gold};">🌱 Handcrafted Traditional Heritage 🌱</p>
            <p style="margin:0;font-family:Georgia,serif;font-size:13px;color:${EMAIL.muted};">Agrahara Bhojanam · Madurai, Tamil Nadu</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function orderEmailHtml(order) {
  return buildOrderEmailHtml(order, 'customer');
}

function storeOrderEmailHtml(order) {
  return buildOrderEmailHtml(order, 'store');
}

function orderEmailText(order, variant) {
  const isStore = variant === 'store';
  const lines = order.items.map(
    (item) => `- ${item.productName} ×${item.quantity} — ${formatInr(item.price * item.quantity)}`,
  );
  const header = isStore
    ? `New order ${order.invoiceNumber} from ${order.customerName}`
    : `Thank you ${order.customerName}. Order ${order.invoiceNumber} confirmed.`;
  return [
    header,
    '',
    ...lines,
    '',
    `Total: ${formatInr(order.totalPrice)}`,
    `Payment: ${paymentMethodLabel(order.paymentMethod)}`,
    `${isStore ? 'Billing' : 'Delivery'}: ${order.customerAddress}`,
    `Phone: ${order.customerPhone}`,
    `Email: ${order.customerEmail}`,
    '',
    `Invoice PDF attached: ${invoicePdfFilename(order)}`,
  ].join('\n');
}

async function orderInvoiceAttachments(order) {
  try {
    const content = await generateOrderInvoicePdf(order);
    return [
      {
        filename: invoicePdfFilename(order),
        content,
        contentType: 'application/pdf',
      },
    ];
  } catch (err) {
    console.error('Invoice PDF generation failed:', err instanceof Error ? err.message : err);
    return [];
  }
}

export async function enrichOrderWithProductImages(order, productsCol) {
  const items = await Promise.all(
    order.items.map(async (item) => {
      const product = await productsCol.findOne({ id: item.productId });
      return {
        ...item,
        imageUrl: product?.images?.[0] || null,
      };
    }),
  );
  return { ...order, items };
}

export async function sendOrderConfirmationEmail(order) {
  if (!order.customerEmail?.trim()) return false;

  const attachments = await orderInvoiceAttachments(order);

  return sendMail({
    to: order.customerEmail.trim(),
    subject: `Order confirmed — ${order.invoiceNumber} | Agrahara Bhojanam`,
    html: orderEmailHtml(order),
    text: orderEmailText(order, 'customer'),
    attachments,
  });
}

export async function sendStoreOrderNotificationEmail(order) {
  const notifyTo =
    process.env.SMTP_NOTIFY_TO?.trim() ||
    activeConfig?.senderEmail ||
    process.env.SMTP_FROM?.trim();

  if (!notifyTo) return false;

  const attachments = await orderInvoiceAttachments(order);

  return sendMail({
    to: notifyTo,
    subject: `New order: ${order.invoiceNumber} — ${order.customerName} | Agrahara Bhojanam`,
    html: storeOrderEmailHtml(order),
    text: orderEmailText(order, 'store'),
    attachments,
  });
}

export async function sendContactNotificationEmail(message) {
  const notifyTo =
    process.env.SMTP_NOTIFY_TO?.trim() ||
    activeConfig?.senderEmail ||
    process.env.SMTP_FROM?.trim();

  if (!notifyTo) return false;

  return sendMail({
    to: notifyTo,
    subject: `Contact: ${message.subject}`,
    html: `
      <h3>New contact message</h3>
      <p><strong>Name:</strong> ${message.name}</p>
      <p><strong>Email:</strong> ${message.email}</p>
      <p><strong>Phone:</strong> ${message.phone}</p>
      <p><strong>Subject:</strong> ${message.subject}</p>
      <p>${message.message}</p>
    `,
    text: `${message.name} (${message.email}): ${message.message}`,
  });
}

export async function sendTestEmail(to) {
  return sendMail({
    to,
    subject: 'SMTP test — Agrahara Bhojanam',
    html: '<p>Your Gmail SMTP setup is working correctly.</p>',
    text: 'Your Gmail SMTP setup is working correctly.',
  });
}
