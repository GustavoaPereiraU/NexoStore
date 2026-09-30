/* =========================================================
   NEXOSTORE — SCRIPT PRINCIPAL
   Tienda pública + Carrito + Firebase + Panel administrativo
   ========================================================= */

console.log("🔥 NEXOSTORE SCRIPT CARGADO");


/* =========================================================
   1. FIREBASE
   ========================================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";


/* =========================================================
   2. CONFIGURACIÓN FIREBASE
   ========================================================= */

const firebaseConfig = {
  apiKey: "AIzaSyBWhnY5W6fsUvzQO__P7jnGwtqxeyJZmHM",
  authDomain: "nexostore-12e5e.firebaseapp.com",
  projectId: "nexostore-12e5e",
  storageBucket: "nexostore-12e5e.firebasestorage.app",
  messagingSenderId: "840633590933",
  appId: "1:840633590933:web:90c37165871a84f50be79c",
  measurementId: "G-CSEC3DN6ST"
};


let app;
let auth;
let db;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);

  console.log("✅ Firebase inicializado");
} catch (error) {
  console.error("❌ Error inicializando Firebase:", error);
}


/* =========================================================
   3. VARIABLES GLOBALES
   ========================================================= */

let storeProducts = [];
let adminProducts = [];

let cart = JSON.parse(
  localStorage.getItem("elanCart") || "[]"
);

let editingProductId = null;

let unsubscribeProducts = null;
let unsubscribeAdminProducts = null;

let currentCategory = "Todos";
let currentSearch = "";


/* =========================================================
   4. UTILIDADES DOM
   ========================================================= */

const $ = (selector) =>
  document.querySelector(selector);

const $$ = (selector) =>
  document.querySelectorAll(selector);


/* =========================================================
   5. REFERENCIAS DE LA TIENDA
   ========================================================= */

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


/* =========================================================
   6. BÚSQUEDA
   ========================================================= */

const searchBtn = $("#searchBtn");
const searchBar = $("#searchBar");
const closeSearch = $("#closeSearch");
const searchInput = $("#searchInput");


/* =========================================================
   7. MENÚ
   ========================================================= */

const menuToggle = $("#menuToggle");
const navLinks = $("#navLinks");


/* =========================================================
   8. NEWSLETTER
   ========================================================= */

const newsletterForm = $("#newsletterForm");
const newsletterMessage = $("#newsletterMessage");


/* =========================================================
   9. REFERENCIAS DEL PANEL ADMIN
   ========================================================= */

const loginView = $("#loginView");
const appView = $("#appView");

const loginForm = $("#loginForm");
const loginEmail = $("#loginEmail");
const loginPassword = $("#loginPassword");
const logoutBtn = $("#logoutBtn");

const productForm = $("#productForm");

const productName = $("#productName");
const productCategory = $("#productCategory");
const productPrice = $("#productPrice");
const productStock = $("#productStock");
const productMinStock = $("#productMinStock");
const productTag = $("#productTag");
const productImageUrl = $("#productImageUrl");
const productDescription = $("#productDescription");

const cancelEditBtn = $("#cancelEdit");

const adminProductGrid = $("#adminProductGrid");

const totalProducts = $("#totalProducts");
const totalUnits = $("#totalUnits");
const inventoryValue = $("#inventoryValue");
const lowStock = $("#lowStock");

const categoryFilter = $("#categoryFilter");
const stockFilter = $("#stockFilter");
const adminSearch = $("#adminSearch");

const exportCsvBtn = $("#exportCsv");


/* =========================================================
   10. FORMATO DE MONEDA
   ========================================================= */

const COP = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0
});


function formatMoney(value) {
  return COP.format(Number(value) || 0);
}


/* =========================================================
   11. ESCAPAR HTML
   ========================================================= */

function esc(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


/* =========================================================
   12. NORMALIZAR TEXTO
   ========================================================= */

function normalize(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}


/* =========================================================
   13. TOAST
   ========================================================= */

function showToast(message) {
  if (!toast) {
    console.log(message);
    return;
  }

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(showToast.timer);

  showToast.timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2200);
}


/* =========================================================
   14. HERO
   IMPORTANTE:
   El Hero no depende de Firebase ni de productos.
   ========================================================= */

function fixHeroVisibility() {
  const heroElements = document.querySelectorAll(
    ".hero .reveal, .hero [data-reveal]"
  );

  heroElements.forEach((element) => {
    element.classList.add("visible");

    element.style.opacity = "1";
    element.style.visibility = "visible";
    element.style.transform = "none";
  });

  console.log("✨ Hero preparado");
}


