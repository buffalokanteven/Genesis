# STILL · Wellness Store (Dropshipping)

Tienda de bienestar con estética editorial y **automatización de fulfillment**:
cuando entra un pedido pagado, el sistema genera automáticamente la **orden de
compra al proveedor**, la **guía de envío + tracking**, y registra el **pago en
tu cuenta de Mercado Pago**.

> Marca: **STILL** — *Movimiento sin caos.*
> Stack: Node.js (HTTP nativo, **sin dependencias**) + frontend vanilla. Precios en MXN.

---

## 1. Cómo correr

```bash
cd still-wellness
node server/index.js
# abre http://localhost:3000
```

- Tienda: `http://localhost:3000`
- Panel de operación: `http://localhost:3000/admin`
- Demo del flujo sin navegador: `npm run demo`

> Si tu terminal tiene un `NODE_OPTIONS` heredado que rompe el arranque, usa
> `env -u NODE_OPTIONS node server/index.js`.

Sin credenciales, el sistema corre en **MODO SIMULACIÓN**: replica el flujo
completo (pago → OC → guía → tracking) sin llamar a servicios externos ni mover
dinero. Ideal para probar y demostrar.

---

## 2. Productos (investigación de mercado)

| Producto | Precio venta | Costo proveedor* | SKU proveedor |
|---|---|---|---|
| Tapete de Yoga TPE 6mm | $499 | ~$185 | CJ-YOGA-TPE6-001 |
| Tapete de Yoga PRO 8mm | $649 | ~$240 | CJ-YOGA-PRO8-002 |
| Kit de Pesas Ajustables | $899 | ~$430 | CJ-WEIGHT-ADJ-010 |
| Bandas Elásticas de Tensión (set 5) | $349 | ~$95 | CJ-BAND-SET5-021 |
| Poleas para Manos y Tobillos | $399 | ~$120 | CJ-PULLEY-DUAL-030 |

\* Costos **estimados** a partir de investigación en CJ Dropshipping, AliExpress
Business, Alibaba y Faire. Ajústalos con las cotizaciones reales de tu proveedor.
Edita todo en `server/data/products.js`.

---

## 3. Arquitectura del flujo

```
Cliente compra en la tienda
        │
        ▼
POST /api/checkout ──► crea pedido + Preferencia de Mercado Pago ──► redirige a pagar
        │
        ▼  (cliente paga)
Webhook  POST /api/webhooks/mercadopago  (topic=payment)
        │  verifica el pago con la API de MP
        ▼  si status = approved
fulfillOrder()  ── orquestador idempotente ──┐
        ├─ 1) Orden de compra al PROVEEDOR (dropship a la dirección del cliente)
        ├─ 2) Guía + tracking con la PAQUETERÍA
        └─ 3) Calcula utilidad (venta − costo proveedor − comisión MP)
```

Archivos clave:

| Archivo | Rol |
|---|---|
| `server/lib/mercadopago.js` | Crea la preferencia (Checkout Pro) y verifica pagos |
| `server/lib/supplier.js` | Orden de compra automática (adaptador CJ Dropshipping) |
| `server/lib/shipping.js` | Guía + tracking (adaptador Skydropx / Envia) |
| `server/lib/fulfillment.js` | Orquestador: pago → OC → guía → finanzas |
| `server/data/products.js` | Catálogo, precios y SKUs |

---

## 4. Conectar tus credenciales reales (pasar a LIVE)

Copia `.env.example` a `.env` y llena lo que tengas. Cada bloque que llenes pasa
de SIMULACIÓN a LIVE de forma independiente.

### A) Mercado Pago (el dinero llega a TU cuenta)
1. Entra a **mercadopago.com.mx/developers/panel**, crea una aplicación.
2. Copia `Access Token` y `Public Key` a `MP_ACCESS_TOKEN` / `MP_PUBLIC_KEY`.
3. Configura el webhook apuntando a `https://TU-DOMINIO/api/webhooks/mercadopago`
   (evento *Pagos*).
4. Empieza con credenciales **TEST**, luego cambia a producción.

### B) Proveedor (orden de compra automática)
1. Crea cuenta en tu proveedor dropshipping (ej. **CJ Dropshipping**) y genera tu
   API Key en el panel de desarrolladores.
2. Ponla en `SUPPLIER_API_KEY`.
3. Ajusta cada `supplierSku` en `products.js` al ID real de cada producto en el
   catálogo del proveedor (paso imprescindible para que la OC salga correcta).

### C) Paquetería (guía + tracking)
1. Crea cuenta en **Skydropx** (o **Envia.com**) y solicita tu API Key
   (Skydropx: `api@skydropx.com`).
2. Ponla en `SHIPPING_API_KEY` y ajusta `SHIPPING_PROVIDER`.
3. Configura la dirección de origen (`ORIGIN_*`) = bodega del proveedor o tu CEDIS.

> **Importante:** yo dejé el código y los adaptadores listos, pero **las cuentas
> y credenciales reales las debes crear tú** (requieren tu identidad/negocio).
> No es posible "conectar" un proveedor o mover dinero sin esas llaves.

---

## 5. Qué falta para lanzar a producción
- [ ] Cargar credenciales reales en `.env` (sección 4).
- [ ] Desplegar en un host con HTTPS (Render, Railway, Fly.io, VPS…) para que el
      webhook de Mercado Pago sea alcanzable.
- [ ] Mapear los `supplierSku` reales del proveedor.
- [ ] Migrar el almacenamiento de `data-store/orders.json` a una base de datos.
- [ ] Sustituir las ilustraciones SVG por fotografía de producto real.
- [ ] Añadir Aviso de Privacidad y Términos (obligatorio para cobrar en MX).
```
```
