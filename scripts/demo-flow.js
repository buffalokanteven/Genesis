/**
 * Demo end-to-end SIN servidor: simula un pedido completo y muestra
 * la orden de compra al proveedor + la guía/tracking generados + finanzas.
 * Uso:  npm run demo
 */
import { randomUUID } from "node:crypto";
import { fulfillOrder } from "../server/lib/fulfillment.js";
import { store } from "../server/store.js";
import { productById } from "../server/data/products.js";
import { modeSummary } from "../server/config.js";

const money = (n) => `$${Number(n).toLocaleString("es-MX")}`;

function makeOrder() {
  const picks = [
    { id: "yoga-mat-tpe-6mm", quantity: 1 },
    { id: "resistance-bands-set", quantity: 2 },
  ];
  const items = picks.map((l) => {
    const p = productById(l.id);
    return {
      id: p.id, name: p.name, price: p.price, supplierCost: p.supplierCost,
      supplierSku: p.supplierSku, weightKg: p.weightKg, dimsCm: p.dimsCm, quantity: l.quantity,
    };
  });
  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const order = {
    id: randomUUID().slice(0, 8),
    externalReference: `DEMO-${Date.now().toString(36).toUpperCase()}`,
    createdAt: new Date().toISOString(),
    status: "paid",
    items, subtotal, shippingCost: subtotal >= 899 ? 0 : 99,
    total: subtotal + (subtotal >= 899 ? 0 : 99),
    customer: { name: "Ana López", email: "ana@correo.com", phone: "5512345678" },
    shipping: { street: "Av. Reforma 123", city: "CDMX", state: "CDMX", zip: "06600", country: "MX" },
    fulfillment: null,
  };
  store.create(order);
  return order;
}

console.log("\n════════ STILL — DEMO DE FULFILLMENT ════════");
console.log("Modo:", modeSummary(), "\n");

const order = makeOrder();
console.log(`Pedido ${order.externalReference} — cliente ${order.customer.name}`);
order.items.forEach((i) => console.log(`  · ${i.quantity} × ${i.name}  ${money(i.price * i.quantity)}`));
console.log(`  Total: ${money(order.total)}\n`);

const done = await fulfillOrder(order.id);
const f = done.fulfillment;

console.log("① ORDEN DE COMPRA AL PROVEEDOR");
console.log(`   Proveedor: ${f.purchaseOrder.supplier}`);
console.log(`   OC: ${f.purchaseOrder.purchaseOrderId}  (${f.purchaseOrder.status})`);
console.log(`   Costo proveedor: ${money(f.purchaseOrder.supplierCostTotal)}\n`);

console.log("② GUÍA Y TRACKING");
console.log(`   Paquetería: ${f.shipment.carrier}`);
console.log(`   Guía: ${f.shipment.trackingNumber}`);
console.log(`   Etiqueta: ${f.shipment.labelUrl}`);
console.log(`   Rastreo: ${f.shipment.trackingUrl}\n`);

console.log("③ FINANZAS");
console.log(`   Venta: ${money(f.finance.revenue)}`);
console.log(`   Costo proveedor: ${money(f.finance.supplierCost)}`);
console.log(`   Comisión MP (aprox.): ${money(f.finance.mpFee)}`);
console.log(`   ► Utilidad: ${money(f.finance.profit)}\n`);
console.log("Estado final del pedido:", done.status);
console.log("═════════════════════════════════════════════\n");
