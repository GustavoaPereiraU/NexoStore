import { auth, db, storage } from './firebase-config.js';
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-storage.js";
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

console.log("🧑‍💼 NEXOSTORE SCRIPT ADMIN CARGADO");

let adminProducts = [];
let editingProductId = null;
let unsubscribeAdminProducts = null;
let unsubscribeOrders = null;

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const loginView = $("#loginView");
const appView = $("#appView");
const loginForm = $("#loginForm");
const loginEmail = $("#loginEmail");
const loginPassword = $("#loginPassword");
const loginError = $("#loginError");
const logoutButton = $("#logoutButton");

const connectionStatus = $("#connectionStatus");
const adminSectionTitle = $("#adminSectionTitle");
const inventorySection = $("#inventorySection");
const ordersSection = $("#ordersSection");

const statProducts = $("#statProducts");
const statUnits = $("#statUnits");
const statValue = $("#statValue");
const statLow = $("#statLow");

const productForm = $("#productForm");
const productIdInput = $("#productId");
const productName = $("#productName");
const productCategory = $("#productCategory");
const productPrice = $("#productPrice");
const productStock = $("#productStock");
const productMinStock = $("#productMinStock");
const productTag = $("#productTag");
const productImageFile = $("#productImageFile");
const currentImageText = $("#currentImageText");
let currentImageUrlsState = []; // Memoria temporal para la URL de la imagen
const productDescription = $("#productDescription");
const productFeatured = $("#productFeatured");
const cancelEditBtn = $("#cancelEdit");
const formTitle = $("#formTitle");

const adminProductGrid = $("#adminProductGrid");
const adminSearch = $("#adminSearch");
const categoryFilter = $("#categoryFilter");
const stockFilter = $("#stockFilter");
const exportCsvBtn = $("#exportCsv");
const ordersList = $("#ordersList");
const adminToast = $("#adminToast");

const COP = new Intl.NumberFormat("es-CO", { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
const formatMoney = (val) => COP.format(Number(val) || 0);

function showToast(msg) {
  if (!adminToast) return;
  adminToast.textContent = msg;
  adminToast.classList.add("show");
  setTimeout(() => adminToast.classList.remove("show"), 2200);
}

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

if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = loginEmail?.value.trim();
    const password = loginPassword?.value;
    if (loginError) loginError.textContent = "";

    try {
      await signInWithEmailAndPassword(auth, email, password);
      showToast("Sesión iniciada");
    } catch (err) {
      console.error(err);
      if (loginError) loginError.textContent = "Correo o contraseña incorrectos.";
    }
  });
}

if (logoutButton) {
  logoutButton.addEventListener("click", async () => {
    try {
      await signOut(auth);
      showToast("Sesión cerrada");
    } catch (err) {
      console.error(err);
    }
  });
}

$$("[data-admin-section]").forEach(btn => {
  btn.addEventListener("click", (e) => {
    $$("[data-admin-section]").forEach(b => b.classList.remove("active"));
    const section = e.currentTarget.dataset.adminSection;
    e.currentTarget.classList.add("active");

    if (section === "inventory") {
      inventorySection.style.display = "block";
      ordersSection.style.display = "none";
      if (adminSectionTitle) adminSectionTitle.textContent = "Inventario";
    } else if (section === "orders") {
      inventorySection.style.display = "none";
      ordersSection.style.display = "block";
      if (adminSectionTitle) adminSectionTitle.textContent = "Pedidos";
      startOrdersListener();
    }
  });
});

function startAdminProductsListener() {
  if (!db || !auth?.currentUser) return;
  if (unsubscribeAdminProducts) unsubscribeAdminProducts();

  unsubscribeAdminProducts = onSnapshot(collection(db, "products"), (snapshot) => {
    adminProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    adminProducts.sort((a, b) => (b.updatedAt?.seconds || b.createdAt?.seconds || 0) - (a.updatedAt?.seconds || a.createdAt?.seconds || 0));
    
    renderAdminProducts();
    updateAdminStats();
    updateCategoryFilter();
    if (connectionStatus) {
      connectionStatus.textContent = "● Conectado";
      connectionStatus.className = "connected";
    }
  }, (err) => {
    console.error(err);
    if (connectionStatus) {
      connectionStatus.textContent = "● Error de conexión";
      connectionStatus.className = "error";
    }
  });
}

function startOrdersListener() {
  if (!db || !auth?.currentUser) return;
  if (unsubscribeOrders) unsubscribeOrders();

  unsubscribeOrders = onSnapshot(collection(db, "orders"), (snapshot) => {
    const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    orders.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    renderOrders(orders);
  }, (err) => console.error(err));
}

