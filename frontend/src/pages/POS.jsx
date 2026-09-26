import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Search, Barcode, Bluetooth, BluetoothConnected, Plus, Minus, Trash2,
  Printer, CreditCard, Wallet, QrCode, Package, Percent, User, X, CheckCircle2
} from "lucide-react";
import { fetchProducts, fetchCategories, fetchByBarcode, createOrder, money, catLabel, catTint } from "../lib/api";
import { connectPrinter, isBleAvailable, isConnected, printReceipt, disconnectPrinter } from "../lib/bluetooth";
import ReceiptModal from "../components/ReceiptModal";
import { useAuth } from "../context/AuthContext";

const TAX_RATE = 0.05;

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
  const [btConnected, setBtConnected] = useState(false);
  const [showPrinter, setShowPrinter] = useState(false);
  const [showPay, setShowPay] = useState(false);
  const [method, setMethod] = useState("CASH");
  const [amountPaid, setAmountPaid] = useState("");
  const [receipt, setReceipt] = useState(null);
  const scanRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const [p, c] = await Promise.all([fetchProducts(), fetchCategories()]);
      setProducts(p); setCats(c);
    } catch { toast.error("Failed to load products"); }
  }, []);

  useEffect(() => { load(); }, [load]);

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
      const mc = activeCat === "ALL" || p.category === activeCat;
      const mq = !q || p.name.toLowerCase().includes(q) || (p.barcode || "").includes(q);
      return mc && mq;
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
      return [...c, { product_id: p.id, name: p.name, price: p.price, quantity: qty, subtotal: p.price * qty, unit: p.unit }];
    });
    toast.success(`Added ${p.name}`, { duration: 1000 });
  };
  const updateQty = (id, delta) =>
    setCart((c) => c.map((it) => it.product_id === id ? { ...it, quantity: Math.max(0, it.quantity + delta), subtotal: Math.max(0, (it.quantity + delta) * it.price) } : it).filter((it) => it.quantity > 0));
  const removeItem = (id) => setCart((c) => c.filter((x) => x.product_id !== id));
  const clearCart = () => { setCart([]); setDiscount(0); setCustomer({ name: "", phone: "" }); };

  const subtotal = cart.reduce((s, it) => s + it.subtotal, 0);
  const tax = subtotal * TAX_RATE;
  const total = Math.max(0, subtotal + tax - Number(discount || 0));
  const changeDue = Math.max(0, Number(amountPaid || 0) - total);

  const submitScan = async (e) => {
    e.preventDefault();
    const code = query.trim(); if (!code) return;
    const local = products.find((p) => p.barcode === code);
    if (local) { addToCart(local); setQuery(""); return; }
    if (/^\d{3,}$/.test(code)) {
      try { const p = await fetchByBarcode(code); addToCart(p); setQuery(""); return; } catch {}
    }
    const first = filtered[0];
    if (first) { addToCart(first); setQuery(""); return; }
    toast.error("Product not found");
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
        channel: "POS", cashier: user?.name || "Cashier",
      });
      // Auto-print via Bluetooth if connected
      if (btConnected && isConnected()) {
        try { await printReceipt(order); toast.success("Sent to Milestone Y50"); } catch (e) { toast.error("BT print failed: " + e.message); }
      }
      setReceipt(order);
      setShowPay(false); clearCart(); load();
      toast.success("Payment successful");
    } catch { toast.error("Failed to record sale"); }
  };

  const connectBt = async () => {
    try {
      if (!isBleAvailable()) return toast.error("Web Bluetooth needs Chrome/Edge desktop");
      const info = await connectPrinter();
      setBtConnected(true);
      toast.success(`Connected to ${info.name}`);
    } catch (e) { toast.error(e.message || "Failed"); }
  };
  const disconnectBt = async () => { await disconnectPrinter(); setBtConnected(false); toast.success("Disconnected"); };

  return (
    <div className="h-full flex flex-col">
      <header className="h-16 shrink-0 flex items-center px-4 md:px-6 border-b border-white/50 glass rounded-none">
        <form onSubmit={submitScan} className="flex-1 max-w-2xl relative" data-no-refocus>
          <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-500" />
          <input
            ref={scanRef} value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Scan Barcode / Search Product…"
            data-testid="scan-input" autoFocus
            className="w-full h-11 pl-11 pr-4 rounded-xl bg-white border border-slate-200 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 outline-none text-sm font-mono-num placeholder:text-slate-400"
          />
        </form>
        <div className="ml-auto flex items-center gap-2">
          <button
            data-testid="printer-toggle-btn"
            onClick={() => setShowPrinter(true)}
            className="flex items-center gap-2 h-11 px-3 rounded-xl bg-white border border-slate-200 hover:border-indigo-300 transition-colors"
          >
            {btConnected ? <BluetoothConnected className="w-4 h-4 text-emerald-500" /> : <Bluetooth className="w-4 h-4 text-slate-500" />}
            <div className="text-left hidden sm:block">
              <div className="text-[10px] uppercase tracking-widest text-slate-500 flex items-center gap-1.5 font-bold">
                {btConnected && <span className="pulse-dot" />} Printer
              </div>
              <div className="text-xs font-semibold text-slate-800">Milestone Y50 · 58mm</div>
            </div>
          </button>
        </div>
      </header>

      <div className="flex-1 min-h-0 grid grid-cols-12">
        <section className="col-span-12 lg:col-span-8 border-r border-white/50 flex flex-col min-h-0">
          <div className="px-4 md:px-6 py-4 flex gap-2 overflow-x-auto" data-no-refocus>
            {["ALL", ...cats].map((c) => (
              <button key={c} data-testid={`cat-${c}`} onClick={() => setActiveCat(c)} className={`chip whitespace-nowrap ${activeCat === c ? "chip-on" : "chip-off"}`}>
                {catLabel(c)}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto px-4 md:px-6 pb-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
              {filtered.map((p) => (
                <button key={p.id} data-testid={`product-${p.id}`} onClick={() => addToCart(p)} className={`glass glass-hover text-left p-3 relative ${catTint(p.category)}`}>
                  <div className="aspect-square rounded-xl bg-white/60 border border-white/70 flex items-center justify-center mb-3 relative">
                    <Package className="w-8 h-8 text-slate-400" />
                    <span className="absolute top-2 right-2 text-[10px] px-2 py-0.5 rounded-full bg-white/80 border border-white text-slate-700 font-semibold">
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
              {filtered.length === 0 && (
                <div className="col-span-full text-center py-16 text-slate-400">
                  <Package className="w-10 h-10 mx-auto mb-3 opacity-50" /> No products found
                </div>
              )}
            </div>
          </div>
        </section>

        <aside className="col-span-12 lg:col-span-4 flex flex-col min-h-0 bg-white/40" data-no-refocus>
          <div className="p-4 border-b border-white/50 flex items-center justify-between">
            <div>
              <div className="label-cap">Current Bill</div>
              <div className="text-lg font-extrabold">Live Cart <span className="text-indigo-500 font-mono-num">#{cart.length}</span></div>
            </div>
            <button onClick={() => setShowCustomer(true)} data-testid="add-customer-btn" className="chip chip-off flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" /> {customer.name ? customer.name.split(" ")[0] : "Customer"}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {cart.length === 0 && (
              <div className="text-center py-16 text-slate-400">
                <Barcode className="w-10 h-10 mx-auto mb-3 opacity-50" />
                Scan or tap a product to begin
              </div>
            )}
            {cart.map((it) => (
              <div key={it.product_id} className="glass p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{it.name}</div>
                    <div className="text-[11px] text-slate-500 font-mono-num">{money(it.price)} × {it.quantity}</div>
                  </div>
                  <button data-testid={`remove-${it.product_id}`} onClick={() => removeItem(it.product_id)} className="text-slate-400 hover:text-rose-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="inline-flex items-center bg-white rounded-lg border border-slate-200">
                    <button data-testid={`dec-${it.product_id}`} onClick={() => updateQty(it.product_id, -1)} className="p-2 hover:bg-slate-50 rounded-l-lg"><Minus className="w-4 h-4" /></button>
                    <span className="px-3 text-sm font-mono-num font-semibold">{it.quantity}</span>
                    <button data-testid={`inc-${it.product_id}`} onClick={() => updateQty(it.product_id, 1)} className="p-2 hover:bg-slate-50 rounded-r-lg"><Plus className="w-4 h-4" /></button>
                  </div>
                  <div className="text-sm font-mono-num font-bold text-indigo-600">{money(it.subtotal)}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-white/50 p-4 space-y-2 text-sm bg-white/50">
            <Row label="Subtotal" value={money(subtotal)} />
            <Row label={`Tax (${(TAX_RATE * 100).toFixed(0)}%)`} value={money(tax)} />
            <div className="flex items-center justify-between">
              <label className="text-slate-500 flex items-center gap-1"><Percent className="w-3.5 h-3.5" /> Discount</label>
              <input data-testid="discount-input" type="number" min="0" value={discount} onChange={(e) => setDiscount(e.target.value)} className="w-24 h-8 px-2 rounded-md bg-white border border-slate-200 text-right font-mono-num text-sm outline-none focus:border-indigo-400" />
            </div>
            <div className="pt-2 flex items-end justify-between border-t border-dashed border-slate-200">
              <span className="label-cap">Grand Total</span>
              <span data-testid="grand-total" className="text-2xl font-mono-num font-extrabold">{money(total)}</span>
            </div>
          </div>

          <div className="border-t border-white/50 p-4 bg-white/60">
            <div className="grid grid-cols-3 gap-2 mb-3">
              <PayBtn tid="pay-cash" active={method === "CASH"} onClick={() => setMethod("CASH")} icon={<Wallet className="w-4 h-4" />} label="Cash" />
              <PayBtn tid="pay-upi" active={method === "UPI"} onClick={() => setMethod("UPI")} icon={<QrCode className="w-4 h-4" />} label="UPI/QR" />
              <PayBtn tid="pay-card" active={method === "CARD"} onClick={() => setMethod("CARD")} icon={<CreditCard className="w-4 h-4" />} label="Card" />
            </div>
            <button data-testid="checkout-btn" onClick={openPay} disabled={cart.length === 0} className="btn-primary w-full h-14 rounded-xl font-bold flex items-center justify-center gap-3">
              <Printer className="w-5 h-5" /> Print Bill · Checkout
            </button>
          </div>
        </aside>
      </div>

      {showPay && (
        <Modal onClose={() => setShowPay(false)} testid="payment-modal">
          <div className="p-6">
            <div className="label-cap mb-1">Confirm Payment</div>
            <div className="text-2xl font-extrabold mb-5">
              {method === "CASH" ? "Cash Payment" : method === "UPI" ? "UPI / QR Payment" : "Card Payment"}
            </div>
            {method === "UPI" && (
              <div className="mb-5 rounded-xl bg-white border border-slate-200 p-6 flex items-center justify-center">
                <div className="w-40 h-40 grid grid-cols-8 grid-rows-8 gap-[2px]">
                  {Array.from({ length: 64 }).map((_, i) => (
                    <div key={i} className={((i * 7 + 3) % 5 < 2 || i === 0 || i === 7 || i === 56 || i === 63) ? "bg-slate-900" : "bg-white"} />
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-3 mb-5">
              <div className="flex justify-between text-sm"><span className="text-slate-500">Total</span><span className="font-mono-num font-bold text-lg">{money(total)}</span></div>
              {method === "CASH" && (
                <>
                  <label className="block">
                    <span className="text-xs text-slate-500">Amount received</span>
                    <input data-testid="amount-paid-input" type="number" min="0" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} className="field field-lg mt-1 font-mono-num" />
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {[100, 200, 500, 1000, 2000].map((v) => (
                      <button key={v} type="button" onClick={() => setAmountPaid(String(v))} className="chip chip-off font-mono-num">₹{v}</button>
                    ))}
                  </div>
                  <div className="flex justify-between text-sm pt-2 border-t border-slate-200">
                    <span className="text-slate-500">Change due</span>
                    <span data-testid="change-due" className="font-mono-num font-bold text-emerald-600">{money(changeDue)}</span>
                  </div>
                </>
              )}
            </div>
            <button data-testid="confirm-payment-btn" onClick={finalize} className="btn-primary w-full h-12 rounded-xl flex items-center justify-center gap-2">
              <CheckCircle2 className="w-5 h-5" /> Confirm & Print
            </button>
          </div>
        </Modal>
      )}

      {showCustomer && (
        <Modal onClose={() => setShowCustomer(false)} testid="customer-modal">
          <div className="p-6 space-y-4">
            <div className="text-lg font-extrabold">Customer Info</div>
            <input data-testid="cust-name" placeholder="Customer name" value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} className="field" />
            <input data-testid="cust-phone" placeholder="Phone number" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} className="field font-mono-num" />
            <button onClick={() => setShowCustomer(false)} className="btn-primary w-full h-11 rounded-xl">Save</button>
          </div>
        </Modal>
      )}

      {showPrinter && (
        <Modal onClose={() => setShowPrinter(false)} testid="printer-modal">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white flex items-center justify-center">
                <Printer className="w-6 h-6" />
              </div>
              <div>
                <div className="text-lg font-extrabold">Thermal Printer</div>
                <div className="text-xs text-slate-500">Milestone Y50 · FCC ID: 2A6FW-Y50</div>
              </div>
            </div>
            <div className="rounded-xl bg-white border border-slate-200 p-4 space-y-2 text-sm mb-5">
              <div className="flex justify-between"><span className="text-slate-500">Status</span>
                <span className={btConnected ? "text-emerald-600 flex items-center gap-2" : "text-slate-500"}>
                  {btConnected && <span className="pulse-dot" />} {btConnected ? "Connected via Bluetooth" : "Not connected"}
                </span>
              </div>
              <div className="flex justify-between"><span className="text-slate-500">Model</span><span>Milestone Y50</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Paper Width</span><span>58 mm</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Interface</span><span>Bluetooth (ESC/POS)</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Power</span><span>5V ~ 1A</span></div>
            </div>
            {btConnected ? (
              <button data-testid="bt-disconnect" onClick={disconnectBt} className="btn-ghost w-full h-11 rounded-xl">Disconnect</button>
            ) : (
              <button data-testid="bt-connect" onClick={connectBt} className="btn-primary w-full h-11 rounded-xl flex items-center justify-center gap-2">
                <Bluetooth className="w-4 h-4" /> Connect via Web Bluetooth
              </button>
            )}
            {!isBleAvailable() && (
              <div className="mt-3 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                Web Bluetooth requires Chrome or Edge on desktop.
              </div>
            )}
          </div>
        </Modal>
      )}

      {receipt && <ReceiptModal sale={receipt} onClose={() => setReceipt(null)} />}
    </div>
  );
}

function Row({ label, value }) {
  return (<div className="flex items-center justify-between"><span className="text-slate-500">{label}</span><span className="font-mono-num">{value}</span></div>);
}

function PayBtn({ active, onClick, icon, label, tid }) {
  return (
    <button data-testid={tid} onClick={onClick} className={`h-12 rounded-xl border flex flex-col items-center justify-center gap-0.5 text-xs font-semibold transition-all ${
      active ? "bg-gradient-to-br from-indigo-50 to-violet-50 border-indigo-300 text-indigo-700" : "bg-white border-slate-200 hover:border-indigo-300"
    }`}>{icon}{label}</button>
  );
}

function Modal({ children, onClose, testid }) {
  return (
    <div data-testid={testid} data-no-refocus className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md glass-strong relative">
        <button onClick={onClose} className="absolute top-3 right-3 p-2 rounded-lg hover:bg-slate-100 text-slate-500">
          <X className="w-4 h-4" />
        </button>
        {children}
      </div>
    </div>
  );
}
