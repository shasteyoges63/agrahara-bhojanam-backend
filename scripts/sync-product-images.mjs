import { MongoClient } from 'mongodb';

const PODI_MASALA_IMAGE =
  'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?q=80&w=600&auto=format&fit=crop';

const MASALA_IMAGES = {
  spices: PODI_MASALA_IMAGE,
  spicesPowder: PODI_MASALA_IMAGE,
  pickle: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?q=80&w=600&auto=format&fit=crop',
  porridge: 'https://images.unsplash.com/photo-1599599810769-bcde5a160d32?q=80&w=600&auto=format&fit=crop',
  grains: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?q=80&w=600&auto=format&fit=crop',
  instant: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=600&auto=format&fit=crop',
  vathal: 'https://images.unsplash.com/photo-1541832676-9b763b0239ab?q=80&w=600&auto=format&fit=crop',
  curry: 'https://images.unsplash.com/photo-1596797038530-2c107229654b?q=80&w=600&auto=format&fit=crop',
  herbs: 'https://images.unsplash.com/photo-1466637574441-749b8f19452f?q=80&w=600&auto=format&fit=crop',
  rice: 'https://images.unsplash.com/photo-1604329760661-e71dc83f8f26?q=80&w=600&auto=format&fit=crop',
};

const CATEGORY_IMAGES = {
  'Podi Varieties': [PODI_MASALA_IMAGE],
  'Pickle Varieties': [MASALA_IMAGES.pickle, MASALA_IMAGES.herbs],
  'Porridge Mix': [MASALA_IMAGES.porridge, MASALA_IMAGES.grains],
  'Instant Mix': [MASALA_IMAGES.instant, MASALA_IMAGES.rice],
  'Vathal Varieties': [MASALA_IMAGES.vathal, MASALA_IMAGES.curry],
};

const PRODUCT_VARIANTS = {
  'prod-1': 0, 'prod-2': 1, 'prod-3': 2, 'prod-4': 0, 'prod-5': 1,
  'prod-6': 0, 'prod-7': 0, 'prod-8': 1, 'prod-9': 0, 'prod-10': 1,
};

function imagesForCategory(category, variant = 0) {
  const pair = CATEGORY_IMAGES[category] ?? [PODI_MASALA_IMAGE];
  const primary = pair[variant % pair.length];
  return [primary];
}

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const dbName = process.env.MONGODB_DB || 'agrahara_bhojanam';

const client = new MongoClient(uri);
await client.connect();
const db = client.db(dbName);
const products = db.collection('products');
const all = await products.find().toArray();

let updated = 0;
for (const product of all) {
  const variant = PRODUCT_VARIANTS[product.id] ?? 0;
  const images = imagesForCategory(product.category, variant);
  await products.updateOne({ id: product.id }, { $set: { images } });
  updated++;
}

console.log(`Updated images for ${updated} products`);
await client.close();