/* =========================================================
   15. ANIMACIONES REVEAL
   ========================================================= */

function initializeRevealAnimations() {
  const elements = document.querySelectorAll(
    ".reveal:not(.hero .reveal)"
  );

  if (!elements.length) {
    return;
  }

  /*
     Los hacemos visibles inmediatamente.
     Así un fallo del observer no oculta contenido.
  */

  elements.forEach((element) => {
    element.classList.add("visible");
  });


  if (!("IntersectionObserver" in window)) {
    return;
  }


  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.08
    }
  );


  elements.forEach((element) => {
    observer.observe(element);
  });
}


/* =========================================================
   16. TARJETA DE PRODUCTO
   ========================================================= */

function productCard(product) {
  const image = product.imageUrl
    ? `
      <img
        src="${esc(product.imageUrl)}"
        alt="${esc(product.name)}"
        loading="lazy"
        onerror="this.style.display='none';"
      >
    `
    : "";


  const tag = product.tag
    ? `
      <span class="product-tag">
        ${esc(product.tag)}
      </span>
    `
    : "";


  const variant =
    product.variant || "variant-1";


  const stock =
    Number(product.stock) || 0;


  return `
    <article class="product-card reveal visible">

      <div class="product-media ${esc(variant)}">

        ${image}

        ${tag}

        ${
          !product.imageUrl
            ? `<div class="product-placeholder"></div>`
            : ""
        }

      </div>


      <div class="product-info">

        <div>

          <span class="product-category">
            ${esc(product.category || "Joyería")}
          </span>

          <h3>
            ${esc(product.name)}
          </h3>

        </div>


        <div class="product-bottom">

          <strong>
            ${formatMoney(product.price)}
          </strong>


          <button
            class="add-product"
            type="button"
            data-add="${esc(product.id)}"
            ${stock <= 0 ? "disabled" : ""}
          >
            ${stock <= 0 ? "Agotado" : "Añadir"}
          </button>

        </div>

      </div>

    </article>
  `;
}


/* =========================================================
   17. PRODUCTOS DESTACADOS
   ========================================================= */

function renderFeatured() {
  if (!featuredGrid) {
    return;
  }


  const featured = storeProducts.filter(
    (product) => product.featured === true
  );


  if (!featured.length) {
    featuredGrid.innerHTML = "";
    return;
  }


  featuredGrid.innerHTML = featured
    .slice(0, 4)
    .map(productCard)
    .join("");
}


/* =========================================================
   18. CATÁLOGO GENERAL
   ========================================================= */

function renderProducts(
  category = currentCategory,
  search = currentSearch
) {
  if (!productGrid) {
    return;
  }


  const normalizedSearch =
    normalize(search);


  const filtered =
    storeProducts.filter((product) => {

      const categoryMatch =
        category === "Todos" ||
        normalize(product.category) ===
          normalize(category);


      const searchMatch =
        !normalizedSearch ||
        normalize(product.name).includes(
          normalizedSearch
        ) ||
        normalize(product.category).includes(
          normalizedSearch
        ) ||
        normalize(product.tag).includes(
          normalizedSearch
        ) ||
        normalize(product.description).includes(
          normalizedSearch
        );


      return categoryMatch && searchMatch;
    });


  if (!filtered.length) {

    productGrid.innerHTML = `
      <div class="empty-state">
        <h3>No encontramos productos</h3>
        <p>
          ${
            storeProducts.length === 0
              ? "Todavía no hay productos disponibles."
              : "Prueba con otra búsqueda o categoría."
          }
        </p>
      </div>
    `;

    return;
  }


  productGrid.innerHTML =
    filtered
      .map(productCard)
      .join("");
}


/* =========================================================
   19. FILTROS DE TIENDA
   ========================================================= */

function initializeFilters() {
  if (!filters) {
    return;
  }


  filters.addEventListener(
    "click",
    (event) => {

      const button =
        event.target.closest(".filter");


      if (!button) {
        return;
      }


      $$("#filters .filter").forEach(
        (filter) => {
          filter.classList.remove("active");
        }
      );


      button.classList.add("active");


      currentCategory =
        button.dataset.filter ||
        button.textContent.trim() ||
        "Todos";


      renderProducts(
        currentCategory,
        currentSearch
      );
    }
  );
}


/* =========================================================
   20. CARRITO
   ========================================================= */

