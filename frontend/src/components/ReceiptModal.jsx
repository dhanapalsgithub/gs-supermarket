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
          /* 1. Page dimensions reset for 80mm continuous thermal roll */
          @page {
            size: 80mm auto !important;
            margin: 0mm !important;
          }

          /* 2. Hide everything on the page visually */
          body * {
            visibility: hidden !important;
          }

          /* 3. Make ONLY the printable section and its children visible */
          #print-area, #print-area * {
            visibility: visible !important;
          }

          /* 4. Position print area directly at top-left corner with box-sizing */
          #print-area {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 72mm !important; /* Printable printable width on 80mm paper */
            margin: 0 !important;
            padding: 2mm 3mm !important;
            background: #ffffff !important;
            color: #000000 !important;
            box-sizing: border-box !important;
          }

          /* 5. Typography and layout rules for crisp thermal printing */
          #printable-receipt {
            width: 100% !important;
            font-family: 'Courier New', Courier, monospace !important;
            font-size: 11px !important;
            line-height: 1.2 !important;
            color: #000000 !important;
            box-sizing: border-box !important;
          }

          #printable-receipt table {
            width: 100% !important;
            border-collapse: collapse !important;
            table-layout: fixed !important;
          }

          #printable-receipt th, 
          #printable-receipt td {
            color: #000000 !important;
            font-weight: 700 !important;
            word-break: break-word !important;
            padding: 2px 0 !important;
          }
        }
      `}</style>

      {/* Screen Overlay Container */}
      <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
        
        {/* Modal Card */}
        <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
          
          {/* Header - Screen Only */}
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

          {/* Targeted Print Container */}
          <div id="print-area">
            <div 
              id="printable-receipt" 
              className="p-6 overflow-y-auto font-mono text-xs text-black font-bold space-y-3 bg-white print:p-0 print:m-0"
            >
              <div className="text-center space-y-1">
                <h2 className="text-base font-black uppercase tracking-wider text-black">GS BILLING PRO</h2>
                <p className="text-[11px] text-black font-bold">Store Counter Sales Receipt</p>
                <p className="text-[10px] text-black font-bold">------------------------------------------------</p>
              </div>

              <div className="space-y-1 text-[11px] text-black">
                <div className="flex justify-between">
                  <span>Receipt No:</span>
                  <span className="font-black truncate max-w-[140px] text-right">{sale.receipt_no || "N/A"}</span>
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
                      <th className="pb-1 w-[45%]">Item</th>
                      <th className="pb-1 text-center w-[15%]">Qty</th>
                      <th className="pb-1 text-right w-[20%]">Price</th>
                      <th className="pb-1 text-right w-[20%]">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dashed divide-black">
                    {sale.items && sale.items.map((item, idx) => (
                      <tr key={idx} className="text-[11px] text-black font-bold">
                        <td className="py-1 pr-1 truncate">{item.name}</td>
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
      </div>
    </>
  );
}