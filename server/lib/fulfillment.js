/**
 * ORQUESTADOR DE FULFILLMENT
 * ------------------------------------------------------------------
 * Se dispara cuando Mercado Pago confirma que un pedido fue PAGADO.
 * Ejecuta en secuencia, de forma idempotente:
 *   1) Orden de compra automática al proveedor (dropship a la dirección del cliente).
 *   2) Generación de la guía (etiqueta) y número de tracking.
 *   3) Actualiza el pedido con toda la trazabilidad y calcula la utilidad.
 *
 * Idempotente: si el webhook llega varias veces, no duplica OC ni guía.
 */
import { store } from "../store.js";
import { createPurchaseOrder } from "./supplier.js";
import { createShipment } from "./shipping.js";

export async function fulfillOrder(orderId) {
  let order = store.get(orderId);
  if (!order) throw new Error(`Pedido no encontrado: ${orderId}`);

  if (order.fulfillment?.completed) {
    return order; // ya procesado -> idempotencia
  }

  const fulfillment = { ...(order.fulfillment || {}), startedAt: new Date().toISOString() };

  // 1) Orden de compra al proveedor
  if (!fulfillment.purchaseOrder) {
    fulfillment.purchaseOrder = await createPurchaseOrder(order);
    store.update(orderId, { fulfillment });
  }

  // 2) Guía + tracking
  if (!fulfillment.shipment) {
    fulfillment.shipment = await createShipment(order);
    store.update(orderId, { fulfillment });
  }

  // 3) Finanzas: utilidad = venta - costo proveedor - comisión estimada MP
  const revenue = order.total;
  const supplierCost = fulfillment.purchaseOrder.supplierCostTotal;
  const mpFee = Math.round(revenue * 0.0359 + 4); // aprox. comisión MP MX
  const profit = revenue - supplierCost - mpFee;

  fulfillment.completed = true;
  fulfillment.completedAt = new Date().toISOString();
  fulfillment.finance = { revenue, supplierCost, mpFee, profit };

  order = store.update(orderId, {
    status: "fulfilled",
    fulfillment,
  });

  return order;
}
