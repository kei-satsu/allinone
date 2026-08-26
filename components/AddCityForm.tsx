"use client";

import React, { useState } from "react";
import { createCity } from "@/lib/databaseApi";

interface AddCityFormProps {
  isOpen: boolean;         // Modal ပွင့်နေသလား စစ်သည့် State
  onClose: () => void;     // Modal ပြန်ပိတ်မည့် Function
  onCityAdded: () => void; // မြို့အသစ်ထည့်ပြီးရင် Parent Dropdown ကို ဒေတာပြန်ဆွဲခိုင်းမည့် Function
}

export default function AddCityForm({ isOpen, onClose, onCityAdded }: AddCityFormProps) {
  const [cityId, setCityId] = useState("");   // 💡 C.ID အတွက် State အသစ်
  const [cityName, setCityName] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cityId.trim() || !cityName.trim()) return;

    setLoading(true);
    setStatus(null);

    try {
      // 💡 Supabase ထဲသို့ C.ID ရော name ရော တွဲလျက် လှမ်းထည့်ခြင်း
      await createCity({ "C.ID": cityId.trim(), name: cityName.trim() });

      setStatus({ type: "success", text: "🎉 မြို့အသစ်ကို အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ။" });
      setCityId("");
      setCityName("");

      // အောင်မြင်ရင် Dropdown ကို Update လုပ်ပြီး Modal ကိုပါ တန်းပိတ်ခိုင်းမည်
      onCityAdded();
      onClose();
    } catch (err: any) {
      setStatus({ type: "error", text: "စနစ်ချို့ယွင်းမှုဖြစ်ပွားခဲ့သည်- " + err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    // Backdrop (မိုဒယ်လ် ပိုပေါ်လွင်အောင် နောက်ခံကို မှိုင်းမှိုင်းလေးပဲ ခံထားပါတယ်ဗျာ)
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      
      {/* နောက်ခံနေရာကို နှိပ်ရင် Modal ပြန်ပိတ်ရန် */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* ── 🤍 WHITE THEME MODAL CARD ── */}
      <div className="relative z-10 w-full max-w-sm p-6 bg-white border border-slate-100 rounded-2xl shadow-2xl text-slate-800 animate-in zoom-in-95 duration-200">
        
        {/* ❌ ညာဘက်အပေါ်ထောင့်က ပြန်ပိတ်ရန် x ခလုတ် */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition active:scale-90"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="flex items-center gap-2 mb-5">
          <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
          <h3 className="text-sm font-bold tracking-wide uppercase text-slate-700">Add New City</h3>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* 💡 ၁။ C.ID ဖြည့်သွင်းရန် Field အသစ် */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600">မြို့ကုဒ် / ID (C.ID)</label>
            <input
              type="text"
              required
              disabled={loading}
              placeholder="ဥပမာ - MDY (သို့) 101"
              value={cityId}
              onChange={(e) => setCityId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm placeholder-slate-400 text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all disabled:opacity-50"
            />
          </div>

          {/* ၂။ မြို့အမည် ဖြည့်သွင်းရန် Field */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600">မြို့အမည် (City Name)</label>
            <input
              type="text"
              required
              disabled={loading}
              placeholder="ဥပမာ - မန္တလေး (Mandalay)"
              value={cityName}
              onChange={(e) => setCityName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm placeholder-slate-400 text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all disabled:opacity-50"
            />
          </div>

          {/* Status Alert Notification (White Theme) */}
          {status && (
            <div className={`p-2.5 rounded-xl text-xs font-medium border ${
              status.type === "success" 
                ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                : "bg-rose-50 text-rose-700 border-rose-200"
            }`}>
              {status.text}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !cityName.trim() || !cityId.trim()}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-100 text-white disabled:text-slate-400 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 active:scale-[0.98] shadow-sm"
          >
            {loading ? "သိမ်းဆည်းနေပါသည်..." : "မြို့အသစ်ထည့်မည်"}
          </button>
        </form>
      </div>
    </div>
  );
}