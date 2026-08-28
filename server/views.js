/**
 * Vistas server-rendered (páginas de confirmación, rastreo, admin y simulación).
 * Comparten la hoja de estilos del frontend para mantener la misma vibe.
 */
const money = (n) => `$${Number(n).toLocaleString("es-MX")}`;

function shell(title, inner) {
  return `<!doctype html><html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} · STILL</title>
<link rel="stylesheet" href="/css/styles.css">
</head><body class="page-plain">
<header class="nav"><a class="brand" href="/">STILL</a><a class="nav-link" href="/">← Volver a la tienda</a></header>
<main class="wrap">${inner}</main>
<footer class="footer"><p>STILL · Movimiento sin caos.</p></footer>
</body></html>`;
}

export const page = {
  sandboxPay(order) {
    const items = order.items
      .map((i) => `<li>${i.quantity} × ${i.name} <span>${money(i.price * i.quantity)}</span></li>`)
      .join("");
    return shell(
      "Pago (simulación)",
      `<section class="card narrow">
        <p class="eyebrow">Entorno de simulación · Mercado Pago</p>
        <h1 class="serif">Confirmar pago</h1>
        <p class="muted">Estás en modo demo (sin credenciales reales). Al confirmar se dispara el flujo real: pago aprobado → orden de compra al proveedor → guía y tracking.</p>
        <ul class="line-items">${items}</ul>
        <div class="total-row"><span>Total</span><strong>${money(order.total)}</strong></div>
        <button id="pay" class="btn btn-primary btn-block">Pagar ${money(order.total)}</button>
        <p class="fineprint">Ref: ${order.externalReference}</p>
      </section>
      <script>
        document.getElementById('pay').addEventListener('click', async () => {
          const b = document.getElementById('pay');
          b.textContent = 'Procesando…'; b.disabled = true;
          const r = await fetch('/sandbox/confirm', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ref:'${order.externalReference}'})});
          const d = await r.json();
          location.href = '/gracias?ref=' + encodeURIComponent(d.ref);
        });
      </script>`
    );
  },

  gracias(order) {
    const f = order.fulfillment;
    const paid = order.status === "paid" || order.status === "fulfilled";
    const po = f?.purchaseOrder;
    const sh = f?.shipment;
    const fin = f?.finance;
    return shell(
      "¡Gracias!",
      `<section class="card narrow">
        <p class="eyebrow">Pedido ${order.externalReference}</p>
        <h1 class="serif">${paid ? "Pago confirmado ✦" : "Pedido registrado"}</h1>
        <p class="muted">Gracias, ${order.customer?.name || "cliente"}. ${
          paid ? "Tu pedido ya está en preparación." : "En cuanto confirmemos el pago iniciamos el envío."
        }</p>

        <div class="status-grid">
          <div class="status-step done"><span>1</span><p>Pago recibido</p><small>${paid ? "Aprobado" : "Pendiente"}</small></div>
          <div class="status-step ${po ? "done" : ""}"><span>2</span><p>Orden a proveedor</p><small>${po ? po.purchaseOrderId : "—"}</small></div>
          <div class="status-step ${sh ? "done" : ""}"><span>3</span><p>Guía generada</p><small>${sh ? sh.trackingNumber : "—"}</small></div>
        </div>

        ${
          sh
            ? `<div class="track-box">
                <p class="eyebrow">Envío</p>
                <p><strong>${sh.carrier}</strong> · Guía <code>${sh.trackingNumber}</code></p>
                <div class="btn-row">
                  <a class="btn btn-outline" href="${sh.trackingUrl}">Rastrear pedido</a>
                  <a class="btn btn-outline" href="${sh.labelUrl}">Ver guía</a>
                </div>
              </div>`
            : ""
        }
        ${
          fin
            ? `<details class="admin-note"><summary>Resumen interno (comerciante)</summary>
                <ul class="kv">
                  <li><span>Venta</span><b>${money(fin.revenue)}</b></li>
                  <li><span>Costo proveedor</span><b>${money(fin.supplierCost)}</b></li>
                  <li><span>Comisión MP (aprox.)</span><b>${money(fin.mpFee)}</b></li>
                  <li class="hl"><span>Utilidad</span><b>${money(fin.profit)}</b></li>
                </ul></details>`
            : ""
        }
      </section>`
    );
  },

  rastreo(tracking, info) {
    const steps = ["created", "collected", "in_transit", "out_for_delivery", "delivered"];
    const labels = {
      created: "Guía generada",
      collected: "Recolectado",
      in_transit: "En tránsito",
      out_for_delivery: "En reparto",
      delivered: "Entregado",
    };
    const currentIdx = steps.indexOf(info.status);
    const timeline = steps
      .map(
        (s, i) =>
          `<li class="${i <= currentIdx ? "done" : ""}"><span></span>${labels[s]}</li>`
      )
      .join("");
    return shell(
      "Rastreo",
      `<section class="card narrow">
        <p class="eyebrow">Rastreo de envío</p>
        <h1 class="serif">Guía ${tracking}</h1>
        <ul class="timeline">${timeline}</ul>
      </section>`
    );
  },

  admin(orders, modes) {
    const rows = orders
      .slice()
      .reverse()
      .map((o) => {
        const f = o.fulfillment || {};
        return `<tr>
          <td><code>${o.externalReference}</code></td>
          <td>${o.customer?.name || "—"}</td>
          <td>${money(o.total)}</td>
          <td><span class="tag tag-${o.status}">${o.status}</span></td>
          <td>${f.purchaseOrder?.purchaseOrderId || "—"}</td>
          <td>${f.shipment ? `<a href="${f.shipment.trackingUrl}">${f.shipment.trackingNumber}</a>` : "—"}</td>
          <td>${f.finance ? money(f.finance.profit) : "—"}</td>
        </tr>`;
      })
      .join("");
    return shell(
      "Panel",
      `<section class="card wide">
        <p class="eyebrow">Panel de operación</p>
        <h1 class="serif">Pedidos</h1>
        <p class="muted">Modo — Mercado Pago: <b>${modes.mercadopago}</b> · Proveedor: <b>${modes.supplier}</b> · Envíos: <b>${modes.shipping}</b></p>
        <table class="admin-table">
          <thead><tr><th>Ref</th><th>Cliente</th><th>Total</th><th>Estado</th><th>OC Proveedor</th><th>Guía</th><th>Utilidad</th></tr></thead>
          <tbody>${rows || `<tr><td colspan="7" class="muted">Aún no hay pedidos.</td></tr>`}</tbody>
        </table>
      </section>`
    );
  },

  fakeLabel(name) {
    return shell(
      "Guía",
      `<section class="card narrow label-sim">
        <p class="eyebrow">Etiqueta de envío (simulación)</p>
        <h1 class="serif">STILL</h1>
        <div class="barcode"></div>
        <p><b>Guía:</b> ${name.replace(".pdf", "")}</p>
        <p class="muted">En modo LIVE aquí se descarga el PDF real de la paquetería.</p>
      </section>`
    );
  },
};
