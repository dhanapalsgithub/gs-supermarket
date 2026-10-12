import { Link } from "react-router-dom";
import { useCart } from "../context/AuthContext";
import { money } from "../lib/api";
import { Plus, Minus, Trash2, ShoppingBag, ArrowRight } from "lucide-react";

export default function Cart() {
  const { items, setQty, remove, updateQty, removeItem, subtotal } = useCart();

  // Safe handlers to support any context function names
  const handleSetQty = setQty || updateQty;
  const handleRemove = remove || removeItem;

  const tax = subtotal * 0.05;
  const total = subtotal + tax;

  if (!items || items.length === 0) {
    return (
      <div className="max-w-3xl mx-auto p-4 sm:p-8 text-center">
        <div className="glass p-8 sm:p-12 mt-8 sm:mt-16 rounded-2xl">
          <ShoppingBag className="w-12 h-12 sm:w-14 sm:h-14 mx-auto text-slate-300 mb-3" />
          <div className="text-xl font-bold text-slate-800">Your cart is empty</div>
          <div className="text-sm text-slate-500 mt-1">Add some fresh picks from the shop</div>
          <Link
            to="/shop"
            data-testid="empty-shop-btn"
            className="btn-primary inline-flex items-center justify-center gap-2 mt-6 h-11 px-6 rounded-xl text-sm font-semibold active:scale-95 transition-transform"
          >
            Continue shopping <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-3 sm:p-6 md:p-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-3">
        <div>
          <div className="label-cap">Your Cart</div>
          <h1 className="text-2xl font-extrabold text-slate-900">
            Review items ({items.length})
          </h1>
        </div>

        <div className="space-y-3 mt-3">
          {items.map((it) => (
            <div
              key={it.product_id}
              data-testid={`cart-item-${it.product_id}`}
              className="glass p-3 sm:p-4 rounded-2xl flex flex-wrap sm:flex-nowrap items-center gap-3 sm:gap-4 border border-slate-100 shadow-sm"
            >
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl bg-white/80 border border-slate-200/60 flex items-center justify-center flex-shrink-0">
                <ShoppingBag className="w-5 h-5 sm:w-6 sm:h-6 text-slate-400" />
              </div>

              <div className="flex-1 min-w-[120px]">
                <div className="font-semibold text-sm sm:text-base text-slate-800 truncate">
                  {it.name}
                </div>
                <div className="text-xs text-slate-500 font-mono-num">
                  {money(it.price)} each
                </div>
              </div>

              <div className="inline-flex items-center bg-white rounded-lg border border-slate-200 shadow-sm">
                <button
                  data-testid={`cart-dec-${it.product_id}`}
                  onClick={() => handleSetQty && handleSetQty(it.product_id, it.quantity - 1)}
                  className="p-2 hover:bg-slate-50 active:bg-slate-100 rounded-l-lg text-slate-600 transition-colors"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="px-2.5 sm:px-3 text-xs sm:text-sm font-mono-num font-semibold text-slate-800">
                  {it.quantity}
                </span>
                <button
                  data-testid={`cart-inc-${it.product_id}`}
                  onClick={() => handleSetQty && handleSetQty(it.product_id, it.quantity + 1)}
                  className="p-2 hover:bg-slate-50 active:bg-slate-100 rounded-r-lg text-slate-600 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center justify-end gap-2 ml-auto sm:ml-0">
                <div className="w-20 sm:w-24 text-right font-mono-num font-bold text-sm sm:text-base text-indigo-600">
                  {money(it.subtotal)}
                </div>
                <button
                  data-testid={`cart-rm-${it.product_id}`}
                  onClick={() => handleRemove && handleRemove(it.product_id)}
                  className="text-slate-400 hover:text-rose-500 p-1.5 rounded-lg active:scale-90 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <aside className="glass-strong p-4 sm:p-5 h-fit lg:sticky lg:top-24 space-y-3 rounded-2xl">
        <div className="label-cap">Order Summary</div>
        <div className="space-y-2">
          <CartRow label="Subtotal" value={money(subtotal)} />
          <CartRow label="Tax (5%)" value={money(tax)} />
        </div>
        <div className="border-t border-slate-200/80 pt-3 flex items-center justify-between">
          <span className="label-cap text-slate-700">Total</span>
          <span
            data-testid="cart-total"
            className="text-xl sm:text-2xl font-mono-num font-extrabold text-slate-900"
          >
            {money(total)}
          </span>
        </div>
        <Link
          to="/checkout"
          data-testid="checkout-link"
          className="btn-primary mt-3 w-full h-12 rounded-xl flex items-center justify-center gap-2 text-sm font-bold active:scale-[0.98] transition-transform shadow-md shadow-indigo-100"
        >
          Proceed to Checkout <ArrowRight className="w-4 h-4" />
        </Link>
        <Link
          to="/shop"
          className="mt-2 block text-center text-xs text-slate-500 hover:text-indigo-600 font-medium py-1"
        >
          Continue shopping
        </Link>
      </aside>
    </div>
  );
}

function CartRow({ label, value }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-mono-num font-medium text-slate-700">{value}</span>
    </div>
  );
}