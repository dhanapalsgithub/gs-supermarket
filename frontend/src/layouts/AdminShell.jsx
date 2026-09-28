import { NavLink, Outlet, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { LayoutGrid, ClipboardList, BarChart3, Boxes, LogOut, ShoppingBag, Settings, Users, Truck, Receipt,Megaphone } from "lucide-react";
import GSLogo from "../components/GSLogo";
import Footer from "../components/Footer";

export default function AdminShell() {
  const { user, logout, isOwner } = useAuth();
  const nav = useNavigate();

  const allLinks = [
    { to: "/admin/pos", icon: LayoutGrid, label: "POS", tid: "admin-nav-pos", roles: ["owner", "cashier"] },
    { to: "/admin/orders", icon: ClipboardList, label: "Orders", tid: "admin-nav-orders", roles: ["owner"] },
    { to: "/admin/customers", icon: Users, label: "Customers", tid: "admin-nav-customers", roles: ["owner"] },
    { to: "/admin/suppliers", icon: Truck, label: "Suppliers", tid: "admin-nav-suppliers", roles: ["owner"] },
    { to: "/admin/purchases", icon: Receipt, label: "Purchases", tid: "admin-nav-purchases", roles: ["owner"] },
    { to: "/admin/inventory", icon: Boxes, label: "Inventory", tid: "admin-nav-inventory", roles: ["owner"] },
    { to: "/admin/reports", icon: BarChart3, label: "Reports", tid: "admin-nav-reports", roles: ["owner"] },
    { to: "/admin/offers", icon: Megaphone, label: "Offers & SMS", tid: "admin-nav-offers", roles: ["owner"] },
    { to: "/admin/settings", icon: Settings, label: "Settings", tid: "admin-nav-settings", roles: ["owner"] },
];
  const links = allLinks.filter((l) => l.roles.includes(user?.role));

  const roleLabel = isOwner ? "Owner" : "Cashier";
  const roleTint = isOwner ? "from-indigo-500 to-violet-500" : "from-emerald-500 to-teal-500";

  return (
    <div className="min-h-screen flex">
      <aside className="w-16 md:w-56 shrink-0 border-r border-white/40 glass rounded-none flex flex-col">
        <div className="h-16 flex items-center gap-2 justify-center md:justify-start md:px-5 border-b border-white/40">
          <GSLogo size={36} />
          <div className="hidden md:block leading-tight">
            <div className="text-[9px] uppercase tracking-widest text-slate-500 font-semibold">R I Billing Pro</div>
            <div className="text-sm font-extrabold tracking-tight">GS <span className={`bg-gradient-to-r ${roleTint} bg-clip-text text-transparent`}>{roleLabel}</span></div>
          </div>
        </div>
        <nav className="flex-1 p-2 md:p-3 space-y-1">
          {links.map((n) => (
            <NavLink
              key={n.to} to={n.to}
              data-testid={n.tid}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                  isActive
                    ? "bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-500/25"
                    : "text-slate-600 hover:bg-white/70 hover:text-slate-900"
                }`
              }
            >
              <n.icon className="w-5 h-5 shrink-0" />
              <span className="hidden md:inline">{n.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-white/40 space-y-2">
          <Link to="/shop" className="hidden md:flex text-xs text-slate-500 hover:text-indigo-500 items-center gap-1.5">
            <ShoppingBag className="w-3.5 h-3.5" /> Storefront
          </Link>
          <div className="hidden md:block text-[10px] text-slate-500 truncate">{user?.email}</div>
          <button
            onClick={() => { logout(); nav("/login"); }}
            data-testid="admin-logout"
            className="flex items-center gap-2 text-xs text-slate-500 hover:text-rose-500"
          >
            <LogOut className="w-3.5 h-3.5" /> Logout
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1"><Outlet /></main>
        <Footer />
      </div>
    </div>
  );
}