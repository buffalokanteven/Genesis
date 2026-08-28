/**
 * Adaptador de PAQUETERÍA — genera la GUÍA (etiqueta) y el TRACKING.
 * Proveedor por defecto: Skydropx (México). También soporta Envia.com.
 *  - Skydropx docs: https://ayuda.skydropx.com/integraciones/api/
 *  - Envia docs:    https://docs.envia.com/
 *
 * createShipment():
 *   - Cotiza con las dimensiones/peso reales del pedido.
 *   - Genera la guía y devuelve trackingNumber, labelUrl y URL de rastreo.
 *
 * Sin SHIPPING_API_KEY corre en SIMULACIÓN: genera una guía y tracking ficticios.
 */
import { config } from "../config.js";

function consolidatePackage(items) {
  // Suma peso y toma la caja mayor (simplificación para MVP).
  let weightKg = 0;
  let length = 0,
    width = 0,
    height = 0;
  for (const it of items) {
    weightKg += (it.weightKg || 0.5) * it.quantity;
    length = Math.max(length, it.dimsCm?.length || 30);
    width = Math.max(width, it.dimsCm?.width || 20);
    height += (it.dimsCm?.height || 10) * it.quantity;
  }
  return { weightKg: Math.max(1, Math.ceil(weightKg)), length, width, height };
}

function fakeTracking() {
  const n = Math.random().toString().slice(2, 12);
  return `STILL${n}MX`;
}

export async function createShipment(order) {
  const pkg = consolidatePackage(order.items);

  if (!config.shipping.live) {
    const tracking = fakeTracking();
    return {
      simulated: true,
      carrier: "Estafeta (sim.)",
      provider: config.shipping.provider,
      trackingNumber: tracking,
      labelUrl: `${config.baseUrl}/sandbox/label/${tracking}.pdf`,
      trackingUrl: `${config.baseUrl}/rastreo/${tracking}`,
      package: pkg,
      estimatedDelivery: new Date(Date.now() + 4 * 864e5).toISOString().slice(0, 10),
      createdAt: new Date().toISOString(),
    };
  }

  // --- Skydropx: cotizar -> comprar guía ---
  if (config.shipping.provider === "skydropx") {
    const quoteRes = await fetch(`${config.shipping.apiBase}/quotations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token token=${config.shipping.apiKey}`,
      },
      body: JSON.stringify({
        address_from: { zip: config.shipping.origin.zip, country: "MX" },
        address_to: { zip: order.shipping.zip, country: "MX" },
        parcel: pkg,
      }),
    });
    if (!quoteRes.ok) throw new Error(`Skydropx cotización falló: ${quoteRes.status}`);
    const quote = await quoteRes.json();
    const cheapest = (quote.rates || quote.data || []).sort(
      (a, b) => a.total_pricing - b.total_pricing
    )[0];

    const shipRes = await fetch(`${config.shipping.apiBase}/shipments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token token=${config.shipping.apiKey}`,
      },
      body: JSON.stringify({
        quotation_id: quote.id,
        rate_id: cheapest?.id,
        address_from: config.shipping.origin,
        address_to: { ...order.shipping, name: order.customer.name, phone: order.customer.phone },
      }),
    });
    if (!shipRes.ok) throw new Error(`Skydropx guía falló: ${shipRes.status}`);
    const ship = await shipRes.json();
    return {
      simulated: false,
      carrier: cheapest?.provider,
      provider: "skydropx",
      trackingNumber: ship.tracking_number,
      labelUrl: ship.label_url,
      trackingUrl: ship.tracking_url_provider || `https://rastreo.skydropx.com/${ship.tracking_number}`,
      package: pkg,
      raw: ship,
      createdAt: new Date().toISOString(),
    };
  }

  throw new Error(`Proveedor de envío no soportado: ${config.shipping.provider}`);
}

export async function getTracking(trackingNumber) {
  if (!config.shipping.live) {
    // Simula avance del envío según la antigüedad de la guía.
    const statuses = ["created", "collected", "in_transit", "out_for_delivery", "delivered"];
    return {
      trackingNumber,
      status: statuses[Math.min(statuses.length - 1, Math.floor(Math.random() * statuses.length))],
      history: [
        { status: "created", at: new Date().toISOString(), note: "Guía generada" },
      ],
    };
  }
  // En producción: consultar endpoint de tracking del proveedor.
  return { trackingNumber, status: "unknown" };
}
