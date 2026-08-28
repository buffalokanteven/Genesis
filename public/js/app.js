/* STILL — frontend store logic (vanilla JS, sin dependencias) */
const money = (n) => `$${Number(n).toLocaleString("es-MX")}`;
const $ = (s) => document.querySelector(s);

let PRODUCTS = [];
let cart = JSON.parse(localStorage.getItem("still_cart") || "[]");

/* ---------- Nav scroll ---------- */
const nav = $("#nav");
window.addEventListener("scroll", () => {
  nav.classList.toggle("scrolled", window.scrollY > window.innerHeight * 0.7);
});

/* ---------- Cargar productos ---------- */
async function loadProducts() {
  const res = await fetch("/api/products");
  const data = await res.json();
  PRODUCTS = data.products;
  renderProducts();
  renderCart();
}

function renderProducts() {
  const grid = $("#productGrid");
  grid.innerHTML = PRODUCTS.map(
    (p) => `
    <article class="card-product">
      <div class="thumb">
        ${p.badge ? `<span class="badge">${p.badge}</span>` : ""}
        <img src="${p.image}" alt="${p.name}" loading="lazy" />
      </div>
      <div class="card-info">
        <p class="card-cat">${p.category}</p>
        <h3 class="card-name">${p.name}</h3>
        <p class="card-sub">${p.subtitle}</p>
        <div class="card-price">
          <span class="now">${money(p.price)}</span>
          ${p.compareAt ? `<span class="was">${money(p.compareAt)}</span>` : ""}
        </div>
        <button class="btn btn-outline add-btn" data-add="${p.id}">Agregar a la bolsa</button>
      </div>
    </article>`
  ).join("");
  grid.querySelectorAll("[data-add]").forEach((b) =>
    b.addEventListener("click", () => addToCart(b.dataset.add))
  );
}

/* ---------- Carrito ---------- */
function saveCart() {
  localStorage.setItem("still_cart", JSON.stringify(cart));
}
function addToCart(id) {
  const line = cart.find((l) => l.id === id);
  if (line) line.quantity++;
  else cart.push({ id, quantity: 1 });
  saveCart();
  renderCart();
  openCart();
}
function changeQty(id, delta) {
  const line = cart.find((l) => l.id === id);
  if (!line) return;
  line.quantity += delta;
  if (line.quantity <= 0) cart = cart.filter((l) => l.id !== id);
  saveCart();
  renderCart();
}
function cartDetailed() {
  return cart
    .map((l) => ({ ...PRODUCTS.find((p) => p.id === l.id), quantity: l.quantity }))
    .filter((x) => x.id);
}
function renderCart() {
  const items = cartDetailed();
  const count = items.reduce((s, i) => s + i.quantity, 0);
  $("#cartCount").textContent = count;
  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);

  $("#cartItems").innerHTML = items.length
    ? items
        .map(
          (i) => `
      <div class="cart-line">
        <div class="thumb"><img src="${i.image}" alt="${i.name}" /></div>
        <div class="meta">
          <p class="name">${i.name}</p>
          <p class="fineprint">${money(i.price)}</p>
          <div class="qty">
            <button data-minus="${i.id}">−</button><span>${i.quantity}</span><button data-plus="${i.id}">+</button>
          </div>
        </div>
        <strong>${money(i.price * i.quantity)}</strong>
      </div>`
        )
        .join("")
    : `<p class="muted" style="padding:2rem 0">Tu bolsa está vacía.</p>`;

  $("#cartItems")
    .querySelectorAll("[data-plus]")
    .forEach((b) => b.addEventListener("click", () => changeQty(b.dataset.plus, 1)));
  $("#cartItems")
    .querySelectorAll("[data-minus]")
    .forEach((b) => b.addEventListener("click", () => changeQty(b.dataset.minus, -1)));

  $("#cartSubtotal").textContent = money(subtotal);
  $("#checkoutBtn").disabled = items.length === 0;
  const shipNote = $("#shipNote");
  if (subtotal >= 899) shipNote.textContent = "✦ Envío gratis incluido.";
  else if (subtotal > 0) shipNote.textContent = `Envío $99 · te faltan ${money(899 - subtotal)} para envío gratis.`;
  else shipNote.textContent = "";
}

/* ---------- UI open/close ---------- */
const backdrop = $("#backdrop");
const drawer = $("#cartDrawer");
const modalBackdrop = $("#modalBackdrop");
function openCart() { drawer.classList.add("open"); backdrop.classList.add("open"); }
function closeCart() { drawer.classList.remove("open"); backdrop.classList.remove("open"); }
function openModal() { modalBackdrop.classList.add("open"); }
function closeModal() { modalBackdrop.classList.remove("open"); }

$("#cartOpen").addEventListener("click", openCart);
$("#cartClose").addEventListener("click", closeCart);
backdrop.addEventListener("click", closeCart);
$("#modalClose").addEventListener("click", closeModal);
modalBackdrop.addEventListener("click", (e) => { if (e.target === modalBackdrop) closeModal(); });
$("#checkoutBtn").addEventListener("click", () => { closeCart(); openModal(); });

/* ---------- Checkout ---------- */
$("#checkoutForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("#payBtn");
  btn.disabled = true;
  btn.textContent = "Creando tu pedido…";
  const fd = new FormData(e.target);
  const payload = {
    cart,
    customer: { name: fd.get("name"), email: fd.get("email"), phone: fd.get("phone") },
    shipping: {
      street: fd.get("street"),
      city: fd.get("city"),
      state: fd.get("state"),
      zip: fd.get("zip"),
      country: "MX",
    },
  };
  try {
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error");
    localStorage.removeItem("still_cart");
    window.location.href = data.initPoint; // redirige a Mercado Pago (o simulación)
  } catch (err) {
    alert("No se pudo procesar: " + err.message);
    btn.disabled = false;
    btn.textContent = "Ir a pagar con Mercado Pago";
  }
});

loadProducts();
