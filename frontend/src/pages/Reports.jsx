import { useEffect, useState } from "react";
import { fetchStats, fetchReport, money } from "../lib/api";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { IndianRupee, Receipt, Package, Clock, TrendingUp, Users, Truck, ShoppingCart, Boxes, DollarSign, Wallet } from "lucide-react";

export default function Reports() {
  const [stats, setStats] = useState({
    total_products: 0,
    total_customers: 0,
    total_supplier: 0,
    total_online_order: 0,
    total_purchase_product: 0,
    total_inventory_product: 0,
    total_revenue: 0,
    total_purchase_cost: 0,
    total_profit: 0,
    pending_orders: 0
  });
  const [report, setReport] = useState({ today: [], yesterday: [], top_products: [], today_total: 0, yesterday_total: 0 });

  useEffect(() => {
    fetchStats().then(setStats).catch(() => {});
    fetchReport().then(setReport).catch(() => {});
  }, []);

  const chartData = Array.from({ length: 24 }, (_, h) => ({
    hour: `${h}:00`, Today: report.today?.[h] || 0, Yesterday: report.yesterday?.[h] || 0,
  }));

  const delta = report.today_total - report.yesterday_total;
  const deltaPct = report.yesterday_total > 0 ? (delta / report.yesterday_total) * 100 : (report.today_total > 0 ? 100 : 0);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <header className="mb-6">
        <div className="label-cap">Insights</div>
        <h1 className="text-3xl font-extrabold">Sales Report</h1>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-6">
        <StatCard icon={<IndianRupee className="w-5 h-5" />} label="Total Revenue" value={money(stats.total_revenue)} tint="from-indigo-50" />
        <StatCard icon={<Wallet className="w-5 h-5" />} label="Total Profit" value={money(stats.total_profit)} tint="from-emerald-100" />
        <StatCard icon={<DollarSign className="w-5 h-5" />} label="Purchase Cost" value={money(stats.total_purchase_cost)} tint="from-rose-100" />
        <StatCard icon={<Receipt className="w-5 h-5" />} label="Total Products" value={stats.total_products} tint="from-blue-100" />
        <StatCard icon={<Boxes className="w-5 h-5" />} label="Inventory Stock" value={stats.total_inventory_product} tint="from-amber-100" />
        <StatCard icon={<ShoppingCart className="w-5 h-5" />} label="Online Orders" value={stats.total_online_order} tint="from-purple-100" />
        <StatCard icon={<Users className="w-5 h-5" />} label="Total Customers" value={stats.total_customers} tint="from-cyan-100" />
        <StatCard icon={<Truck className="w-5 h-5" />} label="Total Suppliers" value={stats.total_supplier} tint="from-orange-100" />
        <StatCard icon={<Package className="w-5 h-5" />} label="Purchased Items" value={stats.total_purchase_product} tint="from-teal-100" />
        <StatCard icon={<Clock className="w-5 h-5" />} label="Pending Orders" value={stats.pending_orders} tint="from-yellow-100" />
      </div>

      <div className="glass-strong p-6 mb-6">
        <div className="flex items-end justify-between mb-4">
          <div>
            <div className="label-cap">Today vs Yesterday</div>
            <div className="text-xl font-extrabold mt-1">Hourly revenue</div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-mono-num font-extrabold text-indigo-600">{money(report.today_total)}</div>
            <div className={`text-xs font-semibold flex items-center gap-1 justify-end ${delta >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              <TrendingUp className="w-3.5 h-3.5" />
              {delta >= 0 ? "+" : ""}{deltaPct.toFixed(1)}% vs yesterday
            </div>
          </div>
        </div>
        <div style={{ width: "100%", height: 320 }}>
          <ResponsiveContainer>
            <LineChart data={chartData}>
              <defs>
                <linearGradient id="grad-today" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#6366F1" />
                  <stop offset="100%" stopColor="#8B5CF6" />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="hour" stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#94a3b8" fontSize={11} />
              <Tooltip contentStyle={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 12 }} formatter={(v) => money(v)} />
              <Legend />
              <Line type="monotone" dataKey="Yesterday" stroke="#94a3b8" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Today" stroke="url(#grad-today)" strokeWidth={3} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="glass-strong p-6">
        <div className="label-cap mb-1">Top Sellers</div>
        <div className="text-xl font-extrabold mb-4">Best selling products</div>
        {report.top_products.length === 0 ? (
          <div className="text-sm text-slate-500 py-8 text-center">No sales yet</div>
        ) : (
          <div className="space-y-2">
            {report.top_products.map((p, i) => {
              const max = report.top_products[0].revenue || 1;
              return (
                <div key={p.product_id} className="rounded-xl bg-white/60 border border-white/70 p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-white flex items-center justify-center text-xs font-bold">#{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{p.name}</div>
                      <div className="text-xs text-slate-500 font-mono-num">{p.qty} units sold</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono-num font-bold text-indigo-600">{money(p.revenue)}</div>
                    </div>
                  </div>
                  <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500" style={{ width: `${(p.revenue / max) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, tint }) {
  return (
    <div className={`glass p-4 bg-gradient-to-b ${tint} to-white flex flex-col justify-between overflow-hidden`}>
      <div className="flex items-center gap-2 text-slate-600 text-xs md:text-sm truncate">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div 
        className="mt-3 font-mono-num font-extrabold tracking-tight text-lg md:text-xl xl:text-2xl truncate"
        title={value}
      >
        {value}
      </div>
    </div>
  );
}