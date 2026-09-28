import { createContext, useContext, useEffect, useState } from "react";
import { authLogin, authMe, api } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = localStorage.getItem("token");
    if (!t) { setLoading(false); return; }
    authMe().then(setUser).catch(() => localStorage.removeItem("token")).finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const res = await authLogin(email, password);
    const token = res.token || res.data?.token;
    const userData = res.user || res.data?.user;
    localStorage.setItem("token", token);
    setUser(userData);
    return userData;
  };

  const register = async (payload) => {
    // நேரடியாக api-ஐப் பயன்படுத்தி பதிவு செய்தல்
    const response = await api.post("/auth/register", payload);
    const { token, user } = response.data;
    localStorage.setItem("token", token);
    setUser(user);
    return user;
  };

  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
  };

  const value = {
    user, setUser, loading, login, register, logout,
    role: user?.role || null,
    isOwner: user?.role === "owner",
    isCashier: user?.role === "cashier",
    isCustomer: user?.role === "user",
    isStaff: user?.role === "owner" || user?.role === "cashier",
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

// Cart context (client-side only, persisted to localStorage per role)
const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem("shop_cart") || "[]"); } catch { return []; }
  });

  useEffect(() => { localStorage.setItem("shop_cart", JSON.stringify(items)); }, [items]);

  const add = (p, qty = 1) => {
    setItems((prev) => {
      const idx = prev.findIndex((x) => x.product_id === p.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + qty, subtotal: (next[idx].quantity + qty) * p.price };
        return next;
      }
      return [...prev, { product_id: p.id, name: p.name, price: p.price, quantity: qty, subtotal: p.price * qty, unit: p.unit, category: p.category }];
    });
  };
  const setQty = (id, qty) => setItems((c) => c.map((it) => it.product_id === id ? { ...it, quantity: qty, subtotal: qty * it.price } : it).filter((it) => it.quantity > 0));
  const remove = (id) => setItems((c) => c.filter((x) => x.product_id !== id));
  const clear = () => setItems([]);
  const subtotal = items.reduce((s, it) => s + it.subtotal, 0);

  return <CartContext.Provider value={{ items, add, setQty, remove, clear, subtotal }}>{children}</CartContext.Provider>;
}
export const useCart = () => useContext(CartContext);