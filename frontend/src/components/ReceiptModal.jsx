import { Printer, X, Bluetooth } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { connectPrinter, printReceipt, isBleAvailable, isConnected } from "../lib/bluetooth";

export default function ReceiptModal({ sale, onClose }) {
  const [printing, setPrinting] = useState(false);
  const created = new Date(sale.created_at);
  const dtStr = created.toLocaleString("en-IN", { hour12: true });

  const btPrint = async () => {
    try {
      setPrinting(true);
      if (!isBleAvailable()) return toast.error("Web Bluetooth needs Chrome/Edge desktop");
      if (!isConnected()) {
        const info = await connectPrinter();
        toast.success(`Connected to ${info.name}`);
      }
      await printReceipt(sale);
      toast.success("Sent to Milestone Y50");
    } catch (e) {
      toast.error(e.message || "Bluetooth print failed");
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div data-testid="receipt-modal" data-no-refocus className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-sm glass-strong relative">
        <button onClick={onClose} className="absolute top-3 right-3 p-2 rounded-lg hover:bg-slate-100 text-slate-500">
          <X className="w-4 h-4" />
        </button>
        <div className="p-5">
          <div className="text-center mb-3">
            <div className="label-cap text-emerald-600 mb-1">Payment Successful</div>
            <div className="text-lg font-bold">Receipt {sale.receipt_no}</div>
          </div>

          <div className="flex justify-center mb-4">
            <div className="receipt-58">
              <div className="center bold" style={{ fontSize: 14, letterSpacing: 1 }}>R I BILLING PRO</div>
              <div className="center bold" style={{ fontSize: 12 }}>GS SUPERMARKET</div>
              <div className="center" style={{ fontSize: 9 }}>Fresh Groceries · Daily Needs</div>
              <div className="center" style={{ fontSize: 9 }}>GSTIN: 33ABCDE1234F1Z5</div>
              <hr />
              <div className="row"><span>Receipt:</span><span>{sale.receipt_no.slice(-10)}</span></div>
              <div className="row"><span>Date:</span><span>{dtStr}</span></div>
              <div className="row"><span>Cashier:</span><span>{sale.cashier || "Cashier"}</span></div>
              {sale.customer_name && <div className="row"><span>Customer:</span><span>{sale.customer_name}</span></div>}
              {sale.customer_phone && <div className="row"><span>Phone:</span><span>{sale.customer_phone}</span></div>}
              {sale.delivery_address && <div style={{ fontSize: 9 }}>Addr: {sale.delivery_address}</div>}
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
              <div className="row"><span>Paid ({sale.payment_method})</span><span>{Number(sale.amount_paid || sale.total).toFixed(2)}</span></div>
              {sale.change_due > 0 && <div className="row"><span>Change</span><span>{Number(sale.change_due).toFixed(2)}</span></div>}
              <hr />
              <div className="center" style={{ fontSize: 9 }}>Thank you · Visit again!</div>
              <div className="center bold" style={{ fontSize: 9 }}>Built by R I Billing Pro</div>
              <div className="center" style={{ fontSize: 8 }}>Milestone Y50 · 58mm</div>
            </div>
          </div>

          <button
            data-testid="bt-print-btn"
            onClick={btPrint}
            disabled={printing}
            className="w-full h-11 rounded-xl btn-primary flex items-center justify-center gap-2 mb-2"
          >
            <Bluetooth className="w-4 h-4" /> {printing ? "Printing…" : "Print via Bluetooth (Milestone Y50)"}
          </button>
          <button
            data-testid="print-receipt-btn"
            onClick={() => window.print()}
            className="w-full h-11 rounded-xl btn-ghost flex items-center justify-center gap-2"
          >
            <Printer className="w-4 h-4" /> Save as PDF / Browser Print
          </button>
          <button onClick={onClose} className="w-full mt-2 h-10 rounded-xl text-sm text-slate-500 hover:text-slate-800">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
