/**
 * Servidor STILL Wellness — Node HTTP nativo (sin dependencias externas).
 * Sirve el frontend estático y expone la API de checkout + webhook + fulfillment.
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";

import { config, modeSummary } from "./config.js";
import { store } from "./store.js";
import { products, productById } from "./data/products.js";
import { createPreference, getPayment } from "./lib/mercadopago.js";
import { fulfillOrder } from "./lib/fulfillment.js";
import { getTracking } from "./lib/shipping.js";
import { page } from "./views.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, "..", "public");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8", ...headers });
  res.end(body);
}
function json(res, status, obj) {
  send(res, status, JSON.stringify(obj), { "Content-Type": "application/json; charset=utf-8" });
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function serveStatic(res, urlPath) {
  const safe = normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(PUBLIC_DIR, safe === "/" ? "index.html" : safe);
  if (!filePath.startsWith(PUBLIC_DIR) || !existsSync(filePath)) return false;
  const data = await readFile(filePath);
  send(res, 200, data, { "Content-Type": MIME[extname(filePath)] || "application/octet-stream" });
  return true;
}

// -------------------- Lógica de negocio --------------------

function buildOrderFromCart(cart, customer, shipping) {
  const items = cart
    .map((line) => {
      const p = productById(line.id);
      if (!p) return null;
      return {
        id: p.id,
        name: p.name,
        price: p.price,
        supplierCost: p.supplierCost,
        supplierSku: p.supplierSku,
        weightKg: p.weightKg,
        dimsCm: p.dimsCm,
        quantity: Math.max(1, Number(line.quantity) || 1),
      };
    })
    .filter(Boolean);

  const subtotal = items.reduce((s, it) => s + it.price * it.quantity, 0);
  const shippingCost = subtotal >= 899 ? 0 : 99; // envío gratis desde $899
  const total = subtotal + shippingCost;

  return {
    id: randomUUID().slice(0, 8),
    externalReference: `STILL-${Date.now().toString(36).toUpperCase()}`,
    createdAt: new Date().toISOString(),
    status: "pending_payment",
    items,
    subtotal,
    shippingCost,
    total,
    customer,
    shipping,
    fulfillment: null,
  };
}

async function handleCheckout(req, res) {
  const body = await readBody(req);
  const { cart = [], customer = {}, shipping = {} } = body;
  if (!Array.isArray(cart) || cart.length === 0) return json(res, 400, { error: "Carrito vacío" });
  if (!customer.email || !customer.name) return json(res, 400, { error: "Faltan datos del cliente" });

  const order = buildOrderFromCart(cart, customer, shipping);
  if (order.items.length === 0) return json(res, 400, { error: "Productos inválidos" });

  store.create(order);
  const pref = await createPreference(order);
  store.update(order.id, { payment: { preferenceId: pref.preferenceId, simulated: pref.simulated } });

  return json(res, 200, {
    orderId: order.id,
    externalReference: order.externalReference,
    total: order.total,
    initPoint: pref.initPoint,
    simulated: pref.simulated,
  });
}

async function processApprovedPayment(externalReference, paymentId) {
  const order = store.getByExternalRef(externalReference);
  if (!order) return null;
  store.update(order.id, {
    status: "paid",
    payment: { ...(order.payment || {}), paymentId, status: "approved", paidAt: new Date().toISOString() },
  });
  // dispara el fulfillment (OC proveedor + guía + tracking)
  return fulfillOrder(order.id);
}

// -------------------- Router --------------------

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, config.baseUrl);
    const path = url.pathname;

    // ---- API ----
    if (path === "/api/products" && req.method === "GET") {
      return json(res, 200, { products });
    }

    if (path === "/api/checkout" && req.method === "POST") {
      return handleCheckout(req, res);
    }

    if (path === "/api/orders" && req.method === "GET") {
      return json(res, 200, { orders: store.all() });
    }

    if (path.startsWith("/api/orders/") && req.method === "GET") {
      const ref = decodeURIComponent(path.split("/").pop());
      const order = store.getByExternalRef(ref) || store.get(ref);
      if (!order) return json(res, 404, { error: "Pedido no encontrado" });
      return json(res, 200, { order });
    }

    // Webhook Mercado Pago (topic=payment)
    if (path === "/api/webhooks/mercadopago" && req.method === "POST") {
      const body = await readBody(req);
      const paymentId = body?.data?.id || url.searchParams.get("data.id");
      const topic = body?.type || url.searchParams.get("type") || url.searchParams.get("topic");
      if (topic && topic !== "payment") return json(res, 200, { ignored: topic });
      try {
        const payment = await getPayment(paymentId);
        if (payment.status === "approved") {
          await processApprovedPayment(payment.external_reference, paymentId);
        }
      } catch (e) {
        console.error("Webhook error:", e.message);
      }
      return json(res, 200, { received: true });
    }

    // ---- Simulación de pago (solo modo demo, sin credenciales MP) ----
    if (path === "/sandbox/pay" && req.method === "GET") {
      const ref = url.searchParams.get("ref");
      const order = store.getByExternalRef(ref);
      if (!order) return send(res, 404, "Pedido no encontrado");
      return send(res, 200, page.sandboxPay(order), { "Content-Type": "text/html; charset=utf-8" });
    }
    if (path === "/sandbox/confirm" && req.method === "POST") {
      const body = await readBody(req);
      const updated = await processApprovedPayment(body.ref, `SIMU-PAY-${Date.now()}`);
      if (!updated) return json(res, 404, { error: "Pedido no encontrado" });
      return json(res, 200, { ok: true, ref: updated.externalReference });
    }
    if (path.startsWith("/sandbox/label/") && req.method === "GET") {
      return send(res, 200, page.fakeLabel(path.split("/").pop()), { "Content-Type": "text/html; charset=utf-8" });
    }

    // ---- Páginas ----
    if (path === "/gracias" && req.method === "GET") {
      const ref = url.searchParams.get("ref");
      const order = store.getByExternalRef(ref);
      if (!order) return send(res, 404, "Pedido no encontrado");
      return send(res, 200, page.gracias(order), { "Content-Type": "text/html; charset=utf-8" });
    }
    if (path.startsWith("/rastreo/") && req.method === "GET") {
      const tracking = decodeURIComponent(path.split("/").pop());
      const info = await getTracking(tracking);
      return send(res, 200, page.rastreo(tracking, info), { "Content-Type": "text/html; charset=utf-8" });
    }
    if (path === "/admin" && req.method === "GET") {
      return send(res, 200, page.admin(store.all(), modeSummary()), { "Content-Type": "text/html; charset=utf-8" });
    }

    // ---- Estáticos / frontend ----
    if (req.method === "GET") {
      const served = await serveStatic(res, path);
      if (served) return;
      // fallback SPA
      const idx = await serveStatic(res, "/index.html");
      if (idx) return;
    }

    return send(res, 404, "No encontrado");
  } catch (err) {
    console.error(err);
    return json(res, 500, { error: err.message });
  }
});

server.listen(config.port, () => {
  const modes = modeSummary();
  console.log(`\n  STILL Wellness corriendo en ${config.baseUrl}`);
  console.log(`  Modo -> Mercado Pago: ${modes.mercadopago} | Proveedor: ${modes.supplier} | Envíos: ${modes.shipping}`);
  console.log(`  Admin: ${config.baseUrl}/admin\n`);
});
