/**
 * Integración Mercado Pago — Checkout Pro (API de Preferencias).
 * Docs: https://www.mercadopago.com.mx/developers/es/reference/online-payments/checkout-pro/overview
 *
 * Flujo:
 *  1) createPreference()  -> crea la preferencia y devuelve init_point (URL de pago).
 *  2) El cliente paga en el entorno de Mercado Pago.
 *  3) MP notifica por webhook (topic=payment). getPayment() consulta el estado real.
 *
 * Sin MP_ACCESS_TOKEN corre en modo SIMULACIÓN: devuelve un init_point local
 * que apunta a /sandbox/pay para poder probar el flujo completo end-to-end.
 */
import { config } from "../config.js";

const MP_API = "https://api.mercadopago.com";

export async function createPreference(order) {
  const items = order.items.map((it) => ({
    id: it.id,
    title: it.name,
    quantity: it.quantity,
    unit_price: it.price,
    currency_id: config.currency,
  }));

  const body = {
    items,
    external_reference: order.externalReference,
    statement_descriptor: config.brand.name,
    back_urls: {
      success: `${config.baseUrl}/gracias?ref=${order.externalReference}`,
      failure: `${config.baseUrl}/checkout?error=1`,
      pending: `${config.baseUrl}/gracias?ref=${order.externalReference}&pending=1`,
    },
    auto_return: "approved",
    notification_url: `${config.baseUrl}/api/webhooks/mercadopago`,
    payer: order.customer
      ? { name: order.customer.name, email: order.customer.email }
      : undefined,
  };

  if (!config.mercadopago.live) {
    // MODO SIMULACIÓN: no llamamos a MP, generamos un enlace local de pago.
    return {
      simulated: true,
      preferenceId: `SIMU-PREF-${order.id}`,
      initPoint: `${config.baseUrl}/sandbox/pay?ref=${order.externalReference}`,
    };
  }

  const res = await fetch(`${MP_API}/checkout/preferences`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.mercadopago.accessToken}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Mercado Pago createPreference falló: ${res.status} ${txt}`);
  }
  const data = await res.json();
  return {
    simulated: false,
    preferenceId: data.id,
    initPoint: data.init_point,
  };
}

/**
 * Consulta un pago real por id (para el webhook).
 * Devuelve { status, external_reference, transaction_amount, ... }
 */
export async function getPayment(paymentId) {
  if (!config.mercadopago.live) {
    return { id: paymentId, status: "approved", simulated: true };
  }
  const res = await fetch(`${MP_API}/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${config.mercadopago.accessToken}` },
  });
  if (!res.ok) throw new Error(`getPayment falló: ${res.status}`);
  return res.json();
}
