import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Search, Barcode, Bluetooth, BluetoothConnected, Plus, Minus, Trash2,
  Printer, CreditCard, Wallet, QrCode, Package, Percent, User, X, CheckCircle2
} from "lucide-react";
import { fetchProducts, fetchCategories, fetchByBarcode, createSale, money } from "../lib/api";
import ReceiptModal from "../components/ReceiptModal";

const CATEGORY_META = {
  ALL: { label: "All Items", tint: "from-indigo-500/20 to-indigo-500/5" },
  GROCERY: { label: "Grocery", tint: "from-amber-500/20 to-amber-500/5" },
  SNACKS: { label: "Snacks", tint: "from-rose-500/20 to-rose-500/5" },
  BEVERAGES: { label: "Beverages", tint: "from-sky-500/20 to-sky-500/5" },
  FOOD_PRODUCTS: { label: "Dairy", tint: "from-emerald-500/20 to-emerald-500/5" },
  PERSONAL_CARE: { label: "Personal Care", tint: "from-fuchsia-500/20 to-fuchsia-500/5" },
  HOME_CLEANING: { label: "Home Care", tint: "from-cyan-500/20 to-cyan-500/5" },
  STATIONERY: { label: "Stationery", tint: "from-violet-500/20 to-violet-500/5" },
  HEALTH_CARE: { label: "Health", tint: "from-teal-500/20 to-teal-500/5" },
  ADHESIVES: { label: "Adhesives", tint: "from-orange-500/20 to-orange-500/5" },
  HOME_APPLIANCES: { label: "Appliances", tint: "from-blue-500/20 to-blue-500/5" },
};

const catLabel = (c) => CATEGORY_META[c]?.label || c;
const catTint = (c) => CATEGORY_META[c]?.tint || "from-slate-500/20 to-slate-500/5";

const TAX_RATE = 0.05;

