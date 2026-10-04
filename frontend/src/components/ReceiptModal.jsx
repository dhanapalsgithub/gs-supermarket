import React from 'react';
import { X, Printer } from 'lucide-react';
import { money } from '../lib/api';

export default function ReceiptModal({ sale, onClose }) {
  if (!sale) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      <style>{`
        @media print {
          @page {
            size: 80mm auto !important;
            margin: 0mm !important;
          }

          /* Hide ALL standard website content on print */
          body > * {
            display: none !important;
          }

          /* Force ONLY the receipt modal wrapper to render */
          body > #thermal-print-wrapper {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
          }

          /* General print resets */
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          #printable-receipt {
            display: block !important;
            width: 100% !important;
            max-width: 80mm !important;
            padding: 2mm !important;
            margin: 0 !important;
            font-family: 'Courier New', Courier, monospace !important;
            font-size: 12px !important;
            line-height: 1.3 !important;
            color: #000000 !important;
          }

          #printable-receipt * {
            color: #000000 !important;
            font-weight: 700 !important;
          }

          #printable-receipt table {
            width: 100% !important;
            border-collapse: collapse !important;
          }
        }
      `}</style>

      {/* Direct Body Top Wrapper for Printing */}
      <div id="thermal-print-wrapper" className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 print:p-0 print:static print:bg-transparent">
        
        <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] print:max-h-none print:shadow-none print:w-full print:rounded-none">
          
          {/* On-screen Header / Print Button */}
          <div className="p-4 bg-slate-100 border-b flex items-center justify-between print:hidden">
            <span className="font-bold text-sm text-slate-800">Receipt Preview (80mm)</span>
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

          {/* Printable Thermal Receipt Content */}
          <div 
            id="printable-receipt" 
            className="p-6 overflow-y-auto font-mono text-xs text-black font-bold space-y-3 bg-white print:p-0 print:m-0 print:w-full print:overflow-visible"
          >
            <div className="text-center space-y-1">
              <h2 className="text-base font-black uppercase tracking-wider text-black">GS BILLING PRO</h2>
              <p className="text-[11px] text-black font-bold">Store Counter Sales Receipt</p>
              <p className="text-[10px] text-black font-bold">------------------------------------------------</p>
            </div>

            <div className="space-y-1 text-[11px] text-black">
              <div className="flex justify-between">
                <span>Receipt No:</span>
                <span className="font-black">{sale.receipt_no || "N/A"}</span>
              </div>
              <div className="flex justify-between">
                <span>Date:</span>
                <span className="font-bold">{sale.created_at ? new Date(sale.created_at).toLocaleString() : new Date().toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Cashier:</span>
                <span className="font-bold">{sale.cashier || "Admin"}</span>
              </div>
              {sale.customer_name && (
                <div className="flex justify-between">
                  <span>Customer:</span>
                  <span className="font-bold">{sale.customer_name} ({sale.customer_phone || ""})</span>
                </div>
              )}
            </div>

            <div className="border-t border-dashed border-black pt-2">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-dashed border-black text-[11px] text-black font-black">
                    <th className="pb-1">Item</th>
                    <th className="pb-1 text-center">Qty</th>
                    <th className="pb-1 text-right">Price</th>
                    <th className="pb-1 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dashed divide-black">
                  {sale.items && sale.items.map((item, idx) => (
                    <tr key={idx} className="text-[11px] text-black font-bold">
                      <td className="py-1 pr-1 truncate max-w-[100px]">{item.name}</td>
                      <td className="py-1 text-center">{item.quantity}</td>
                      <td className="py-1 text-right">{money(item.price)}</td>
                      <td className="py-1 text-right font-black">{money(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border-t border-dashed border-black pt-2 space-y-1 text-[11px] text-black">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span className="font-bold">{money(sale.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tax (5%):</span>
                <span className="font-bold">{money(sale.tax_amount || 0)}</span>
              </div>
              {sale.discount > 0 && (
                <div className="flex justify-between text-black">
                  <span>Discount:</span>
                  <span className="font-bold">-{money(sale.discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-xs font-black pt-1 border-t border-black">
                <span>TOTAL:</span>
                <span className="font-black">{money(sale.total)}</span>
              </div>
              <div className="flex justify-between text-[11px] text-black pt-1">
                <span>Payment Mode:</span>
                <span className="font-black">{sale.payment_method || "CASH"}</span>
              </div>
              {sale.payment_method === "CASH" && (
                <>
                  <div className="flex justify-between text-[11px] text-black">
                    <span>Cash Paid:</span>
                    <span className="font-bold">{money(sale.amount_paid || sale.total)}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-black">
                    <span>Change Due:</span>
                    <span className="font-bold">{money(sale.change_due || 0)}</span>
                  </div>
                </>
              )}
            </div>

            <div className="text-center pt-3 space-y-1 text-[11px] text-black font-bold border-t border-dashed border-black">
              <p className="font-black">Thank You! Visit Again!</p>
              <p className="text-[10px]">Powered by GS Billing Pro</p>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}