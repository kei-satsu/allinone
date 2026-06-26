"use client";
import React, { useState, useEffect, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/lib/supabase";

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white text-gray-800 rounded-2xl shadow-xl p-6 max-w-sm w-full mx-4 text-center">
            <h2 className="text-lg font-bold mb-2">Voucher ဒေတာ ပြင်ဆင်မလား။</h2>
            <p className="text-sm text-gray-500 mb-5">
              လက်ခံသူ၊ ပို့သူအချက်အလက်များ (သို့) မှတ်ချက် (Remark) ကို
              ထည့်သွင်း/ပြင်ဆင်လိုပါက <strong>Edit & Print</strong> ကိုနှိပ်ပါ။
              မပြင်ချင်ပါက <strong>Print Now</strong> ကိုနှိပ်ပါ။
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={handlePrintNow}
                className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition"
              >
                Print Now
              </button>
              <button
                onClick={handleEdit}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-lg transition"
              >
                Edit &amp; Print
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
                <input
                  type="text"
                  name="cod_amount"
                  value={editFormData.cod_amount ?? ""}
                  onChange={handleEditChange}
                  className="w-full mt-1 px-3 py-1.5 border rounded-md focus:ring focus:ring-blue-200"
                />
              </label>

              {/* Delivery Fee */}
              <label className="block">
                <span className="font-semibold">Deli Fee</span>
                <input
                  type="text"
                  name="deli_fee"
                  value={editFormData.deli_fee ?? ""}
                  onChange={handleEditChange}
                  className="w-full mt-1 px-3 py-1.5 border rounded-md focus:ring focus:ring-blue-200"
                />
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
            <div className="flex justify-between mt-6 gap-3">
              <button
                onClick={handleDiscardAndPrint}
                className="px-5 py-2 bg-gray-400 hover:bg-gray-500 text-white font-semibold rounded-lg transition"
              >
                မပြင်တော့ဘူး (Print Original)
              </button>
              <button
                onClick={handleSaveAndPrint}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition"
              >
                Save &amp; Print
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PRINTABLE VOUCHER ───────────────────── */}
      <div
        style={{ width: "4in", height: "6in" }}
        className="printable-voucher bg-white text-black p-3 flex flex-col select-none box-border relative shadow-2xl"
      >
        <style
          dangerouslySetInnerHTML={{
            __html: `
              @page { size: 4in 6in; margin: 0; }
              @media print {
                body * { visibility: hidden; }
                .printable-voucher, .printable-voucher * { visibility: visible; }
                .printable-voucher { position: absolute; left: 0; top: 0; width: 4in !important; height: 6in !important; box-shadow: none !important; padding: 12px !important; }
                body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: transparent; }
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
                <div className="mt-1">YGN Office:</div>
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
        <div className="mt-1">
          <div className="border-t border-black text-[12px]">
            <div className="flex items-center">
              <div
                className="w-[72px] font-bold py-1.5 text-right pr-2 shrink-0"
                style={{ fontFamily: "Pyidaungsu, Arial, sans-serif" }}
              >
                COD:
              </div>
              <div className="w-[1px] bg-black self-stretch"></div>
              <div className="pl-3 font-mono font-bold">{fields.codAmount}</div>
            </div>
            <div className="border-t border-dashed border-black w-full"></div>
            <div className="flex items-center">
              <div
                className="w-[72px] font-bold py-1.5 text-right pr-2 shrink-0"
                style={{ fontFamily: "Pyidaungsu, Arial, sans-serif" }}
              >
                Deli Fee:
              </div>
              <div className="w-[1px] bg-black self-stretch"></div>
              <div className="pl-3 flex-1 flex justify-between items-center pr-1">
                <span className="font-mono font-semibold">{fields.deliFee}</span>
                <span className="font-bold text-[11px] uppercase tracking-wide">
                  {fields.payType}
                </span>
              </div>
            </div>
            <div className="border-t border-black flex items-center">
              <div
                className="w-[72px] font-black py-1.5 text-right pr-2 shrink-0 text-[14px]"
                style={{ fontFamily: "Pyidaungsu, Arial, sans-serif" }}
              >
                Total:
              </div>
              <div className="w-[1px] bg-black self-stretch"></div>
              <div className="pl-3 font-mono font-black text-[15px]">{fields.totalAmount}</div>
            </div>
          </div>
          <div className="border-t border-black w-full"></div>
        </div>

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
        </div>
      </div>
    </div>
  );
}