export default function POS() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCat, setActiveCat] = useState("ALL");
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [customer, setCustomer] = useState({ name: "", phone: "" });
  const [showCustomer, setShowCustomer] = useState(false);
  const [printerConnected, setPrinterConnected] = useState(true);
  const [showPrinterModal, setShowPrinterModal] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [amountPaid, setAmountPaid] = useState("");
  const [receipt, setReceipt] = useState(null);
  const scanRef = useRef(null);

  const loadProducts = useCallback(async () => {
    try {
      const [prods, cats] = await Promise.all([fetchProducts(), fetchCategories()]);
      setProducts(prods);
      setCategories(cats);
    } catch (e) {
      toast.error("Failed to load products");
    }
  }, []);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  // Auto-focus scanner input (also on any click outside inputs)
  useEffect(() => {
    scanRef.current?.focus();
    const handler = (e) => {
      const t = e.target;
      if (t?.tagName === "INPUT" || t?.tagName === "TEXTAREA" || t?.getAttribute?.("contenteditable") === "true") return;
      if (t?.closest?.("[data-no-refocus]")) return;
      scanRef.current?.focus();
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      const matchCat = activeCat === "ALL" || p.category === activeCat;
      const matchQ = !q || p.name.toLowerCase().includes(q) || (p.barcode || "").toLowerCase().includes(q);
      return matchCat && matchQ;
    });
  }, [products, activeCat, query]);

  const addToCart = (p, qty = 1) => {
    setCart((c) => {
      const idx = c.findIndex((x) => x.product_id === p.id);
      if (idx >= 0) {
        const next = [...c];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + qty, subtotal: (next[idx].quantity + qty) * p.price };
        return next;
      }
      return [...c, { product_id: p.id, name: p.name, price: p.price, quantity: qty, subtotal: p.price * qty, unit: p.unit, barcode: p.barcode }];
    });
    toast.success(`Added ${p.name}`, { duration: 1200 });
  };

  const updateQty = (id, delta) => {
    setCart((c) =>
      c
        .map((it) =>
          it.product_id === id ? { ...it, quantity: Math.max(0, it.quantity + delta), subtotal: Math.max(0, (it.quantity + delta) * it.price) } : it
        )
        .filter((it) => it.quantity > 0)
    );
  };

  const removeItem = (id) => setCart((c) => c.filter((x) => x.product_id !== id));
  const clearCart = () => { setCart([]); setDiscount(0); setCustomer({ name: "", phone: "" }); };

  const subtotal = cart.reduce((s, it) => s + it.subtotal, 0);
  const taxAmount = subtotal * TAX_RATE;
  const total = Math.max(0, subtotal + taxAmount - Number(discount || 0));
  const changeDue = Math.max(0, Number(amountPaid || 0) - total);

  const handleBarcodeSubmit = async (e) => {
    e.preventDefault();
    const code = query.trim();
    if (!code) return;
    // First try local match
    const local = products.find((p) => p.barcode === code);
    if (local) { addToCart(local); setQuery(""); return; }
    // Only hit barcode endpoint for numeric codes to avoid noisy 404s
    if (/^\d{3,}$/.test(code)) {
      try {
        const p = await fetchByBarcode(code);
        addToCart(p); setQuery(""); return;
      } catch { /* fall through to search */ }
    }
    const first = filtered[0];
    if (first) { addToCart(first); setQuery(""); return; }
    toast.error("Product not found");
  };

  const openPayment = () => {
    if (cart.length === 0) return toast.error("Cart is empty");
    setAmountPaid(total.toFixed(2));
    setShowPayment(true);
  };

  const finalizeSale = async () => {
    if (paymentMethod === "CASH" && Number(amountPaid) < total) {
      return toast.error("Insufficient cash");
    }
    try {
      const sale = await createSale({
        items: cart.map((c) => ({
          product_id: c.product_id, name: c.name, price: c.price, quantity: c.quantity, subtotal: c.subtotal,
        })),
        subtotal, tax_rate: TAX_RATE, tax_amount: taxAmount, discount: Number(discount || 0), total,
        payment_method: paymentMethod, amount_paid: Number(amountPaid || total), change_due: changeDue,
        customer_name: customer.name || null, customer_phone: customer.phone || null,
      });
      setReceipt({ ...sale, printer: printerConnected ? "Milestone Y50 - 58mm" : null });
      setShowPayment(false);
      clearCart();
      loadProducts();
      toast.success("Payment successful", { icon: <CheckCircle2 className="w-4 h-4" /> });
    } catch (e) {
      toast.error("Failed to record sale");
    }
  };

  const allCats = ["ALL", ...categories];

  return (
    <div className="h-screen flex flex-col">
      {/* Top bar */}
      <header className="h-16 shrink-0 flex items-center px-4 md:px-6 border-b border-white/5 bg-[#12121F]/80 backdrop-blur">
        <form onSubmit={handleBarcodeSubmit} className="flex-1 max-w-2xl relative" data-no-refocus>
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-300">
            <Barcode className="w-5 h-5" />
          </div>
          <input
            ref={scanRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Scan Barcode / Search Product…"
            data-testid="scan-input"
            autoFocus
            className="w-full h-11 pl-11 pr-4 rounded-xl bg-[#0B0B14] border border-white/10 focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm font-mono-num placeholder:text-slate-500"
          />
        </form>
        <div className="ml-auto flex items-center gap-3">
          <button
            data-testid="printer-toggle-btn"
            onClick={() => setShowPrinterModal(true)}
            className="hidden sm:flex items-center gap-2 h-11 px-3 rounded-xl bg-[#0B0B14] border border-white/10 hover:border-indigo-400/40 transition-colors"
          >
            {printerConnected ? <BluetoothConnected className="w-4 h-4 text-emerald-400" /> : <Bluetooth className="w-4 h-4 text-slate-400" />}
            <div className="text-left">
              <div className="text-[10px] uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                {printerConnected && <span className="pulse-dot" />} Printer
              </div>
              <div className="text-xs font-medium text-slate-100">Milestone Y50 · 58mm</div>
            </div>
          </button>
        </div>
      </header>

      {/* Body: 2 columns */}
      <div className="flex-1 min-h-0 grid grid-cols-12">
        {/* LEFT - product grid */}
        <section className="col-span-12 lg:col-span-8 xl:col-span-8 border-r border-white/5 flex flex-col min-h-0">
          {/* Categories */}
          <div className="px-4 md:px-6 py-4 flex gap-2 overflow-x-auto pos-grid-scroll" data-no-refocus>
            {allCats.map((c) => (
              <button
                key={c}
                data-testid={`cat-${c}`}
                onClick={() => setActiveCat(c)}
                className={`px-4 py-2 rounded-full text-xs font-semibold tracking-wide whitespace-nowrap border transition-all ${
                  activeCat === c
                    ? "bg-indigo-500 text-white border-indigo-400 shadow-lg shadow-indigo-500/25"
                    : "bg-white/[0.03] text-slate-300 border-white/10 hover:border-indigo-400/40 hover:text-white"
                }`}
              >
                {catLabel(c)}
              </button>
            ))}
          </div>

          {/* Products grid */}
          <div className="flex-1 overflow-y-auto px-4 md:px-6 pb-6 pos-grid-scroll">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
              {filtered.map((p) => (
                <button
                  key={p.id}
                  data-testid={`product-${p.id}`}
                  onClick={() => addToCart(p)}
                  className={`card-hover text-left rounded-2xl bg-gradient-to-b ${catTint(p.category)} p-3 border border-white/5 hover:border-indigo-400/50 relative`}
                >
                  <div className="aspect-square rounded-xl bg-black/30 border border-white/5 flex items-center justify-center mb-3">
                    <Package className="w-8 h-8 text-white/40" />
                    <span className="absolute top-2 right-2 text-[10px] px-2 py-0.5 rounded-full bg-black/40 border border-white/10 text-slate-300">
                      {p.stock > 0 ? `${Math.floor(p.stock)} ${p.unit || ""}` : "OOS"}
                    </span>
                  </div>
                  <div className="text-[11px] uppercase tracking-widest text-slate-400 mb-1">
                    {catLabel(p.category)}
                  </div>
                  <div className="text-sm font-semibold leading-snug line-clamp-2 min-h-[2.5rem]">{p.name}</div>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-lg font-mono-num font-bold text-indigo-300">{money(p.price)}</span>
                  </div>
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="col-span-full text-center py-16 text-slate-500">
                  <Package className="w-10 h-10 mx-auto mb-3 opacity-40" />
                  No products found
                </div>
              )}
            </div>
          </div>
        </section>

        {/* RIGHT - Cart */}
        <aside className="col-span-12 lg:col-span-4 xl:col-span-4 flex flex-col bg-[#0F0F1A] min-h-0" data-no-refocus>
          {/* Cart header */}
          <div className="p-4 md:p-5 border-b border-white/5 flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-slate-400">Current Bill</div>
              <div className="text-lg font-bold">Live Cart <span className="text-indigo-400 font-mono-num">#{cart.length}</span></div>
            </div>
            <button
              onClick={() => setShowCustomer(true)}
              data-testid="add-customer-btn"
              className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:border-indigo-400/40 text-xs flex items-center gap-2"
            >
              <User className="w-4 h-4" />
              {customer.name ? customer.name.split(" ")[0] : "Add Customer"}
            </button>
          </div>

          {/* Cart items */}
          <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-2 pos-grid-scroll">
            {cart.length === 0 && (
              <div className="text-center py-16 text-slate-500">
                <Barcode className="w-10 h-10 mx-auto mb-3 opacity-40" />
                Scan or tap a product to begin
              </div>
            )}
            {cart.map((it) => (
              <div key={it.product_id} className="rounded-xl bg-[#171729] border border-white/5 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{it.name}</div>
                    <div className="text-[11px] text-slate-400 font-mono-num">{money(it.price)} × {it.quantity}</div>
                  </div>
                  <button data-testid={`remove-${it.product_id}`} onClick={() => removeItem(it.product_id)} className="text-slate-500 hover:text-rose-400">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="inline-flex items-center bg-black/30 rounded-lg border border-white/5">
                    <button data-testid={`dec-${it.product_id}`} onClick={() => updateQty(it.product_id, -1)} className="p-2 hover:bg-white/5 rounded-l-lg">
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="px-3 text-sm font-mono-num font-semibold">{it.quantity}</span>
                    <button data-testid={`inc-${it.product_id}`} onClick={() => updateQty(it.product_id, 1)} className="p-2 hover:bg-white/5 rounded-r-lg">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="text-sm font-mono-num font-bold text-indigo-300">{money(it.subtotal)}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="border-t border-white/5 p-4 md:p-5 space-y-2 text-sm">
            <Row label="Subtotal" value={money(subtotal)} />
            <Row label={`Tax (${(TAX_RATE * 100).toFixed(0)}%)`} value={money(taxAmount)} />
            <div className="flex items-center justify-between">
              <label className="text-slate-400 flex items-center gap-1"><Percent className="w-3.5 h-3.5" /> Discount</label>
              <input
                data-testid="discount-input"
                type="number" min="0"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                className="w-24 h-8 px-2 rounded-md bg-black/30 border border-white/10 text-right font-mono-num text-sm outline-none focus:border-indigo-400/50"
              />
            </div>
            <div className="pt-2 flex items-end justify-between border-t border-dashed border-white/10">
              <span className="text-slate-400 text-xs uppercase tracking-widest">Grand Total</span>
              <span data-testid="grand-total" className="text-2xl font-mono-num font-extrabold text-white">{money(total)}</span>
            </div>
          </div>

          {/* Payments */}
          <div className="border-t border-white/5 p-4 md:p-5">
            <div className="grid grid-cols-3 gap-2 mb-3">
              <PayBtn tid="pay-cash" active={paymentMethod === "CASH"} onClick={() => setPaymentMethod("CASH")} icon={<Wallet className="w-4 h-4" />} label="Cash" />
              <PayBtn tid="pay-upi" active={paymentMethod === "UPI"} onClick={() => setPaymentMethod("UPI")} icon={<QrCode className="w-4 h-4" />} label="UPI/QR" />
              <PayBtn tid="pay-card" active={paymentMethod === "CARD"} onClick={() => setPaymentMethod("CARD")} icon={<CreditCard className="w-4 h-4" />} label="Card" />
            </div>
            <button
              data-testid="checkout-btn"
              onClick={openPayment}
              disabled={cart.length === 0}
              className="w-full h-14 rounded-xl bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-bold tracking-wide flex items-center justify-center gap-3 shadow-lg shadow-indigo-500/30"
            >
              <Printer className="w-5 h-5" />
              Print Bill · Checkout
            </button>
          </div>
        </aside>
      </div>

      {/* Payment Modal */}
      {showPayment && (
        <Modal onClose={() => setShowPayment(false)} testid="payment-modal">
          <div className="p-6">
            <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">Confirm Payment</div>
            <div className="text-2xl font-bold mb-6">
              {paymentMethod === "CASH" ? "Cash Payment" : paymentMethod === "UPI" ? "UPI / QR Payment" : "Card Payment"}
            </div>

            {paymentMethod === "UPI" && (
              <div className="mb-6 rounded-xl bg-white p-6 flex items-center justify-center">
                <div className="w-40 h-40 grid grid-cols-8 grid-rows-8 gap-[2px] bg-white p-2">
                  {Array.from({ length: 64 }).map((_, i) => (
                    <div key={i} className={((i * 7 + 3) % 5 < 2 || i === 0 || i === 7 || i === 56 || i === 63) ? "bg-black" : "bg-white"} />
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-sm"><span className="text-slate-400">Total</span><span className="font-mono-num font-bold text-lg">{money(total)}</span></div>
              {paymentMethod === "CASH" && (
                <>
                  <label className="block">
                    <span className="text-xs text-slate-400">Amount received</span>
                    <input
                      data-testid="amount-paid-input"
                      type="number" min="0"
                      value={amountPaid}
                      onChange={(e) => setAmountPaid(e.target.value)}
                      className="mt-1 w-full h-12 px-3 rounded-lg bg-black/40 border border-white/10 focus:border-indigo-400/50 outline-none font-mono-num text-lg"
                    />
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {[100, 200, 500, 1000, 2000].map((v) => (
                      <button key={v} onClick={() => setAmountPaid(String(v))} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:border-indigo-400/40 text-xs font-mono-num">
                        ₹{v}
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-between text-sm pt-2 border-t border-white/10">
                    <span className="text-slate-400">Change due</span>
                    <span data-testid="change-due" className="font-mono-num font-bold text-emerald-400">{money(changeDue)}</span>
                  </div>
                </>
              )}
            </div>

            <button
              data-testid="confirm-payment-btn"
              onClick={finalizeSale}
              className="w-full h-12 rounded-xl bg-indigo-500 hover:bg-indigo-400 font-bold flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-5 h-5" /> Confirm & Print
            </button>
          </div>
        </Modal>
      )}

      {/* Customer modal */}
      {showCustomer && (
        <Modal onClose={() => setShowCustomer(false)} testid="customer-modal">
          <div className="p-6 space-y-4">
            <div className="text-lg font-bold">Customer Info</div>
            <input
              data-testid="cust-name" placeholder="Customer name" value={customer.name}
              onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
              className="w-full h-11 px-3 rounded-lg bg-black/40 border border-white/10 focus:border-indigo-400/50 outline-none"
            />
            <input
              data-testid="cust-phone" placeholder="Phone number" value={customer.phone}
              onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
              className="w-full h-11 px-3 rounded-lg bg-black/40 border border-white/10 focus:border-indigo-400/50 outline-none font-mono-num"
            />
            <button onClick={() => setShowCustomer(false)} className="w-full h-11 rounded-lg bg-indigo-500 hover:bg-indigo-400 font-semibold">Save</button>
          </div>
        </Modal>
      )}

      {/* Printer modal */}
      {showPrinterModal && (
        <Modal onClose={() => setShowPrinterModal(false)} testid="printer-modal">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center">
                <Printer className="w-6 h-6 text-indigo-300" />
              </div>
              <div>
                <div className="text-lg font-bold">Thermal Printer</div>
                <div className="text-xs text-slate-400">Milestone Y50 · FCC ID: 2A6FW-Y50</div>
              </div>
            </div>
            <div className="rounded-xl bg-black/30 border border-white/5 p-4 space-y-2 text-sm mb-5">
              <div className="flex justify-between"><span className="text-slate-400">Status</span>
                <span className={printerConnected ? "text-emerald-400 flex items-center gap-2" : "text-slate-400"}>
                  {printerConnected && <span className="pulse-dot" />} {printerConnected ? "Connected" : "Disconnected"}
                </span>
              </div>
              <div className="flex justify-between"><span className="text-slate-400">Model</span><span>Milestone Y50</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Paper Width</span><span>58 mm</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Interface</span><span>Bluetooth</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Power</span><span>5V ~ 1A</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Barcode Scanner</span><span>USB HID (Auto)</span></div>
            </div>
            <button
              data-testid="toggle-printer-conn"
              onClick={() => { setPrinterConnected((c) => !c); toast.success(printerConnected ? "Printer disconnected" : "Connected to Milestone Y50"); }}
              className={`w-full h-11 rounded-lg font-semibold ${printerConnected ? "bg-white/5 border border-white/10 hover:border-rose-400/40" : "bg-indigo-500 hover:bg-indigo-400"}`}
            >
              {printerConnected ? "Disconnect Printer" : "Connect Printer"}
            </button>
          </div>
        </Modal>
      )}

      {receipt && <ReceiptModal sale={receipt} onClose={() => setReceipt(null)} />}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-400">{label}</span>
      <span className="font-mono-num">{value}</span>
    </div>
  );
}

function PayBtn({ active, onClick, icon, label, tid }) {
  return (
    <button
      data-testid={tid}
      onClick={onClick}
      className={`h-12 rounded-xl border flex flex-col items-center justify-center gap-0.5 text-xs font-semibold transition-all ${
        active
          ? "bg-indigo-500/15 border-indigo-400/50 text-indigo-200"
          : "bg-white/[0.03] border-white/10 hover:border-indigo-400/30"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function Modal({ children, onClose, testid }) {
  return (
    <div data-testid={testid} data-no-refocus className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-[#12121F] border border-white/10 shadow-2xl relative animate-in fade-in">
        <button onClick={onClose} className="absolute top-3 right-3 p-2 rounded-lg hover:bg-white/5">
          <X className="w-4 h-4" />
        </button>
        {children}
      </div>
    </div>
  );
}
