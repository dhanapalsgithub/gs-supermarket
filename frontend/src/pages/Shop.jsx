import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Package, Search, Heart, ShoppingCart, Filter, Megaphone, Tag } from "lucide-react";
import { fetchProducts, fetchCategories, money, catTint, catLabel, addWishlist, fetchWishlist } from "../lib/api";
import { useAuth, useCart } from "../context/AuthContext";

function UserOffersBanner() {
  const [offers, setOffers] = useState([]);
  useEffect(() => {
    fetch("/api/offers/active")
      .then((res) => res.json())
      .then((data) => { if (Array.isArray(data)) setOffers(data); })
      .catch(() => {});
  }, []);
  if (offers.length === 0) return null;
  return (
    <div className="mb-6 space-y-3">
      {offers.map((offer) => (
        <div key={offer.id || offer.created_at} className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-4 rounded-2xl shadow-md flex items-start gap-3">
          <div className="bg-white/20 p-2 rounded-xl mt-0.5"><Megaphone className="w-5 h-5 text-white animate-pulse" /></div>
          <div className="flex-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-200 mb-1">
              <Tag className="w-3.5 h-3.5" /> Special Offer
            </div>
            <p className="text-sm font-medium leading-relaxed">{offer.message}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Shop() {
  const [products, setProducts] = useState([]);
  const [cats, setCats] = useState([]);
  const [activeCat, setActiveCat] = useState("ALL");
  const [q, setQ] = useState("");
  const [wish, setWish] = useState({});
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
      <UserOffersBanner />
      <header className="mb-6 flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="label-cap">Storefront</div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">Fresh picks for your kitchen</h1>
        </div>
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search groceries..." className="field field-lg pl-10" />
        </div>
      </header>

      <div className="flex gap-2 overflow-x-auto pb-3 mb-4">
        {["ALL", ...cats].map((c) => (
          <button key={c} onClick={() => setActiveCat(c)} className={`chip whitespace-nowrap ${activeCat === c ? "chip-on" : "chip-off"}`}>
            {catLabel(c)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {filtered.map((p) => {
          const cart = inCart(p.id);
          return (
            <div key={p.id} className={`glass glass-hover p-4 relative ${catTint(p.category)}`}>
              <button onClick={() => toggleWish(p)} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/85 flex items-center justify-center z-10">
                <Heart className={`w-4 h-4 ${wish[p.id] ? "fill-rose-500 text-rose-500" : "text-slate-500"}`} />
              </button>
              <div className="aspect-square rounded-xl bg-white/60 border border-white/70 flex items-center justify-center mb-3 overflow-hidden relative">
                {p.image_hint ? (
                  <img src={p.image_hint} alt={p.name} className="w-full h-full object-cover" onError={(e)=>{e.target.style.display='none'}} />
                ) : (
                  <Package className="w-10 h-10 text-slate-400" />
                )}
              </div>
              <div className="label-cap">{catLabel(p.category)}</div>
              <div className="text-sm font-semibold leading-snug line-clamp-2 min-h-[2.5rem] mt-1">{p.name}</div>
              <div className="mt-2 flex items-end justify-between">
                <span className="text-lg font-mono-num font-extrabold text-indigo-600">{money(p.price)}</span>
              </div>
              <button onClick={() => { add(p); toast.success("Added to cart"); }} className={`mt-3 w-full h-9 rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5 ${cart ? "btn-ghost" : "btn-primary"}`}>
                <ShoppingCart className="w-4 h-4" /> {cart ? `In cart (${cart.quantity})` : "Add to cart"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}