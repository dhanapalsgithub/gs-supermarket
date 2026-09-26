import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Package, Search, Heart, ShoppingCart, Filter } from "lucide-react";
import { fetchProducts, fetchCategories, money, catTint, catLabel, addWishlist, fetchWishlist } from "../lib/api";
import { useAuth, useCart } from "../context/AuthContext";

export default function Shop() {
  const [products, setProducts] = useState([]);
  const [cats, setCats] = useState([]);
  const [activeCat, setActiveCat] = useState("ALL");
  const [q, setQ] = useState("");
  const [wish, setWish] = useState({}); // product_id → true
  const { user } = useAuth();
  const { add, items } = useCart();

  useEffect(() => {
    fetchProducts().then(setProducts).catch(() => {});
    fetchCategories().then(setCats).catch(() => {});
    if (user) fetchWishlist().then((w) => setWish(Object.fromEntries(w.map((x) => [x.product.id, true])))).catch(() => {});
  }, [user]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return products.filter((p) => {
      const mc = activeCat === "ALL" || p.category === activeCat;
      const mq = !t || p.name.toLowerCase().includes(t) || (p.barcode || "").includes(t);
      return mc && mq;
    });
  }, [products, activeCat, q]);

  const toggleWish = async (p) => {
    if (!user) return toast.error("Sign in to save wishlist");
    try {
      await addWishlist(p.id);
      setWish((w) => ({ ...w, [p.id]: true }));
      toast.success("Added to wishlist");
    } catch { toast.error("Failed"); }
  };

  const inCart = (id) => items.find((x) => x.product_id === id);

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      <header className="mb-6 flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="label-cap">Storefront</div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">Fresh picks for your kitchen</h1>
          <p className="text-slate-500 mt-1 text-sm">Free delivery over ₹499 · Pay on delivery or UPI</p>
        </div>
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            data-testid="shop-search"
            placeholder="Search groceries, snacks, brands…"
            className="field field-lg pl-10"
          />
        </div>
      </header>

      {/* Categories */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-4">
        {["ALL", ...cats].map((c) => (
          <button
            key={c}
            data-testid={`shop-cat-${c}`}
            onClick={() => setActiveCat(c)}
            className={`chip whitespace-nowrap ${activeCat === c ? "chip-on" : "chip-off"}`}
          >
            {catLabel(c)}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {filtered.map((p) => {
          const cart = inCart(p.id);
          return (
            <div key={p.id} data-testid={`shop-product-${p.id}`} className={`glass glass-hover p-4 relative ${catTint(p.category)}`}>
              <button
                onClick={() => toggleWish(p)}
                data-testid={`wish-${p.id}`}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/80 border border-white flex items-center justify-center hover:scale-110 transition-transform"
              >
                <Heart className={`w-4 h-4 ${wish[p.id] ? "fill-rose-500 text-rose-500" : "text-slate-500"}`} />
              </button>
              <div className="aspect-square rounded-xl bg-white/60 border border-white/70 flex items-center justify-center mb-3">
                <Package className="w-10 h-10 text-slate-400" />
              </div>
              <div className="label-cap">{catLabel(p.category)}</div>
              <div className="text-sm font-semibold leading-snug line-clamp-2 min-h-[2.5rem] mt-1">{p.name}</div>
              <div className="mt-2 flex items-end justify-between">
                <span className="text-lg font-mono-num font-extrabold text-indigo-600">{money(p.price)}</span>
                <span className="text-[10px] text-slate-500">{Math.floor(p.stock)} {p.unit || ""}</span>
              </div>
              <button
                onClick={() => { add(p); toast.success("Added to cart", { duration: 1000 }); }}
                data-testid={`add-cart-${p.id}`}
                className={`mt-3 w-full h-9 rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5 ${
                  cart ? "btn-ghost" : "btn-primary"
                }`}
              >
                <ShoppingCart className="w-4 h-4" />
                {cart ? `In cart · ${cart.quantity}` : "Add to cart"}
              </button>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="col-span-full text-center py-24 text-slate-400">
            <Filter className="w-10 h-10 mx-auto mb-3 opacity-50" />
            No products match your search
          </div>
        )}
      </div>

      <div className="mt-8 flex items-center justify-center">
        <Link to="/cart" data-testid="go-cart" className="btn-primary h-11 px-6 rounded-xl flex items-center gap-2">
          <ShoppingCart className="w-4 h-4" /> Review Cart
        </Link>
      </div>
    </div>
  );
}
