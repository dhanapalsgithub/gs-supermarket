import React from 'react';
import { X, Printer } from 'lucide-react';
import { money } from '../lib/api';

export default function ReceiptModal({ sale, onClose }) {
  if (!sale) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header Actions (Hidden when printing) */}
        <div className="p-4 bg-slate-100 border-b flex items-center justify-between print:hidden">
          <span className="font-bold text-sm text-slate-700">Receipt Preview (80mm)</span>
          <div className="flex gap-2">
            <button 
              onClick={handlePrint}
              className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 hover:bg-indigo-700"
            >
              <Printer className="w-3.5 h-3.5" /> Print
            </button>
            <button 
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Receipt Area (80mm Standard Size Layout) */}
        <div className="p-6 overflow-y-auto font-mono text-xs text-slate-800 space-y-4 print:p-0 print:m-0 print:w-[80mm]" id="printable-receipt">
          
          <div className="text-center space-y-1">
            <h2 className="text-base font-extrabold uppercase tracking-wider">GS BILLING PRO</h2>
            <p className="text-[11px] text-slate-500">Store Counter Sales Receipt</p>
            <p className="text-[10px] text-slate-400">------------------------------------------------</p>
          </div>

          <div className="space-y-0.5 text-[11px]">
            <div className="flex justify-between">
              <span>Receipt No:</span>
              <span className="font-bold">{sale.receipt_no || "N/A"}</span>
            </div>
            <div className="flex justify-between">
              <span>Date:</span>
              <span>{sale.created_at ? new Date(sale.created_at).toLocaleString() : new Date().toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Cashier:</span>
              <span>{sale.cashier || "Cashier"}</span>
            </div>
            {sale.customer_name && (
              <div className="flex justify-between">
                <span>Customer:</span>
                <span>{sale.customer_name} ({sale.customer_phone || ""})</span>
              </div>
            )}
          </div>

          <div className="border-t border-dashed border-slate-300 pt-2">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-dashed border-slate-200 text-[10px] text-slate-500">
                  <th className="pb-1">Item</th>
                  <th className="pb-1 text-center">Qty</th>
                  <th className="pb-1 text-right">Price</th>
                  <th className="pb-1 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dashed divide-slate-100">
                {sale.items && sale.items.map((item, idx) => (
                  <tr key={idx} className="text-[11px]">
                    <td className="py-1 pr-1 truncate max-w-[110px]">{item.name}</td>
                    <td className="py-1 text-center">{item.quantity}</td>
                    <td className="py-1 text-right">{money(item.price)}</td>
                    <td className="py-1 text-right font-bold">{money(item.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-t border-dashed border-slate-300 pt-2 space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>{money(sale.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Tax (5%):</span>
              <span>{money(sale.tax_amount || 0)}</span>
            </div>
            {sale.discount > 0 && (
              <div className="flex justify-between text-rose-600">
                <span>Discount:</span>
                <span>-{money(sale.discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-bold pt-1 border-t border-slate-300">
              <span>TOTAL:</span>
              <span>{money(sale.total)}</span>
            </div>
            <div className="flex justify-between text-[10px] text-slate-500 pt-1">
              <span>Payment Mode:</span>
              <span className="font-bold">{sale.payment_method || "CASH"}</span>
            </div>
            {sale.payment_method === "CASH" && (
              <>
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>Cash Paid:</span>
                  <span>{money(sale.amount_paid || sale.total)}</span>
                </div>
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>Change Due:</span>
                  <span>{money(sale.change_due || 0)}</span>
                </div>
              </>
            )}
          </div>

          <div className="text-center pt-4 space-y-1 text-[10px] text-slate-500 border-t border-dashed border-slate-300">
            <p className="font-bold">Thank You! Visit Again!</p>
            <p>Powered by GS Billing Pro</p>
          </div>

        </div>

      </div>
    </div>
  );
}