function saveCart() {
  localStorage.setItem(
    "elanCart",
    JSON.stringify(cart)
  );
}


function updateCartCount() {
  if (!cartCount) {
    return;
  }


  const quantity =
    cart.reduce(
      (total, item) =>
        total + Number(item.qty || 0),
      0
    );


  cartCount.textContent = quantity;
}


/* =========================================================
   21. BUSCAR PRODUCTO
   ========================================================= */

function findProduct(id) {
  return storeProducts.find(
    (product) =>
      String(product.id) ===
      String(id)
  );
}


/* =========================================================
   22. AGREGAR AL CARRITO
   ========================================================= */

function addToCart(id) {
  const product = findProduct(id);


  if (!product) {
    showToast("Producto no encontrado.");
    return;
  }


  const stock =
    Number(product.stock) || 0;


  if (stock <= 0) {
    showToast(
      "Este producto está agotado."
    );

    return;
  }


  const existing =
    cart.find(
      (item) =>
        String(item.id) ===
        String(id)
    );


  if (existing) {

    if (
      Number(existing.qty) >=
      stock
    ) {
      showToast(
        "No hay más unidades disponibles."
      );

      return;
    }


    existing.qty += 1;

  } else {

    cart.push({
      id: String(id),
      qty: 1
    });

  }


  saveCart();
  updateCartCount();
  renderCart();


  showToast(
    `${product.name} añadido al carrito.`
  );
}


/* =========================================================
   23. ELIMINAR DEL CARRITO
   ========================================================= */

function removeFromCart(id) {

  cart =
    cart.filter(
      (item) =>
        String(item.id) !==
        String(id)
    );


  saveCart();
  updateCartCount();
  renderCart();


  showToast(
    "Producto eliminado."
  );
}


/* =========================================================
   24. RENDER CARRITO
   ========================================================= */

function renderCart() {
  if (!cartItems || !cartTotal) {
    return;
  }


  if (!cart.length) {

    cartItems.innerHTML = `
      <div class="cart-empty">
        <p>
          Tu carrito está esperando
          una pequeña obsesión ✦
        </p>
      </div>
    `;


    cartTotal.textContent =
      formatMoney(0);


    return;
  }


  let total = 0;


  const html =
    cart
      .map((item) => {

        const product =
          findProduct(item.id);


        if (!product) {
          return "";
        }


        const quantity =
          Number(item.qty) || 1;


        const price =
          Number(product.price) || 0;


        const subtotal =
          price * quantity;


        total += subtotal;


        return `
          <div class="cart-item">

            <div class="cart-item-info">

              <strong>
                ${esc(product.name)}
              </strong>

              <span>
                ${esc(product.category || "")}
              </span>

              <small>
                ${quantity} × ${formatMoney(price)}
              </small>

            </div>


            <div class="cart-item-actions">

              <strong>
                ${formatMoney(subtotal)}
              </strong>

              <button
                type="button"
                data-remove="${esc(product.id)}"
                aria-label="Eliminar producto"
              >
                ×
              </button>

            </div>

          </div>
        `;
      })
      .join("");


  cartItems.innerHTML = html;

  cartTotal.textContent =
    formatMoney(total);
}


/* =========================================================
   25. ABRIR CARRITO
   ========================================================= */

function openCart() {
  if (!cartDrawer) {
    return;
  }


  cartDrawer.classList.add("open");

  cartDrawer.setAttribute(
    "aria-hidden",
    "false"
  );


  document.body.style.overflow =
    "hidden";
}


/* =========================================================
   26. CERRAR CARRITO
   ========================================================= */

function closeCart() {
  if (!cartDrawer) {
    return;
  }


  cartDrawer.classList.remove("open");

  cartDrawer.setAttribute(
    "aria-hidden",
    "true"
  );


  document.body.style.overflow =
    "";
}


/* =========================================================
   27. EVENTOS DEL CARRITO
   ========================================================= */

if (cartBtn) {
  cartBtn.addEventListener(
    "click",
    openCart
  );
}


if (closeCartBtn) {
  closeCartBtn.addEventListener(
    "click",
    closeCart
  );
}


if (cartOverlay) {
  cartOverlay.addEventListener(
    "click",
    closeCart
  );
}


/* =========================================================
   28. BOTONES DE PRODUCTOS
   ========================================================= */

document.addEventListener(
  "click",
  (event) => {

    const addButton =
      event.target.closest(
        "[data-add]"
      );


    if (addButton) {

      addToCart(
        addButton.dataset.add
      );

      return;
    }


    const removeButton =
      event.target.closest(
        "[data-remove]"
      );


    if (removeButton) {

      removeFromCart(
        removeButton.dataset.remove
      );
    }
  }
);


