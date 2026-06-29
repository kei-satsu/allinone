"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase"; // 💡 Supabase လမ်းကြောင်းမှန်အောင် ပြင်ပေးပါ

export default function SendersDashboard() {
  const [senders, setSenders] = useState<any[]>([]);
  const [selectedSender, setSelectedSender] = useState<any | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loadingSenders, setLoadingSenders] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // ၁။ စပွင့်ပွင့်ချင်း Senders စာရင်းကို ဆွဲထုတ်မည်
  useEffect(() => {
    const fetchSenders = async () => {
      setLoadingSenders(true);
      const { data, error } = await supabase
        .from("senders")
        .select("*")
        .order("name", { ascending: true }); // နာမည်အလိုက် စီထားသည်

      if (error) {
        console.error("Error fetching senders:", error);
      } else {
        setSenders(data || []);
      }
      setLoadingSenders(false);
    };

    fetchSenders();
  }, []);

  // ၂။ Sender တစ်ယောက်ကို နှိပ်လိုက်တဲ့အခါ သူ့ရဲ့ Orders တွေကို ဆွဲထုတ်မည်
  const handleSenderClick = async (sender: any) => {
    setSelectedSender(sender);
    setLoadingOrders(true);
    setOrders([]); // အဟောင်းတွေကို ရှင်းထုတ်မည်

    // 💡 orders table ထဲက sender_id နဲ့ သွားတိုက်ပြီး ဆွဲထုတ်ပါမည်
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("sender_id", sender.id)
      .order("created_at", { ascending: false }); // နောက်ဆုံးလာအပ်တဲ့အထုပ်ကို အပေါ်ဆုံးမှာပြမည်

    if (error) {
      console.error("Error fetching orders:", error);
    } else {
      setOrders(data || []);
    }
    setLoadingOrders(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Senders Dashboard</h1>
            <p className="text-sm text-slate-500">ပို့ဆောင်သူစာရင်းနှင့် သူတို့၏ အထုပ် (Way) များ</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* ── 👈 ဘယ်ဘက်ခြမ်း: SENDERS စာရင်း ── */}
          <div className="lg:col-span-1 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col h-[75vh]">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50">
              <h2 className="font-semibold text-slate-700 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Sender List ({senders.length})
              </h2>
            </div>
            
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {loadingSenders ? (
                <div className="text-center py-10 text-slate-400 text-sm animate-pulse">
                  ဒေတာများကို ဆွဲယူနေပါသည်...
                </div>
              ) : (
                senders.map((sender) => (
                  <button
                    key={sender.id}
                    onClick={() => handleSenderClick(sender)}
                    className={`w-full text-left p-4 rounded-xl transition-all border ${
                      selectedSender?.id === sender.id
                        ? "bg-blue-50 border-blue-200 shadow-sm ring-1 ring-blue-500/10"
                        : "bg-white border-slate-100 hover:border-blue-100 hover:bg-slate-50"
                    }`}
                  >
                    <div className="font-bold text-slate-800 text-sm mb-1">{sender.name}</div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 font-mono">
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                        {sender.phone === "EMPTY" || !sender.phone ? "No Phone" : sender.phone}
                      </span>
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        {sender.LOC}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* ── 👉 ညာဘက်ခြမ်း: ORDERS (WAYS) စာရင်း ── */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col h-[75vh] overflow-hidden">
            {selectedSender ? (
              <>
                {/* ညာဘက် Header */}
                <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">{selectedSender.name} ၏ အထုပ်များ</h2>
                    <p className="text-xs text-slate-500 mt-1">
                      Total Ways: <span className="font-bold text-blue-600">{orders.length}</span>
                    </p>
                  </div>
                </div>

                {/* Table Data */}
                <div className="flex-1 overflow-auto">
                  {loadingOrders ? (
                    <div className="flex items-center justify-center h-full text-slate-400 text-sm animate-pulse">
                      အထုပ်စာရင်းကို ရှာဖွေနေပါသည်...
                    </div>
                  ) : orders.length > 0 ? (
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-50 sticky top-0 shadow-sm z-10">
                        <tr>
                          <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200"># Way ID</th>
                          <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">Receiver / Destination</th>
                          <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">Date</th>
                          {/* လိုအပ်ပါက ငွေပမာဏ (သို့) အခြား Column များ ဤနေရာတွင် ထပ်ထည့်နိုင်ပါသည် */}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {orders.map((order, index) => (
                          <tr key={order.id || index} className="hover:bg-slate-50/70 transition-colors">
                            <td className="px-5 py-4 whitespace-nowrap text-sm font-mono font-medium text-slate-700">
                              {order.id} {/* 💡 အစ်ကို့ table ရဲ့ way id ပေါ်မူတည်ပြီး ပြင်ပါ */}
                            </td>
                            <td className="px-5 py-4">
                              <div className="text-sm font-bold text-slate-800">{order.receiver_name || "Unknown"}</div>
                              <div className="text-xs text-slate-500">{order.receiver_loc || "No Location"} - {order.receiver_phone}</div>
                            </td>
                            <td className="px-5 py-4 whitespace-nowrap text-sm text-slate-500">
                              {new Date(order.created_at).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-3">
                      <svg className="w-12 h-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                      </svg>
                      <p className="text-sm">ဒီပို့ဆောင်သူအတွက် အထုပ် (Way) များ မရှိသေးပါ။</p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              // ညာဘက်ခြမ်း (Sender မရွေးရသေးခင် ပြမည့်ပုံစံ)
              <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-4">
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
                  <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                  </svg>
                </div>
                <p className="text-sm">အထုပ်စာရင်း ကြည့်ရှုရန် ဘယ်ဘက်မှ ပို့ဆောင်သူ အမည်ကို ရွေးချယ်ပါ။</p>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}