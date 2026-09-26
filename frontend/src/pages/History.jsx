import { useEffect, useState } from "react";
import { fetchSales, fetchStats, money } from "../lib/api";
import { Receipt, TrendingUp, Package, IndianRupee } from "lucide-react";
import ReceiptModal from "../components/ReceiptModal";

export default function History() {
  const [sales, setSales] = useState([]);
  const [stats, setStats] = useState({ total_products: 0, total_sales: 0, total_revenue: 0 });
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    fetchSales().then(setSales).catch(() => {});
    fetchStats().then(setStats).catch(() => {});
  }, []);

  return (
    <div className="h-screen overflow-y-auto p-6 md:p-8">
      <header className="mb-8">
        <div className="text-[10px] uppercase tracking-widest text-slate-400">Reports</div>
        <h1 className="text-3xl font-extrabold tracking-tight">Sales History</h1>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <StatCard icon={<IndianRupee className="w-5 h-5" />} label="Total Revenue" value={money(stats.total_revenue)} tint="from-indigo-500/20" />
        <StatCard icon={<Receipt className="w-5 h-5" />} label="Total Bills" value={stats.total_sales} tint="from-emerald-500/20" />
        <StatCard icon={<Package className="w-5 h-5" />} label="Products" value={stats.total_products} tint="from-amber-500/20" />
      </div>

      <div className="rounded-2xl border border-white/5 bg-[#12121F] overflow-hidden">
        <div className="p-4 border-b border-white/5 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-indigo-300" />
          <div className="font-semibold">Recent Transactions</div>
        </div>
        <div className="divide-y divide-white/5">
          {sales.length === 0 && <div className="p-10 text-center text-slate-500">No sales yet</div>}
          {sales.map((s) => (
            <button
              key={s.id}
              data-testid={`sale-${s.id}`}
              onClick={() => setSelected(s)}
              className="w-full grid grid-cols-12 items-center gap-3 px-5 py-4 hover:bg-white/[0.03] text-left"
            >
              <div className="col-span-4">
                <div className="font-semibold text-sm">{s.receipt_no}</div>
                <div className="text-xs text-slate-400">{new Date(s.created_at).toLocaleString("en-IN", { hour12: true })}</div>
              </div>
              <div className="col-span-3 text-sm text-slate-300">
                {s.customer_name || <span className="text-slate-500">Walk-in</span>}
              </div>
              <div className="col-span-2 text-xs">
                <span className="px-2 py-1 rounded-full bg-white/5 border border-white/10">{s.payment_method}</span>
              </div>
              <div className="col-span-2 text-xs text-slate-400 font-mono-num">{s.items.length} items</div>
              <div className="col-span-1 text-right font-mono-num font-bold text-indigo-300">{money(s.total)}</div>
            </button>
          ))}
        </div>
      </div>

      {selected && <ReceiptModal sale={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function StatCard({ icon, label, value, tint }) {
  return (
    <div className={`rounded-2xl border border-white/5 bg-gradient-to-b ${tint} to-transparent p-5`}>
      <div className="flex items-center gap-2 text-slate-300 text-sm">{icon}<span>{label}</span></div>
      <div className="mt-3 text-3xl font-mono-num font-extrabold">{value}</div>
    </div>
  );
}