/* =========================================================
   29. CHECKOUT
   ========================================================= */

if (checkoutBtn) {

  checkoutBtn.addEventListener(
    "click",
    () => {

      if (!cart.length) {

        showToast(
          "Tu carrito está vacío."
        );

        return;
      }


      createOrderFromCart();
    }
  );
}


/* =========================================================
   30. CREAR PEDIDO
   ========================================================= */

async function createOrderFromCart() {

  if (!db) {

    showToast(
      "Firebase no está disponible."
    );

    return;
  }


  try {

    const items =
      cart
        .map((item) => {

          const product =
            findProduct(item.id);


          if (!product) {
            return null;
          }


          const quantity =
            Number(item.qty) || 1;


          const price =
            Number(product.price) || 0;


          return {
            productId:
              String(product.id),

            name:
              product.name,

            quantity,

            price,

            subtotal:
              price * quantity
          };
        })
        .filter(Boolean);


    if (!items.length) {

      showToast(
        "No hay productos válidos."
      );

      return;
    }


    const total =
      items.reduce(
        (sum, item) =>
          sum + item.subtotal,
        0
      );


    await addDoc(
      collection(
        db,
        "orders"
      ),
      {
        items,
        total,
        status: "pendiente",
        createdAt:
          serverTimestamp()
      }
    );


    cart = [];

    saveCart();
    updateCartCount();
    renderCart();


    showToast(
      "Pedido creado correctamente."
    );

  } catch (error) {

    console.error(
      "❌ Error creando pedido:",
      error
    );


    showToast(
      "No fue posible crear el pedido."
    );
  }
}


/* =========================================================
   31. MENÚ MOBILE
   ========================================================= */

if (menuToggle && navLinks) {

  menuToggle.addEventListener(
    "click",
    () => {
      navLinks.classList.toggle(
        "open"
      );
    }
  );


  navLinks
    .querySelectorAll("a")
    .forEach((link) => {

      link.addEventListener(
        "click",
        () => {
          navLinks.classList.remove(
            "open"
          );
        }
      );
    });
}


/* =========================================================
   32. BÚSQUEDA
   ========================================================= */

if (searchBtn && searchBar) {

  searchBtn.addEventListener(
    "click",
    () => {

      searchBar.classList.add(
        "open"
      );


      if (searchInput) {

        setTimeout(
          () => searchInput.focus(),
          100
        );

      }
    }
  );
}


if (closeSearch && searchBar) {

  closeSearch.addEventListener(
    "click",
    () => {

      searchBar.classList.remove(
        "open"
      );


      if (searchInput) {
        searchInput.value = "";
      }


      currentSearch = "";


      renderProducts(
        currentCategory,
        currentSearch
      );
    }
  );
}


if (searchInput) {

  searchInput.addEventListener(
    "input",
    (event) => {

      currentSearch =
        event.target.value;


      renderProducts(
        currentCategory,
        currentSearch
      );
    }
  );
}


/* =========================================================
   33. NEWSLETTER
   ========================================================= */

if (newsletterForm) {

  newsletterForm.addEventListener(
    "submit",
    (event) => {

      event.preventDefault();


      if (newsletterMessage) {

        newsletterMessage.textContent =
          "Listo. Revisa tu correo para confirmar la suscripción.";
      }


      newsletterForm.reset();
    }
  );
}


/* =========================================================
   34. FIRESTORE — PRODUCTOS PÚBLICOS
   ========================================================= */

