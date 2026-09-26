import { NavLink, Outlet, useNavigate, Link } from "react-router-dom";
import { useAuth, useCart } from "../context/AuthContext";
import { ShoppingBag, Heart, ShoppingCart, Package, User, LogOut, Store, LogIn } from "lucide-react";
import Footer from "../components/Footer";

export default function UserShell() {
  const { user, logout, isAdmin } = useAuth();
  const { items } = useCart();
  const nav = useNavigate();

  const cartCount = items.reduce((s, it) => s + it.quantity, 0);

  const NavItem = ({ to, icon: Icon, label, badge, tid }) => (
    <NavLink
      to={to} end
      data-testid={tid}
      className={({ isActive }) =>
        `relative px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
          isActive ? "bg-white text-indigo-600 shadow-sm" : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
        }`
      }
    >
      <Icon className="w-4 h-4" />
      <span className="hidden sm:inline">{label}</span>
      {badge > 0 && (
        <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-indigo-500 text-white text-[10px] flex items-center justify-center font-bold">
          {badge}
        </span>
      )}
    </NavLink>
  );

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 glass border-0 border-b border-white/40 rounded-none px-4 md:px-8 py-3 flex items-center gap-4">
        <Link to="/shop" className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
            <Store className="w-5 h-5" />
          </div>
          <div className="leading-tight">
            <div className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">R I Billing Pro</div>
            <div className="text-lg font-extrabold tracking-tight">Cashier<span className="text-indigo-500">Pro</span></div>
          </div>
        </Link>

        <nav className="ml-auto flex items-center gap-1 md:gap-2 bg-slate-100/60 rounded-xl p-1">
          <NavItem to="/shop" icon={ShoppingBag} label="Shop" tid="nav-shop" />
          <NavItem to="/wishlist" icon={Heart} label="Wishlist" tid="nav-wishlist" />
          <NavItem to="/cart" icon={ShoppingCart} label="Cart" badge={cartCount} tid="nav-cart" />
          {user && <NavItem to="/orders" icon={Package} label="Orders" tid="nav-orders" />}
          {user && <NavItem to="/account" icon={User} label="Account" tid="nav-account" />}
        </nav>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <Link to="/admin/pos" className="chip chip-off hidden md:inline-flex" data-testid="go-admin">
              Admin
            </Link>
          )}
          {user ? (
            <button
              onClick={() => { logout(); nav("/"); }}
              data-testid="logout-btn"
              className="chip chip-off flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" /> Logout
            </button>
          ) : (
            <Link to="/login" data-testid="login-link" className="chip chip-on flex items-center gap-1.5">
              <LogIn className="w-3.5 h-3.5" /> Sign In
            </Link>
          )}
        </div>
      </header>

      <main className="flex-1 relative">
        <Outlet />
      </main>

      <Footer />
    </div>
  );
}
