import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ShoppingBag, LayoutGrid, ShieldCheck, Bluetooth } from "lucide-react";
import Footer from "../components/Footer";

export default function Landing() {
  const { user, isAdmin } = useAuth();
  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-6 md:px-12 py-6 flex items-center">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/40">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="leading-tight">
            <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">R I Billing Pro</div>
            <div className="text-lg font-extrabold">CashierPro</div>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {!user && <Link to="/login" data-testid="landing-login" className="chip chip-off">Sign In</Link>}
          {!user && <Link to="/register" data-testid="landing-register" className="chip chip-on">Create Account</Link>}
          {user && !isAdmin && <Link to="/shop" data-testid="landing-shop" className="chip chip-on">Continue Shopping</Link>}
          {isAdmin && <Link to="/admin/pos" data-testid="landing-admin" className="chip chip-on">Open Admin</Link>}
        </div>
      </header>

      <section className="flex-1 flex items-center px-6 md:px-12">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-10 items-center w-full">
          <div>
            <div className="label-cap mb-3">Modern Retail · POS + Online Store</div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.05]">
              Bill in-store, sell online, print on <span className="bg-gradient-to-r from-indigo-500 to-violet-500 bg-clip-text text-transparent">Milestone&nbsp;Y50</span>.
            </h1>
            <p className="mt-5 text-slate-600 text-lg max-w-xl">
              One elegant workspace to run your counter, ship online orders, track wishlists, and print thermal
              receipts over Bluetooth — signed off by R I Billing Pro.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/shop" data-testid="cta-shop" className="btn-primary px-6 h-12 rounded-xl flex items-center gap-2">
                <ShoppingBag className="w-5 h-5" /> Enter Storefront
              </Link>
              <Link to="/admin/pos" data-testid="cta-admin" className="btn-ghost px-6 h-12 rounded-xl flex items-center gap-2">
                <LayoutGrid className="w-5 h-5" /> Admin & POS
              </Link>
            </div>
            <div className="mt-8 flex items-center gap-3 text-xs text-slate-500">
              <Bluetooth className="w-4 h-4 text-indigo-500" />
              Chrome / Edge desktop supports live Bluetooth printing to Milestone Y50 (58mm)
            </div>
          </div>

          <div className="relative">
            <div className="glass-strong p-6">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { l: "POS Billing", v: "Live cart · Barcode scan" },
                  { l: "Online Shop", v: "Wishlist · Cart · COD" },
                  { l: "Orders", v: "Track shipping · paid status" },
                  { l: "Reports", v: "Today vs Yesterday" },
                  { l: "Inventory", v: "Import CSV · Manage stock" },
                  { l: "Thermal Print", v: "Milestone Y50 · 58mm" },
                ].map((f) => (
                  <div key={f.l} className="rounded-2xl bg-white/60 border border-white/60 p-3">
                    <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">{f.l}</div>
                    <div className="mt-1 text-sm font-semibold text-slate-800">{f.v}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 text-center text-[10px] text-slate-500">
                Powered by <span className="font-semibold text-indigo-600">R I Billing Pro</span> · Test admin: smallbiz743@gmail.com
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
