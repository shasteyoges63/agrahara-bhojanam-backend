import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const DB_NAME = process.env.MONGODB_DB || 'agrahara_bhojanam';

let client = null;
let db = null;

export async function connectDB() {
  if (db) return db;
  client = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  await client.connect();
  db = client.db(DB_NAME);
  await db.collection('users').createIndex({ email: 1 }, { unique: true });
  await db.collection('users').createIndex({ phoneDigits: 1 }, { unique: true, sparse: true });
  console.log(`MongoDB connected: ${DB_NAME}`);
  return db;
}

export function getDB() {
  if (!db) throw new Error('Database not connected. Call connectDB() first.');
  return db;
}

export async function closeDB() {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}
