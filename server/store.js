/**
 * Persistencia simple basada en archivo JSON.
 * Suficiente para MVP / demo. En producción migra a Postgres, Mongo, etc.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data-store");
const ORDERS_FILE = join(DATA_DIR, "orders.json");

function ensure() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(ORDERS_FILE)) writeFileSync(ORDERS_FILE, "[]");
}

function readAll() {
  ensure();
  try {
    return JSON.parse(readFileSync(ORDERS_FILE, "utf8"));
  } catch {
    return [];
  }
}

function writeAll(orders) {
  ensure();
  writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
}

export const store = {
  all() {
    return readAll();
  },
  get(id) {
    return readAll().find((o) => o.id === id) || null;
  },
  getByExternalRef(ref) {
    return readAll().find((o) => o.externalReference === ref) || null;
  },
  create(order) {
    const orders = readAll();
    orders.push(order);
    writeAll(orders);
    return order;
  },
  update(id, patch) {
    const orders = readAll();
    const idx = orders.findIndex((o) => o.id === id);
    if (idx === -1) return null;
    orders[idx] = { ...orders[idx], ...patch, updatedAt: new Date().toISOString() };
    writeAll(orders);
    return orders[idx];
  },
};