function renderOrders(orders) {
  if (!ordersList) return;
  if (!orders.length) {
    ordersList.innerHTML = `<div class="empty-admin"><p>No hay pedidos registrados todavía.</p></div>`;
    return;
  }

  ordersList.innerHTML = orders.map(order => {
    const cust = order.customer || {};
    const date = order.createdAt?.toDate ? order.createdAt.toDate().toLocaleString() : "Reciente";
    const itemsHtml = (order.items || []).map(i => `
      <div class="order-product-row">
        <span>${i.quantity}x ${esc(i.name)}</span>
        <span>${formatMoney(i.subtotal)}</span>
      </div>
    `).join("");

    return `
      <div class="order-card">
        <div class="order-top">
          <span class="order-id">#${order.id.slice(0, 8)}</span>
          <span class="order-status">${esc(order.status || "pendiente")}</span>
        </div>
        <h3>${esc(cust.name || "Cliente")} (${esc(cust.phone || "Sin teléfono")})</h3>
        <p class="order-customer">📍 ${esc(cust.city || "")} - ${esc(cust.address || "")} ${cust.notes ? `| 📝 ${esc(cust.notes)}` : ""}</p>
        <p class="order-customer">🕒 ${date}</p>
        <div class="order-products">
          ${itemsHtml}
        </div>
        <div class="order-total">
          <strong>Total</strong>
          <strong>${formatMoney(order.total)}</strong>
        </div>
      </div>
    `;
  }).join("");
}

if (productForm) {
  productForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!auth?.currentUser) { showToast("Debes iniciar sesión."); return; }

    let finalImageUrls = currentImageUrlsState; // Usamos la memoria temporal correcta

    // Obtenemos todos los archivos seleccionados
    const files = productImageFile?.files; 
    
    if (files && files.length > 0) {
      showToast("Subiendo imágenes al servidor...");
      const uploadTasks = Array.from(files).map(async (file) => {
        const storageRef = ref(storage, 'products/' + Date.now() + '_' + file.name);
        const snapshot = await uploadBytes(storageRef, file);
        return await getDownloadURL(snapshot.ref); 
      });

      try {
        finalImageUrls = await Promise.all(uploadTasks); 
      } catch (err) {
        console.error(err);
        showToast("Error al subir algunas imágenes.");
        return; 
      }
    }

    const data = {
      name: productName?.value.trim() || "",
      category: productCategory?.value.trim() || "Joyería",
      price: Number(productPrice?.value) || 0,
      stock: Number(productStock?.value) || 0,
      minStock: Number(productMinStock?.value) || 3,
      tag: productTag?.value.trim() || "",
      imageUrls: finalImageUrls, 
      description: productDescription?.value.trim() || "",
      featured: productFeatured?.checked || false,
      variant: "variant-1",
      updatedAt: serverTimestamp()
    };

    if (!data.name) { showToast("Escribe el nombre del producto."); return; }
    if (data.price <= 0) { showToast("El precio debe ser mayor a 0."); return; }

    try {
      if (editingProductId) {
        await updateDoc(doc(db, "products", editingProductId), data);
        showToast("Producto actualizado.");
      } else {
        await addDoc(collection(db, "products"), { ...data, createdAt: serverTimestamp() });
        showToast("Producto guardado.");
      }
      resetForm();
    } catch (err) {
      console.error(err);
      showToast("No fue posible guardar el producto.");
    }
  });
}

function resetForm() {
  editingProductId = null;
  if (productForm) productForm.reset();
  if (cancelEditBtn) cancelEditBtn.style.display = "none";
  if (formTitle) formTitle.textContent = "Nuevo producto";
  if (productMinStock) productMinStock.value = 3;
  // Limpiamos la memoria de las fotos
  currentImageUrlsState = [];
  if (currentImageText) currentImageText.style.display = "none";
}

if (cancelEditBtn) cancelEditBtn.addEventListener("click", () => { resetForm(); showToast("Edición cancelada."); });

window.editProduct = function(id) {
  const p = adminProducts.find(item => String(item.id) === String(id));
  if (!p) { showToast("Producto no encontrado."); return; }
  editingProductId = String(p.id);

  if (productName) productName.value = p.name || "";
  if (productCategory) productCategory.value = p.category || "";
  if (productPrice) productPrice.value = p.price || 0;
  if (productStock) productStock.value = p.stock || 0;
  if (productMinStock) productMinStock.value = p.minStock ?? 3;
  if (productTag) productTag.value = p.tag || "";
  currentImageUrlsState = p.imageUrls || (p.imageUrl ? [p.imageUrl] : []);
  if (currentImageText) currentImageText.style.display = currentImageUrlsState.length > 0 ? "block" : "none";
  if (productImageFile) productImageFile.value = "";
  if (productDescription) productDescription.value = p.description || "";
  if (productFeatured) productFeatured.checked = p.featured === true;

  if (cancelEditBtn) cancelEditBtn.style.display = "inline-flex";
  if (formTitle) formTitle.textContent = "Editar producto";
  if (productForm) productForm.scrollIntoView({ behavior: "smooth", block: "start" });
};

window.deleteProduct = async function(id) {
  if (!auth?.currentUser) { showToast("Debes iniciar sesión."); return; }
  const p = adminProducts.find(item => String(item.id) === String(id));
  if (!p) return;
  if (!window.confirm(`¿Eliminar "${p.name}"?`)) return;

  try {
    await deleteDoc(doc(db, "products", String(id)));
    showToast("Producto eliminado.");
  } catch (err) {
    console.error(err);
    showToast("No fue posible eliminar el producto.");
  }
};

