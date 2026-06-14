import { DEFAULT_PRODUCTS } from './defaultProducts.js';

const initialOrders = [
  {
    id: 'ord-101',
    customerName: 'Aravind Krishnan',
    customerEmail: 'aravind.k@gmail.com',
    customerPhone: '9840245678',
    customerAddress: '43, Sannidhi Street, Mylapore, Chennai, TN - 600004',
    items: [
      { productId: 'prod-1', productName: 'Agrahara Divine Ghee Laddu', price: 320, quantity: 2, costPrice: 150 },
      { productId: 'prod-2', productName: 'Temple Puliyodarai Mix (Tamarind Rice Paste)', price: 180, quantity: 1, costPrice: 80 }
    ],
    totalPrice: 820,
    orderDate: '2026-05-10T11:20:00Z',
    status: 'Delivered',
    paymentMethod: 'UPI',
    paymentStatus: 'Completed',
    invoiceNumber: 'INV-2026-051',
    whatsappSent: true,
    emailSent: true
  },
  {
    id: 'ord-102',
    customerName: 'Meera Deshpande',
    customerEmail: 'meera.d@yahoo.com',
    customerPhone: '9123456780',
    customerAddress: '72, Vedic Residency, Erandwane, Pune, MH - 411004',
    items: [
      { productId: 'prod-3', productName: 'Hand-Churned Pure Vedic A2 Cow Ghee', price: 850, quantity: 1, costPrice: 400 },
      { productId: 'prod-4', productName: "Traditional Sambhar Podi (Grandma's Recipe)", price: 150, quantity: 3, costPrice: 60 }
    ],
    totalPrice: 1300,
    orderDate: '2026-05-24T16:45:00Z',
    status: 'Dispatched',
    paymentMethod: 'COD',
    paymentStatus: 'Pending',
    invoiceNumber: 'INV-2026-052',
    whatsappSent: false,
    emailSent: true
  }
];

const initialExpenses = [
  { id: 'exp-1', month: '2026-05', category: 'Temple Ingredients', amount: 3500, description: 'Bulk green cardamom pods and native organic Jaggery sweetener blocks', date: '2026-05-12T10:00:00Z' },
  { id: 'exp-2', month: '2026-05', category: 'Packaging supplies', amount: 1500, description: 'Sun-dried banana leaf packings and woven jute carrier bags', date: '2026-05-18T14:30:00Z' }
];

const initialMessages = [
  { id: 'msg-1', name: 'Ranganatha Prasad S.', email: 'ranga@srirangam.org', phone: '9444011223', subject: 'Enquiry for Devasthanam feast prasadams', message: 'Greetings. We require 500 units of divine ghee laddus and 150 packs of Sakkarai pongal mix for prasadam distribution on the upcoming Sri Rama Navami. Can we schedule secure Ashram van transport directly?', date: '2026-05-28T09:12:00Z', resolved: false },
  { id: 'msg-2', name: 'Saraswathi Iyer', email: 'iyer.sara@outlook.com', phone: '9884512345', subject: 'Custom sour citron pickle jars', message: 'Tell me if the temple grandmothers currently hold sun-dried citron or bitter gourd slices preserved inside traditional ceramic Bharani jars. Looking forward to booking bulk quantities.', date: '2026-05-29T15:00:00Z', resolved: true }
];

const initialSMTP = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 465,
  secure: process.env.SMTP_SECURE !== 'false',
  username: process.env.SMTP_USER || 'admin@agraharabhojanam.com',
  senderEmail: process.env.SMTP_FROM || process.env.SMTP_USER || 'admin@agraharabhojanam.com',
  password: process.env.SMTP_PASS || '',
};

const initialWhatsApp = {
  apiKey: 'EAA12093HBAJHBASDJASND89123612',
  phoneId: '331209745',
  routingMode: 'DirectWeb',
  recipientNumber: '918778447165'
};

export async function seedDatabase(database) {
  const products = database.collection('products');
  if ((await products.countDocuments()) === 0) {
    await products.insertMany(DEFAULT_PRODUCTS);
    console.log('Seeded products');
  } else {
    for (const product of DEFAULT_PRODUCTS) {
      await products.updateOne({ id: product.id }, { $set: { images: product.images } });
    }
    console.log('Synced product images');
  }

  const orders = database.collection('orders');
  if ((await orders.countDocuments()) === 0) {
    await orders.insertMany(initialOrders);
    console.log('Seeded orders');
  }

  const expenses = database.collection('expenses');
  if ((await expenses.countDocuments()) === 0) {
    await expenses.insertMany(initialExpenses);
    console.log('Seeded expenses');
  }

  const messages = database.collection('contact_messages');
  if ((await messages.countDocuments()) === 0) {
    await messages.insertMany(initialMessages);
    console.log('Seeded contact messages');
  }

  const configs = database.collection('configs');
  if ((await configs.countDocuments({ _id: 'smtp' })) === 0) {
    await configs.insertOne({ _id: 'smtp', ...initialSMTP });
    console.log('Seeded SMTP config');
  } else {
    const smtp = await configs.findOne({ _id: 'smtp' });
    const patch = {};
    if (!smtp?.username?.trim()) {
      patch.username =
        smtp?.senderEmail?.trim() ||
        initialSMTP.username;
    }
    if (!smtp?.senderEmail?.trim()) {
      patch.senderEmail =
        smtp?.username?.trim() ||
        initialSMTP.senderEmail;
    }
    if (Object.keys(patch).length > 0) {
      await configs.updateOne({ _id: 'smtp' }, { $set: patch });
    }
  }
  if ((await configs.countDocuments({ _id: 'whatsapp' })) === 0) {
    await configs.insertOne({ _id: 'whatsapp', ...initialWhatsApp });
    console.log('Seeded WhatsApp config');
  } else {
    await configs.updateOne(
      {
        _id: 'whatsapp',
        recipientNumber: { $in: ['919025672285', '918838026509', '9025672285', '8838026509'] },
      },
      { $set: { recipientNumber: initialWhatsApp.recipientNumber } },
    );
  }
}