function startProductsListener() {

  if (!db) {

    console.error(
      "❌ Firestore no está disponible."
    );

    return;
  }


  if (unsubscribeProducts) {
    unsubscribeProducts();
  }


  const productsRef =
    collection(
      db,
      "products"
    );


  unsubscribeProducts =
    onSnapshot(

      productsRef,

      (snapshot) => {

        storeProducts =
          snapshot.docs.map(
            (document) => {

              const data =
                document.data();


              return {
                id:
                  document.id,

                name:
                  data.name || "",

                category:
                  data.category ||
                  "Joyería",

                price:
                  Number(data.price) ||
                  0,

                stock:
                  Number(data.stock) ||
                  0,

                minStock:
                  Number(data.minStock) ||
                  3,

                tag:
                  data.tag || "",

                imageUrl:
                  data.imageUrl || "",

                description:
                  data.description || "",

                featured:
                  data.featured === true,

                variant:
                  data.variant ||
                  "variant-1",

                createdAt:
                  data.createdAt ||
                  null,

                updatedAt:
                  data.updatedAt ||
                  null
              };
            }
          );


        console.log(
          `📦 Productos Firebase: ${storeProducts.length}`
        );


        renderFeatured();


        renderProducts(
          currentCategory,
          currentSearch
        );


        updateCartCount();

        renderCart();
      },


      (error) => {

        console.error(
          "❌ Error escuchando productos:",
          error
        );


        storeProducts = [];


        if (productGrid) {

          productGrid.innerHTML = `
            <div class="empty-state">
              <h3>No se pudieron cargar los productos</h3>
              <p>
                Revisa las reglas de Firestore.
              </p>
            </div>
          `;
        }


        if (featuredGrid) {
          featuredGrid.innerHTML = "";
        }
      }
    );
}


/* =========================================================
   35. ADMIN — LOGIN
   ========================================================= */

if (loginForm) {

  loginForm.addEventListener(
    "submit",
    async (event) => {

      event.preventDefault();


      const email =
        loginEmail?.value.trim();


      const password =
        loginPassword?.value;


      if (!email || !password) {

        showToast(
          "Completa correo y contraseña."
        );

        return;
      }


      try {

        await signInWithEmailAndPassword(
          auth,
          email,
          password
        );


        showToast(
          "Sesión iniciada."
        );

      } catch (error) {

        console.error(
          "❌ Error de login:",
          error
        );


        let message =
          "No fue posible iniciar sesión.";


        if (
          error.code ===
          "auth/invalid-credential"
        ) {

          message =
            "Correo o contraseña incorrectos.";
        }


        if (
          error.code ===
          "auth/invalid-email"
        ) {

          message =
            "El correo no es válido.";
        }


        showToast(message);
      }
    }
  );
}


/* =========================================================
   36. ADMIN — LOGOUT
   ========================================================= */

if (logoutBtn) {

  logoutBtn.addEventListener(
    "click",
    async () => {

      try {

        await signOut(auth);

        showToast(
          "Sesión cerrada."
        );

      } catch (error) {

        console.error(
          "❌ Error cerrando sesión:",
          error
        );
      }
    }
  );
}


/* =========================================================
   37. REFERENCIA FIRESTORE ADMIN
   ========================================================= */

function getAdminProductsRef() {

  if (!db) {

    throw new Error(
      "Firestore no está disponible."
    );
  }


  return collection(
    db,
    "products"
  );
}


/* =========================================================
   38. ADMIN — ESCUCHAR PRODUCTOS
   ========================================================= */

function startAdminProductsListener() {

  if (
    !db ||
    !auth?.currentUser
  ) {
    return;
  }


  if (unsubscribeAdminProducts) {
    unsubscribeAdminProducts();
  }


  unsubscribeAdminProducts =
    onSnapshot(

      getAdminProductsRef(),

      (snapshot) => {

        adminProducts =
          snapshot.docs.map(
            (document) => {

              return {
                id:
                  document.id,

                ...document.data()
              };
            }
          );


        adminProducts.sort(
          (a, b) => {

            const aTime =
              a.updatedAt?.seconds ||
              a.createdAt?.seconds ||
              0;


            const bTime =
              b.updatedAt?.seconds ||
              b.createdAt?.seconds ||
              0;


            return bTime - aTime;
          }
        );


        console.log(
          `🧑‍💼 Productos admin: ${adminProducts.length}`
        );


        renderAdminProducts();

        updateAdminStats();

        updateCategoryFilter();
      },


      (error) => {

        console.error(
          "❌ Error escuchando productos admin:",
          error
        );


        showToast(
          "Error cargando inventario."
        );
      }
    );
}


/* =========================================================
   39. ADMIN — GUARDAR PRODUCTO
   ========================================================= */