function renderAdminProducts() {
  if (!adminProductGrid) return;
  const search = normalize(adminSearch?.value || "");
  const category = categoryFilter?.value || "all";
  const stock = stockFilter?.value || "all";

  let list = [...adminProducts];
  if (search) {
    list = list.filter(p => normalize(p.name).includes(search) || normalize(p.category).includes(search) || normalize(p.tag).includes(search));
  }
  if (category !== "all") {
    list = list.filter(p => normalize(p.category) === normalize(category));
  }
  if (stock === "low") {
    list = list.filter(p => Number(p.stock) <= Number(p.minStock ?? 3) && Number(p.stock) > 0);
  }
  if (stock === "out") {
    list = list.filter(p => Number(p.stock) <= 0);
  }

  if (!list.length) {
    adminProductGrid.innerHTML = `<div class="empty-admin"><p>No hay productos que coincidan con los filtros.</p></div>`;
    return;
  }

  adminProductGrid.innerHTML = list.map(p => {
    const stockVal = Number(p.stock) || 0;
    const minS = Number(p.minStock ?? 3);
    let sClass = "stock-status";
    let sText = `${stockVal} unidades`;
    if (stockVal <= 0) { sClass += " out"; sText = "Agotado"; }
    else if (stockVal <= minS) { sClass += " low"; sText = `Stock bajo (${stockVal})`; }

    return `
      <article class="admin-product">
        <div class="admin-product-image">
          ${(p.imageUrls && p.imageUrls.length > 0) ? `<img src="${esc(p.imageUrls[0])}" alt="${esc(p.name)}" loading="lazy">` : (p.imageUrl ? `<img src="${esc(p.imageUrl)}" alt="${esc(p.name)}" loading="lazy">` : "")}
        </div>
        <div class="admin-product-info">
          <p>${esc(p.category || "Joyería")}</p>
          <h3>${esc(p.name)}</h3>
          <p>${esc(p.description || "Sin descripción.")}</p>
          <div class="admin-price">${formatMoney(p.price)}</div>
          <span class="${sClass}">${esc(sText)}</span>
        </div>
        <div class="admin-product-actions">
          <button type="button" class="admin-btn secondary" onclick="editProduct('${esc(p.id)}')">Editar</button>
          <button type="button" class="admin-btn secondary danger" onclick="deleteProduct('${esc(p.id)}')">Eliminar</button>
        </div>
      </article>
    `;
  }).join("");
}

function updateAdminStats() {
  const count = adminProducts.length;
  const units = adminProducts.reduce((t, p) => t + (Number(p.stock) || 0), 0);
  const val = adminProducts.reduce((t, p) => t + ((Number(p.price) || 0) * (Number(p.stock) || 0)), 0);
  const low = adminProducts.filter(p => Number(p.stock) <= Number(p.minStock ?? 3)).length;

  if (statProducts) statProducts.textContent = count;
  if (statUnits) statUnits.textContent = units;
  if (statValue) statValue.textContent = formatMoney(val);
  if (statLow) statLow.textContent = low;
}

function updateCategoryFilter() {
  if (!categoryFilter) return;
  const cats = [...new Set(adminProducts.map(p => p.category).filter(Boolean))].sort((a,b) => a.localeCompare(b, "es"));
  const current = categoryFilter.value || "all";

  categoryFilter.innerHTML = `
    <option value="all">Todas las categorías</option>
    ${cats.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join("")}
  `;
  categoryFilter.value = [...categoryFilter.options].some(o => o.value === current) ? current : "all";
}

if (adminSearch) adminSearch.addEventListener("input", renderAdminProducts);
if (categoryFilter) categoryFilter.addEventListener("change", renderAdminProducts);
if (stockFilter) stockFilter.addEventListener("change", renderAdminProducts);

if (exportCsvBtn) {
  exportCsvBtn.addEventListener("click", () => {
    if (!adminProducts.length) { showToast("No hay productos para exportar."); return; }
    const headers = ["ID", "Nombre", "Categoría", "Precio", "Stock", "Stock mínimo", "Etiqueta", "Descripción", "Imagen"];
    const rows = adminProducts.map(p => [p.id, p.name, p.category, p.price, p.stock, p.minStock ?? 3, p.tag, p.description, p.imageUrl]);
    const csv = [headers, ...rows].map(row => row.map(v => `"${String(v ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "inventario-nexostore.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast("Inventario exportado.");
  });
}

if (auth) {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      if (loginView) loginView.style.display = "none";
      if (appView) appView.style.display = "grid";
      startAdminProductsListener();
    } else {
      if (loginView) loginView.style.display = "grid";
      if (appView) appView.style.display = "none";
      adminProducts = [];
      if (unsubscribeAdminProducts) { unsubscribeAdminProducts(); unsubscribeAdminProducts = null; }
      if (unsubscribeOrders) { unsubscribeOrders(); unsubscribeOrders = null; }
    }
  });
}
