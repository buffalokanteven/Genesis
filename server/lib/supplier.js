/**
 * Adaptador de PROVEEDOR (dropshipping) — genera la ORDEN DE COMPRA automática.
 * Implementación: CJ Dropshipping API v2.
 * Docs: https://developers.cjdropshipping.com/en/api/api2/
 *
 * Flujo real de CJ:
 *   1) Autenticación: POST /authentication/getAccessToken  (email + apiKey)
 *      -> devuelve un accessToken válido ~15 días (se cachea en memoria).
 *   2) Crear orden:   POST /shopping/order/createOrderV2   (header CJ-Access-Token)
 *      -> se envía la dirección del cliente final + los "vid" (variant id) de cada producto.
 *
 * IMPORTANTE: en products.js, cada `supplierSku` debe ser el **vid** (ID de variante)
 * real del producto en CJ. Ese dato se obtiene del producto en el catálogo de CJ.
 *
 * Sin SUPPLIER_API_KEY + SUPPLIER_EMAIL corre en SIMULACIÓN.
 */
import { config } from "../config.js";

// Cache del access token en memoria (evita re-autenticar en cada pedido).
let _token = null; // { accessToken, expiresAt }
// Cache de resolución SPU -> variante (evita consultar CJ en cada pedido).
const _variantCache = new Map();

async function getAccessToken() {
  if (_token && _token.expiresAt > Date.now() + 60_000) return _token.accessToken;

  const res = await fetch(`${config.supplier.apiBase}/authentication/getAccessToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: config.supplier.email,
      password: config.supplier.apiKey, // en CJ v2 la API Key va como "password"
    }),
  });
  const data = await res.json().catch(() => ({}));
  const accessToken = data?.data?.accessToken;
  if (!accessToken) {
    throw new Error(`CJ getAccessToken falló: ${JSON.stringify(data).slice(0, 300)}`);
  }
  _token = {
    accessToken,
    expiresAt: Date.parse(data.data.accessTokenExpiryDate) || Date.now() + 10 * 864e5,
  };
  return accessToken;
}

/**
 * Resuelve el VID (variant id) de un producto a partir de su SPU/productSku de CJ.
 * - Si el item ya trae `supplierVid`, se usa directo (sin consultar).
 * - Si trae `supplierVariantSku`, elige esa variante exacta (útil cuando hay colores/tallas).
 * - Si no, toma la primera variante disponible.
 * Devuelve además el costo y peso reales que reporta CJ.
 */
async function resolveVariant(item) {
  if (item.supplierVid) return { vid: item.supplierVid, cost: item.supplierCost, weight: item.weightKg };

  const spu = item.supplierSku;
  const cacheKey = `${spu}|${item.supplierVariantSku || ""}`;
  if (_variantCache.has(cacheKey)) return _variantCache.get(cacheKey);

  const token = await getAccessToken();
  const res = await fetch(
    `${config.supplier.apiBase}/product/query?productSku=${encodeURIComponent(spu)}`,
    { headers: { "CJ-Access-Token": token } }
  );
  const data = await res.json().catch(() => ({}));
  const product = data?.data || {};
  const variants = product.variants || product.variantList || [];
  if (!variants.length) {
    throw new Error(`CJ: no encontré variantes para el SPU ${spu} (revisa que el producto exista en tu cuenta). Respuesta: ${JSON.stringify(data).slice(0, 200)}`);
  }
  const v =
    (item.supplierVariantSku && variants.find((x) => x.variantSku === item.supplierVariantSku)) ||
    variants[0];
  if (!v?.vid) throw new Error(`CJ: la variante del SPU ${spu} no trae vid.`);

  const resolved = {
    vid: v.vid,
    cost: Number(v.variantSellPrice) || item.supplierCost,
    weight: Number(v.variantWeight) ? Number(v.variantWeight) / 1000 : item.weightKg,
    variantName: v.variantNameEn || v.variantName,
  };
  _variantCache.set(cacheKey, resolved);
  return resolved;
}

export async function createPurchaseOrder(order) {
  const lineItems = order.items.map((it) => ({
    sku: it.supplierSku, // = vid en CJ
    productName: it.name,
    quantity: it.quantity,
    unitCost: it.supplierCost,
  }));

  const supplierCostTotal = lineItems.reduce((s, li) => s + li.unitCost * li.quantity, 0);

  // ---------- MODO SIMULACIÓN ----------
  if (!config.supplier.live) {
    return {
      simulated: true,
      supplier: config.supplier.name,
      purchaseOrderId: `PO-${config.supplier.name.slice(0, 2).toUpperCase()}-${order.id}`,
      status: "confirmed",
      supplierCostTotal,
      lineItems,
      createdAt: new Date().toISOString(),
    };
  }

  // ---------- MODO LIVE (CJ Dropshipping) ----------
  const token = await getAccessToken();

  // Resuelve el VID real de cada producto (a partir de su SPU) antes de ordenar.
  const cjProducts = [];
  for (const it of order.items) {
    const variant = await resolveVariant(it);
    cjProducts.push({ vid: variant.vid, quantity: it.quantity });
  }

  const payload = {
    orderNumber: order.externalReference,
    shippingCountryCode: order.shipping.country || "MX",
    shippingProvince: order.shipping.state,
    shippingCity: order.shipping.city,
    shippingAddress: order.shipping.street,
    shippingZip: order.shipping.zip,
    shippingCustomerName: order.customer.name,
    shippingPhone: order.customer.phone,
    fromCountryCode: config.supplier.fromCountryCode,
    // logisticName: "CJPacket Ordinary", // opcional: fija un método logístico
    products: cjProducts,
  };

  const res = await fetch(`${config.supplier.apiBase}/shopping/order/createOrderV2`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "CJ-Access-Token": token,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  const orderId = data?.data?.orderId || data?.data?.orderNum || data?.orderId;
  if (!res.ok || !orderId) {
    throw new Error(`CJ createOrder falló: ${res.status} ${JSON.stringify(data).slice(0, 300)}`);
  }

  return {
    simulated: false,
    supplier: config.supplier.name,
    purchaseOrderId: orderId,
    status: data?.data?.orderStatus || "confirmed",
    supplierCostTotal,
    lineItems,
    raw: data.data,
    createdAt: new Date().toISOString(),
  };
}
