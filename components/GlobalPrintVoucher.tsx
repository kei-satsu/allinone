// src/components/GlobalPrintVoucher.tsx
"use client"
import { useEffect, useState } from "react"

export default function GlobalPrintVoucher() {
  const [printData, setPrintData] = useState<any>(null);

  useEffect(() => {
    const handlePrintEvent = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail) {
        setPrintData(customEvent.detail);
        
        // State ထဲ Data ဝင်သွားပြီး မျက်နှာပြင် Render ဖြစ်သည်အထိ ခေတ္တစောင့်၍ Print ထုတ်သည်
        setTimeout(() => {
          window.print();
        }, 50);
      }
    };

    // Event ကို စောင့်နားထောင်ခြင်း
    window.addEventListener("app:print-voucher", handlePrintEvent);
    return () => window.removeEventListener("app:print-voucher", handlePrintEvent);
  }, []);

  if (!printData) return null;

  return (
    <div className="hidden print:block fixed inset-0 bg-white z-[9999] text-black font-mono text-xs p-2 uppercase tracking-tight">
      {/* 🧾 Slip Size Container (80mm/58mm Thermal Printer standard) */}
      <div className="w-[72mm] mx-auto p-1 space-y-3">
        
        {/* Header */}
        <div className="text-center space-y-0.5">
          <h2 className="text-[16px] font-black tracking-wider">ALL IN ONE</h2>
          <p className="text-[10px] font-bold tracking-widest text-slate-600">EXPRESS LOGISTICS</p>
        </div>

        <div className="border-t border-dashed border-black my-1" />

        {/* Meta Details */}
        <div className="space-y-1 text-[11px]">
          <div className="flex justify-between">
            <span className="font-bold">ITEM ID:</span>
            <span className="font-mono font-black text-sm">{printData.item_id}</span>
          </div>
          <div className="flex justify-between">
            <span>DATE:</span>
            <span>{printData.received_date ? new Date(printData.received_date).toLocaleDateString() : '13/06/2026'}</span>
          </div>
          <div className="flex justify-between">
            <span>BRANCH:</span>
            <span className="font-bold">{printData.branch || 'MDY'}</span>
          </div>
        </div>

        <div className="border-t border-dashed border-black my-1" />

        {/* Sender Info */}
        <div className="space-y-0.5 text-[11px]">
          <span className="font-bold block text-[10px] bg-black text-white px-1 w-max rounded-sm mb-1">SENDER</span>
          <div className="pl-1">
            <p className="font-bold">{printData.sender_name}</p>
            <p className="text-slate-700">CITY: {printData.sender_loc}</p>
          </div>
        </div>

        {/* Receiver Info */}
        <div className="space-y-0.5 text-[11px] pt-1">
          <span className="font-bold block text-[10px] bg-black text-white px-1 w-max rounded-sm mb-1">RECEIVER</span>
          <div className="pl-1 space-y-0.5">
            <p className="font-bold text-[12px]">{printData.receiver_name}</p>
            <p className="font-bold tracking-normal">{printData.receiver_phone}</p>
            <p className="normal-case leading-tight text-slate-700">{printData.receiver_address || printData.receiver_loc}</p>
          </div>
        </div>

        <div className="border-t border-dashed border-black my-1" />

        {/* Pricing */}
        <div className="space-y-1 text-[11px]">
          <div className="flex justify-between">
            <span>COD AMOUNT:</span>
            <span className="font-bold">{(printData.cod_amount || 0).toLocaleString()} KS</span>
          </div>
          <div className="flex justify-between">
            <span>DELI FEE:</span>
            <span>{(printData.deli_fee || 0).toLocaleString()} KS</span>
          </div>
          
          <div className="border-t border-dotted border-black my-0.5" />
          
          <div className="flex justify-between text-sm font-black pt-0.5">
            <span>TOTAL:</span>
            <span>{((printData.cod_amount || 0) + (printData.deli_fee || 0)).toLocaleString()} KS</span>
          </div>
        </div>

        <div className="border-t border-dashed border-black my-2" />

        {/* Footer Barcode Placeholder */}
        <div className="text-center space-y-1 pt-1">
          <p className="text-[9px] font-bold tracking-normal">*** THANK YOU FOR USING OUR SERVICE ***</p>
          <div className="text-[10px] font-mono font-bold tracking-widest bg-slate-100 py-1 border border-black/10">
            *{printData.item_id}*
          </div>
        </div>

      </div>
    </div>
  )
}