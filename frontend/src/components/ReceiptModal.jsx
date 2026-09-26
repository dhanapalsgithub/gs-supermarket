import { Printer, X } from "lucide-react";
import { money } from "../lib/api";

export default function ReceiptModal({ sale, onClose }) {
  const created = new Date(sale.created_at);
  const dtStr = created.toLocaleString("en-IN", { hour12: true });

  return (
    <div data-testid="receipt-modal" data-no-refocus className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-[#12121F] border border-white/10 rounded-2xl relative">
        <button onClick={onClose} className="absolute top-3 right-3 p-2 rounded-lg hover:bg-white/5 text-slate-300">
          <X className="w-4 h-4" />
        </button>
        <div className="p-5">
          <div className="text-center mb-3">
            <div className="text-xs uppercase tracking-widest text-emerald-400 mb-1">Payment Successful</div>
            <div className="text-lg font-bold">Receipt #{sale.receipt_no}</div>
          </div>

          {/* 58mm receipt */}
          <div className="flex justify-center mb-4">
            <div className="receipt-58 shadow-2xl rounded-sm">
              <div className="center bold" style={{ fontSize: 13 }}>CASHIERPRO MART</div>
              <div className="center" style={{ fontSize: 9 }}>Fresh Groceries · Daily Needs</div>
              <div className="center" style={{ fontSize: 9 }}>GSTIN: 33ABCDE1234F1Z5</div>
              <hr />
              <div className="row"><span>Receipt:</span><span>{sale.receipt_no.slice(-10)}</span></div>
              <div className="row"><span>Date:</span><span>{dtStr}</span></div>
              <div className="row"><span>Cashier:</span><span>{sale.cashier || "Cashier"}</span></div>
              {sale.customer_name && <div className="row"><span>Customer:</span><span>{sale.customer_name}</span></div>}
              {sale.customer_phone && <div className="row"><span>Phone:</span><span>{sale.customer_phone}</span></div>}
              <hr />
              <div className="row bold"><span>Item</span><span>Amt</span></div>
              <hr />
              {sale.items.map((it, i) => (
                <div key={i} style={{ marginBottom: 2 }}>
                  <div>{it.name}</div>
                  <div className="row">
                    <span>{it.quantity} x {Number(it.price).toFixed(2)}</span>
                    <span>{Number(it.subtotal).toFixed(2)}</span>
                  </div>
                </div>
              ))}
              <hr />
              <div className="row"><span>Subtotal</span><span>{Number(sale.subtotal).toFixed(2)}</span></div>
              <div className="row"><span>Tax ({(sale.tax_rate * 100).toFixed(0)}%)</span><span>{Number(sale.tax_amount).toFixed(2)}</span></div>
              {sale.discount > 0 && <div className="row"><span>Discount</span><span>-{Number(sale.discount).toFixed(2)}</span></div>}
              <hr />
              <div className="row bold" style={{ fontSize: 12 }}>
                <span>TOTAL</span><span>Rs {Number(sale.total).toFixed(2)}</span>
              </div>
              <div className="row"><span>Paid ({sale.payment_method})</span><span>{Number(sale.amount_paid).toFixed(2)}</span></div>
              {sale.change_due > 0 && <div className="row"><span>Change</span><span>{Number(sale.change_due).toFixed(2)}</span></div>}
              <hr />
              <div className="center" style={{ fontSize: 9 }}>Thank you · Visit again!</div>
              <div className="center" style={{ fontSize: 8 }}>Printed on Milestone Y50 · 58mm</div>
            </div>
          </div>

          <button
            data-testid="print-receipt-btn"
            onClick={() => window.print()}
            className="w-full h-11 rounded-xl bg-indigo-500 hover:bg-indigo-400 font-semibold flex items-center justify-center gap-2"
          >
            <Printer className="w-4 h-4" /> Print / Save PDF
          </button>
          <button onClick={onClose} className="w-full mt-2 h-10 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-sm">
            New Sale
          </button>
        </div>
      </div>
    </div>
  );
}