if (productForm) {

  productForm.addEventListener(
    "submit",
    async (event) => {

      event.preventDefault();


      if (!auth?.currentUser) {

        showToast(
          "Debes iniciar sesión."
        );

        return;
      }


      const data = {

        name:
          productName?.value.trim() ||
          "",

        category:
          productCategory?.value.trim() ||
          "Joyería",

        price:
          Number(productPrice?.value) ||
          0,

        stock:
          Number(productStock?.value) ||
          0,

        minStock:
          Number(productMinStock?.value) ||
          3,

        tag:
          productTag?.value.trim() ||
          "",

        imageUrl:
          productImageUrl?.value.trim() ||
          "",

        description:
          productDescription?.value.trim() ||
          "",

        featured:
          false,

        variant:
          "variant-1",

        updatedAt:
          serverTimestamp()
      };


      if (!data.name) {

        showToast(
          "Escribe el nombre del producto."
        );

        return;
      }


      if (data.price <= 0) {

        showToast(
          "El precio debe ser mayor a 0."
        );

        return;
      }


      try {

        if (editingProductId) {

          await updateDoc(
            doc(
              db,
              "products",
              editingProductId
            ),
            data
          );


          showToast(
            "Producto actualizado."
          );

        } else {

          await addDoc(
            getAdminProductsRef(),
            {
              ...data,

              createdAt:
                serverTimestamp()
            }
          );


          showToast(
            "Producto guardado."
          );
        }


        resetProductForm();

      } catch (error) {

        console.error(
          "❌ Error guardando producto:",
          error
        );


        showToast(
          "No fue posible guardar el producto."
        );
      }
    }
  );
}


/* =========================================================
   40. ADMIN — RESET FORMULARIO
   ========================================================= */

function resetProductForm() {

  editingProductId = null;


  if (productForm) {
    productForm.reset();
  }


  if (cancelEditBtn) {

    cancelEditBtn.style.display =
      "none";
  }


  if (productMinStock) {
    productMinStock.value = 3;
  }
}


/* =========================================================
   41. ADMIN — EDITAR
   ========================================================= */

window.editProduct = function (id) {

  const product =
    adminProducts.find(
      (item) =>
        String(item.id) ===
        String(id)
    );


  if (!product) {

    showToast(
      "Producto no encontrado."
    );

    return;
  }


  editingProductId =
    String(product.id);


  if (productName) {
    productName.value =
      product.name || "";
  }


  if (productCategory) {
    productCategory.value =
      product.category || "";
  }


  if (productPrice) {
    productPrice.value =
      product.price || 0;
  }


  if (productStock) {
    productStock.value =
      product.stock || 0;
  }


  if (productMinStock) {
    productMinStock.value =
      product.minStock ?? 3;
  }


  if (productTag) {
    productTag.value =
      product.tag || "";
  }


  if (productImageUrl) {
    productImageUrl.value =
      product.imageUrl || "";
  }


  if (productDescription) {
    productDescription.value =
      product.description || "";
  }


  if (cancelEditBtn) {

    cancelEditBtn.style.display =
      "inline-flex";
  }


  if (productForm) {

    productForm.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }
};


/* =========================================================
   42. ADMIN — CANCELAR EDICIÓN
   ========================================================= */

if (cancelEditBtn) {

  cancelEditBtn.addEventListener(
    "click",
    () => {

      resetProductForm();

      showToast(
        "Edición cancelada."
      );
    }
  );
}


window.cancelEdit = function () {
  resetProductForm();
};


/* =========================================================
   43. ADMIN — ELIMINAR
   ========================================================= */

window.deleteProduct =
  async function (id) {

    if (!auth?.currentUser) {

      showToast(
        "Debes iniciar sesión."
      );

      return;
    }


    const product =
      adminProducts.find(
        (item) =>
          String(item.id) ===
          String(id)
      );


    if (!product) {
      return;
    }


    const confirmed =
      window.confirm(
        `¿Eliminar "${product.name}"?`
      );


    if (!confirmed) {
      return;
    }


    try {

      await deleteDoc(
        doc(
          db,
          "products",
          String(id)
        )
      );


      showToast(
        "Producto eliminado."
      );

    } catch (error) {

      console.error(
        "❌ Error eliminando producto:",
        error
      );


      showToast(
        "No fue posible eliminar el producto."
      );
    }
  };


/* =========================================================
   44. ADMIN — RENDER PRODUCTOS
   ========================================================= */

