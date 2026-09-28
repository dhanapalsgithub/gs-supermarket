import { Printer, X } from "lucide-react";
import { useState } from "react";

export default function ReceiptModal({ sale, onClose }) {
  const [printing, setPrinting] = useState(false);
  const created = new Date(sale.created_at);
  const dtStr = created.toLocaleString("en-IN", { hour12: true });

  const totalQuantity = sale.items.reduce((sum, item) => sum + item.quantity, 0);

  const handleDirectPrint = () => {
    setPrinting(true);
    try {
      window.print();
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div data-testid="receipt-modal" data-no-refocus className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-sm max-h-[92vh] glass-strong relative flex flex-col overflow-hidden rounded-2xl shadow-2xl">
        
        <button onClick={onClose} className="absolute top-3 right-3 z-10 p-2 rounded-lg hover:bg-slate-100 text-slate-500 bg-white/80">
          <X className="w-4 h-4" />
        </button>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="text-center mb-1">
            <div className="label-cap text-emerald-600 mb-1">Payment Successful</div>
            <div className="text-lg font-bold">Receipt {sale.receipt_no}</div>
          </div>

          <div className="flex justify-center">
            <div className="w-full bg-white p-3 rounded border border-slate-200 shadow-inner font-mono text-xs text-slate-900">
              <div className="text-center font-bold text-sm">GS SUPERMARKET</div>
              <div className="text-center text-[10px] text-slate-500">Fresh Groceries · Daily Needs</div>
              <div className="text-center text-[10px] text-slate-500 mb-2">GSTIN: 33ABCDE1234F1Z5</div>
              <hr className="my-2 border-dashed border-slate-300" />
              <div className="flex justify-between"><span>Receipt:</span><span>{sale.receipt_no.slice(-10)}</span></div>
              <div className="flex justify-between"><span>Date:</span><span>{dtStr}</span></div>
              <div className="flex justify-between"><span>Cashier:</span><span>{sale.cashier || "Cashier"}</span></div>
              {sale.customer_name && <div className="flex justify-between"><span>Customer:</span><span>{sale.customer_name}</span></div>}
              {sale.customer_phone && <div className="flex justify-between"><span>Phone:</span><span>{sale.customer_phone}</span></div>}
              <hr className="my-2 border-dashed border-slate-300" />
              <div className="flex justify-between font-bold text-[11px]"><span>Item</span><span>Amt</span></div>
              <hr className="my-2 border-dashed border-slate-300" />
              {sale.items.map((it, i) => (
                <div key={i} className="mb-1">
                  <div>{it.name}</div>
                  <div className="flex justify-between text-slate-600 text-[11px]">
                    <span>{it.quantity} x {Number(it.price).toFixed(2)}</span>
                    <span>{Number(it.subtotal).toFixed(2)}</span>
                  </div>
                </div>
              ))}
              <hr className="my-2 border-dashed border-slate-300" />
              
              <div className="flex justify-between font-semibold"><span>Total Quantity</span><span>{totalQuantity}</span></div>
              <div className="flex justify-between"><span>Subtotal</span><span>{Number(sale.subtotal).toFixed(2)}</span></div>
              <div className="flex justify-between"><span>Tax ({(sale.tax_rate * 100).toFixed(0)}%)</span><span>{Number(sale.tax_amount).toFixed(2)}</span></div>
              {sale.discount > 0 && <div className="flex justify-between text-rose-600"><span>Discount</span><span>-{Number(sale.discount).toFixed(2)}</span></div>}
              <hr className="my-2 border-dashed border-slate-300" />
              <div className="flex justify-between font-bold text-sm">
                <span>TOTAL</span><span>Rs {Number(sale.total).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[11px]"><span>Paid ({sale.payment_method})</span><span>{Number(sale.amount_paid || sale.total).toFixed(2)}</span></div>
              {sale.change_due > 0 && <div className="flex justify-between text-[11px]"><span>Change</span><span>{Number(sale.change_due).toFixed(2)}</span></div>}
              <hr className="my-2 border-dashed border-slate-300" />
              <div className="text-center font-semibold text-[10px]">Thank you · Visit again!</div>
              <div className="text-center font-bold text-indigo-600 text-[10px]">Retsol RTP-80EU · USB</div>
            </div>
          </div>
        </div>

        <div className="p-4 bg-white/80 border-t border-slate-200 shrink-0 space-y-2">
          <button
            data-testid="bt-print-btn"
            onClick={handleDirectPrint}
            disabled={printing}
            className="w-full h-11 rounded-xl btn-primary flex items-center justify-center gap-2 font-bold shadow-sm"
          >
            <Printer className="w-4 h-4" /> {printing ? "Printing..." : "Print Receipt (POS80 USB)"}
          </button>
          <button onClick={onClose} className="w-full h-9 rounded-xl text-xs text-slate-500 hover:text-slate-800 font-medium">
            Close Preview
          </button>
        </div>

      </div>
    </div>
  );
}