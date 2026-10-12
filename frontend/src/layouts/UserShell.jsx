import { NavLink, Outlet, useNavigate, Link } from "react-router-dom";
import { useAuth, useCart } from "../context/AuthContext";
import { ShoppingBag, Heart, ShoppingCart, Package, User, LogOut, LogIn } from "lucide-react";
import GSLogo, { GSLogoWithText } from "../components/GSLogo";
import Footer from "../components/Footer";

export default function UserShell() {
  const { user, logout, isStaff } = useAuth();
  const { items } = useCart();
  const nav = useNavigate();

  const cartCount = items.reduce((s, it) => s + it.quantity, 0);

  const NavItem = ({ to, icon: Icon, label, badge, tid }) => (
    <NavLink
      to={to}
      end
      data-testid={tid}
      className={({ isActive }) =>
        `relative p-2 sm:px-3 sm:py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors ${
          isActive
            ? "bg-white text-indigo-600 shadow-sm"
            : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
        }`
      }
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      {/* Hide label text on tiny screens to avoid overflow */}
      <span className="hidden md:inline">{label}</span>
      {badge > 0 && (
        <span className="absolute -top-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-indigo-500 text-white text-[10px] flex items-center justify-center font-bold">
          {badge}
        </span>
      )}
    </NavLink>
  );

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 glass border-0 border-b border-white/40 rounded-none px-2 sm:px-4 md:px-8 py-2.5 flex items-center justify-between gap-2 overflow-x-auto">
        <Link to="/shop" className="flex items-center flex-shrink-0">
          <GSLogoWithText size={32} subtitle="Billing" />
        </Link>

        <nav className="flex items-center gap-0.5 sm:gap-1 bg-slate-100/80 rounded-xl p-1 flex-shrink-0">
          <NavItem to="/shop" icon={ShoppingBag} label="Shop" tid="nav-shop" />
          <NavItem to="/wishlist" icon={Heart} label="Wishlist" tid="nav-wishlist" />
          <NavItem to="/cart" icon={ShoppingCart} label="Cart" badge={cartCount} tid="nav-cart" />
          {user && <NavItem to="/orders" icon={Package} label="Orders" tid="nav-orders" />}
          {user && <NavItem to="/account" icon={User} label="Account" tid="nav-account" />}
        </nav>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {isStaff && (
            <Link to="/admin/pos" className="chip chip-off hidden lg:inline-flex text-xs" data-testid="go-admin">
              {user?.role === "owner" ? "Owner" : "Cashier"} Console
            </Link>
          )}
          {user ? (
            <button
              onClick={() => { logout(); nav("/"); }}
              data-testid="logout-btn"
              className="chip chip-off p-2 sm:px-3 flex items-center gap-1 text-xs"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          ) : (
            <Link to="/login" data-testid="login-link" className="chip chip-on p-2 sm:px-3 flex items-center gap-1 text-xs">
              <LogIn className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign In</span>
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