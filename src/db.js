import mysql from 'mysql2/promise';
 
const DOCUMENTS_TABLE = 'agrahara_abdatabase';
 
let pool = null;
let db = null;
 
function parseStoredDocument(row) {
  if (!row) return null;
  if (typeof row.data === 'string') return JSON.parse(row.data);
  if (Buffer.isBuffer(row.data)) return JSON.parse(row.data.toString('utf8'));
  return row.data;
}
 
function getDocumentKey(collectionName, document) {
  return String(
    document?.id
      ?? document?._id
      ?? `${collectionName}-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
}
 
function getValue(document, key) {
  return Object.prototype.hasOwnProperty.call(document, key) ? document[key] : undefined;
}
 
function matchesCondition(value, condition) {
  if (
    condition
    && typeof condition === 'object'
    && !Array.isArray(condition)
    && Object.keys(condition).some((key) => key.startsWith('$'))
  ) {
    if ('$ne' in condition && value === condition.$ne) return false;
    if ('$exists' in condition) {
      const exists = value !== undefined;
      if (Boolean(condition.$exists) !== exists) return false;
    }
    if ('$in' in condition && !condition.$in.includes(value)) return false;
    return true;
  }
 
  return value === condition;
}
 
function matchesFilter(document, filter = {}) {
  return Object.entries(filter).every(([key, condition]) =>
    matchesCondition(getValue(document, key), condition)
  );
}
 
function applyUpdate(document, update) {
  if (update?.$set) {
    return { ...document, ...update.$set };
  }
  return { ...document, ...update };
}
 
function sortDocuments(documents, sortSpec = {}) {
  const entries = Object.entries(sortSpec);
  if (entries.length === 0) return documents;
 
  return [...documents].sort((a, b) => {
    for (const [key, direction] of entries) {
      const aValue = getValue(a, key);
      const bValue = getValue(b, key);
      if (aValue === bValue) continue;
      if (aValue == null) return 1;
      if (bValue == null) return -1;
      return aValue > bValue ? direction : -direction;
    }
    return 0;
  });
}
 
class MySqlCollection {
  constructor(connectionPool, name) {
    this.pool = connectionPool;
    this.name = name;
  }
 
  async createIndex() {
    return null;
  }
 
  async loadAll() {
    const [rows] = await this.pool.execute(
      `SELECT data FROM ${DOCUMENTS_TABLE} WHERE collection_name = ?`,
      [this.name],
    );
    return rows.map(parseStoredDocument);
  }
 
  async save(document) {
    const documentId = getDocumentKey(this.name, document);
    await this.pool.execute(
      `INSERT INTO ${DOCUMENTS_TABLE} (collection_name, document_id, data)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE data = VALUES(data), updated_at = CURRENT_TIMESTAMP`,
      [this.name, documentId, JSON.stringify(document)],
    );
    return document;
  }
 
  find(filter = {}) {
    return {
      sort: (sortSpec = {}) => ({
        toArray: async () => sortDocuments(
          (await this.loadAll()).filter((document) => matchesFilter(document, filter)),
          sortSpec,
        ),
      }),
      toArray: async () => (await this.loadAll()).filter((document) => matchesFilter(document, filter)),
    };
  }
 
  async findOne(filter = {}) {
    const documents = await this.loadAll();
    return documents.find((document) => matchesFilter(document, filter)) ?? null;
  }
 
  async countDocuments(filter = {}) {
    if (Object.keys(filter).length === 0) {
      const [rows] = await this.pool.execute(
        `SELECT COUNT(*) AS count FROM ${DOCUMENTS_TABLE} WHERE collection_name = ?`,
        [this.name],
      );
      return Number(rows[0]?.count || 0);
    }
    return (await this.find(filter).toArray()).length;
  }
 
  async insertOne(document) {
    await this.save(document);
    return { insertedId: getDocumentKey(this.name, document) };
  }
 
  async insertMany(documents) {
    for (const document of documents) {
      await this.insertOne(document);
    }
    return { insertedCount: documents.length };
  }
 
  async updateOne(filter, update, options = {}) {
    const existing = await this.findOne(filter);
    if (!existing) {
      if (!options.upsert) return { matchedCount: 0, modifiedCount: 0, upsertedCount: 0 };
      const baseDocument = Object.fromEntries(
        Object.entries(filter).filter(([, value]) => typeof value !== 'object' || value === null),
      );
      await this.save(applyUpdate(baseDocument, update));
      return { matchedCount: 0, modifiedCount: 0, upsertedCount: 1 };
    }
 
    await this.save(applyUpdate(existing, update));
    return { matchedCount: 1, modifiedCount: 1, upsertedCount: 0 };
  }
 
  async findOneAndUpdate(filter, update) {
    const existing = await this.findOne(filter);
    if (!existing) return null;
    const updated = applyUpdate(existing, update);
    await this.save(updated);
    return updated;
  }
 
  async findOneAndReplace(filter, replacement) {
    const existing = await this.findOne(filter);
    if (!existing) return null;
    await this.save(replacement);
    return replacement;
  }
 
  async deleteOne(filter) {
    const existing = await this.findOne(filter);
    if (!existing) return { deletedCount: 0 };
    await this.pool.execute(
      `DELETE FROM ${DOCUMENTS_TABLE} WHERE collection_name = ? AND document_id = ?`,
      [this.name, getDocumentKey(this.name, existing)],
    );
    return { deletedCount: 1 };
  }
}
 
class MySqlDatabase {
  constructor(connectionPool) {
    this.pool = connectionPool;
  }
 
  collection(name) {
    return new MySqlCollection(this.pool, name);
  }
 
  async command(command) {
    if (command?.ping) {
      await this.pool.query('SELECT 1');
      return { ok: 1 };
    }
    throw new Error('Unsupported database command.');
  }
}
 
export async function connectDB() {
  if (db) return db;
 
  const mysqlDatabase = process.env.MYSQL_DATABASE || process.env.DB_NAME || 'agrahara_bhojanam';
  pool = mysql.createPool({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT) || 3306,
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: mysqlDatabase,
    waitForConnections: true,
    connectionLimit: Number(process.env.MYSQL_CONNECTION_LIMIT) || 10,
    queueLimit: 0,
  });
 
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${DOCUMENTS_TABLE} (
      collection_name VARCHAR(64) NOT NULL,
      document_id VARCHAR(191) NOT NULL,
      data LONGTEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (collection_name, document_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
 
  db = new MySqlDatabase(pool);
  console.log(`MySQL connected: ${mysqlDatabase}`);
  return db;
}
 
export function getDB() {
  if (!db) throw new Error('Database not connected. Call connectDB() first.');
  return db;
}
 
export async function closeDB() {
  if (pool) {
    await pool.end();
    pool = null;
    db = null;
  }
}