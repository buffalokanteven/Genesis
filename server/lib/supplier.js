/**
 * Adaptador de PROVEEDOR (dropshipping) — genera la ORDEN DE COMPRA automática.
 *
 * Implementado como adaptador intercambiable. Por defecto: CJ Dropshipping.
 * Docs CJ: https://developers.cjdropshipping.com/
 *
 * Cuando entra un pedido pagado, createPurchaseOrder():
 *   - Mapea cada item de la tienda a su supplierSku.
 *   - Envía la orden al proveedor con la dirección del cliente final (dropship).
 *   - Devuelve el id de la orden de compra del proveedor y el costo.
 *
 * Sin SUPPLIER_API_KEY corre en SIMULACIÓN: genera una OC ficticia coherente.
 */
import { config } from "../config.js";

export async function createPurchaseOrder(order) {
  const lineItems = order.items.map((it) => ({
    sku: it.supplierSku,
    productName: it.name,
    quantity: it.quantity,
    unitCost: it.supplierCost,
  }));

  const supplierCostTotal = lineItems.reduce(
    (s, li) => s + li.unitCost * li.quantity,
    0
  );

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

  // Ejemplo de llamada real a CJ Dropshipping (crear orden).
  const payload = {
    orderNumber: order.externalReference,
    shippingCustomerName: order.customer.name,
    shippingPhone: order.customer.phone,
    shippingAddress: order.shipping.street,
    shippingCity: order.shipping.city,
    shippingProvince: order.shipping.state,
    shippingZip: order.shipping.zip,
    shippingCountryCode: "MX",
    products: lineItems.map((li) => ({ vid: li.sku, quantity: li.quantity })),
  };

  const res = await fetch(`${config.supplier.apiBase}/shopping/order/createOrder`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "CJ-Access-Token": config.supplier.apiKey,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Proveedor createPurchaseOrder falló: ${res.status} ${txt}`);
  }
  const data = await res.json();
  return {
    simulated: false,
    supplier: config.supplier.name,
    purchaseOrderId: data?.data?.orderId || data?.orderId,
    status: "confirmed",
    supplierCostTotal,
    lineItems,
    raw: data,
    createdAt: new Date().toISOString(),
  };
}
