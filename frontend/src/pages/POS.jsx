import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Search, Barcode, Usb, CheckCircle2, Plus, Minus, Trash2,
  Printer, CreditCard, Wallet, QrCode, Package, Percent, User, X, ChevronLeft, ChevronRight, Smartphone, BookOpen
} from "lucide-react";
import { fetchProducts, fetchCategories, fetchByBarcode, createOrder, money, catLabel, catTint, api } from "../lib/api";
import { connectUsbPrinter, isUsbAvailable, isUsbConnected, printUsbReceipt, disconnectUsbPrinter } from "../lib/usbPrinter";
import ReceiptModal from "../components/ReceiptModal";
import { useAuth } from "../context/AuthContext";

const TAX_RATE = 0.00;
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

  /* Ref to refocus custom item input */
  const customNameInputRef = useRef(null);

  /* State for custom / "Other" billing items modal */
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customInput, setCustomInput] = useState({ name: "", price: "" });
  const [pendingCustomItems, setPendingCustomItems] = useState([]);

  const load = useCallback(async () => {
    try {
      const [p, c] = await Promise.all([fetchProducts(), fetchCategories()]);
      setProducts(Array.isArray(p) ? p : []); 
      setCats(Array.isArray(c) ? c : []);
    } catch { 
      toast.error("Failed to load products"); 
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      const mc = activeCat === "ALL" || p.category === activeCat;
      const mq = !q || (p.name || "").toLowerCase().includes(q) || (p.barcode || "").includes(q);
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
        const newQty = next[idx].quantity + qty;
        next[idx] = { 
          ...next[idx], 
          quantity: newQty, 
          subtotal: newQty * Number(p.price || 0) 
        };
        return next;
      }
      return [...c, { 
        product_id: p.id, 
        name: p.name || "Product", 
        price: Number(p.price || 0), 
        quantity: qty, 
        subtotal: Number(p.price || 0) * qty, 
        unit: p.unit || "pcs",
        is_custom: false
      }];
    });
    toast.success(`Added ${p.name}`, { duration: 1000 });
  }, []);

  /* Add custom item to modal's pending list and re-focus input */
  const handleAddPendingCustom = (e) => {
    e.preventDefault();
    const priceNum = parseFloat(customInput.price);
    if (!customInput.name.trim() || isNaN(priceNum) || priceNum <= 0) {
      return toast.error("Please enter a valid item name and price");
    }

    const newItem = {
      product_id: null,
      name: customInput.name.trim(),
      price: priceNum,
      quantity: 1,
      subtotal: priceNum,
      unit: "pcs",
      is_custom: true
    };

    setPendingCustomItems((prev) => [...prev, newItem]);
    setCustomInput({ name: "", price: "" });

    setTimeout(() => {
      customNameInputRef.current?.focus();
    }, 50);
  };

  /* Remove an item from the pending custom list */
  const removePendingItem = (index) => {
    setPendingCustomItems((prev) => prev.filter((_, i) => i !== index));
  };

  /* Confirm all pending custom items to the main cart */
  const confirmCustomToCart = () => {
    if (pendingCustomItems.length === 0) {
      return toast.error("Please add at least one item first");
    }

    setCart((prev) => [...prev, ...pendingCustomItems]);
    toast.success(`Added ${pendingCustomItems.length} custom item(s) to cart`);
    setPendingCustomItems([]);
    setCustomInput({ name: "", price: "" });
    setShowCustomModal(false);
  };

  const updateQty = (id, delta, isCustom = false, index = null) => {
    setCart((c) => c.map((it, idx) => {
      const isMatch = isCustom ? idx === index : it.product_id === id;
      if (isMatch) {
        const nextQty = Math.max(0, it.quantity + delta);
        return { 
          ...it, 
          quantity: nextQty, 
          subtotal: Math.max(0, nextQty * it.price) 
        };
      }
      return it;
    }).filter((it) => it.quantity > 0));
  };

  const removeItem = (id, isCustom = false, index = null) => {
    setCart((c) => c.filter((it, idx) => isCustom ? idx !== index : it.product_id !== id));
  };

  const clearCart = () => { setCart([]); setDiscount(0); setCustomer({ name: "", phone: "" }); };

  const subtotal = cart.reduce((s, it) => s + (Number(it.subtotal) || 0), 0);
  const totalQuantity = cart.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const tax = subtotal * TAX_RATE;
  const total = Math.max(0, subtotal + tax - Number(discount || 0));
  const changeDue = Math.max(0, Number(amountPaid || 0) - total);

  const processBarcode = useCallback((codeText) => {
    const code = codeText.trim();
    if (!code) return false;
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
    setAmountPaid(total.toFixed(2));
    setMethod("CASH");
    setShowPay(true);
  };

  const finalize = async () => {
    if (method === "CREDIT" && (!customer.name.trim() || !customer.phone.trim())) {
      setShowPay(false);
      setShowCustomer(true);
      return toast.error("Customer name and phone are required for Credit Sale");
    }

    if (method === "CASH" && Number(amountPaid || 0) < total) {
      return toast.error("Insufficient cash amount entered");
    }

    try {
      const isCredit = method === "CREDIT";

      // Map frontend selection to allowed backend values ('CASH', 'UPI', 'CARD', 'COD')
      let finalPaymentMethod = method;
      if (method === "GPAY") {
        finalPaymentMethod = "UPI";
      } else if (method === "CREDIT") {
        finalPaymentMethod = "CASH";
      }

      // Clean order payload matching backend validation schemas
      const orderPayload = {
        items: cart.map((c) => ({
          product_id: c.product_id || null, 
          name: String(c.name || "Item"), 
          price: Number(c.price || 0), 
          quantity: Number(c.quantity || 1), 
          subtotal: Number(c.subtotal || 0) 
        })),
        subtotal: Number(subtotal.toFixed(2)), 
        tax_rate: Number(TAX_RATE), 
        tax_amount: Number(tax.toFixed(2)), 
        discount: Number(discount || 0), 
        total: Number(total.toFixed(2)),
        payment_method: finalPaymentMethod,
        amount_paid: isCredit ? 0 : Number(amountPaid || total), 
        change_due: method === "CASH" ? Number(changeDue.toFixed(2)) : 0,
        customer_name: customer.name.trim() || (isCredit ? "Credit Customer" : "Walk-in"), 
        customer_phone: customer.phone.trim() || "0000000000",
        channel: "POS", 
        order_type: "STORE_BILL", 
        cashier: user?.name || "Cashier",
      };

      const order = await createOrder(orderPayload);

      if (usbConnected && isUsbConnected()) {
        try { await printUsbReceipt(order); } catch {}
      }
      setReceipt(order);
      setShowPay(false); 
      clearCart(); 
      load();
      toast.success("Store Bill Generated Successfully");
    } catch (err) { 
      console.error("Order Creation Error Details:", err.response?.data || err.message);
      toast.error(err.response?.data?.detail?.[0]?.msg || "Failed to record sale. Check details."); 
    }
  };

  const handlePhoneChange = async (e) => {
    const phoneVal = e.target.value;
    setCustomer(prev => ({ ...prev, phone: phoneVal }));
    if (phoneVal.trim().length >= 10) {
      try {
        const cleanPhone = phoneVal.trim();
        const res = await api.get(`/orders?phone=${cleanPhone}`).catch(() => ({ data: [] }));
        const orders = res.data || [];
        const matchedOrder = orders.find(o => (o.customer_phone === cleanPhone || o.phone === cleanPhone) && o.customer_name);
        
        if (matchedOrder && matchedOrder.customer_name) {
          setCustomer(prev => ({ ...prev, name: matchedOrder.customer_name }));
          return;
        }

        const custRes = await api.get('/customers').catch(() => ({ data: {} }));
        const allCusts = [...(custRes.data?.online || []), ...(custRes.data?.walking || [])];
        const matchedCust = allCusts.find(c => (c.phone === cleanPhone || c.mobile === cleanPhone) && c.name);
        
        if (matchedCust && matchedCust.name) {
          setCustomer(prev => ({ ...prev, name: matchedCust.name }));
        }
      } catch (err) {
        console.error("Error looking up customer", err);
      }
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
          <div className="px-4 md:px-6 py-4 flex items-center justify-between gap-2 overflow-x-auto">
            <div className="flex gap-2 overflow-x-auto">
              {["ALL", ...cats].map((c) => (
                <button key={c} onClick={() => setActiveCat(c)} className={`chip whitespace-nowrap ${activeCat === c ? "chip-on" : "chip-off"}`}>
                  {catLabel(c)}
                </button>
              ))}
            </div>

            <button 
              onClick={() => setShowCustomModal(true)} 
              className="chip chip-off flex items-center gap-1.5 whitespace-nowrap border-dashed border-indigo-400 text-indigo-600 font-bold shrink-0"
            >
              <Plus className="w-3.5 h-3.5" /> + Custom / Other
            </button>
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
            {cart.map((it, idx) => (
              <div key={it.product_id || `custom-cart-${idx}`} className="glass p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">
                      {it.name} {it.is_custom && <span className="text-[10px] text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded ml-1 font-bold">Custom</span>}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono-num">{money(it.price)} × {it.quantity}</div>
                  </div>
                  <button onClick={() => removeItem(it.product_id, it.is_custom, idx)} className="text-slate-400 hover:text-rose-500"><Trash2 className="w-4 h-4" /></button>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="inline-flex items-center bg-white rounded-lg border">
                    <button onClick={() => updateQty(it.product_id, -1, it.is_custom, idx)} className="p-2"><Minus className="w-4 h-4" /></button>
                    <span className="px-3 text-sm font-mono-num font-semibold">{it.quantity}</span>
                    <button onClick={() => updateQty(it.product_id, 1, it.is_custom, idx)} className="p-2"><Plus className="w-4 h-4" /></button>
                  </div>
                  <div className="text-sm font-mono-num font-bold text-indigo-600">{money(it.subtotal)}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-white/50 p-4 space-y-2 text-sm bg-white/50">
            <div className="flex items-center justify-between"><span className="text-slate-500">Subtotal</span><span className="font-mono-num">{money(subtotal)}</span></div>
            {TAX_RATE > 0 && (
              <div className="flex items-center justify-between"><span className="text-slate-500">Tax</span><span className="font-mono-num">{money(tax)}</span></div>
            )}
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

      {showCustomModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md glass-strong p-6 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center shrink-0">
              <div>
                <div className="text-lg font-extrabold">Add Custom / Other Items</div>
                <div className="text-xs text-slate-500">Add items to list below, then confirm to add to cart</div>
              </div>
              <button 
                type="button" 
                onClick={() => {
                  setShowCustomModal(false);
                  setPendingCustomItems([]);
                }} 
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddPendingCustom} className="space-y-3 shrink-0 bg-white/50 p-3 rounded-xl border border-white/70">
              <div>
                <label className="text-xs text-slate-500 mb-1 block font-medium">Item Description / Name</label>
                <input
                  ref={customNameInputRef}
                  type="text"
                  placeholder="e.g. Loose Groceries / Service"
                  value={customInput.name}
                  onChange={(e) => setCustomInput({ ...customInput, name: e.target.value })}
                  className="field"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs text-slate-500 mb-1 block font-medium">Price</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={customInput.price}
                  onChange={(e) => setCustomInput({ ...customInput, price: e.target.value })}
                  className="field font-mono-num"
                />
              </div>

              <button 
                type="submit" 
                className="chip chip-off border-indigo-400 text-indigo-600 w-full py-2.5 font-bold flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Add to Item List
              </button>
            </form>

            <div className="flex-1 overflow-y-auto space-y-2 min-h-[100px] pr-1">
              {pendingCustomItems.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-400">
                  No items added yet. Fill above form and click "Add to Item List".
                </div>
              ) : (
                pendingCustomItems.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-white/70 rounded-xl border border-slate-100 text-sm">
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="font-bold text-slate-800 truncate">{index + 1}. {item.name}</div>
                      <div className="text-xs font-mono-num text-indigo-600 font-semibold">{money(item.price)}</div>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => removePendingItem(index)} 
                      className="text-slate-400 hover:text-rose-500 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-200 shrink-0">
              <button 
                type="button" 
                onClick={() => {
                  setShowCustomModal(false);
                  setPendingCustomItems([]);
                }} 
                className="chip chip-off flex-1 py-3 justify-center text-slate-700 font-bold"
              >
                Cancel
              </button>
              <button 
                type="button" 
                onClick={confirmCustomToCart}
                disabled={pendingCustomItems.length === 0}
                className="btn-primary flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" /> Confirm & Add to Cart ({pendingCustomItems.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {showPay && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md glass-strong p-6 space-y-4">
            <div className="flex justify-between items-center">
              <div className="text-lg font-extrabold">Confirm Payment</div>
              <button onClick={() => setShowPay(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-indigo-50/50 p-3 rounded-xl flex justify-between items-center border border-indigo-100">
              <span className="text-xs text-indigo-700 font-medium">Total Bill Amount</span>
              <span className="font-mono-num font-extrabold text-xl text-indigo-600">{money(total)}</span>
            </div>

            <div>
              <label className="text-xs text-slate-500 mb-1 block font-medium">Payment Method</label>
              <div className="grid grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => { setMethod("CASH"); setAmountPaid(total.toFixed(2)); }}
                  className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                    method === "CASH" ? "border-indigo-600 bg-indigo-50/70 text-indigo-600 font-bold" : "bg-white text-slate-600 border-slate-200"
                  }`}
                >
                  <Wallet className="w-4 h-4" />
                  <span className="text-[11px]">Cash</span>
                </button>

                <button
                  type="button"
                  onClick={() => { setMethod("GPAY"); setAmountPaid(total.toFixed(2)); }}
                  className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                    method === "GPAY" ? "border-indigo-600 bg-indigo-50/70 text-indigo-600 font-bold" : "bg-white text-slate-600 border-slate-200"
                  }`}
                >
                  <Smartphone className="w-4 h-4" />
                  <span className="text-[11px]">GPay</span>
                </button>

                <button
                  type="button"
                  onClick={() => { setMethod("CARD"); setAmountPaid(total.toFixed(2)); }}
                  className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                    method === "CARD" ? "border-indigo-600 bg-indigo-50/70 text-indigo-600 font-bold" : "bg-white text-slate-600 border-slate-200"
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  <span className="text-[11px]">Card</span>
                </button>

                <button
                  type="button"
                  onClick={() => { setMethod("CREDIT"); setAmountPaid("0"); }}
                  className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                    method === "CREDIT" ? "border-amber-600 bg-amber-50/70 text-amber-600 font-bold" : "bg-white text-slate-600 border-slate-200"
                  }`}
                >
                  <BookOpen className="w-4 h-4" />
                  <span className="text-[11px]">Credit</span>
                </button>
              </div>
            </div>

            {method === "CASH" ? (
              <label className="block space-y-1">
                <span className="text-xs text-slate-500 font-medium">Cash Received</span>
                <input 
                  type="number" 
                  step="0.01" 
                  value={amountPaid} 
                  onChange={(e) => setAmountPaid(e.target.value)} 
                  className="field font-mono-num text-lg" 
                  placeholder="0.00"
                />
                {Number(amountPaid) > total && (
                  <div className="text-xs font-semibold text-emerald-600 text-right mt-1">
                    Change Due: {money(changeDue)}
                  </div>
                )}
              </label>
            ) : method === "CREDIT" ? (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 space-y-1">
                <div className="font-bold">Credit (Non-Pay) Sale</div>
                <div>Customer: {customer.name || "Not assigned"} ({customer.phone || "No phone"})</div>
                <div className="text-[11px] text-amber-600">Amount will be added to customer credit balance.</div>
              </div>
            ) : (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600">
                Payment status: <span className="font-bold text-indigo-600 uppercase">{method} Selected</span>
              </div>
            )}

            <button onClick={finalize} className="btn-primary w-full h-12 rounded-xl flex items-center justify-center gap-2 font-bold">
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