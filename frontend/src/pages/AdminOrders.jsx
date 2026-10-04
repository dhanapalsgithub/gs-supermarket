import { useEffect, useState, useMemo, useCallback } from "react";
import { fetchOrders, updateOrderStatus, money } from "../lib/api";
import { toast } from "sonner";
import { 
  Package, Truck, CheckCircle2, XCircle, Clock, CreditCard, 
  ArrowRight, Download, ChevronLeft, ChevronRight, Calendar, RefreshCw, Eye, MessageCircle, Printer, ChevronDown, Store, Globe 
} from "lucide-react";
import ReceiptModal from "../components/ReceiptModal";

const STAGES = ["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED"];
const PAGE_SIZE = 6;

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState("ALL");
  const [sourceFilter, setSourceFilter] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);

  const load = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    setRefreshing(true);
    try {
      const data = await fetchOrders();
      if (Array.isArray(data)) {
        setOrders(data);
      }
    } catch { 
      toast.error("Failed to load orders"); 
    } finally { 
      setLoading(false); 
      setRefreshing(false); 
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const setStatus = async (o, newStatus) => {
    const targetId = o.id || o._id;
    setUpdatingId(targetId);
    try { 
      // Backend status, order_status இரண்டில் எதை எதிர்பார்த்தாலும் வேலை செய்யும் வகையில்
      await updateOrderStatus(targetId, { 
        status: newStatus, 
        order_status: newStatus 
      }); 
      toast.success(`Marked as ${newStatus}`); 
      await load(true); 
    } catch (err) { 
      console.error("Order status update failed:", err);
      toast.error("Failed to update status"); 
    } finally {
      setUpdatingId(null);
    }
  };

  const setPay = async (o, payment_status) => {
    const targetId = o.id || o._id;
    setUpdatingId(targetId);
    try { 
      await updateOrderStatus(targetId, { 
        payment_status: payment_status 
      }); 
      toast.success(`Payment marked as ${payment_status}`); 
      await load(true); 
    } catch (err) { 
      console.error("Payment status update failed:", err);
      toast.error("Failed to update payment status"); 
    } finally {
      setUpdatingId(null);
    }
  };

  const getOrderSource = (o) => {
    const type = (o.order_type || o.channel || "").toUpperCase();
    if (type.includes("POS") || type.includes("WALK") || type.includes("STORE")) {
      return "WALK-IN";
    }
    return "ONLINE";
  };

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      const matchStatus = filter === "ALL" || o.order_status === filter || o.status === filter;
      if (!matchStatus) return false;

      if (sourceFilter !== "ALL") {
        const source = getOrderSource(o);
        if (source !== sourceFilter) return false;
      }

      if (startDate || endDate) {
        const orderDate = new Date(o.created_at).toISOString().split("T")[0];
        if (startDate && orderDate < startDate) return false;
        if (endDate && orderDate > endDate) return false;
      }
      return true;
    });
  }, [orders, filter, sourceFilter, startDate, endDate]);

  useEffect(() => { setPage(1); }, [filter, sourceFilter, startDate, endDate]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;
  const paginatedOrders = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const exportToCSV = () => {
    if (filtered.length === 0) return toast.error("No orders to export");
    
    const headers = ["Receipt No,Type,Date,Customer Name,Phone,Status,Payment Status,Payment Method,Total"];
    const rows = filtered.map(o => [
      o.receipt_no,
      getOrderSource(o),
      `"${new Date(o.created_at).toLocaleString()}"`,
      `"${o.customer_name || 'Walk-in'}"`,
      o.customer_phone || '',
      o.order_status || o.status,
      o.payment_status,
      o.payment_method,
      o.total
    ].join(","));

    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `orders_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Orders exported successfully");
  };

  const shareToWhatsApp = (o) => {
    const phone = o.customer_phone ? o.customer_phone.replace(/\D/g, '') : '';
    const message = `Hello ${o.customer_name || 'Customer'}, here are the details for your order *${o.receipt_no}*:\nTotal Amount: *${money(o.total)}*\nStatus: *${o.order_status || o.status}*\nThank you for shopping with us!`;
    const url = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4 md:p-6 overflow-y-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <div className="label-cap">Management</div>
          <h1 className="text-2xl font-extrabold text-slate-800">Order & Bill History</h1>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={exportToCSV}
            className="btn-primary h-11 px-4 rounded-xl flex items-center gap-2 text-sm font-bold shadow-sm"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button 
            onClick={() => load(true)}
            className="p-3 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition"
          >
            <RefreshCw className={`w-4 h-4 text-slate-700 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { id: "ALL", label: "All Bills", icon: Package, count: orders.length },
          { id: "WALK-IN", label: "Walk-in / POS", icon: Store, count: orders.filter(o => getOrderSource(o) === "WALK-IN").length },
          { id: "ONLINE", label: "Online Orders", icon: Globe, count: orders.filter(o => getOrderSource(o) === "ONLINE").length }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = sourceFilter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSourceFilter(tab.id)}
              className={`p-3 rounded-xl border flex items-center justify-center gap-2 transition font-bold text-xs md:text-sm ${
                isActive 
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-sm" 
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${isActive ? "bg-indigo-700 text-white" : "bg-slate-100 text-slate-600"}`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="glass p-4 mb-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-indigo-500" />
          <span className="text-xs font-bold text-slate-700">Calendar Filter:</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">From</span>
          <input 
            type="date" 
            value={startDate} 
            onChange={(e) => setStartDate(e.target.value)} 
            className="h-9 px-3 rounded-lg bg-white border border-slate-200 text-xs font-mono-num outline-none focus:border-indigo-400" 
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">To</span>
          <input 
            type="date" 
            value={endDate} 
            onChange={(e) => setEndDate(e.target.value)} 
            className="h-9 px-3 rounded-lg bg-white border border-slate-200 text-xs font-mono-num outline-none focus:border-indigo-400" 
          />
        </div>
        {(startDate || endDate) && (
          <button 
            onClick={() => { setStartDate(""); setEndDate(""); }} 
            className="text-xs text-rose-500 hover:underline font-semibold ml-auto"
          >
            Clear Dates
          </button>
        )}
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {["ALL", ...STAGES, "CANCELLED"].map((s) => (
          <button 
            key={s} 
            onClick={() => setFilter(s)} 
            className={`chip whitespace-nowrap ${filter === s ? "chip-on" : "chip-off"}`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="space-y-3 flex-1">
        {paginatedOrders.map((o) => {
          const currentStatus = o.order_status || o.status || "PENDING";
          const idx = STAGES.indexOf(currentStatus);
          const next = STAGES[idx + 1];
          const source = getOrderSource(o);
          const targetId = o.id || o._id;
          const isUpdating = updatingId === targetId;
          
          return (
            <div key={targetId} className="glass p-4 relative">
              <div className="flex flex-wrap items-center gap-3 mb-3 pb-3 border-b border-white/50">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded-lg text-[10px] font-extrabold flex items-center gap-1 ${
                    source === "WALK-IN" ? "bg-cyan-50 text-cyan-700 border border-cyan-200" : "bg-indigo-50 text-indigo-700 border border-indigo-200"
                  }`}>
                    {source === "WALK-IN" ? <Store className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
                    {source}
                  </span>
                  <div>
                    <div className="text-sm font-bold text-slate-800">{o.receipt_no}</div>
                    <div className="text-xs text-slate-400 font-mono-num">{new Date(o.created_at).toLocaleString()}</div>
                  </div>
                </div>

                <div className="ml-auto flex items-center gap-2 flex-wrap justify-end">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${pillFor(currentStatus)}`}>{currentStatus}</span>
                  
                  <div className="relative group">
                    <select
                      disabled={isUpdating}
                      value={o.payment_status || "UNPAID"}
                      onChange={(e) => setPay(o, e.target.value)}
                      className={`px-3 py-1 rounded-full text-xs font-bold border outline-none cursor-pointer appearance-none pr-7 ${
                        o.payment_status === "PAID" 
                          ? "bg-emerald-50 text-emerald-600 border-emerald-200" 
                          : "bg-amber-50 text-amber-600 border-amber-200"
                      }`}
                    >
                      <option value="PAID">PAID</option>
                      <option value="UNPAID">UNPAID</option>
                      <option value="PENDING">PENDING</option>
                    </select>
                    <ChevronDown className={`w-3 h-3 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none ${
                      o.payment_status === "PAID" ? "text-emerald-600" : "text-amber-600"
                    }`} />
                  </div>

                  <div className="text-right ml-2">
                    <div className="text-base font-mono-num font-extrabold text-indigo-600">{money(o.total)}</div>
                    <div className="text-[10px] text-slate-400 uppercase">{o.payment_method}</div>
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-3 text-sm items-center">
                <div className="rounded-xl bg-white/50 border border-white/60 p-3">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Customer Details</div>
                  <div className="mt-1 font-semibold text-slate-800">{o.customer_name || "Walk-in Customer"}</div>
                  <div className="text-xs text-slate-500 font-mono-num">{o.customer_phone || "No phone provided"}</div>
                </div>
                
                <div className="rounded-xl bg-white/50 border border-white/60 p-3">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Items Summary · {o.items ? o.items.length : 0} items</div>
                  <div className="mt-1 space-y-0.5 text-xs text-slate-700">
                    {o.items && o.items.slice(0, 2).map((it, i) => (
                      <div key={i} className="flex justify-between truncate">
                        <span className="truncate">{it.name} ×{it.quantity}</span>
                        <span className="font-mono-num">{money(it.subtotal)}</span>
                      </div>
                    ))}
                    {o.items && o.items.length > 2 && <div className="text-slate-400 text-[11px]">+ {o.items.length - 2} more items</div>}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 justify-end">
                  <button onClick={() => setSelectedReceipt(o)} className="btn-ghost h-9 px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-white">
                    <Eye className="w-3.5 h-3.5 text-indigo-500" /> View
                  </button>

                  <button onClick={() => shareToWhatsApp(o)} className="btn-ghost h-9 px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-white text-emerald-600 hover:text-emerald-700">
                    <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                  </button>

                  {currentStatus !== "CANCELLED" && next && (
                    <button 
                      disabled={isUpdating}
                      onClick={() => setStatus(o, next)} 
                      className="btn-primary h-9 px-3 rounded-xl text-xs font-bold flex items-center gap-1 disabled:opacity-50"
                    >
                      {isUpdating ? "Updating..." : next} <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="glass text-center py-16 text-slate-400">
            <Package className="w-10 h-10 mx-auto mb-3 opacity-50" /> No bills or orders found matching your filter
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 mt-4 border-t border-white/50">
          <div className="text-xs text-slate-500 font-medium">
            Page {page} of {totalPages} ({filtered.length} total records)
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setPage(p => Math.max(p - 1, 1))} 
              disabled={page === 1}
              className="btn-ghost h-9 px-3 rounded-lg flex items-center gap-1 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" /> Prev
            </button>
            <button 
              onClick={() => setPage(p => Math.min(p + 1, totalPages))} 
              disabled={page === totalPages}
              className="btn-ghost h-9 px-3 rounded-lg flex items-center gap-1 disabled:opacity-40"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {selectedReceipt && (
        <ReceiptModal sale={selectedReceipt} onClose={() => setSelectedReceipt(null)} />
      )}
    </div>
  );
}

function pillFor(s) {
  return { 
    PENDING: "bg-amber-50 text-amber-600 border border-amber-200", 
    CONFIRMED: "bg-blue-50 text-blue-600 border border-blue-200", 
    SHIPPED: "bg-purple-50 text-purple-600 border border-purple-200", 
    DELIVERED: "bg-emerald-50 text-emerald-600 border border-emerald-200", 
    CANCELLED: "bg-rose-50 text-rose-600 border border-rose-200" 
  }[s] || "bg-slate-50 text-slate-600 border border-slate-200";
}