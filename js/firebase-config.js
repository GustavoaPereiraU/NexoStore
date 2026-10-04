import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
// 1. Importamos la API de Storage
import { getStorage } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyBWhnY5W6fsUvzQO__P7jnGwtqxeyJZmHM",
  authDomain: "nexostore-12e5e.firebaseapp.com",
  projectId: "nexostore-12e5e",
  storageBucket: "nexostore-12e5e.firebasestorage.app",
  messagingSenderId: "840633590933",
  appId: "1:840633590933:web:90c37165871a84f50be79c",
  measurementId: "G-CSEC3DN6ST"
};

// 2. Agregamos storage a las variables exportables
let app, auth, db, storage;
try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
  console.log("✅ Firebase inicializado con Storage");
} catch (error) {
  console.error("❌ Error inicializando Firebase:", error);
}

export { auth, db, storage };