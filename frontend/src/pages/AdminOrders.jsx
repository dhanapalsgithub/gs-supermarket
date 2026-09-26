import { useEffect, useState } from "react";
import { fetchOrders, updateOrderStatus, money } from "../lib/api";
import { toast } from "sonner";
import { Package, Truck, CheckCircle2, XCircle, Clock, CreditCard, ArrowRight } from "lucide-react";

const STAGES = ["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED"];
const stepIcon = { PENDING: Clock, CONFIRMED: Package, SHIPPED: Truck, DELIVERED: CheckCircle2, CANCELLED: XCircle };

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState("ALL");

  const load = () => fetchOrders().then(setOrders).catch(() => {});
  useEffect(load, []);

  const setStatus = async (o, order_status) => {
    try { await updateOrderStatus(o.id, { order_status }); toast.success(`Marked ${order_status}`); load(); } catch { toast.error("Failed"); }
  };
  const setPay = async (o, payment_status) => {
    try { await updateOrderStatus(o.id, { payment_status }); toast.success(`Marked ${payment_status}`); load(); } catch { toast.error("Failed"); }
  };

  const filtered = orders.filter((o) => filter === "ALL" || o.order_status === filter);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <header className="mb-6">
        <div className="label-cap">Fulfillment</div>
        <h1 className="text-3xl font-extrabold">All Orders</h1>
      </header>

      <div className="flex gap-2 mb-4 overflow-x-auto">
        {["ALL", ...STAGES, "CANCELLED"].map((s) => (
          <button key={s} data-testid={`ord-filter-${s}`} onClick={() => setFilter(s)} className={`chip whitespace-nowrap ${filter === s ? "chip-on" : "chip-off"}`}>
            {s} {s !== "ALL" && <span className="ml-1 opacity-70 font-mono-num">({orders.filter((o) => o.order_status === s).length})</span>}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map((o) => {
          const idx = STAGES.indexOf(o.order_status);
          const next = STAGES[idx + 1];
          return (
            <div key={o.id} data-testid={`adm-order-${o.id}`} className="glass p-4">
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <div>
                  <div className="text-sm font-bold">{o.receipt_no}</div>
                  <div className="text-xs text-slate-500">{new Date(o.created_at).toLocaleString("en-IN", { hour12: true })}</div>
                </div>
                <div className="ml-auto flex items-center gap-2 flex-wrap justify-end">
                  <span className={`pill ${pillFor(o.order_status)}`}>{o.order_status}</span>
                  <span className={`pill ${o.payment_status === "PAID" ? "pill-paid" : "pill-unpaid"}`}>{o.payment_status}</span>
                  <span className="pill pill-confirmed">{o.channel}</span>
                  <div className="text-right ml-2">
                    <div className="text-lg font-mono-num font-extrabold text-indigo-600">{money(o.total)}</div>
                    <div className="text-[10px] text-slate-500">{o.payment_method}</div>
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-3 text-sm">
                <div className="rounded-xl bg-white/60 border border-white/70 p-3">
                  <div className="label-cap">Customer</div>
                  <div className="mt-1 font-semibold">{o.customer_name || "Walk-in"}</div>
                  <div className="text-xs text-slate-500 font-mono-num">{o.customer_phone || "—"}</div>
                  {o.delivery_address && <div className="text-xs text-slate-500 mt-1 line-clamp-3">{o.delivery_address}</div>}
                </div>
                <div className="rounded-xl bg-white/60 border border-white/70 p-3">
                  <div className="label-cap">Items · {o.items.length}</div>
                  <div className="mt-1 space-y-0.5 text-xs">
                    {o.items.slice(0, 4).map((it, i) => (
                      <div key={i} className="flex justify-between"><span className="truncate">{it.name} ×{it.quantity}</span><span className="font-mono-num">{money(it.subtotal)}</span></div>
                    ))}
                    {o.items.length > 4 && <div className="text-slate-400">+ {o.items.length - 4} more</div>}
                  </div>
                </div>
                <div className="rounded-xl bg-white/60 border border-white/70 p-3 flex flex-col gap-2">
                  <div className="label-cap">Actions</div>
                  {o.order_status !== "CANCELLED" && next && (
                    <button data-testid={`adm-next-${o.id}`} onClick={() => setStatus(o, next)} className="btn-primary h-9 rounded-lg text-xs flex items-center justify-center gap-2">
                      Mark {next} <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {o.payment_status !== "PAID" ? (
                    <button data-testid={`adm-paid-${o.id}`} onClick={() => setPay(o, "PAID")} className="btn-ghost h-9 rounded-lg text-xs flex items-center justify-center gap-2">
                      <CreditCard className="w-3.5 h-3.5" /> Mark PAID
                    </button>
                  ) : (
                    <button data-testid={`adm-unpaid-${o.id}`} onClick={() => setPay(o, "UNPAID")} className="btn-ghost h-9 rounded-lg text-xs">Mark UNPAID</button>
                  )}
                  {o.order_status !== "DELIVERED" && o.order_status !== "CANCELLED" && (
                    <button data-testid={`adm-cancel-${o.id}`} onClick={() => setStatus(o, "CANCELLED")} className="text-xs text-rose-500 hover:text-rose-700">Cancel order</button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <div className="glass p-12 text-center text-slate-500">No orders</div>}
      </div>
    </div>
  );
}

function pillFor(s) {
  return { PENDING: "pill-pending", CONFIRMED: "pill-confirmed", SHIPPED: "pill-shipped", DELIVERED: "pill-delivered", CANCELLED: "pill-cancelled" }[s] || "pill-pending";
}
