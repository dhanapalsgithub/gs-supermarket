import "@/App.css";
import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import { Toaster } from "sonner";
import POS from "./pages/POS";
import History from "./pages/History";
import Admin from "./pages/Admin";
import { Store, Receipt, Boxes } from "lucide-react";

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-[#0B0B14] text-slate-100">
      <aside className="fixed inset-y-0 left-0 w-16 md:w-52 bg-[#12121F] border-r border-white/5 flex flex-col">
        <div className="h-16 flex items-center justify-center md:justify-start md:px-5 border-b border-white/5">
          <div className="w-9 h-9 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center">
            <Store className="w-5 h-5 text-indigo-300" />
          </div>
          <span className="hidden md:block ml-3 font-semibold tracking-tight">Cashier<span className="text-indigo-400">Pro</span></span>
        </div>
        <nav className="flex-1 p-2 md:p-3 space-y-1">
          {[
            { to: "/", icon: Store, label: "POS", tid: "nav-pos" },
            { to: "/history", icon: Receipt, label: "Sales", tid: "nav-history" },
            { to: "/admin", icon: Boxes, label: "Inventory", tid: "nav-admin" },
          ].map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end
              data-testid={n.tid}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-indigo-500/15 text-indigo-200 border border-indigo-400/20"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
                }`
              }
            >
              <n.icon className="w-5 h-5 shrink-0" />
              <span className="hidden md:inline">{n.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="hidden md:block p-3 text-[10px] uppercase tracking-widest text-slate-500 border-t border-white/5">
          Milestone Y50 • 58mm
        </div>
      </aside>
      <main className="pl-16 md:pl-52">{children}</main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-center" richColors closeButton />
      <Shell>
        <Routes>
          <Route path="/" element={<POS />} />
          <Route path="/history" element={<History />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </Shell>
    </BrowserRouter>
  );
}

export default App;
