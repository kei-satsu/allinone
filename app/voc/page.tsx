"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/lib/supabase";
import { toPng } from "html-to-image";

export default function VoucherTemplate() {
  // ─── State ────────────────────────────────────
  const [voucherData, setVoucherData] = useState<any>(null);   // final data for printing
  const [editFormData, setEditFormData] = useState<any>(null);  // temporary editing data
  const [isEditing, setIsEditing] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [loading, setLoading] = useState(true);
  const [printTrigger, setPrintTrigger] = useState(false);

  // ─── Fetch Order from Supabase ────────────────
  useEffect(() => {
    async function loadVoucherData() {
      const savedData = localStorage.getItem("print_order_data");
      if (!savedData) {
        setLoading(false);
        return;
      }

      let orderId = savedData.replace(/"/g, "");

      try {
        // Try with primary key 'id'
        const { data, error } = await supabase
          .from("orders")
          .select("*")
          .eq("id", orderId)
          .single();

        if (error) {
          console.error("First attempt failed, trying with item_id...", error);
          const { data: retryData } = await supabase
            .from("orders")
            .select("*")
            .eq("item_id", orderId)
            .single();

          if (retryData) {
            setVoucherData(retryData);
          } else {
            console.error("No data found.");
          }
        } else if (data) {
          setVoucherData(data);
        }
      } catch (e) {
        console.error("Fetch error:", e);
      } finally {
        setLoading(false);
      }
    }

    loadVoucherData();
  }, []);

  // When voucherData arrives (first time), show the decision dialog
  useEffect(() => {
    if (voucherData && !showDialog && !isEditing) {
      setShowDialog(true);
    }
  }, [voucherData]);

  // ─── Print Trigger Effect ─────────────────────
  useEffect(() => {
    if (printTrigger) {
      const timer = setTimeout(() => {
        window.print();
        setPrintTrigger(false);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [printTrigger]);

  // ─── Handlers ─────────────────────────────────
  const handlePrintNow = useCallback(() => {
    setShowDialog(false);
    // give a small delay so DOM reflects the state before printing
    setPrintTrigger(true);
  }, []);

  const handleEdit = useCallback(() => {
    // Copy current voucherData to editFormData
    setEditFormData({ ...voucherData });
    setIsEditing(true);
    setShowDialog(false);
  }, [voucherData]);

  const handleSaveAndPrint = useCallback(() => {
    // Transfer edited data to voucherData and print
    setVoucherData(editFormData);
    setIsEditing(false);
    setPrintTrigger(true);
  }, [editFormData]);

  const handleDiscardAndPrint = useCallback(() => {
    // Discard edits, keep original data and print
    setEditFormData(null);
    setIsEditing(false);
    setPrintTrigger(true);
  }, []);

  // ─── Field change for editing form ────────────
  const handleEditChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setEditFormData((prev: any) => ({ ...prev, [name]: value }));
  };

  // ─── Derive display data ──────────────────────
  const displayData = isEditing && editFormData ? editFormData : voucherData;
  const fields = {
    receiveDate: displayData?.received_date || displayData?.receiveDate || "---",
    itemId: displayData?.item_id || displayData?.itemId || "---",
    senderName: displayData?.sender_name || displayData?.senderName || "---",
    senderPhone: displayData?.sender_phone || displayData?.senderPhone || "---",
    senderLoc: displayData?.sender_loc || displayData?.senderLoc || "---",
    receiverName: displayData?.receiver_name || displayData?.receiverName || "---",
    receiverPhone: displayData?.receiver_phone || displayData?.receiverPhone || "---",
    receiverAddress:
      displayData?.receiver_address ||
      displayData?.receiverAddress ||
      displayData?.receiver_loc ||
      "---",
    codAmount: displayData?.cod_amount ?? displayData?.codAmount ?? "0",
    deliFee: displayData?.deli_fee ?? displayData?.deliFee ?? "0",
    payType: displayData?.fee_type || displayData?.payType || "COLLECT",
    totalAmount: displayData?.total_amount ?? displayData?.totalAmount ?? "0",
    remarkText: displayData?.note || displayData?.remark || "",
  };

   // ─── Ref for Voucher Capture ──────────────────
const voucherRef = useRef<HTMLDivElement>(null); // Voucher Div ကို လှမ်းဖမ်းဖို့

// ─── Save as Image Handler ────────────────────
const handleSaveAsImage = useCallback(() => {
  if (voucherRef.current === null) return;

  // pixelRatio: 3 ထည့်ထားလို့ ပုံထွက်လာရင် စာသားနဲ့ QR က လုံးဝမဝါးဘဲ ဂျတ်ကနဲ ရှင်းနေမှာပါ
  toPng(voucherRef.current, { cacheBust: true, pixelRatio: 3 })
    .then((dataUrl) => {
      const link = document.createElement("a");
      link.download = `Voucher-${fields.itemId || "order"}.png`; // သိမ်းမယ့် ဖိုင်နာမည်
      link.href = dataUrl;
      link.click();
    })
    .catch((err) => {
      console.error("အော်တို ပုံပြောင်းရာတွင် အမှားအယွင်းရှိခဲ့သည်-", err);
    });
}, [fields.itemId]);

  // ─── Loading State ────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white font-sans">
        <div className="text-center space-y-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
          <p className="text-sm text-gray-400">Loading Voucher From Supabase...</p>
        </div>
      </div>
    );
  }

  // ─── No Data Found ────────────────────────────
  if (!voucherData) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white font-sans p-4">
        <div className="text-center bg-gray-800 p-6 rounded-xl max-w-sm border border-red-500">
          <p className="text-red-400 font-bold mb-2">❌ ပါဆယ်ဒေတာ ရှာမတွေ့ပါ</p>
          <p className="text-xs text-gray-400 break-all">
            ID: {localStorage.getItem("print_order_data")}
          </p>
          <p className="text-[11px] text-amber-400 mt-2">
            Supabase Table နာမည် (သို့မဟုတ်) ID Column မတူညီခြင်း ဖြစ်နိုင်ပါသည်။
          </p>
        </div>
      </div>
    );
  }

  

  return (
    <div className="min-h-screen bg-gray-900 py-10 flex flex-col items-center justify-center font-sans antialiased">
      {/* ── DECISION DIALOG ───────────────────── */}
{showDialog && (
  // 💡 ရှင်းလင်းချက်- bg-black/15 သုံးထားပြီး blur ဖယ်ထားလို့ နောက်ခံကို အကြည်အတိုင်း မြင်ရပါမည်။
  // 💻 Desktop တွင် ညာဘက်အပေါ်ထောင့်၊ 📱 Mobile တွင် အောက်ခြေ၌ ပေါ်အောင် နေရာညှိထားပါသည်။
  <div className="fixed inset-0 z-50 flex items-end justify-center md:items-start md:justify-end p-4 bg-black/15 transition-all">
    {/* 💡 ရှင်းလင်းချက်- ညာဘက်အပေါ်ထောင့်က "x" ခလုတ် အလုပ်လုပ်ရန် "relative" Class တိုးထားပါသည်။ */}
    <div className="bg-white text-gray-800 rounded-2xl shadow-2xl p-5 max-w-sm w-full border border-slate-100 animate-in fade-in slide-in-from-bottom-4 md:slide-in-from-right-4 duration-300 relative">
      
      {/* ❌ ပြန်ပိတ်ရန် ခလုတ် (Close Button) */}
      <button
        onClick={() => setShowDialog(false)} // 💡 Dialog ကို ပိတ်မည့် Function[cite: 3]
        className="absolute top-4 right-4 p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition active:scale-90"
        title="Close Dialog"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Dialog Header */}
      {/* 💡 pr-6 ထည့်ထားပေးလို့ စာသားက x ခလုတ်နဲ့ သွားထပ်မှာ မဟုတ်ပါဘူး */}
      <div className="flex items-center gap-2 mb-2 justify-center md:justify-start pr-6">
        <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
        <h2 className="text-sm font-extrabold text-slate-800 tracking-tight uppercase">Voucher Action Required</h2>
      </div>
      
      <p className="text-[11px] text-slate-500 mb-4 text-center md:text-left leading-relaxed">
        နောက်ခံတွင် ဘောင်ချာ အချက်အလက်များအား စစ်ဆေးနိုင်ပါသည်။ သင်ပြုလုပ်လိုသည့် လုပ်ဆောင်ချက်ကို ရွေးချယ်ပေးပါ အစ်ကို။
      </p>
      
      {/* Action Buttons Stack */}
      <div className="flex flex-col gap-2">
        
        {/* ၁။ တိုက်ရိုက် PRINT ထုတ်မည့်ခလုတ် */}
        <button
          onClick={handlePrintNow}
          className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 active:scale-[0.98] shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.8A8.001 8.001 0 1017.28 13.8M12 3v12m0 0l-3.75-3.75M12 15l3.75-3.75" />
          </svg>
          တိုက်ရိုက် Print ထုတ်မည် (Print Now)
        </button>

        {/* ၂။ ပုံအဖြစ်သိမ်းမည့်ခလုတ် */}
        <button
          onClick={() => {
            handleSaveAsImage(); // ပုံသိမ်းသည့် Function ကို လှမ်းခေါ်ခြင်း[cite: 3]
            setShowDialog(false); // အလုပ်လုပ်ပြီးလျှင် Dialog Box အား ပိတ်ရန်[cite: 3]
          }}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 active:scale-[0.98] shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Voucher အား ပုံအဖြစ်သိမ်းမည် (Save Image)
        </button>

        {/* ၃။ ဒေတာပြင်ဆင်မည့်ခလုတ် */}
        <button
          onClick={handleEdit}
          className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 active:scale-[0.98] shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
          </svg>
          ဒေတာပြင်ဆင်ပြီးမှ Print ထုတ်မည် (Edit & Print)
        </button>

      </div>
    </div>
  </div>
)}

      {/* ── EDITING FORM (Modal) ────────────────── */}
      {isEditing && editFormData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg overflow-y-auto max-h-[90vh] text-gray-800">
            <h2 className="text-xl font-bold mb-4 text-center">Voucher ဒေတာ ပြင်ဆင်ရန်</h2>

            <div className="space-y-3 text-sm">
              {/* Received Date */}
              <label className="block">
                <span className="font-semibold">Date</span>
                <input
                  type="text"
                  name="received_date"
                  value={editFormData.received_date || ""}
                  onChange={handleEditChange}
                  className="w-full mt-1 px-3 py-1.5 border rounded-md focus:ring focus:ring-blue-200"
                />
              </label>

              {/* Item ID */}
              <label className="block">
                <span className="font-semibold">Item ID</span>
                <input
                  type="text"
                  name="item_id"
                  value={editFormData.item_id || ""}
                  onChange={handleEditChange}
                  className="w-full mt-1 px-3 py-1.5 border rounded-md focus:ring focus:ring-blue-200"
                />
              </label>

              {/* Sender Name */}
              <label className="block">
                <span className="font-semibold">Sender Name</span>
                <input
                  type="text"
                  name="sender_name"
                  value={editFormData.sender_name || ""}
                  onChange={handleEditChange}
                  className="w-full mt-1 px-3 py-1.5 border rounded-md focus:ring focus:ring-blue-200"
                />
              </label>

              {/* Sender Phone */}
              <label className="block">
                <span className="font-semibold">Sender Phone</span>
                <input
                  type="text"
                  name="sender_phone"
                  value={editFormData.sender_phone || ""}
                  onChange={handleEditChange}
                  className="w-full mt-1 px-3 py-1.5 border rounded-md focus:ring focus:ring-blue-200"
                />
              </label>

              {/* Sender Location */}
              <label className="block">
                <span className="font-semibold">Sender Address</span>
                <input
                  type="text"
                  name="sender_loc"
                  value={editFormData.sender_loc || ""}
                  onChange={handleEditChange}
                  className="w-full mt-1 px-3 py-1.5 border rounded-md focus:ring focus:ring-blue-200"
                />
              </label>

              {/* Receiver Name */}
              <label className="block">
                <span className="font-semibold">Receiver Name</span>
                <input
                  type="text"
                  name="receiver_name"
                  value={editFormData.receiver_name || ""}
                  onChange={handleEditChange}
                  className="w-full mt-1 px-3 py-1.5 border rounded-md focus:ring focus:ring-blue-200"
                />
              </label>

              {/* Receiver Phone */}
              <label className="block">
                <span className="font-semibold">Receiver Phone</span>
                <input
                  type="text"
                  name="receiver_phone"
                  value={editFormData.receiver_phone || ""}
                  onChange={handleEditChange}
                  className="w-full mt-1 px-3 py-1.5 border rounded-md focus:ring focus:ring-blue-200"
                />
              </label>

              {/* Receiver Address */}
              <label className="block">
                <span className="font-semibold">Receiver Address</span>
                <textarea
                  name="receiver_address"
                  rows={2}
                  value={editFormData.receiver_address || ""}
                  onChange={handleEditChange}
                  className="w-full mt-1 px-3 py-1.5 border rounded-md focus:ring focus:ring-blue-200"
                />
              </label>

              {/* COD Amount */}
<label className="block">
  <span className="font-semibold">COD</span>
  <div className="mt-1 flex rounded-md shadow-sm">
    <input
      type="text"
      name="cod_amount"
      value={editFormData.cod_amount ?? ""}
      onChange={handleEditChange}
      className="block w-full flex-1 min-w-0 px-3 py-1.5 border border-gray-300 rounded-none rounded-l-md focus:outline-none focus:ring focus:ring-blue-200 focus:border-blue-400"
    />
    <span className="inline-flex items-center px-3 rounded-r-md border border-l-0 border-gray-300 bg-slate-50 text-slate-500 text-sm font-semibold select-none">
      Ks
    </span>
  </div>
</label>

{/* Delivery Fee */}
<label className="block mt-4"> {/* အကွာအဝေးအတွက် mt-4 လေး ထည့်ပေးထားပါတယ် */}
  <span className="font-semibold">Deli Fee</span>
  <div className="mt-1 flex rounded-md shadow-sm">
    <input
      type="text"
      name="deli_fee"
      value={editFormData.deli_fee ?? ""}
      onChange={handleEditChange}
      className="block w-full flex-1 min-w-0 px-3 py-1.5 border border-gray-300 rounded-none rounded-l-md focus:outline-none focus:ring focus:ring-blue-200 focus:border-blue-400"
    />
    <span className="inline-flex items-center px-3 rounded-r-md border border-l-0 border-gray-300 bg-slate-50 text-slate-500 text-sm font-semibold select-none">
      Ks
    </span> 
  </div>
</label>

              {/* Pay Type */}
              <label className="block">
                <span className="font-semibold">Pay Type</span>
                <input
                  type="text"
                  name="fee_type"
                  value={editFormData.fee_type || "COLLECT"}
                  onChange={handleEditChange}
                  className="w-full mt-1 px-3 py-1.5 border rounded-md focus:ring focus:ring-blue-200"
                />
              </label>

              {/* Total Amount */}
              <label className="block">
                <span className="font-semibold">Total</span>
                <input
                  type="text"
                  name="total_amount"
                  value={editFormData.total_amount ?? ""}
                  onChange={handleEditChange}
                  className="w-full mt-1 px-3 py-1.5 border rounded-md focus:ring focus:ring-blue-200"
                />
              </label>

              {/* Remark */}
              <label className="block">
                <span className="font-semibold">Remark (မှတ်ချက်)</span>
                <textarea
                  name="note"
                  rows={3}
                  value={editFormData.note || ""}
                  onChange={handleEditChange}
                  className="w-full mt-1 px-3 py-1.5 border rounded-md focus:ring focus:ring-blue-200"
                />
              </label>
            </div>

            {/* Buttons */}
{/* 💡 ရှင်းလင်းချက်- ခလုတ် ၃ ခုစလုံး အချိုးညီညီ တန်းနေစေရန် flex-1 နှင့် gap-2.5 ကို သုံးထားပါသည် */}
<div className="flex justify-between mt-6 gap-2.5 w-full text-white">
  
  {/* ၁။ မပြင်တော့ဘူး (Print Original) */}
  <button
    onClick={handleDiscardAndPrint} //
    className="flex-1 py-2.5 bg-gray-400 hover:bg-gray-500 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 active:scale-[0.95] shadow-sm"
  >
    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
    </svg>
    <span className="truncate">Print Original</span>
  </button>

  {/* ၂။ Save & Print */}
  <button
    onClick={handleSaveAndPrint} //
    className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 active:scale-[0.95] shadow-sm"
  >
    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
    <span className="truncate">Save &amp; Print</span>
  </button>

  {/* ၃။ Save Image */}
  <button
    onClick={() => {
      handleSaveAsImage(); //
      setShowDialog(false); //[cite: 3]
    }}
    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 active:scale-[0.95] shadow-sm"
  >
    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
    <span className="truncate">Save Image</span>
  </button>

</div>
          </div>
        </div>
      )}

      {/* ── PRINTABLE VOUCHER ───────────────────── */}
      <div
      ref={voucherRef}
        style={{ width: "4in", height: "6in" }}
        className="printable-voucher bg-white text-black p-3 flex flex-col select-none box-border relative shadow-2xl"
      >
        <style
  dangerouslySetInnerHTML={{
    __html: `
      @page { 
        size: 4in 6in; 
        margin: 0; 
      }
      @media print {
        /* ၁။ နောက်ခံ အမည်းနှင့် အခြား Element များကို မပြရန် */
        html, body {
          background: #ffffff !important;
          color: #000000 !important;
          margin: 0 !important;
          padding: 0 !important;
          width: 4in !important;
          height: 6in !important;
          overflow: hidden !important;
        }

        /* ၂။ Printable Voucher ကို သီးသန့် အပြည့်ဆွဲတင်ရန် */
        .printable-voucher {
          position: fixed !important;
          left: 0 !important;
          top: 0 !important;
          width: 4in !important;
          height: 6in !important;
          box-shadow: none !important;
          padding: 12px !important;
          background: white !important;
          z-index: 99999 !important;
        }
      }
    `,
  }}
