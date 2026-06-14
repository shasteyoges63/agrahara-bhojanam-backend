import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import { connectDB, getDB } from './db.js';
import { seedDatabase } from './seed.js';
import { findUserByEmailOrPhone, normalizePhone } from './userUtils.js';
import { jitterCoordinates, resolveLocationFromAddress } from './locationUtils.js';
import {
  initEmailService,
  sendContactNotificationEmail,
  sendOrderConfirmationEmail,
  sendTestEmail,
} from './email.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });
dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 4000;

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'https://agraharabhojanam.com',
  'https://www.agraharabhojanam.com',
];
if (process.env.CORS_ORIGIN) {
  allowedOrigins.push(...process.env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean));
}
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

app.get('/api/health', async (_req, res) => {
  try {
    await getDB().command({ ping: 1 });
    res.json({ status: 'ok', database: 'mongodb' });
  } catch {
    res.status(503).json({ status: 'error', database: 'disconnected' });
  }
});

// Customer users (sign up / login)
app.post('/api/users/register', async (req, res) => {
  const { name, email, phone, address } = req.body;

  if (!name?.trim() || !email?.trim() || !phone?.trim()) {
    return res.status(400).json({ error: 'Name, email, and phone are required' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const phoneDigits = normalizePhone(phone);
  const usersCol = getDB().collection('users');

  const existingEmail = await usersCol.findOne({ email: normalizedEmail });
  if (existingEmail) {
    return res.status(409).json({ error: 'An account with this email already exists. Please sign in instead.' });
  }

  const existingPhone = phoneDigits
    ? await findUserByEmailOrPhone(usersCol, '__no-match__@local', phone)
    : null;
  if (existingPhone) {
    return res.status(409).json({ error: 'An account with this phone number already exists. Please sign in instead.' });
  }

  const user = {
    id: 'user-' + Date.now(),
    name: name.trim(),
    email: normalizedEmail,
    phone: phone.trim(),
    phoneDigits,
    address: address?.trim() || undefined,
    role: 'customer',
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  };

  await usersCol.insertOne(user);
  res.status(201).json(user);
});

app.post('/api/users/login', async (req, res) => {
  const { email, phone, name, address } = req.body;

  if (!email?.trim() || !phone?.trim()) {
    return res.status(400).json({ error: 'Email and phone are required' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const phoneDigits = normalizePhone(phone);
  const usersCol = getDB().collection('users');
  const user = await findUserByEmailOrPhone(usersCol, email, phone);

  if (!user) {
    return res.status(404).json({ error: 'No account found with this email or phone. Please create an account first.' });
  }

  const updates = {
    lastLoginAt: new Date().toISOString(),
    phone: phone.trim(),
    phoneDigits,
  };
  if (name?.trim()) updates.name = name.trim();
  if (address?.trim()) updates.address = address.trim();

  if (normalizedEmail !== user.email) {
    const emailTaken = await usersCol.findOne({ email: normalizedEmail, id: { $ne: user.id } });
    if (!emailTaken) updates.email = normalizedEmail;
  }

  const result = await usersCol.findOneAndUpdate(
    { id: user.id },
    { $set: updates },
    { returnDocument: 'after' }
  );

  res.json(result);
});

app.get('/api/users', async (_req, res) => {
  const users = await getDB().collection('users')
    .find()
    .sort({ createdAt: -1 })
    .toArray();
  res.json(users);
});

app.get('/api/users/:id', async (req, res) => {
  const user = await getDB().collection('users').findOne({ id: req.params.id });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// Products
app.get('/api/products', async (_req, res) => {
  const products = await getDB().collection('products')
    .find({ enabled: true })
    .toArray();
  res.json(products);
});

app.get('/api/products/all', async (_req, res) => {
  const products = await getDB().collection('products').find().toArray();
  res.json(products);
});

app.get('/api/products/:id', async (req, res) => {
  const product = await getDB().collection('products').findOne({ id: req.params.id, enabled: true });
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

app.post('/api/products', async (req, res) => {
  const product = req.body;
  await getDB().collection('products').insertOne(product);
  res.status(201).json(product);
});

app.put('/api/products/:id', async (req, res) => {
  const { id } = req.params;
  const product = req.body;
  const result = await getDB().collection('products').findOneAndReplace(
    { id },
    product,
    { returnDocument: 'after' }
  );
  if (!result) return res.status(404).json({ error: 'Product not found' });
  res.json(result);
});

app.delete('/api/products/:id', async (req, res) => {
  const { id } = req.params;
  const result = await getDB().collection('products').deleteOne({ id });
  if (result.deletedCount === 0) return res.status(404).json({ error: 'Product not found' });
  res.status(204).end();
});

function enrichOrderWithLocation(order) {
  const resolved = order.latitude != null && order.deliveryCity
    ? {
        deliveryCity: order.deliveryCity,
        deliveryState: order.deliveryState || 'Tamil Nadu',
        latitude: order.latitude,
        longitude: order.longitude ?? 78.1198,
        region: order.deliveryRegion || 'tamilnadu',
      }
    : resolveLocationFromAddress(order.customerAddress);

  const jittered = jitterCoordinates(resolved.latitude, resolved.longitude, order.id);
  return {
    ...order,
    deliveryCity: resolved.deliveryCity,
    deliveryState: resolved.deliveryState,
    latitude: jittered.latitude,
    longitude: jittered.longitude,
    deliveryRegion: resolved.region,
  };
}

// Orders
app.get('/api/orders/map-points', async (req, res) => {
  const region = String(req.query.region || 'all');
  const orders = await getDB().collection('orders').find().sort({ orderDate: -1 }).toArray();

  const points = orders
    .map((order) => {
      const located = enrichOrderWithLocation(order);
      return {
        orderId: located.id,
        city: located.deliveryCity || 'Unknown',
        state: located.deliveryState || 'India',
        latitude: located.latitude,
        longitude: located.longitude,
        region: located.deliveryRegion || 'india',
        customerName: located.customerName,
        totalPrice: located.totalPrice,
        orderDate: located.orderDate,
        productNames: located.items.map((item) => item.productName),
      };
    })
    .filter((point) => region === 'all' || point.region === region);

  res.json(points);
});

app.get('/api/orders', async (_req, res) => {
  const orders = await getDB().collection('orders')
    .find()
    .sort({ orderDate: -1 })
    .toArray();
  res.json(orders);
});

app.post('/api/orders', async (req, res) => {
  const order = enrichOrderWithLocation(req.body);
  const db = getDB();
  const productsCol = db.collection('products');

  for (const item of order.items) {
    const product = await productsCol.findOne({ id: item.productId });
    if (product) {
      await productsCol.updateOne(
        { id: item.productId },
        { $set: { stock: Math.max(0, product.stock - item.quantity) } }
      );
    }
  }

  await db.collection('orders').insertOne(order);

  const emailSent = await sendOrderConfirmationEmail(order);
  if (emailSent !== order.emailSent) {
    await db.collection('orders').updateOne({ id: order.id }, { $set: { emailSent } });
    order.emailSent = emailSent;
  }

  res.status(201).json(order);
});

app.patch('/api/orders/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const result = await getDB().collection('orders').findOneAndUpdate(
    { id },
    { $set: { status } },
    { returnDocument: 'after' }
  );
  if (!result) return res.status(404).json({ error: 'Order not found' });
  res.json(result);
});

app.delete('/api/orders/:id', async (req, res) => {
  const { id } = req.params;
  const result = await getDB().collection('orders').deleteOne({ id });
  if (result.deletedCount === 0) return res.status(404).json({ error: 'Order not found' });
  res.status(204).end();
});

// Expenses
app.get('/api/expenses', async (_req, res) => {
  const expenses = await getDB().collection('expenses')
    .find()
    .sort({ date: -1 })
    .toArray();
  res.json(expenses);
});

app.post('/api/expenses', async (req, res) => {
  const expense = req.body;
  await getDB().collection('expenses').insertOne(expense);
  res.status(201).json(expense);
});

app.delete('/api/expenses/:id', async (req, res) => {
  const { id } = req.params;
  const result = await getDB().collection('expenses').deleteOne({ id });
  if (result.deletedCount === 0) return res.status(404).json({ error: 'Expense not found' });
  res.status(204).end();
});

// Contact messages
app.get('/api/contact-messages', async (_req, res) => {
  const messages = await getDB().collection('contact_messages')
    .find()
    .sort({ date: -1 })
    .toArray();
  res.json(messages);
});

app.post('/api/contact-messages', async (req, res) => {
  const msg = {
    id: 'msg-' + Date.now(),
    date: new Date().toISOString(),
    resolved: false,
    ...req.body
  };
  await getDB().collection('contact_messages').insertOne(msg);
  sendContactNotificationEmail(msg).catch((err) =>
    console.error('Contact email failed:', err instanceof Error ? err.message : err),
  );
  res.status(201).json(msg);
});

app.patch('/api/contact-messages/:id/resolved', async (req, res) => {
  const { id } = req.params;
  const existing = await getDB().collection('contact_messages').findOne({ id });
  if (!existing) return res.status(404).json({ error: 'Message not found' });

  const result = await getDB().collection('contact_messages').findOneAndUpdate(
    { id },
    { $set: { resolved: !existing.resolved } },
    { returnDocument: 'after' }
  );
  res.json(result);
});

app.delete('/api/contact-messages/:id', async (req, res) => {
  const { id } = req.params;
  const result = await getDB().collection('contact_messages').deleteOne({ id });
  if (result.deletedCount === 0) return res.status(404).json({ error: 'Message not found' });
  res.status(204).end();
});

// Config
app.get('/api/config/smtp', async (_req, res) => {
  const doc = await getDB().collection('configs').findOne({ _id: 'smtp' });
  if (!doc) return res.status(404).json({ error: 'SMTP config not found' });
  const { _id, ...config } = doc;
  res.json(config);
});

app.put('/api/config/smtp', async (req, res) => {
  const config = req.body;
  await getDB().collection('configs').updateOne(
    { _id: 'smtp' },
    { $set: config },
    { upsert: true }
  );
  await initEmailService(getDB());
  res.json(config);
});

app.post('/api/config/smtp/test', async (req, res) => {
  const { to } = req.body;
  const recipient = to?.trim() || process.env.SMTP_USER?.trim() || process.env.SMTP_FROM?.trim();
  if (!recipient) {
    return res.status(400).json({ error: 'Provide "to" email or set SMTP_USER in .env' });
  }

  const ok = await sendTestEmail(recipient);
  if (!ok) {
    return res.status(503).json({ error: 'SMTP not ready. Check backend/.env and restart.' });
  }
  res.json({ ok: true, sentTo: recipient });
});

app.get('/api/config/whatsapp', async (_req, res) => {
  const doc = await getDB().collection('configs').findOne({ _id: 'whatsapp' });
  if (!doc) return res.status(404).json({ error: 'WhatsApp config not found' });
  const { _id, ...config } = doc;
  res.json(config);
});

app.put('/api/config/whatsapp', async (req, res) => {
  const config = req.body;
  await getDB().collection('configs').updateOne(
    { _id: 'whatsapp' },
    { $set: config },
    { upsert: true }
  );
  res.json(config);
});

const isProduction = process.env.NODE_ENV === 'production';
const serveFrontend = process.env.SERVE_FRONTEND === 'true'
  || (isProduction && process.env.SERVE_FRONTEND !== 'false');
const frontendDist = path.join(__dirname, '..', '..', 'frontend', 'dist');

if (serveFrontend) {
  app.use(express.static(frontendDist));
  app.get(/^(?!\/api).*/, (_req, res, next) => {
    res.sendFile(path.join(frontendDist, 'index.html'), (err) => {
      if (err) next();
    });
  });
}

async function start() {
  try {
    const db = await connectDB();
    await seedDatabase(db);
    await initEmailService(db);
    const host = process.env.HOST || (isProduction ? '0.0.0.0' : '127.0.0.1');
    const server = app.listen(PORT, host, () => {
      console.log(`Backend running at http://${host}:${PORT}`);
      if (serveFrontend) {
        console.log(`Serving frontend from ${frontendDist}`);
      }
    });
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(
          `Port ${PORT} is already in use. Stop the other backend process, then run again.\n` +
          `Windows: netstat -ano | findstr :${PORT}  then  taskkill /PID <pid> /F`
        );
      } else {
        console.error('Failed to start backend server:', err);
      }
      process.exit(1);
    });
  } catch (err) {
    console.error('Failed to start backend:', err);
    process.exit(1);
  }
}

export { app };
start();
