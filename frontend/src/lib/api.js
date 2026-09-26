import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API, timeout: 15000 });

export const fetchProducts = (params = {}) => api.get("/products", { params }).then((r) => r.data);
export const fetchCategories = () => api.get("/categories").then((r) => r.data);
export const fetchByBarcode = (bc) => api.get(`/products/barcode/${encodeURIComponent(bc)}`).then((r) => r.data);
export const createSale = (payload) => api.post("/sales", payload).then((r) => r.data);
export const fetchSales = () => api.get("/sales").then((r) => r.data);
export const createProduct = (p) => api.post("/products", p).then((r) => r.data);
export const updateProduct = (id, p) => api.put(`/products/${id}`, p).then((r) => r.data);
export const deleteProduct = (id) => api.delete(`/products/${id}`).then((r) => r.data);
export const seedProducts = () => api.post("/seed").then((r) => r.data);
export const fetchStats = () => api.get("/stats/summary").then((r) => r.data);

export const money = (n) =>
  `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