function renderAdminProducts() {

  if (!adminProductGrid) {
    return;
  }


  const search =
    normalize(
      adminSearch?.value || ""
    );


  const category =
    categoryFilter?.value ||
    "Todos";


  const stock =
    stockFilter?.value ||
    "all";


  let products =
    [...adminProducts];


  /* Buscar */

  if (search) {

    products =
      products.filter(
        (product) => {

          return (
            normalize(product.name)
              .includes(search) ||

            normalize(product.category)
              .includes(search) ||

            normalize(product.tag)
              .includes(search) ||

            normalize(product.description)
              .includes(search)
          );
        }
      );
  }


  /* Categoría */

  if (category !== "Todos") {

    products =
      products.filter(
        (product) =>
          normalize(product.category) ===
          normalize(category)
      );
  }


  /* Stock bajo */

  if (stock === "low") {

    products =
      products.filter(
        (product) =>
          Number(product.stock) <=
          Number(product.minStock ?? 3)
      );
  }


  /* Agotados */

  if (stock === "out") {

    products =
      products.filter(
        (product) =>
          Number(product.stock) <= 0
      );
  }


  if (!products.length) {

    adminProductGrid.innerHTML = `
      <div class="empty-state">

        <h3>No hay productos</h3>

        <p>
          No encontramos productos
          con estos filtros.
        </p>

      </div>
    `;

    return;
  }


  adminProductGrid.innerHTML =
    products
      .map((product) => {

        const stockValue =
          Number(product.stock) || 0;


        const minStock =
          Number(
            product.minStock ?? 3
          );


        let stockClass =
          "stock-ok";


        let stockText =
          `${stockValue} unidades`;


        if (stockValue <= 0) {

          stockClass =
            "stock-out";

          stockText =
            "Agotado";

        } else if (
          stockValue <= minStock
        ) {

          stockClass =
            "stock-low";
        }


        return `
          <article class="admin-product-card">

            ${
              product.imageUrl
                ? `
                  <img
                    src="${esc(product.imageUrl)}"
                    alt="${esc(product.name)}"
                    loading="lazy"
                  >
                `
                : `
                  <div class="admin-product-placeholder">
                    ✦
                  </div>
                `
            }


            <div class="admin-product-content">

              <div class="admin-product-heading">

                <div>

                  <small>
                    ${esc(
                      product.category ||
                      "Joyería"
                    )}
                  </small>

                  <h3>
                    ${esc(
                      product.name
                    )}
                  </h3>

                </div>


                ${
                  product.tag
                    ? `
                      <span>
                        ${esc(
                          product.tag
                        )}
                      </span>
                    `
                    : ""
                }

              </div>


              <p>
                ${esc(
                  product.description ||
                  "Sin descripción."
                )}
              </p>


              <div class="admin-product-meta">

                <strong>
                  ${formatMoney(
                    product.price
                  )}
                </strong>


                <span
                  class="${stockClass}"
                >
                  ${esc(stockText)}
                </span>

              </div>


              <div class="admin-product-actions">

                <button
                  type="button"
                  onclick="editProduct('${esc(product.id)}')"
                >
                  Editar
                </button>


                <button
                  type="button"
                  onclick="deleteProduct('${esc(product.id)}')"
                >
                  Eliminar
                </button>

              </div>

            </div>

          </article>
        `;
      })
      .join("");
}


/* =========================================================
   45. ADMIN — ESTADÍSTICAS
   ========================================================= */

function updateAdminStats() {

  const productsCount =
    adminProducts.length;


  const units =
    adminProducts.reduce(
      (total, product) =>
        total +
        (Number(product.stock) || 0),
      0
    );


  const value =
    adminProducts.reduce(
      (total, product) =>
        total +
        (
          (Number(product.price) || 0) *
          (Number(product.stock) || 0)
        ),
      0
    );


  const low =
    adminProducts.filter(
      (product) =>
        Number(product.stock) <=
        Number(product.minStock ?? 3)
    ).length;


  if (totalProducts) {
    totalProducts.textContent =
      productsCount;
  }


  if (totalUnits) {
    totalUnits.textContent =
      units;
  }


  if (inventoryValue) {
    inventoryValue.textContent =
      formatMoney(value);
  }


  if (lowStock) {
    lowStock.textContent =
      low;
  }
}


/* =========================================================
   46. ADMIN — CATEGORÍAS
   ========================================================= */

function updateCategoryFilter() {

  if (!categoryFilter) {
    return;
  }


  const categories =
    [
      ...new Set(
        adminProducts
          .map(
            (product) =>
              product.category
          )
          .filter(Boolean)
      )
    ].sort(
      (a, b) =>
        a.localeCompare(
          b,
          "es"
        )
    );


  const current =
    categoryFilter.value ||
    "Todos";


  categoryFilter.innerHTML = `
    <option value="Todos">
      Todas las categorías
    </option>

    ${categories
      .map(
        (category) => `
          <option value="${esc(category)}">
            ${esc(category)}
          </option>
        `
      )
      .join("")}
  `;


  const exists =
    [...categoryFilter.options]
      .some(
        (option) =>
          option.value === current
      );


  categoryFilter.value =
    exists
      ? current
      : "Todos";
}


