import { db } from './firebase-config.js';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { collection, addDoc, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const auth = getAuth();
console.log("🔥 NEXOSTORE SCRIPT TIENDA CARGADO (Con Autenticación)");

let storeProducts = [];
let cart = JSON.parse(localStorage.getItem("elanCart") || "[]");
let currentCategory = "Todos";
let currentSearch = "";
let unsubscribeProducts = null;
let currentClient = null;

const $ = (s) => document.querySelector(s); const $$ = (s) => document.querySelectorAll(s);

const featuredGrid = $("#featuredGrid");
const productGrid = $("#productGrid");
const filters = $("#filters");
const cartBtn = $("#cartBtn");
const cartDrawer = $("#cartDrawer");
const cartOverlay = $("#cartOverlay");
const closeCartBtn = $("#closeCart");
const cartItems = $("#cartItems");
const cartTotal = $("#cartTotal");
const cartCount = $("#cartCount");
const checkoutBtn = $("#checkoutBtn");
const toast = $("#toast");

const searchBtn = $("#searchBtn");
const searchBar = $("#searchBar");
const closeSearch = $("#closeSearch");
const searchInput = $("#searchInput");

const menuToggle = $("#menuToggle");
const navLinks = $("#navLinks");
const newsletterForm = $("#newsletterForm");
const newsletterMessage = $("#newsletterMessage");

const checkoutModal = $("#checkoutModal");
const checkoutOverlay = $("#checkoutOverlay");
const closeCheckoutBtn = $("#closeCheckout");
const checkoutForm = $("#checkoutForm");

// Elementos de Autenticación de Clientes
const userAuthBtn = $("#userAuthBtn");
const authModal = $("#authModal");
const authOverlay = $("#authOverlay");
const closeAuthModal = $("#closeAuthModal");
const clientLoginForm = $("#clientLoginForm");
const clientRegisterForm = $("#clientRegisterForm");
const switchToRegister = $("#switchToRegister");
const switchToLogin = $("#switchToLogin");
const authModalTitle = $("#authModalTitle");

const COP = new Intl.NumberFormat("es-CO", { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
const formatMoney = (val) => COP.format(Number(val) || 0);

function esc(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalize(value = "") {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function showToast(message) {
  if (!toast) { console.log(message); return; }
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2200);
}

function fixHeroVisibility() {
  document.querySelectorAll(".hero .reveal, .hero [data-reveal]").forEach((el) => {
    el.classList.add("visible");
    el.style.opacity = "1";
    el.style.visibility = "visible";
    el.style.transform = "none";
  });
}

function initializeRevealAnimations() {
  const elements = document.querySelectorAll(".reveal:not(.hero .reveal)");
  elements.forEach((el) => el.classList.add("visible"));
}

function productCard(product) {
  const image = product.imageUrl ? `<img src="${esc(product.imageUrl)}" alt="${esc(product.name)}" loading="lazy" onerror="this.style.display='none';">` : "";
  const tag = product.tag ? `<span class="product-tag">${esc(product.tag)}</span>` : "";
  const variant = product.variant || "variant-1";
  const stock = Number(product.stock) || 0;

  return `
    <article class="product-card reveal visible">
      <div class="product-media ${esc(variant)}">
        ${image}
        ${tag}
        ${!product.imageUrl ? `<div class="product-placeholder"></div>` : ""}
      </div>
      <div class="product-info">
        <div>
          <span class="product-category">${esc(product.category || "Joyería")}</span>
          <h3>${esc(product.name)}</h3>
        </div>
        <div class="product-bottom">
          <strong>${formatMoney(product.price)}</strong>
          <button class="add-product add-btn" type="button" data-add="${esc(product.id)}" ${stock <= 0 ? "disabled" : ""}>
            ${stock <= 0 ? "✕" : "+"}
          </button>
        </div>
      </div>
    </article>
  `;
}

function renderFeatured() {
  if (!featuredGrid) return;
  const featured = storeProducts.filter(p => p.featured === true);
  if (!featured.length) { featuredGrid.innerHTML = ""; return; }
  featuredGrid.innerHTML = featured.slice(0, 4).map(productCard).join("");
}

function renderProducts(category = currentCategory, search = currentSearch) {
  if (!productGrid) return;
  const normSearch = normalize(search);
  const filtered = storeProducts.filter(product => {
    const catMatch = category === "Todos" || normalize(product.category) === normalize(category);
    const searchMatch = !normSearch || 
      normalize(product.name).includes(normSearch) || 
      normalize(product.category).includes(normSearch) || 
      normalize(product.tag).includes(normSearch) || 
      normalize(product.description).includes(normSearch);
    return catMatch && searchMatch;
  });

  if (!filtered.length) {
    productGrid.innerHTML = `
      <div class="empty-state" style="grid-column: 1/-1; text-align:center; padding: 40px;">
        <h3>No encontramos productos</h3>
        <p>${storeProducts.length === 0 ? "Todavía no hay productos disponibles." : "Prueba con otra búsqueda o categoría."}</p>
      </div>
    `;
    return;
  }
  productGrid.innerHTML = filtered.map(productCard).join("");
}

function initializeFilters() {
  if (!filters) return;
  filters.addEventListener("click", (e) => {
    const btn = e.target.closest(".filter");
    if (!btn) return;
    $$("#filters .filter").forEach(f => f.classList.remove("active"));
    btn.classList.add("active");
    currentCategory = btn.dataset.filter || btn.textContent.trim() || "Todos";
    renderProducts(currentCategory, currentSearch);
  });
}

function saveCart() { localStorage.setItem("elanCart", JSON.stringify(cart)); }

function updateCartCount() {
  if (!cartCount) return;
  const qty = cart.reduce((t, i) => t + Number(i.qty || 0), 0);
  cartCount.textContent = qty;
}

function findProduct(id) { return storeProducts.find(p => String(p.id) === String(id)); }

function addToCart(id) {
  const product = findProduct(id);
  if (!product) { showToast("Producto no encontrado."); return; }
  const stock = Number(product.stock) || 0;
  if (stock <= 0) { showToast("Este producto está agotado."); return; }
  
  const existing = cart.find(i => String(i.id) === String(id));
  if (existing) {
    if (Number(existing.qty) >= stock) { showToast("No hay más unidades disponibles."); return; }
    existing.qty += 1;
  } else {
    cart.push({ id: String(id), qty: 1 });
  }
  saveCart();
  updateCartCount();
  renderCart();
  showToast(`${product.name} añadido al carrito.`);
}

function removeFromCart(id) {
  cart = cart.filter(i => String(i.id) !== String(id));
  saveCart();
  updateCartCount();
  renderCart();
  showToast("Producto eliminado.");
}

function renderCart() {
  if (!cartItems || !cartTotal) return;
  if (!cart.length) {
    cartItems.innerHTML = `<div class="empty-cart"><p>Tu carrito está esperando una pequeña obsesión ✦</p></div>`;
    cartTotal.textContent = formatMoney(0);
    return;
  }
  let total = 0;
  cartItems.innerHTML = cart.map(item => {
    const product = findProduct(item.id);
    if (!product) return "";
    const qty = Number(item.qty) || 1;
    const price = Number(product.price) || 0;
    const sub = price * qty;
    total += sub;
    return `
      <div class="cart-item">
        <div class="cart-thumb ${product.imageUrl ? 'has-image' : ''}">
          ${product.imageUrl ? `<img src="${esc(product.imageUrl)}" alt="${esc(product.name)}">` : ""}
        </div>
        <div>
          <h4>${esc(product.name)}</h4>
          <p>${qty} × ${formatMoney(price)}</p>
          <strong>${formatMoney(sub)}</strong>
        </div>
        <button class="cart-remove" type="button" data-remove="${esc(product.id)}">×</button>
      </div>
    `;
  }).join("");
  cartTotal.textContent = formatMoney(total);
}

function openCart() { if (cartDrawer) { cartDrawer.classList.add("open"); cartDrawer.setAttribute("aria-hidden", "false"); document.body.style.overflow = "hidden"; } }
function closeCart() { if (cartDrawer) { cartDrawer.classList.remove("open"); cartDrawer.setAttribute("aria-hidden", "true"); document.body.style.overflow = ""; } }

if (cartBtn) cartBtn.addEventListener("click", openCart);
if (closeCartBtn) closeCartBtn.addEventListener("click", closeCart);
if (cartOverlay) cartOverlay.addEventListener("click", closeCart);

document.addEventListener("click", (e) => {
  const addBtn = e.target.closest("[data-add]");
  if (addBtn) { addToCart(addBtn.dataset.add); return; }
  const remBtn = e.target.closest("[data-remove]");
  if (remBtn) { removeFromCart(remBtn.dataset.remove); return; }
});

// Control del Modal de Autenticación de Clientes
if (userAuthBtn) {
  userAuthBtn.addEventListener("click", () => {
    if (currentClient) {
      if (window.confirm(`¿Deseas cerrar sesión (${currentClient.email})?`)) {
        signOut(auth).then(() => showToast("Sesión cerrada."));
      }
    } else {
      if (authModal) {
        authModal.classList.add("open");
        authModal.setAttribute("aria-hidden", "false");
      }
    }
  });
}

if (closeAuthModal) closeAuthModal.addEventListener("click", () => authModal.classList.remove("open"));
if (authOverlay) authOverlay.addEventListener("click", () => authModal.classList.remove("open"));

if (switchToRegister && switchToLogin) {
  switchToRegister.addEventListener("click", (e) => {
    e.preventDefault();
    clientLoginForm.style.display = "none";
    clientRegisterForm.style.display = "grid";
    if (authModalTitle) authModalTitle.textContent = "Registro";
  });
  switchToLogin.addEventListener("click", (e) => {
    e.preventDefault();
    clientRegisterForm.style.display = "none";
    clientLoginForm.style.display = "grid";
    if (authModalTitle) authModalTitle.textContent = "Iniciar sesión";
  });
}

// Manejo de Inicio de Sesión de Clientes
if (clientLoginForm) {
  clientLoginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("#clientLoginEmail").value.trim();
    const password = $("#clientLoginPassword").value;
    try {
      await signInWithEmailAndPassword(auth, email, password);
      showToast("¡Bienvenido de nuevo!");
      authModal.classList.remove("open");
      clientLoginForm.reset();
    } catch (err) {
      console.error(err);
      showToast("Correo o contraseña incorrectos.");
    }
  });
}

// Manejo de Registro de Clientes
if (clientRegisterForm) {
  clientRegisterForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = $("#clientRegName").value.trim();
    const email = $("#clientRegEmail").value.trim();
    const password = $("#clientRegPassword").value;
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      showToast("¡Cuenta creada con éxito!");
      authModal.classList.remove("open");
      clientRegisterForm.reset();
    } catch (err) {
      console.error(err);
      showToast("No se pudo crear la cuenta (puede que el correo ya esté en uso).");
    }
  });
}

