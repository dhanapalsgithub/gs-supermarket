import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Search, Barcode, Usb, CheckCircle2, Plus, Minus, Trash2,
  Printer, CreditCard, Wallet, QrCode, Package, Percent, User, X, ChevronLeft, ChevronRight
} from "lucide-react";
import { fetchProducts, fetchCategories, fetchByBarcode, createOrder, money, catLabel, catTint } from "../lib/api";
import { connectUsbPrinter, isUsbAvailable, isUsbConnected, printUsbReceipt, disconnectUsbPrinter } from "../lib/usbPrinter";
import ReceiptModal from "../components/ReceiptModal";
import { useAuth } from "../context/AuthContext";

const TAX_RATE = 0.05;
const PAGE_SIZE = 6;

export default function POS() {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [cats, setCats] = useState([]);
  const [activeCat, setActiveCat] = useState("ALL");
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [customer, setCustomer] = useState({ name: "", phone: "" });
  const [showCustomer, setShowCustomer] = useState(false);
  const [usbConnected, setUsbConnected] = useState(false);
  const [showPrinter, setShowPrinter] = useState(false);
  const [showPay, setShowPay] = useState(false);
  const [method, setMethod] = useState("CASH");
  const [amountPaid, setAmountPaid] = useState("");
  const [receipt, setReceipt] = useState(null);
  const [page, setPage] = useState(1);
  const scanRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const [p, c] = await Promise.all([fetchProducts(), fetchCategories()]);
      setProducts(p); setCats(c);
    } catch { toast.error("Failed to load products"); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      const mc = activeCat === "ALL" || p.category === activeCat;
      const mq = !q || p.name.toLowerCase().includes(q) || (p.barcode || "").includes(q);
      return mc && mq;
    });
  }, [products, activeCat, query]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;
  const paginatedProducts = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  useEffect(() => { setPage(1); }, [activeCat, query]);

  const addToCart = useCallback((p, qty = 1) => {
    setCart((c) => {
      const idx = c.findIndex((x) => x.product_id === p.id);
      if (idx >= 0) {
        const next = [...c];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + qty, subtotal: (next[idx].quantity + qty) * p.price };
        return next;
      }
      return [...c, { product_id: p.id, name: p.name, price: p.price, quantity: qty, subtotal: p.price * qty, unit: p.unit }];
    });
    toast.success(`Added ${p.name}`, { duration: 1000 });
  }, []);

  const updateQty = (id, delta) =>
    setCart((c) => c.map((it) => it.product_id === id ? { ...it, quantity: Math.max(0, it.quantity + delta), subtotal: Math.max(0, (it.quantity + delta) * it.price) } : it).filter((it) => it.quantity > 0));
  const removeItem = (id) => setCart((c) => c.filter((x) => x.product_id !== id));
  const clearCart = () => { setCart([]); setDiscount(0); setCustomer({ name: "", phone: "" }); };

  const subtotal = cart.reduce((s, it) => s + it.subtotal, 0);
  const totalQuantity = cart.reduce((sum, item) => sum + item.quantity, 0);
  const tax = subtotal * TAX_RATE;
  const total = Math.max(0, subtotal + tax - Number(discount || 0));
  const changeDue = Math.max(0, Number(amountPaid || 0) - total);

  const processBarcode = useCallback((codeText) => {
    const code = codeText.trim();
    if (!code) return;
    const local = products.find((p) => p.barcode === code);
    if (local) { addToCart(local); setQuery(""); return true; }
    return false;
  }, [products, addToCart]);

  const submitScan = async (e) => {
    e.preventDefault();
    const code = query.trim(); 
    if (!code) return;
    if (processBarcode(code)) return;
    if (/^\d{3,}$/.test(code)) {
      try { const p = await fetchByBarcode(code); addToCart(p); setQuery(""); return; } catch {}
    }
    const first = filtered[0];
    if (first && filtered.length === 1) { addToCart(first); setQuery(""); return; }
    toast.error("Product not found");
  };

  const handleQueryChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    if (val.length >= 4) {
      const match = products.find((p) => p.barcode === val.trim());
      if (match) { addToCart(match); setQuery(""); }
    }
  };

  const openPay = () => {
    if (cart.length === 0) return toast.error("Cart is empty");
    setAmountPaid(total.toFixed(2)); setShowPay(true);
  };

  const finalize = async () => {
    if (method === "CASH" && Number(amountPaid) < total) return toast.error("Insufficient cash");
    try {
      const order = await createOrder({
        items: cart.map((c) => ({ product_id: c.product_id, name: c.name, price: c.price, quantity: c.quantity, subtotal: c.subtotal })),
        subtotal, tax_rate: TAX_RATE, tax_amount: tax, discount: Number(discount || 0), total,
        payment_method: method, amount_paid: Number(amountPaid || total), change_due: changeDue,
        customer_name: customer.name || null, customer_phone: customer.phone || null,
        channel: "POS", order_type: "STORE_BILL", cashier: user?.name || "Cashier",
      });
      if (usbConnected && isUsbConnected()) {
        try { await printUsbReceipt(order); } catch {}
      }
      setReceipt(order);
      setShowPay(false); clearCart(); load();
      toast.success("Store Bill Generated Successfully");
    } catch { toast.error("Failed to record sale"); }
  };

  const handlePhoneChange = async (e) => {
    const phoneVal = e.target.value;
    setCustomer(prev => ({ ...prev, phone: phoneVal }));
    if (phoneVal.trim().length >= 10) {
      try {
        const res = await fetch(`/api/orders?phone=${phoneVal.trim()}`);
        if (res.ok) {
          const orders = await res.json();
          const matchedOrder = orders.find(o => o.customer_phone === phoneVal.trim() && o.customer_name);
          if (matchedOrder) {
            setCustomer(prev => ({ ...prev, name: matchedOrder.customer_name }));
          }
        }
      } catch {}
    }
  };

  return (
    <div className="h-full flex flex-col">
      <header className="h-16 shrink-0 flex items-center px-4 md:px-6 border-b border-white/50 glass rounded-none">
        <form onSubmit={submitScan} className="flex-1 max-w-2xl relative">
          <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-500" />
          <input
            ref={scanRef} value={query} onChange={handleQueryChange}
            placeholder="Scan Barcode / Search Product (Store Bill)…"
            className="w-full h-11 pl-11 pr-4 rounded-xl bg-white border border-slate-200 outline-none text-sm font-mono-num"
          />
        </form>
      </header>

      <div className="flex-1 min-h-0 grid grid-cols-12">
        <section className="col-span-12 lg:col-span-8 border-r border-white/50 flex flex-col min-h-0">
          <div className="px-4 md:px-6 py-4 flex gap-2 overflow-x-auto">
            {["ALL", ...cats].map((c) => (
              <button key={c} onClick={() => setActiveCat(c)} className={`chip whitespace-nowrap ${activeCat === c ? "chip-on" : "chip-off"}`}>
                {catLabel(c)}
              </button>
            ))}
          </div>
          
          <div className="flex-1 overflow-y-auto px-4 md:px-6 pb-2 flex flex-col justify-between">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {paginatedProducts.map((p) => (
                <button key={p.id} onClick={() => addToCart(p)} className={`glass glass-hover text-left p-4 relative ${catTint(p.category)}`}>
                  <div className="aspect-square rounded-xl bg-white/60 border border-white/70 flex items-center justify-center mb-3 relative overflow-hidden">
                    {p.image_hint ? (
                      <img src={p.image_hint} alt={p.name} className="w-full h-full object-cover" onError={(e)=>{e.target.style.display='none'}} />
                    ) : (
                      <Package className="w-8 h-8 text-slate-400" />
                    )}
                    <span className="absolute top-2 right-2 text-[10px] px-2 py-0.5 rounded-full bg-white/80 border text-slate-700 font-semibold">
                      {p.stock > 0 ? `${Math.floor(p.stock)} ${p.unit || ""}` : "OOS"}
                    </span>
                  </div>
                  <div className="label-cap">{catLabel(p.category)}</div>
                  <div className="text-sm font-semibold leading-snug line-clamp-2 min-h-[2.5rem] mt-1">{p.name}</div>
                  <div className="mt-2 flex items-baseline">
                    <span className="text-lg font-mono-num font-extrabold text-indigo-600">{money(p.price)}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>

        <aside className="col-span-12 lg:col-span-4 flex flex-col min-h-0 bg-white/40">
          <div className="p-4 border-b border-white/50 flex items-center justify-between">
            <div>
              <div className="label-cap">Store Counter Bill</div>
              <div className="text-lg font-extrabold">Live Cart <span className="text-indigo-500 font-mono-num">#{cart.length}</span></div>
            </div>
            <button onClick={() => setShowCustomer(true)} className="chip chip-off flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" /> {customer.name ? customer.name.split(" ")[0] + "..." : "Customer"}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {cart.map((it) => (
              <div key={it.product_id} className="glass p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{it.name}</div>
                    <div className="text-[11px] text-slate-500 font-mono-num">{money(it.price)} × {it.quantity}</div>
                  </div>
                  <button onClick={() => removeItem(it.product_id)} className="text-slate-400 hover:text-rose-500"><Trash2 className="w-4 h-4" /></button>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="inline-flex items-center bg-white rounded-lg border">
                    <button onClick={() => updateQty(it.product_id, -1)} className="p-2"><Minus className="w-4 h-4" /></button>
                    <span className="px-3 text-sm font-mono-num font-semibold">{it.quantity}</span>
                    <button onClick={() => updateQty(it.product_id, 1)} className="p-2"><Plus className="w-4 h-4" /></button>
                  </div>
                  <div className="text-sm font-mono-num font-bold text-indigo-600">{money(it.subtotal)}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-white/50 p-4 space-y-2 text-sm bg-white/50">
            <div className="flex items-center justify-between"><span className="text-slate-500">Subtotal</span><span className="font-mono-num">{money(subtotal)}</span></div>
            <div className="flex items-center justify-between"><span className="text-slate-500">Tax (5%)</span><span className="font-mono-num">{money(tax)}</span></div>
            <div className="pt-2 flex items-end justify-between border-t border-dashed">
              <span className="label-cap">Grand Total</span>
              <span className="text-2xl font-mono-num font-extrabold">{money(total)}</span>
            </div>
          </div>

          <div className="border-t border-white/50 p-4 bg-white/60">
            <button onClick={openPay} disabled={cart.length === 0} className="btn-primary w-full h-14 rounded-xl font-bold flex items-center justify-center gap-3">
              <Printer className="w-5 h-5" /> Generate Store Bill · Checkout
            </button>
          </div>
        </aside>
      </div>

      {showPay && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md glass-strong p-6 space-y-4">
            <div className="text-lg font-extrabold">Confirm Payment</div>
            <div className="flex justify-between text-sm"><span className="text-slate-500">Total</span><span className="font-mono-num font-bold text-lg">{money(total)}</span></div>
            <label className="block">
              <span className="text-xs text-slate-500">Amount received</span>
              <input type="number" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} className="field mt-1 font-mono-num" />
            </label>
            <button onClick={finalize} className="btn-primary w-full h-12 rounded-xl flex items-center justify-center gap-2">
              <CheckCircle2 className="w-5 h-5" /> Confirm & Print Store Bill
            </button>
          </div>
        </div>
      )}

      {showCustomer && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md glass-strong p-6 space-y-4">
            <div className="text-lg font-extrabold">Customer Info</div>
            <input placeholder="Phone number..." value={customer.phone} onChange={handlePhoneChange} className="field font-mono-num" />
            <input placeholder="Customer name" value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} className="field" />
            <button onClick={() => setShowCustomer(false)} className="btn-primary w-full h-11 rounded-xl">Save Customer</button>
          </div>
        </div>
      )}

      {receipt && <ReceiptModal sale={receipt} onClose={() => setReceipt(null)} />}
    </div>
  );
}
