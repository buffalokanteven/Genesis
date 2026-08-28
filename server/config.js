/**
 * Configuración central. Lee variables de entorno con valores por defecto seguros.
 * Si no hay credenciales reales, el sistema corre en MODO SIMULACIÓN (mock),
 * que replica el flujo completo sin llamar a servicios externos ni mover dinero.
 */

const env = process.env;

export const config = {
  port: Number(env.PORT || 3000),
  // En Render, RENDER_EXTERNAL_URL se inyecta solo -> back_urls y webhook quedan correctos sin configurar nada.
  baseUrl: env.BASE_URL || env.RENDER_EXTERNAL_URL || `http://localhost:${env.PORT || 3000}`,
  currency: "MXN",

  brand: {
    name: "STILL",
    tagline: "Movimiento sin caos.",
    email: env.STORE_EMAIL || "hola@stillwellness.mx",
  },

  // --- Mercado Pago (tu cuenta, aquí llega el pago) ---
  mercadopago: {
    accessToken: env.MP_ACCESS_TOKEN || "", // TEST-... o APP_USR-...
    publicKey: env.MP_PUBLIC_KEY || "",
    webhookSecret: env.MP_WEBHOOK_SECRET || "",
    // Si no hay accessToken => modo simulación
    get live() {
      return Boolean(this.accessToken);
    },
  },

  // --- Proveedor / dropshipping (orden de compra automática) ---
  supplier: {
    name: env.SUPPLIER_NAME || "CJ Dropshipping",
    apiKey: env.SUPPLIER_API_KEY || "",
    apiBase: env.SUPPLIER_API_BASE || "https://developers.cjdropshipping.com/api2.0/v1",
    get live() {
      return Boolean(this.apiKey);
    },
  },

  // --- Paquetería / guía y tracking ---
  shipping: {
    provider: env.SHIPPING_PROVIDER || "skydropx", // skydropx | envia
    apiKey: env.SHIPPING_API_KEY || "",
    apiBase: env.SHIPPING_API_BASE || "https://api.skydropx.com/v1",
    // Dirección de origen (bodega del proveedor o tu centro de distribución)
    origin: {
      name: env.ORIGIN_NAME || "STILL Fulfillment",
      street: env.ORIGIN_STREET || "Av. Central 100",
      city: env.ORIGIN_CITY || "Ciudad de México",
      state: env.ORIGIN_STATE || "CDMX",
      zip: env.ORIGIN_ZIP || "06000",
      country: "MX",
      phone: env.ORIGIN_PHONE || "5555555555",
    },
    get live() {
      return Boolean(this.apiKey);
    },
  },
};

export const modeSummary = () => ({
  mercadopago: config.mercadopago.live ? "LIVE" : "SIMULACIÓN",
  supplier: config.supplier.live ? "LIVE" : "SIMULACIÓN",
  shipping: config.shipping.live ? "LIVE" : "SIMULACIÓN",
});