// Escuchar cambios de estado de autenticación del usuario
onAuthStateChanged(auth, (user) => {
  currentClient = user;
  if (user) {
    if (userAuthBtn) userAuthBtn.title = `Sesión iniciada: ${user.email}`;
    const nameInput = $("#customerName");
    if (nameInput && !nameInput.value) nameInput.value = user.displayName || "";
  } else {
    if (userAuthBtn) userAuthBtn.title = "Mi cuenta / Iniciar sesión";
  }
});

if (checkoutBtn) {
  checkoutBtn.addEventListener("click", () => {
    if (!cart.length) { showToast("Tu carrito está vacío."); return; }
    
    // EXIGIR INICIO DE SESIÓN ANTES DE PAGAR
    if (!currentClient) {
      showToast("Debes iniciar sesión para finalizar tu pedido.");
      closeCart();
      if (authModal) {
        authModal.classList.add("open");
        authModal.setAttribute("aria-hidden", "false");
      }
      return;
    }

    if (checkoutModal) {
      checkoutModal.classList.add("open");
      checkoutModal.setAttribute("aria-hidden", "false");
    }
  });
}

if (closeCheckoutBtn) closeCheckoutBtn.addEventListener("click", () => checkoutModal.classList.remove("open"));
if (checkoutOverlay) checkoutOverlay.addEventListener("click", () => checkoutModal.classList.remove("open"));

