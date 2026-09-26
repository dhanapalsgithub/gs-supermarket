import { useEffect, useState } from "react";
import { fetchWishlist, removeWishlist, money, catLabel, catTint } from "../lib/api";
import { useCart } from "../context/AuthContext";
import { Heart, ShoppingCart, Trash2, Package } from "lucide-react";
import { toast } from "sonner";

export default function Wishlist() {
  const [items, setItems] = useState([]);
  const { add } = useCart();

  const load = () => fetchWishlist().then(setItems).catch(() => {});
  useEffect(load, []);

  const remove = async (pid) => { await removeWishlist(pid); load(); };
  const addAll = () => { items.forEach((w) => add(w.product)); toast.success("Added to cart"); };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8">
      <header className="flex items-end justify-between mb-6">
        <div>
          <div className="label-cap">Saved for later</div>
          <h1 className="text-3xl font-extrabold flex items-center gap-2"><Heart className="w-7 h-7 text-rose-500" /> My Wishlist</h1>
        </div>
        {items.length > 0 && (
          <button data-testid="wish-add-all" onClick={addAll} className="btn-primary h-11 px-5 rounded-xl flex items-center gap-2">
            <ShoppingCart className="w-4 h-4" /> Add all to cart
          </button>
        )}
      </header>

      {items.length === 0 ? (
        <div className="glass p-12 text-center text-slate-500">
          <Heart className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          Your wishlist is empty
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((w) => (
            <div key={w.wishlist_id} data-testid={`wish-item-${w.product.id}`} className={`glass glass-hover p-4 relative ${catTint(w.product.category)}`}>
              <button data-testid={`wish-remove-${w.product.id}`} onClick={() => remove(w.product.id)} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/80 border border-white flex items-center justify-center hover:bg-rose-50">
                <Trash2 className="w-4 h-4 text-rose-500" />
              </button>
              <div className="aspect-square rounded-xl bg-white/60 border border-white/70 flex items-center justify-center mb-3">
                <Package className="w-10 h-10 text-slate-400" />
              </div>
              <div className="label-cap">{catLabel(w.product.category)}</div>
              <div className="text-sm font-semibold line-clamp-2 min-h-[2.5rem] mt-1">{w.product.name}</div>
              <div className="mt-2 text-lg font-mono-num font-extrabold text-indigo-600">{money(w.product.price)}</div>
              <button
                data-testid={`wish-toCart-${w.product.id}`}
                onClick={() => { add(w.product); toast.success("Added to cart"); }}
                className="btn-primary w-full mt-3 h-9 rounded-lg text-sm flex items-center justify-center gap-1.5"
              >
                <ShoppingCart className="w-4 h-4" /> Add to cart
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
