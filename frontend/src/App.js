import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, CartProvider } from "./context/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import AdminShell from "./layouts/AdminShell";
import UserShell from "./layouts/UserShell";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Landing from "./pages/Landing";
import Shop from "./pages/Shop";
import Wishlist from "./pages/Wishlist";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import MyOrders from "./pages/MyOrders";
import Account from "./pages/Account";
import POS from "./pages/POS";
import AdminOrders from "./pages/AdminOrders";
import Reports from "./pages/Reports";
import Inventory from "./pages/Inventory";
import Settings from "./pages/Settings";

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <BrowserRouter>
          <Toaster position="top-center" richColors closeButton />
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Public/User routes */}
            <Route element={<UserShell />}>
              <Route path="/shop" element={<Shop />} />
              <Route path="/wishlist" element={<ProtectedRoute><Wishlist /></ProtectedRoute>} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
              <Route path="/orders" element={<ProtectedRoute><MyOrders /></ProtectedRoute>} />
              <Route path="/account" element={<ProtectedRoute><Account /></ProtectedRoute>} />
            </Route>

            {/* Admin / Staff routes */}
            <Route element={<ProtectedRoute staffOnly><AdminShell /></ProtectedRoute>}>
              <Route path="/admin" element={<Navigate to="/admin/pos" replace />} />
              <Route path="/admin/pos" element={<POS />} />
              <Route path="/admin/orders" element={<ProtectedRoute ownerOnly><AdminOrders /></ProtectedRoute>} />
              <Route path="/admin/reports" element={<ProtectedRoute ownerOnly><Reports /></ProtectedRoute>} />
              <Route path="/admin/inventory" element={<ProtectedRoute ownerOnly><Inventory /></ProtectedRoute>} />
              <Route path="/admin/settings" element={<ProtectedRoute ownerOnly><Settings /></ProtectedRoute>} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
