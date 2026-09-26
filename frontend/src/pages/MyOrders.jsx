import { useEffect, useState } from "react";
import { fetchOrders, money } from "../lib/api";
import { Package, Truck, CheckCircle2, XCircle, Clock, CreditCard } from "lucide-react";

const stepIcon = (s) => ({
  PENDING: Clock, CONFIRMED: Package, SHIPPED: Truck, DELIVERED: CheckCircle2, CANCELLED: XCircle,
}[s] || Clock);

const STAGES = ["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED"];

export default function MyOrders() {
  const [orders, setOrders] = useState([]);
  const [open, setOpen] = useState(null);

  useEffect(() => { fetchOrders({ mine: true }).then(setOrders).catch(() => {}); }, []);

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8">
      <header className="mb-6">
        <div className="label-cap">Track your purchases</div>
        <h1 className="text-3xl font-extrabold">My Orders</h1>
      </header>

      {orders.length === 0 && <div className="glass p-12 text-center text-slate-500">You have no orders yet.</div>}

      <div className="space-y-3">
        {orders.map((o) => {
          const idx = STAGES.indexOf(o.order_status);
          return (
            <div key={o.id} data-testid={`myorder-${o.id}`} className="glass p-5">
              <div className="flex flex-wrap items-center gap-3">
                <div>
                  <div className="text-sm font-bold">{o.receipt_no}</div>
                  <div className="text-xs text-slate-500">{new Date(o.created_at).toLocaleString("en-IN", { hour12: true })}</div>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <span className={`pill ${pillFor(o.order_status)}`}>{o.order_status}</span>
                  <span className={`pill ${o.payment_status === "PAID" ? "pill-paid" : "pill-unpaid"}`}>{o.payment_status}</span>
                  <div className="text-right ml-3">
                    <div className="text-lg font-mono-num font-extrabold text-indigo-600">{money(o.total)}</div>
                    <div className="text-[10px] text-slate-500">{o.payment_method}</div>
                  </div>
                </div>
              </div>

              {/* Tracker */}
              {o.order_status !== "CANCELLED" && (
                <div className="mt-5 grid grid-cols-4 gap-2">
                  {STAGES.map((s, i) => {
                    const Icon = stepIcon(s);
                    const done = i <= idx;
                    return (
                      <div key={s} className="text-center">
                        <div className={`mx-auto w-9 h-9 rounded-full flex items-center justify-center ${done ? "bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow" : "bg-slate-100 text-slate-400"}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className={`mt-1.5 text-[11px] ${done ? "text-slate-800 font-semibold" : "text-slate-400"}`}>{s}</div>
                      </div>
                    );
                  })}
                </div>
              )}

              <button onClick={() => setOpen(open === o.id ? null : o.id)} data-testid={`myorder-toggle-${o.id}`} className="mt-4 text-xs text-indigo-600 font-semibold">
                {open === o.id ? "Hide details" : "View details"}
              </button>
              {open === o.id && (
                <div className="mt-3 border-t border-slate-200 pt-3 space-y-1">
                  {o.items.map((it, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span>{it.name} × {it.quantity}</span>
                      <span className="font-mono-num">{money(it.subtotal)}</span>
                    </div>
                  ))}
                  <div className="border-t border-dashed border-slate-200 mt-2 pt-2 space-y-1 text-sm">
                    <RowSm label="Subtotal" value={money(o.subtotal)} />
                    <RowSm label="Tax" value={money(o.tax_amount)} />
                    {o.discount > 0 && <RowSm label="Discount" value={`-${money(o.discount)}`} />}
                    <RowSm label="Total" value={money(o.total)} bold />
                    {o.delivery_address && <div className="text-xs text-slate-500 mt-2 flex gap-2"><CreditCard className="w-3 h-3 mt-0.5" /> {o.delivery_address}</div>}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RowSm({ label, value, bold }) {
  return (
    <div className={`flex items-center justify-between ${bold ? "font-bold" : ""}`}>
      <span className="text-slate-500">{label}</span><span className="font-mono-num">{value}</span>
    </div>
  );
}

function pillFor(s) {
  return { PENDING: "pill-pending", CONFIRMED: "pill-confirmed", SHIPPED: "pill-shipped", DELIVERED: "pill-delivered", CANCELLED: "pill-cancelled" }[s] || "pill-pending";
}
