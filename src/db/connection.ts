import Database from 'better-sqlite3';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'app.db');

type DbWithMeta = Database.Database & { __initialized?: boolean };

let dbInstance: DbWithMeta | undefined;

function ensureDirectory() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
}

function runMigrations(db: Database.Database) {
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(
    `CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );`
  );

  const migrationsDir = path.join(process.cwd(), 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    return;
  }

  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  const applied = new Set(
    db
      .prepare('SELECT name FROM migrations')
      .all<{ name: string }>()
      .map((row) => row.name)
  );

  for (const file of migrationFiles) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    const transaction = db.transaction(() => {
      db.exec(sql);
      db.prepare('INSERT INTO migrations (name) VALUES (?)').run(file);
    });
    transaction();
  }
}

function seedDatabase(db: Database.Database) {
  const categoryCount = db
    .prepare('SELECT COUNT(*) as count FROM categories')
    .get() as { count: number };
  if (categoryCount.count > 0) {
    return;
  }

  const insertCategory = db.prepare(
    'INSERT INTO categories (name, sort_order) VALUES (?, ?)'
  );
  const categories = [
    { name: 'Hamburguesas', sort: 1 },
    { name: 'Tortas', sort: 2 },
    { name: 'Papas', sort: 3 },
    { name: 'Alitas', sort: 4 },
    { name: 'Snacks', sort: 5 }
  ];

  const categoryIds = new Map<string, number>();
  for (const category of categories) {
    const result = insertCategory.run(category.name, category.sort);
    categoryIds.set(category.name, Number(result.lastInsertRowid));
  }

  const insertProduct = db.prepare(
    `INSERT INTO products
      (category_id, name, description, price_cents, station, is_available, image_url, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const products = [
    {
      category: 'Hamburguesas',
      name: 'Hamburguesa clásica',
      description: 'Res, lechuga, tomate, queso',
      price: 9900,
      station: 'PLANCHA',
      sort: 1
    },
    {
      category: 'Hamburguesas',
      name: 'Hamburguesa doble',
      description: 'Doble carne, queso',
      price: 12900,
      station: 'PLANCHA',
      sort: 2
    },
    {
      category: 'Tortas',
      name: 'Torta de res',
      description: 'Res guisada, frijoles, queso',
      price: 10500,
      station: 'PLANCHA',
      sort: 1
    },
    {
      category: 'Papas',
      name: 'Papas',
      description: 'Papas fritas clásicas',
      price: 4500,
      station: 'FREIDORA',
      sort: 1
    },
    {
      category: 'Alitas',
      name: 'Alitas',
      description: 'Alitas crujientes',
      price: 8900,
      station: 'FREIDORA',
      sort: 1
    },
    {
      category: 'Snacks',
      name: 'Dedos de queso',
      description: 'Deditos empanizados',
      price: 6200,
      station: 'FREIDORA',
      sort: 2
    },
    {
      category: 'Snacks',
      name: 'Aros',
      description: 'Aros de cebolla',
      price: 5900,
      station: 'FREIDORA',
      sort: 3
    }
  ];

  const productIds = new Map<string, number>();
  for (const product of products) {
    const result = insertProduct.run(
      categoryIds.get(product.category),
      product.name,
      product.description,
      product.price,
      product.station,
      1,
      null,
      product.sort
    );
    productIds.set(product.name, Number(result.lastInsertRowid));
  }

  const today = new Date().toISOString().slice(0, 10);
  const orderNumber = 1;
  const insertOrder = db.prepare(
    `INSERT INTO orders
      (order_date, order_number, type, status, customer_name, customer_phone, address_json, notes, subtotal_cents, delivery_fee_cents, total_cents)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const orderResult = insertOrder.run(
    today,
    orderNumber,
    'TAKEOUT',
    'RECIBIDO',
    'Cliente Demo',
    '5551234567',
    null,
    'Combo demo',
    17400,
    0,
    17400
  );
  const orderId = Number(orderResult.lastInsertRowid);

  const groupId = crypto.randomUUID();
  const insertItem = db.prepare(
    `INSERT INTO order_items
      (order_id, product_id, name_snapshot, price_cents_snapshot, qty, station, status, notes, group_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  insertItem.run(
    orderId,
    productIds.get('Hamburguesa clásica'),
    'Hamburguesa clásica',
    9900,
    1,
    'PLANCHA',
    'EN_COLA',
    null,
    groupId
  );
  insertItem.run(
    orderId,
    productIds.get('Papas'),
    'Papas',
    4500,
    1,
    'FREIDORA',
    'EN_COLA',
    null,
    groupId
  );
}

export function getDb() {
  if (!dbInstance) {
    ensureDirectory();
    dbInstance = new Database(DB_PATH) as DbWithMeta;
  }

  if (!dbInstance.__initialized) {
    runMigrations(dbInstance);
    seedDatabase(dbInstance);
    dbInstance.__initialized = true;
  }

  return dbInstance;
}
