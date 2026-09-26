import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, useCart } from "../context/AuthContext";
import { createOrder, money } from "../lib/api";
import { QrCode, Wallet, CheckCircle2, Truck } from "lucide-react";
import { toast } from "sonner";

export default function Checkout() {
  const { user } = useAuth();
  const { items, subtotal, clear } = useCart();
  const nav = useNavigate();
  const [method, setMethod] = useState("COD");
  const [address, setAddress] = useState(user?.address || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [placed, setPlaced] = useState(null);
  const [busy, setBusy] = useState(false);

  const tax = subtotal * 0.05;
  const total = subtotal + tax;

  const place = async () => {
    if (!address.trim()) return toast.error("Delivery address required");
    setBusy(true);
    try {
      const order = await createOrder({
        items: items.map((it) => ({ product_id: it.product_id, name: it.name, price: it.price, quantity: it.quantity, subtotal: it.subtotal })),
        subtotal, tax_rate: 0.05, tax_amount: tax, discount: 0, total,
        payment_method: method, amount_paid: method === "UPI" ? total : 0, change_due: 0,
        customer_name: user.name, customer_phone: phone, delivery_address: address,
        channel: "ONLINE",
      });
      setPlaced(order);
      clear();
      toast.success("Order placed");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to place order");
    } finally { setBusy(false); }
  };

  if (placed) {
    return (
      <div className="max-w-md mx-auto p-8 text-center">
        <div className="glass-strong p-8 mt-16">
          <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div className="text-2xl font-extrabold">Order placed!</div>
          <div className="text-sm text-slate-500 mt-1">Receipt {placed.receipt_no}</div>
          <div className="mt-6 rounded-xl bg-white/60 border border-white/70 p-4 text-left space-y-1 text-sm">
            <Row label="Total" value={money(placed.total)} />
            <Row label="Payment" value={placed.payment_method === "COD" ? "Cash on delivery" : "UPI"} />
            <Row label="Status" value={placed.order_status} />
          </div>
          <button data-testid="view-orders-btn" onClick={() => nav("/orders")} className="btn-primary w-full h-12 rounded-xl mt-6">
            Track my orders
          </button>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="max-w-md mx-auto p-8 text-center text-slate-500">
        <div className="glass p-8 mt-16">Your cart is empty.
          <button onClick={() => nav("/shop")} className="btn-primary mt-4 w-full h-11 rounded-xl">Continue shopping</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <div className="label-cap">Checkout</div>
        <h1 className="text-2xl font-extrabold">Delivery & Payment</h1>

        <div className="glass p-5 space-y-3">
          <div className="label-cap flex items-center gap-2"><Truck className="w-3.5 h-3.5" /> Delivery details</div>
          <label className="block">
            <span className="text-xs text-slate-500">Address</span>
            <textarea data-testid="chk-address" rows={2} value={address} onChange={(e) => setAddress(e.target.value)} className="field pt-2 mt-1" style={{ height: "auto" }} />
          </label>
          <label className="block">
            <span className="text-xs text-slate-500">Phone</span>
            <input data-testid="chk-phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="field mt-1 font-mono-num" />
          </label>
        </div>

        <div className="glass p-5 space-y-3">
          <div className="label-cap">Payment Method</div>
          <div className="grid grid-cols-2 gap-3">
            <MethodBtn tid="pay-cod" active={method === "COD"} onClick={() => setMethod("COD")} icon={<Wallet className="w-5 h-5" />} title="Cash on Delivery" sub="Pay when you receive" />
            <MethodBtn tid="pay-upi-online" active={method === "UPI"} onClick={() => setMethod("UPI")} icon={<QrCode className="w-5 h-5" />} title="UPI / QR" sub="Scan and pay now" />
          </div>

          {method === "UPI" && (
            <div className="mt-3 rounded-2xl bg-white/70 border border-white/70 p-4 flex items-center gap-4">
              <div className="w-32 h-32 bg-white rounded-xl border border-slate-200 p-2 flex items-center justify-center">
                <div className="grid grid-cols-8 grid-rows-8 gap-[2px] w-full h-full">
                  {Array.from({ length: 64 }).map((_, i) => (
                    <div key={i} className={((i * 7 + 3) % 5 < 2 || i === 0 || i === 7 || i === 56 || i === 63) ? "bg-slate-900" : "bg-white"} />
                  ))}
                </div>
              </div>
              <div className="text-xs">
                <div className="font-semibold">Scan to pay {money(total)}</div>
                <div className="text-slate-500 mt-1">UPI ID: cashierpro@upi</div>
                <div className="text-slate-400 mt-1">This is a demo QR — payment will be marked as paid on placing order.</div>
              </div>
            </div>
          )}
        </div>
      </div>

      <aside className="glass-strong p-5 h-fit sticky top-24 space-y-2">
        <div className="label-cap">Order Summary</div>
        {items.map((it) => (
          <div key={it.product_id} className="flex items-center justify-between text-sm py-1">
            <span className="truncate max-w-[65%]">{it.name} × {it.quantity}</span>
            <span className="font-mono-num">{money(it.subtotal)}</span>
          </div>
        ))}
        <div className="border-t border-slate-200 pt-3 space-y-1">
          <Row label="Subtotal" value={money(subtotal)} />
          <Row label="Tax (5%)" value={money(tax)} />
        </div>
        <div className="border-t border-slate-200 pt-3 flex items-center justify-between">
          <span className="label-cap">Total</span>
          <span data-testid="chk-total" className="text-2xl font-mono-num font-extrabold">{money(total)}</span>
        </div>
        <button data-testid="place-order-btn" onClick={place} disabled={busy} className="btn-primary mt-3 w-full h-12 rounded-xl">
          {busy ? "Placing…" : `Place Order · ${method}`}
        </button>
      </aside>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-mono-num">{value}</span>
    </div>
  );
}

function MethodBtn({ active, onClick, icon, title, sub, tid }) {
  return (
    <button data-testid={tid} onClick={onClick} className={`p-4 rounded-2xl border text-left transition-all ${active ? "bg-gradient-to-br from-indigo-50 to-violet-50 border-indigo-300 shadow-sm" : "bg-white border-slate-200 hover:border-indigo-300"}`}>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${active ? "bg-indigo-500 text-white" : "bg-slate-100 text-slate-600"}`}>{icon}</div>
      <div className="mt-2 font-semibold text-sm">{title}</div>
      <div className="text-xs text-slate-500">{sub}</div>
    </button>
  );
}
