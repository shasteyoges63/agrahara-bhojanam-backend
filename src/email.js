import nodemailer from 'nodemailer';

let transporter = null;
let activeConfig = null;

function maskEmail(email) {
  const [user, domain] = email.split('@');
  if (!domain) return '***';
  const visible = user.slice(0, Math.min(3, user.length));
  return `${visible}***@${domain}`;
}

export function resolveSmtpConfig(dbConfig) {
  const password = process.env.SMTP_PASS?.trim();
  const host = process.env.SMTP_HOST?.trim() || dbConfig?.host?.trim();
  const port = Number(process.env.SMTP_PORT || dbConfig?.port || 465);
  const secure = process.env.SMTP_SECURE !== undefined
    ? process.env.SMTP_SECURE !== 'false'
    : (dbConfig?.secure ?? port === 465);
  const username = process.env.SMTP_USER?.trim() || dbConfig?.username?.trim();
  const senderEmail =
    process.env.SMTP_FROM?.trim() ||
    process.env.SMTP_USER?.trim() ||
    dbConfig?.senderEmail?.trim();

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

  console.log(`Host:   ${config.host}`);
  console.log(`Port:   ${config.port} (${config.secure ? 'SSL' : 'STARTTLS'})`);
  console.log(`From:   ${config.senderEmail}`);
  console.log(`User:   ${maskEmail(config.username)}`);
  console.log('Pass:   **** (from .env)');

  const mailer = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.username,
      pass: config.password,
    },
  });

  try {
    await mailer.verify();
    transporter = mailer;
    activeConfig = config;
    console.log('Status: ready — order & contact emails enabled');
    console.log('--------------------------\n');
    return true;
  } catch (err) {
    transporter = null;
    activeConfig = null;
    const message = err instanceof Error ? err.message : String(err);
    console.log(`Status: failed — ${message}`);
    console.log('Check SMTP_USER / SMTP_PASS (use a Gmail App Password)');
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
    });
    return true;
  } catch (err) {
    console.error('Email send failed:', err instanceof Error ? err.message : err);
    return false;
  }
}

function orderEmailHtml(order) {
  const items = order.items
    .map(
      (item) =>
        `<tr><td style="padding:8px;border-bottom:1px solid #eee">${item.productName}</td>` +
        `<td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${item.quantity}</td>` +
        `<td style="padding:8px;border-bottom:1px solid #eee;text-align:right">₹${item.price}</td></tr>`,
    )
    .join('');

  return `
    <div style="font-family:Georgia,serif;color:#2c1810;max-width:600px;margin:0 auto">
      <h2 style="color:#5c1a1b">Thank you for your order!</h2>
      <p>Dear ${order.customerName},</p>
      <p>We received your order <strong>${order.invoiceNumber}</strong>.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <thead>
          <tr style="background:#fff8f0">
            <th style="padding:8px;text-align:left">Item</th>
            <th style="padding:8px">Qty</th>
            <th style="padding:8px;text-align:right">Price</th>
          </tr>
        </thead>
        <tbody>${items}</tbody>
      </table>
      <p><strong>Total: ₹${order.totalPrice}</strong></p>
      <p>Payment: ${order.paymentMethod} (${order.paymentStatus})</p>
      <p>Delivery address:<br>${order.customerAddress}</p>
      <p style="color:#6b5b4f;font-size:13px">— Agrahara Bhojanam, Madurai</p>
    </div>
  `;
}

export async function sendOrderConfirmationEmail(order) {
  if (!order.customerEmail?.trim()) return false;

  return sendMail({
    to: order.customerEmail.trim(),
    subject: `Order confirmed — ${order.invoiceNumber} | Agrahara Bhojanam`,
    html: orderEmailHtml(order),
    text: `Thank you ${order.customerName}. Order ${order.invoiceNumber} total ₹${order.totalPrice}.`,
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