/* =========================================================
   47. ADMIN — FILTROS
   ========================================================= */

if (adminSearch) {

  adminSearch.addEventListener(
    "input",
    () => {
      renderAdminProducts();
    }
  );
}


if (categoryFilter) {

  categoryFilter.addEventListener(
    "change",
    () => {
      renderAdminProducts();
    }
  );
}


if (stockFilter) {

  stockFilter.addEventListener(
    "change",
    () => {
      renderAdminProducts();
    }
  );
}


/* =========================================================
   48. EXPORTAR CSV
   ========================================================= */

function exportInventoryCSV() {

  if (!adminProducts.length) {

    showToast(
      "No hay productos para exportar."
    );

    return;
  }


  const headers = [
    "ID",
    "Nombre",
    "Categoría",
    "Precio",
    "Stock",
    "Stock mínimo",
    "Etiqueta",
    "Descripción",
    "Imagen"
  ];


  const rows =
    adminProducts.map(
      (product) => [
        product.id,
        product.name,
        product.category,
        product.price,
        product.stock,
        product.minStock ?? 3,
        product.tag,
        product.description,
        product.imageUrl
      ]
    );


  const csv =
    [
      headers,
      ...rows
    ]
      .map(
        (row) =>
          row
            .map(
              (value) =>
                `"${String(value ?? "")
                  .replaceAll(
                    '"',
                    '""'
                  )}"`
            )
            .join(",")
      )
      .join("\n");


  const blob =
    new Blob(
      ["\uFEFF" + csv],
      {
        type:
          "text/csv;charset=utf-8;"
      }
    );


  const url =
    URL.createObjectURL(blob);


  const link =
    document.createElement("a");


  link.href = url;

  link.download =
    "inventario-nexostore.csv";


  document.body.appendChild(link);

  link.click();

  link.remove();

  URL.revokeObjectURL(url);


  showToast(
    "Inventario exportado."
  );
}


if (exportCsvBtn) {

  exportCsvBtn.addEventListener(
    "click",
    exportInventoryCSV
  );
}


/* =========================================================
   49. NAVEGACIÓN ADMIN
   ========================================================= */

function showComingSoon() {

  showToast(
    "Este módulo estará disponible próximamente."
  );
}


$$(
  "[data-section], [data-page]"
).forEach(
  (button) => {

    button.addEventListener(
      "click",
      (event) => {

        const target =
          event.currentTarget.dataset.section ||
          event.currentTarget.dataset.page;


        if (
          target === "orders" ||
          target === "pedidos" ||
          target === "customers" ||
          target === "clientes"
        ) {

          showComingSoon();
        }
      }
    );
  }
);


/* =========================================================
   50. AUTENTICACIÓN
   ========================================================= */

if (auth) {

  onAuthStateChanged(
    auth,
    (user) => {

      if (user) {

        console.log(
          "👤 Usuario autenticado:",
          user.email
        );


        if (loginView) {

          loginView.style.display =
            "none";
        }


        if (appView) {

          appView.style.display =
            "";
        }


        startAdminProductsListener();

      } else {

        console.log(
          "👤 No hay usuario autenticado"
        );


        if (loginView) {

          loginView.style.display =
            "";
        }


        if (appView) {

          appView.style.display =
            "none";
        }


        adminProducts = [];


        if (unsubscribeAdminProducts) {

          unsubscribeAdminProducts();

          unsubscribeAdminProducts =
            null;
        }
      }
    }
  );
}


/* =========================================================
   51. INICIALIZACIÓN
   ========================================================= */

function initializeNexoStore() {

  console.log(
    "🚀 Inicializando NexoStore..."
  );


  /*
     El Hero se prepara primero.
     No depende de Firebase.
  */

  fixHeroVisibility();


  /*
     Carrito.
  */

  updateCartCount();

  renderCart();


  /*
     Filtros.
  */

  initializeFilters();


  /*
     Animaciones.
  */

  initializeRevealAnimations();


  /*
     Productos.
     Firestore es la única fuente.
  */

  startProductsListener();


  console.log(
    "✅ NexoStore inicializado correctamente"
  );
}


/* =========================================================
   52. ARRANQUE
   ========================================================= */

if (
  document.readyState ===
  "loading"
) {

  document.addEventListener(
    "DOMContentLoaded",
    initializeNexoStore
  );

} else {

  initializeNexoStore();

}