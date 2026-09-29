import axios from "axios";

// எப்போதும் நேரடியாக ரெண்டர் URL மட்டுமே செயல்படும் படி மாற்றுதல்
export const api = axios.create({
  baseURL: "https://gs-supermarket.onrender.com/api",
  timeout: 20000,
});
export const authRegister = async (payload) => {
  const response = await api.post("/auth/register", payload);
  return response.data;
};

api.interceptors.request.use((config) => {
  const t = localStorage.getItem("token");
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

// Products
export const fetchProducts = (params = {}) => api.get("/products", { params }).then((r) => r.data);
export const fetchCategories = () => api.get("/categories").then((r) => r.data);
export const fetchByBarcode = (bc) => api.get(`/products/barcode/${encodeURIComponent(bc)}`).then((r) => r.data);
export const createProduct = (p) => api.post("/products", p).then((r) => r.data);
export const updateProduct = (id, p) => api.put(`/products/${id}`, p).then((r) => r.data);
export const deleteProduct = (id) => api.delete(`/products/${id}`).then((r) => r.data);
export const importProductsCsv = (file) => {
  const fd = new FormData();
  fd.append("file", file);
  return api.post("/products/import", fd, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data);
};

// Orders
export const createOrder = (payload) => api.post("/orders", payload).then((r) => r.data);
export const fetchOrders = (params = {}) => api.get("/orders", { params }).then((r) => r.data);
export const fetchOrder = (id) => api.get(`/orders/${id}`).then((r) => r.data);
export const updateOrderStatus = (id, payload) => api.patch(`/orders/${id}/status`, payload).then((r) => r.data);

// Customers (Newly Added)
export const fetchCustomers = () => api.get("/customers").then((r) => r.data);
export const createCustomer = (payload) => api.post("/customers", payload).then((r) => r.data);

// Suppliers (Newly Added)
export const fetchSuppliers = () => api.get("/suppliers").then((r) => r.data);
export const createSupplier = (payload) => api.post("/suppliers", payload).then((r) => r.data);

// Wishlist
export const fetchWishlist = () => api.get("/wishlist").then((r) => r.data);
export const addWishlist = (product_id) => api.post("/wishlist", { product_id }).then((r) => r.data);
export const removeWishlist = (product_id) => api.delete(`/wishlist/${product_id}`).then((r) => r.data);

// Auth
export const authLogin = (email, password) => api.post("/auth/login", { email, password }).then((r) => r.data);
export const authRegisterUser = (payload) => api.post("/auth/register", payload).then((r) => r.data);
export const authMe = () => api.get("/auth/me").then((r) => r.data);
export const updateProfile = (payload) => api.put("/auth/profile", payload).then((r) => r.data);

// Stats
export const fetchStats = () => api.get("/stats/summary").then((r) => r.data);
export const fetchReport = () => api.get("/stats/report").then((r) => r.data);

// Settings
export const fetchSettings = () => api.get("/settings").then((r) => r.data);
export const updateSettings = (payload) => api.put("/settings", payload).then((r) => r.data);

// Purchases
export const fetchPurchases = (params = {}) => api.get("/purchases", { params }).then((r) => r.data);
export const createPurchase = (payload) => api.post("/purchases", payload).then((r) => r.data);
export const updatePurchase = (id, payload) => api.put(`/purchases/${id}`, payload).then((r) => r.data);
export const deletePurchase = (id) => api.delete(`/purchases/${id}`).then((r) => r.data);

// Admin Offers / Broadcast & Management (Newly Added)
export const broadcastOffer = (payload) => api.post("/admin/broadcast-offer", payload).then((r) => r.data);
export const fetchActiveOffers = () => api.get("/offers/active").then((r) => r.data);
export const updateOffer = (id, payload) => api.put(`/admin/offers/${id}`, payload).then((r) => r.data);
export const deleteOffer = (id) => api.delete(`/admin/offers/${id}`).then((r) => r.data);

export const money = (n) =>
  `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const CATEGORY_TINT = {
  GROCERY: "tint-grocery",
  SNACKS: "tint-snacks",
  BEVERAGES: "tint-beverages",
  FOOD_PRODUCTS: "tint-dairy",
  PERSONAL_CARE: "tint-personal",
  HOME_CLEANING: "tint-home",
  STATIONERY: "tint-stationery",
  HEALTH_CARE: "tint-health",
};

export const CATEGORY_LABEL = {
  ALL: "All Items",
  GROCERY: "Grocery",
  SNACKS: "Snacks",
  BEVERAGES: "Beverages",
  FOOD_PRODUCTS: "Dairy",
  PERSONAL_CARE: "Personal Care",
  HOME_CLEANING: "Home Care",
  STATIONERY: "Stationery",
  HEALTH_CARE: "Health",
  ADHESIVES: "Adhesives",
};

export const catTint = (c) => CATEGORY_TINT[c] || "tint-default";
export const catLabel = (c) => CATEGORY_LABEL[c] || c;