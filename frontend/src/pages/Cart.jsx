import { Link } from "react-router-dom";
import { useCart } from "../context/AuthContext";
import { money } from "../lib/api";
import { Plus, Minus, Trash2, ShoppingBag, ArrowRight } from "lucide-react";

export default function Cart() {
  const { items, setQty, remove, subtotal } = useCart();
  const tax = subtotal * 0.05;
  const total = subtotal + tax;

  if (items.length === 0) {
    return (
      <div className="max-w-3xl mx-auto p-8 text-center">
        <div className="glass p-12 mt-16">
          <ShoppingBag className="w-14 h-14 mx-auto text-slate-300 mb-3" />
          <div className="text-xl font-bold">Your cart is empty</div>
          <div className="text-sm text-slate-500 mt-1">Add some fresh picks from the shop</div>
          <Link to="/shop" data-testid="empty-shop-btn" className="btn-primary inline-flex items-center gap-2 mt-6 h-11 px-5 rounded-xl">
            Continue shopping <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-3">
        <div className="label-cap">Your Cart</div>
        <h1 className="text-2xl font-extrabold">Review items ({items.length})</h1>
        <div className="space-y-3 mt-3">
          {items.map((it) => (
            <div key={it.product_id} data-testid={`cart-item-${it.product_id}`} className="glass p-4 flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl bg-white/70 border border-white/70 flex items-center justify-center">
                <ShoppingBag className="w-6 h-6 text-slate-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{it.name}</div>
                <div className="text-xs text-slate-500 font-mono-num">{money(it.price)} each</div>
              </div>
              <div className="inline-flex items-center bg-white rounded-lg border border-slate-200">
                <button data-testid={`cart-dec-${it.product_id}`} onClick={() => setQty(it.product_id, it.quantity - 1)} className="p-2 hover:bg-slate-50 rounded-l-lg"><Minus className="w-3.5 h-3.5" /></button>
                <span className="px-3 text-sm font-mono-num font-semibold">{it.quantity}</span>
                <button data-testid={`cart-inc-${it.product_id}`} onClick={() => setQty(it.product_id, it.quantity + 1)} className="p-2 hover:bg-slate-50 rounded-r-lg"><Plus className="w-3.5 h-3.5" /></button>
              </div>
              <div className="w-24 text-right font-mono-num font-bold text-indigo-600">{money(it.subtotal)}</div>
              <button data-testid={`cart-rm-${it.product_id}`} onClick={() => remove(it.product_id)} className="text-slate-400 hover:text-rose-500 p-1">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <aside className="glass-strong p-5 h-fit sticky top-24 space-y-2">
        <div className="label-cap">Order Summary</div>
        <Row label="Subtotal" value={money(subtotal)} />
        <Row label="Tax (5%)" value={money(tax)} />
        <div className="border-t border-slate-200 pt-3 flex items-center justify-between">
          <span className="label-cap">Total</span>
          <span data-testid="cart-total" className="text-2xl font-mono-num font-extrabold">{money(total)}</span>
        </div>
        <Link to="/checkout" data-testid="checkout-link" className="btn-primary mt-3 w-full h-12 rounded-xl flex items-center justify-center gap-2">
          Proceed to Checkout <ArrowRight className="w-4 h-4" />
        </Link>
        <Link to="/shop" className="mt-1 block text-center text-xs text-slate-500 hover:text-indigo-500">Continue shopping</Link>
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