if (checkoutForm) {
  checkoutForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!db || !currentClient) { showToast("Debes iniciar sesión para realizar el pedido."); return; }
    
    const name = $("#customerName")?.value.trim() || "";
    const phone = $("#customerPhone")?.value.trim() || "";
    const city = $("#customerCity")?.value.trim() || "";
    const address = $("#customerAddress")?.value.trim() || "";
    const notes = $("#customerNotes")?.value.trim() || "";

    const items = cart.map(item => {
      const p = findProduct(item.id);
      if (!p) return null;
      return { productId: String(p.id), name: p.name, quantity: Number(item.qty), price: Number(p.price), subtotal: Number(p.price) * Number(item.qty) };
    }).filter(Boolean);

    const total = items.reduce((sum, i) => sum + i.subtotal, 0);

    try {
      await addDoc(collection(db, "orders"), {
        userId: currentClient.uid,
        userEmail: currentClient.email,
        customer: { name, phone, city, address, notes },
        items,
        total,
        status: "pendiente",
        createdAt: serverTimestamp()
      });

      cart = [];
      saveCart();
      updateCartCount();
      renderCart();
      if (checkoutModal) checkoutModal.classList.remove("open");
      closeCart();
      checkoutForm.reset();
      showToast("¡Pedido realizado con éxito!");
    } catch (err) {
      console.error(err);
      showToast("Error al procesar el pedido.");
    }
  });
}

if (menuToggle && navLinks) {
  menuToggle.addEventListener("click", () => navLinks.classList.toggle("open"));
  navLinks.querySelectorAll("a").forEach(a => a.addEventListener("click", () => navLinks.classList.remove("open")));
}

if (searchBtn && searchBar) {
  searchBtn.addEventListener("click", () => { searchBar.classList.add("open"); if (searchInput) setTimeout(() => searchInput.focus(), 100); });
}
if (closeSearch && searchBar) {
  closeSearch.addEventListener("click", () => { searchBar.classList.remove("open"); if (searchInput) searchInput.value = ""; currentSearch = ""; renderProducts(currentCategory, currentSearch); });
}
if (searchInput) {
  searchInput.addEventListener("input", (e) => { currentSearch = e.target.value; renderProducts(currentCategory, currentSearch); });
}

if (newsletterForm) {
  newsletterForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (newsletterMessage) newsletterMessage.textContent = "Listo. Revisa tu correo para confirmar la suscripción.";
    newsletterForm.reset();
  });
}

function startProductsListener() {
  if (!db) return;
  if (unsubscribeProducts) unsubscribeProducts();
  unsubscribeProducts = onSnapshot(collection(db, "products"), (snapshot) => {
    storeProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderFeatured();
    renderProducts(currentCategory, currentSearch);
    updateCartCount();
    renderCart();
  }, (err) => console.error(err));
}

function init() {
  fixHeroVisibility();
  updateCartCount();
  renderCart();
  initializeFilters();
  initializeRevealAnimations();
  startProductsListener();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}