/>

        {/* ── TOP CONTENT AREA ── */}
        <div>
          <div className="flex items-center justify-center gap-2 pb-1">
            <img src="/voclogo.png" alt="Logo" className="w-6 h-6 object-contain shrink-0" />
            <h1 className="text-l font-bold tracking-tight uppercase">ALL IN ONE EXPRESS</h1>
          </div>

          <div className="flex justify-between items-baseline mt-0 text-[12px]">
            <div>
              <span className="font-bold">Date:</span>{" "}
              <span className="font-mono">{fields.receiveDate}</span>
            </div>
            <div className="text-[12px] font-black font-mono tracking-wider">{fields.itemId}</div>
          </div>

          <div className="flex justify-between gap-1 items-start mt-1.5 text-[10px]">
            <div className="flex flex-1 items-stretch">
              <div className="w-[65px] font-bold shrink-0 flex flex-col justify-between text-right pr-1.5">
                <div>MDY Office:</div>
                <div className="mt-0">YGN Office:</div>
              </div>
              <div className="w-[1px] bg-black mx-0.5 self-stretch"></div>
              <div className="flex flex-col justify-between pl-1.5 pr-1 text-gray-900 font-medium">
                <div>No.Nga-6/93, 62A, between 109 & 109B, Mandalay.09-889988856</div>
                <div className="mt-1">
                  No.280, Corner of Du Yar St. & Ba La Min Htin St., 50 ward, North Dagon,
                  Yangon.
                </div>
              </div>
            </div>
            <div className="bg-white shrink-0 ml-1 flex items-center justify-center">
              <QRCodeSVG value={fields.itemId} size={52} />
            </div>
          </div>

          {/* SENDER SECTION */}
          <div className="mt-2">
            <div className="text-center font-bold text-[11px] tracking-widest border-y border-black py-[2px] uppercase">
              FROM
            </div>
            <div className="mt-1 py-1 text-[12px] space-y-0.5">
              <div className="flex items-start">
                <span
                  className="w-16 font-bold text-right pr-2 shrink-0 text-[11px]"
                  style={{ fontFamily: "Pyidaungsu, Arial, sans-serif" }}
                >
                  Name:
                </span>
                <span
                  className="font-medium text-black text-[11px]"
                  style={{ fontFamily: "Pyidaungsu, Arial, sans-serif" }}
                >
                  {fields.senderName}
                </span>
              </div>
              <div className="flex items-start">
                <span
                  className="w-16 font-bold text-right pr-2 shrink-0 text-[11px]"
                  style={{ fontFamily: "Pyidaungsu, Arial, sans-serif" }}
                >
                  Phone:
                </span>
                <span
                  className="font-medium text-black text-[11px]"
                  style={{ fontFamily: "Pyidaungsu, Arial, sans-serif" }}
                >
                  {fields.senderPhone}
                </span>
              </div>
              <div className="flex items-start">
                <span
                  className="w-16 font-bold text-right pr-2 shrink-0 text-[11px]"
                  style={{ fontFamily: "Pyidaungsu, Arial, sans-serif" }}
                >
                  Address:
                </span>
                <span
                  className="font-medium text-black text-[11px]"
                  style={{ fontFamily: "Pyidaungsu, Arial, sans-serif" }}
                >
                  {fields.senderLoc}
                </span>
              </div>
            </div>
          </div>

          {/* RECEIVER SECTION */}
          <div className="mt-1">
            <div className="text-center font-bold text-xs tracking-widest border-y border-black py-[2px] uppercase">
              TO
            </div>
            <div className="mt-1 py-1 text-[12px] space-y-0.5">
              <div className="flex items-start">
                <span
                  className="w-16 font-bold text-right pr-2 shrink-0 text-[12px]"
                  style={{ fontFamily: "Pyidaungsu, Arial, sans-serif" }}
                >
                  Name:
                </span>
                <span
                  className="font-bold text-black text-[12px]"
                  style={{ fontFamily: "Pyidaungsu, Arial, sans-serif" }}
                >
                  {fields.receiverName}
                </span>
              </div>
              <div className="flex items-start">
                <span
                  className="w-16 font-bold text-right pr-2 shrink-0 text-[12px]"
                  style={{ fontFamily: "Pyidaungsu, Arial, sans-serif" }}
                >
                  Phone:
                </span>
                <span
                  className="font-mono font-bold text-black text-[12px]"
                  style={{ fontFamily: "Pyidaungsu, Arial, sans-serif" }}
                >
                  {fields.receiverPhone}
                </span>
              </div>
              <div className="flex items-start pt-0.5 pb-1">
                <span
                  className="w-16 font-bold text-right pr-2 shrink-0 text-[12px]"
                  style={{ fontFamily: "Pyidaungsu, Arial, sans-serif" }}
                >
                  Address:
                </span>
                <span
                  className="font-medium text-black flex-1 break-all text-[12px] leading-[18px] h-[55px] line-clamp-3 overflow-hidden"
                  style={{ fontFamily: "Pyidaungsu, Arial, sans-serif" }}
                >
                  {fields.receiverAddress}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── MIDDLE FINANCIALS SECTION ── */}
      {(() => {
  // ── ၁။ PayType ပြသမှု Logic ──
  const payTypeDisplay = fields.payType === "Deli" ? "Receiver Pay" : "Sender Pay";

  // ── ၂။ Deli Fee နောက်က Paid / Bill ပြသမှု Logic ──
  let deliStatus = "";
  if (fields.payType === "Cash" || fields.payType === "Kpay") {
    deliStatus = "Paid";
  } else if (fields.payType === "Bill") {
    deliStatus = "Bill";
  }

  // ── ၃။ COD ပြသမှု Logic (Bill ဖြစ်ရင် Total ပြရန်၊ - ဖြစ်ရင် 0 ပြရန်) ──
  let codDisplay = fields.codAmount;
  if (fields.payType === "Bill") {
    codDisplay = fields.totalAmount;
  } else {
    const codNum = parseFloat(fields.codAmount);
    if (fields.codAmount === "-" || (!isNaN(codNum) && codNum < 0)) {
      codDisplay = "0";
    }
  }

  return (
    <div className="mt-1">
      <div className="border-t border-black text-[12px]">
        {/* COD Row */}
        <div className="flex items-center">
          <div
            className="w-[72px] font-bold py-1.5 text-right pr-2 shrink-0"
            style={{ fontFamily: "Pyidaungsu, Arial, sans-serif" }}
          >
            COD:
          </div>
          <div className="w-[1px] bg-black self-stretch"></div>
          <div className="pl-3 font-mono font-bold">{codDisplay} Ks</div>
        </div>
        
        <div className="border-t border-dashed border-black w-full"></div>
        
        {/* Delivery Fee Row */}
        <div className="flex items-center">
          <div
            className="w-[72px] font-bold py-1.5 text-right pr-2 shrink-0"
            style={{ fontFamily: "Pyidaungsu, Arial, sans-serif" }}
          >
            Deli Fee:
          </div>
          <div className="w-[1px] bg-black self-stretch"></div>
          <div className="pl-3 flex-1 flex justify-between items-center pr-6">
            <span className="font-mono font-semibold">
              {fields.deliFee} Ks 
              {deliStatus && (
                <span className="ml-1.5 text-[11px] font-sans font-bold text-gray-700">
                  ({deliStatus})
                </span>
              )}
            </span>
            <span className="font-bold text-[11px] uppercase tracking-wide">
              {payTypeDisplay}
            </span>
          </div>
        </div>
        
        {/* Total Row */}
        <div className="border-t border-black flex items-center">
          <div
            className="w-[72px] font-black py-1.5 text-right pr-2 shrink-0 text-[14px]"
            style={{ fontFamily: "Pyidaungsu, Arial, sans-serif" }}
          >
            Total:
          </div>
          <div className="w-[1px] bg-black self-stretch"></div>
          <div className="pl-3 font-mono font-black text-[15px]">{fields.totalAmount} Ks</div>
        </div>
      </div>
      <div className="border-t border-black w-full"></div>
    </div>
  );
})()}

        {/* ── BOTTOM REMARK SECTION ── */}
        <div className="pt-1 flex flex-col justify-start min-h-[85px]">
          <div
            className="text-center font-bold text-[12px]"
            style={{ fontFamily: "Pyidaungsu, Arial, sans-serif" }}
          >
            မှတ်ချက်
          </div>
          <div className="border-b border-dotted border-gray-400 w-full mt-0.5"></div>
          <div
            className="w-full h-[55px] flex items-center justify-center text-center px-2 overflow-hidden"
            style={{ fontFamily: "Pyidaungsu, Arial, sans-serif" }}
          >
            <span
              className={`text-black break-all leading-tight max-h-full ${
                fields.remarkText.length > 50
                  ? "text-[10px]"
                  : fields.remarkText.length > 25
                  ? "text-[12px]"
                  : "text-[20px]"
              }`}
            >
              {fields.remarkText || "---"}
            </span>
            
          </div>
          <div className="pt-6 border-b border-dotted border-gray-400 w-full "></div>
        </div>
      </div>
      <div className="pt-2">
      <button
  onClick={() => setShowDialog(true)}
  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold rounded-xl border border-slate-700 shadow-md transition flex items-center gap-2 active:scale-95 print:hidden"
>
  <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
  </svg>
  Voucher Options ခေါ်ရန်
</button>
</div>
    </div>
  );
}