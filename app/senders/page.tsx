"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase"; 
import SenderModal from "@/components/SenderModal"; 
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import Link from "next/link";

export default function SendersDashboard() {
  // ─── States ───
  const [senders, setSenders] = useState<any[]>([]);
  const [filteredSenders, setFilteredSenders] = useState<any[]>([]);
  const [selectedSender, setSelectedSender] = useState<any | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [realBranch, setRealBranch] = useState<string | null>(null);

  const [orderSearchTerm, setOrderSearchTerm] = useState("");
  const [filterFeeType, setFilterFeeType] = useState("All");
const [filterLoc, setFilterLoc] = useState("All");
const [startDate, setStartDate] = useState("");
const [endDate, setEndDate] = useState("");
  const [loadingSenders, setLoadingSenders] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(false);
  
  // Search & Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [activeBranch, setActiveBranch] = useState("MDY"); 
  const [activeTab, setActiveTab] = useState<"uncleared" | "cleared" | "not_delivered">("uncleared");

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");

  // Multiple Ways Selection & Clearing Date States
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [clearedDateInput, setClearedDateInput] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    setSelectedOrderIds([]);
  }, [activeTab, activeBranch, selectedSender]);

  // 💡 အကောင့်ဝင်ထားသူသည် Admin ဟုတ်/မဟုတ် စစ်ဆေးရန် useEffect
  useEffect(() => {
    const checkUserRole = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.user_metadata) {
        // user_metadata ထဲက branch တန်ဖိုးကို ယူသည် (ဥပမာ- "ADMIN", "MDY", "YGN")
        setRealBranch(session.user.user_metadata.branch || "MDY");
      }
    };
    
    checkUserRole();
  }, []);

  // 🌟 ၁။ Senders List ဆွဲထုတ်စဉ်မှာတင် သက်ဆိုင်ရာ Orders အခြေအနေကို ပါဝင်စစ်ဆေးပြီး အမှန်တကယ် ကျန်/မကျန် တွက်ချက်ခြင်း
  const fetchSenders = async () => {
    setLoadingSenders(true);
    
    // orders ဇယားထဲက status နဲ့ cleared_date ကိုပါ ပူးတွဲဆွဲထုတ်စစ်ဆေးသည်
    const { data, error } = await supabase
      .from("senders")
      .select("*, orders(id, status, cleared_date)")
      .eq("LOC", activeBranch);

    if (error) {
      console.error("Error fetching senders:", error);
    } else {
      // စာရင်းမရှင်းရသေးသည့် အထုပ် ရှိ/မရှိ အစစ်အမှန်ကို ရှာဖွေတွက်ချက်သည်
      const processedSenders = (data || []).map((sender) => {
        // စာရင်းမရှင်းရသေးသည့်အထုပ် (Delivered ဖြစ်ပြီး cleared_date မရှိတာ)
        const unclearedCount = sender.orders?.filter(
          (o: any) => o.status === "Delivered" && !o.cleared_date
        ).length || 0;
        
        // 💡 မပို့ရသေးသည့်အထုပ် (Status က Delivered မဟုတ်တာ အားလုံးထဲမှ စာရင်းမရှင်းရသေးတာ)
        const notDeliveredCount = sender.orders?.filter(
          (o: any) => o.status !== "Delivered" 
        ).length || 0;
        
        return {
          ...sender,
          unclearedCount,
          notDeliveredCount, // ဒေတာထဲသို့ ထည့်သွင်းသည်
          hasUncleared: unclearedCount > 0,
        };
      });

      // 🔥 Sorting Logic: Uncleared ကျန်သည့်သူကို ထိပ်ဆုံးတင်မည်၊ ပြီးမှ နာမည်အလိုက် စီမည်
      processedSenders.sort((a, b) => {
        if (a.hasUncleared && !b.hasUncleared) return -1;
        if (!a.hasUncleared && b.hasUncleared) return 1;
        return (a.name || "").localeCompare(b.name || "", "my");
      });

      setSenders(processedSenders);
      setFilteredSenders(processedSenders);

      // ညာဘက်မှာ လက်ရှိရွေးထားတဲ့ Sender ရှိနေရင် ဘယ်ဘက် Sidebar မှာလည်း Status ချက်ချင်း Update ဖြစ်စေရန်
      if (selectedSender) {
        const updated = processedSenders.find((s) => s.id === selectedSender.id);
        if (updated) setSelectedSender(updated);
      }
    }
    setLoadingSenders(false);
  };

  useEffect(() => {
    fetchSenders();
  }, [activeBranch]);

  // ၂။ Search Term အလိုက် စစ်ထုတ်ခြင်း
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (!searchTerm.trim()) {
        setFilteredSenders(senders);
      } else {
        const lower = searchTerm.toLowerCase();
        const filtered = senders.filter(
          (s) =>
            s.name?.toLowerCase().includes(lower) ||
            s.phone?.toLowerCase().includes(lower)
        );
        setFilteredSenders(filtered);
      }
    }, 200); 

    return () => clearTimeout(delayDebounce);
  }, [searchTerm, senders]);

  // ၃။ Sender ကို နှိပ်လျှင် ပါဆယ်စာရင်းဆွဲထုတ်ခြင်း
  const handleSenderClick = async (sender: any) => {
    setSelectedSender(sender);
    setLoadingOrders(true);
    setOrders([]); 
    setSelectedOrderIds([]); 
    setOrderSearchTerm("");

    setFilterFeeType("All");
  setFilterLoc("All");
  setStartDate("");
  setEndDate("");

    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("sender_id", sender.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching orders:", error);
    } else {
      setOrders(data || []);
    }
    setLoadingOrders(false);
  };

  // 💡 ရှာဖွေမှုစာသားအလိုက် Way ID နှင့် Receiver အချက်အလက်များကို စစ်ထုတ်ခြင်း Logic
 // 💡 ရှာဖွေမှုစာသား နှင့် Filter Criteria အားလုံးပေါင်းစပ်၍ စစ်ထုတ်ခြင်း Logic
const filteredOrders = orders.filter((order) => {
  // ၁။ Text Search (Way ID, အမည်, ဖုန်း စသည်ဖြင့် ရှာဖွေခြင်း)
  const searchLower = orderSearchTerm.toLowerCase();
  const matchesSearch = !orderSearchTerm.trim() || 
    (order.item_id || "").toLowerCase().includes(searchLower) ||
    (order.id || "").toLowerCase().includes(searchLower) ||
    (order.receiver_name || "").toLowerCase().includes(searchLower) ||
    (order.receiver_phone || "").toLowerCase().includes(searchLower) ||
    (order.receiver_loc || "").toLowerCase().includes(searchLower);

  // ၂။ Fee Type Filter (ဥပမာ- "All" မဟုတ်ရင် ရွေးထားတာနဲ့ တူမှပြမည်)
  const matchesFeeType = filterFeeType === "All" || order.fee_type === filterFeeType;

  // ၃။ Location Filter
  const matchesLoc = filterLoc === "All" || order.receiver_loc === filterLoc;

  // ၄။ Date Range Filter (ရက်စွဲအပိုင်းအခြား စစ်ဆေးခြင်း)
  // order ထဲက target date ကို format ညှိယူပါ (ဥပမာ- YYYY-MM-DD)
  const orderDate = order.deliver_date || (order.created_at ? order.created_at.split("T")[0] : "");
  const matchesStartDate = !startDate || orderDate >= startDate;
  const matchesEndDate = !endDate || orderDate <= endDate;

  // အခြေအနေ အားလုံး True ဖြစ်မှ Order ကို ချန်ထားမည်
  return matchesSearch && matchesFeeType && matchesLoc && matchesStartDate && matchesEndDate;
});

  // Tab အလိုက် ခွဲထုတ်ရာတွင် filteredOrders ကို အခြေခံ၍ စစ်ထုတ်မည်
  const unclearedOrders = filteredOrders.filter(
    (o) => o.status === "Delivered" && !o.cleared_date
  );
  const clearedOrders = filteredOrders.filter((o) => o.cleared_date);

  // 💡 Not Delivered အထုပ်များထဲမှ Cleared Date မရှိသေးသည့်အထုပ်များ (စာရင်းမရှင်းရသေးသော Not Delivered များ)
  const notDeliveredOrders = filteredOrders.filter(
    (o) => o.status !== "Delivered"
  );

  // 🌟 ၄။ Bulk Clear လုပ်ပြီးချိန်မှာ ဘယ်ဘက်ခြမ်းက ကတ်တွေပါ အလိုအလျောက် Live Update ဖြစ်သွားစေရန် ထည့်သွင်းခြင်း
  const handleBulkClear = async () => {
    if (selectedOrderIds.length === 0) return;
    if (!clearedDateInput) {
      alert("ကျေးဇူးပြု၍ ရက်စွဲရွေးချယ်ပေးပါရန်။");
      return;
    }

    setClearing(true);
    const { error } = await supabase
      .from("orders")
      .update({ cleared_date: clearedDateInput })
      .in("id", selectedOrderIds);

    setClearing(false);

    if (error) {
      console.error("Error clearing orders:", error);
      alert("စာရင်းရှင်းရာတွင် အမှားအယွင်းရှိခဲ့ပါသည်: " + error.message);
    } else {
      setSelectedOrderIds([]);
      // 🔥 ဒေတာနှစ်ခုလုံးကို ပြိုင်တူ Refresh ပြန်လုပ်ပေးလို့ Badge တွေအမှားအယွင်းမရှိ ချက်ချင်းပြောင်းလဲသွားပါမည်
      await fetchSenders();
      if (selectedSender) {
        handleSenderClick(selectedSender);
      }
    }
  };

  const getDisplayOrders = () => {
    if (activeTab === "uncleared") return unclearedOrders;
    if (activeTab === "cleared") return clearedOrders;
    return notDeliveredOrders; // "not_delivered" ဖြစ်လျှင် ပြရန်
  };

  // 💡 လက်ရှိ ရွေးချယ်ထားသော ပုံးများ၏ စုစုပေါင်း COD တန်ဖိုးကို Dynamic တွက်ချက်ခြင်း
  const totalSelectedCod = getDisplayOrders()
    .filter((o) => selectedOrderIds.includes(o.id))
    .reduce((sum, o) => sum + (Number(o.cod_amount) || 0), 0);

  const handleModalSuccess = () => {
    setIsModalOpen(false);
    fetchSenders();
    if (selectedSender) {
      handleSenderClick(selectedSender);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 font-sans w-full">
      <div className="w-full space-y-4">
        
        {/* ─── TOP BAR HEADER ─── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-orange-100 text-orange-600 rounded-xl">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">Senders Finance Dashboard</h1>
              <p className="text-xs text-slate-500">ပို့ဆောင်သူများ၏ စစာရင်းရှင်းလင်းမှု အခြေအနေများကို စီမံခန့်ခွဲရန်</p>
            </div>
             <Link href="/senders/pickup-list" className="bg-orange-500 hover:bg-orange-600 text-white font-medium px-4 py-1.5 rounded-md shadow-sm transition-all flex items-center gap-1.5 text-xs">
                     Pickup Report
                    </Link>
          </div>

         

          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 self-start sm:self-center">
            
            <button
              onClick={() => { setActiveBranch("MDY"); setSelectedSender(null); setOrders([]); }}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeBranch === "MDY" ? "bg-white text-orange-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              MANDALAY
            </button>
            <button
              onClick={() => { setActiveBranch("YGN"); setSelectedSender(null); setOrders([]); }}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeBranch === "YGN" ? "bg-white text-purple-600 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              YANGON
            </button>
          </div>
        </div>

        {/* GRID LAYOUT */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          
          {/* ─── 👈 ဘယ်ဘက်ခြမ်း: SENDERS LIST & SEARCH ─── */}
          <div className="lg:col-span-1 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col h-[82vh]">
            
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-slate-700 text-sm flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${activeBranch === 'MDY' ? 'bg-orange-500' : 'bg-purple-500'}`}></span>
                  Sender List ({filteredSenders.length})
                </h2>
                <button
                  onClick={() => { setModalMode("add"); setIsModalOpen(true); }}
                  className="px-2.5 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
                >
                  + Add Sender
                </button>
              </div>

              <div className="relative">
                <input
                  type="text"
                  placeholder="ရှာဖွေရန်... (အမည် သို့ ဖုန်းနံပါတ်)"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20 text-slate-800"
                />
                <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
            
            {/* Senders Loop Area */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar bg-slate-50/40">
              {loadingSenders ? (
                <div className="text-center py-10 text-slate-400 text-xs animate-pulse">ဒေတာများကို ဆွဲယူနေပါသည်...</div>
              ) : filteredSenders.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs">ရှာဖွေမှုမတွေ့ရှိပါ။</div>
              ) : (
                filteredSenders.map((sender) => (
                  <button
                    key={sender.id}
                    onClick={() => handleSenderClick(sender)}
                    className={`w-full text-left p-3.5 rounded-xl transition-all border border-l-4 ${
                      sender.hasUncleared 
                        ? "border-l-orange-500 bg-white" 
                        : "border-l-emerald-500 bg-white opacity-90"
                    } ${
                      selectedSender?.id === sender.id
                        ? "bg-orange-50/90 ring-2 ring-orange-500/30 border-orange-300"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="font-bold text-slate-800 text-sm truncate">{sender.name}</div>
                      
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {/* 💡 Not Delivered Badge */}
                        {sender.notDeliveredCount > 0 && (
                          <span className="px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded-md text-[10px] font-bold border border-amber-100">
                            💡 {sender.notDeliveredCount} ပို့ရန်ကျန်
                          </span>
                        )}

                        {/* Uncleared သို့မဟုတ် Cleared Badge */}
                        {sender.hasUncleared ? (
                          <span className="px-1.5 py-0.5 bg-rose-50 text-rose-600 rounded-md text-[10px] font-bold border border-rose-100 animate-pulse">
                            🔴 {sender.unclearedCount} ထုပ်ကျန်
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded-md text-[10px] font-bold border border-emerald-100">
                            🟢 Cleared
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 text-[11px] text-slate-500 font-medium">
                      <span className="font-mono">📞 {sender.phone === "EMPTY" || !sender.phone ? "No Phone" : sender.phone}</span>
                      <span>📍 {sender.LOC || "-"}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* ─── 👉 ညာဘက်ခြမ်း: ORDERS DETAILS TABLE ─── */}
          <div className="lg:col-span-3 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col h-[82vh] overflow-hidden">
            {selectedSender ? (
              <>
                {/* Header */}
                <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50/40">
                  <div>
                    <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                      👤 {selectedSender.name}
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5 font-medium">
                      ဖုန်း - <span className="font-mono text-slate-700">{selectedSender.phone}</span> | ရုံးခွဲ - <span className="text-slate-700">{selectedSender.LOC}</span>
                    </p>
                  </div>
                  {realBranch === "ADMIN" && (
                    <button
                      onClick={() => { setModalMode("edit"); setIsModalOpen(true); }}
                      className="px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold shadow-sm transition-colors"
                    >
                      ✏️ Edit Sender Info
                    </button>
                  )}
                </div>

                {/* Tabs & Way Search Box */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 px-4 bg-white sticky top-0 z-20 gap-2 py-2 sm:py-0">
                  
                  {/* Left Side: Tabs */}
                  <div className="flex">
                    <button
                      onClick={() => setActiveTab("uncleared")}
                      className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
                        activeTab === "uncleared" ? "border-orange-500 text-orange-600" : "border-transparent text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      🔴 Uncleared
                      <span className={`px-1.5 py-0.5 text-[10px] rounded-full ${activeTab === 'uncleared' ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-600'}`}>
                        {unclearedOrders.length}
                      </span>
                    </button>
                    <button
                      onClick={() => setActiveTab("cleared")}
                      className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
                        activeTab === "cleared" ? "border-emerald-500 text-emerald-600" : "border-transparent text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      🟢 Cleared
                      <span className={`px-1.5 py-0.5 text-[10px] rounded-full ${activeTab === 'cleared' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-600'}`}>
                        {clearedOrders.length}
                      </span>
                    </button>
                    <button
                      onClick={() => setActiveTab("not_delivered")}
                      className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
                        activeTab === "not_delivered" ? "border-amber-500 text-amber-600" : "border-transparent text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      🟡 Not Delivered
                      <span className={`px-1.5 py-0.5 text-[10px] rounded-full ${activeTab === 'not_delivered' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-600'}`}>
                        {notDeliveredOrders.length}
                      </span>
                    </button>
                  </div>

                 {/* Right Side: Search & Multi-Filters Box */}
<div className="flex flex-wrap items-center gap-2 my-2 w-full sm:w-auto">
  
  {/* ၁။ Text Search Input (ရှိပြီးသားကို ပြင်ဆင်ထားခြင်း) */}
  <div className="relative w-full sm:w-48">
    <input
      type="text"
      placeholder="Way ID၊ အမည်၊ ဖုန်း..."
      value={orderSearchTerm}
      onChange={(e) => setOrderSearchTerm(e.target.value)}
      className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20 text-slate-800 font-medium"
    />
    <svg className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  </div>

  {/* ၂။ Fee Type Dropdown */}
  <select
    value={filterFeeType}
    onChange={(e) => setFilterFeeType(e.target.value)}
    className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/20"
  >
    <option value="All">Fee Type: All</option>
    <option value="Deli">Deli </option>
    <option value="Kpay">Kpay</option>
    <option value="Cash">Cash</option>
    <option value="Bill">Bill</option>
  </select>

  {/* ၃။ Location Dropdown (လက်ရှိ ပါဆယ်တွေထဲမှာ ပါတဲ့ မြို့နယ်အလိုက် Automatic unique လုပ်ပေးထားခြင်း) */}
  <select
    value={filterLoc}
    onChange={(e) => setFilterLoc(e.target.value)}
    className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/20"
  >
    <option value="All">Location: All</option>
    {Array.from(new Set(orders.map((o) => o.receiver_loc).filter(Boolean))).map((loc) => (
      <option key={loc} value={loc}>{loc}</option>
    ))}
  </select>

  {/* ၄။ Date Range Picker (မှ - ထိ) */}
  <div className="flex items-center gap-1 text-[11px] text-slate-500 bg-slate-50 px-2 py-1 border border-slate-200 rounded-xl">
    <input
      type="date"
      value={startDate}
      onChange={(e) => setStartDate(e.target.value)}
      className="bg-transparent focus:outline-none text-slate-700 w-24"
      title="Start Date"
    />
    <span>to</span>
    <input
      type="date"
      value={endDate}
      onChange={(e) => setEndDate(e.target.value)}
      className="bg-transparent focus:outline-none text-slate-700 w-24"
      title="End Date"
    />
    {(startDate || endDate) && (
      <button 
        onClick={() => { setStartDate(""); setEndDate(""); }}
        className="ml-1 text-rose-500 font-bold hover:text-rose-700"
        title="Clear Date"
      >
        ✕
      </button>
    )}
  </div>

</div>

                </div>

                {/* 💡 Date Picker Action Bar (Uncleared နှင့် Not Delivered နှစ်မျိုးလုံးတွင် ပြသမည်) */}
                {(activeTab === "uncleared" || activeTab === "not_delivered") && selectedOrderIds.length > 0 && (
                  <div className="bg-orange-50 border-b border-orange-100 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 animate-fadeIn">
                    <div className="text-xs font-semibold text-orange-800">
                      Selected: <span className="font-mono bg-orange-200/60 px-1.5 py-0.5 rounded text-orange-700">{selectedOrderIds.length}</span> ထုပ် | 
                      စုစုပေါင်း COD: <span className="font-mono text-sm ml-1 text-orange-600 font-bold">{totalSelectedCod.toLocaleString()} Ks</span>
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <input
                        type="date"
                        value={clearedDateInput}
                        onChange={(e) => setClearedDateInput(e.target.value)}
                        className="px-3 py-1.5 bg-white border border-orange-200 rounded-xl text-xs font-semibold text-slate-800"
                      />
                      <button
                        onClick={handleBulkClear}
                        disabled={clearing}
                        className="px-4 py-1.5 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                      >
                        {clearing ? "Saving..." : "Clear Selected"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Table Layout */}
                <div className="flex-1 overflow-auto custom-scrollbar">
                  {getDisplayOrders().length > 0 ? (
                    <table className="w-full text-left border-collapse whitespace-nowrap">
                      <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100 sticky top-0 z-10 shadow-sm">
                        <tr>
                          {/* 💡 Checkbox to select all (Uncleared & Not Delivered နှစ်မျိုးလုံးအတွက် အလုပ်လုပ်သည်) */}
                          {(activeTab === "uncleared" || activeTab === "not_delivered") && (
                            <th className="px-4 py-3 text-center w-12">
                              <input
                                type="checkbox"
                                checked={getDisplayOrders().length > 0 && selectedOrderIds.length === getDisplayOrders().length}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedOrderIds(getDisplayOrders().map((o) => o.id));
                                  } else {
                                    setSelectedOrderIds([]);
                                  }
                                }}
                                className="rounded border-slate-300 text-orange-500 focus:ring-orange-500 cursor-pointer"
                              />
                            </th>
                          )}
                          <th className="px-5 py-3">Way ID</th>
                          <th className="px-5 py-3">Receiver & Destination</th>
                          <th className="px-5 py-3 text-right">COD (Ks)</th>
                          <th className="px-5 py-3 text-right">Deli Fee (Ks)</th>
                          <th className="px-5 py-3 text-center">Fee Type</th>
                          <th className="px-5 py-3 text-right">Total (Ks)</th>
                          <th className="px-5 py-3">Deli Date</th>
                          <th className="px-5 py-3">Status</th>
                          {activeTab === "cleared" && <th className="px-5 py-3">Cleared Date</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700 text-xs font-medium">
                        {getDisplayOrders().map((order, index) => (
                          <tr key={order.id || index} className="hover:bg-slate-50/60 transition-colors">
                            {/* 💡 Row Selection Checkbox (Uncleared & Not Delivered နှစ်မျိုးလုံးအတွက် ပြသရန်) */}
                            {(activeTab === "uncleared" || activeTab === "not_delivered") && (
                              <td className="px-4 py-3.5 text-center">
                                <input
                                  type="checkbox"
                                  checked={selectedOrderIds.includes(order.id)}
                                  onChange={() => {
                                    if (selectedOrderIds.includes(order.id)) {
                                      setSelectedOrderIds(selectedOrderIds.filter((id) => id !== order.id));
                                    } else {
                                      setSelectedOrderIds([...selectedOrderIds, order.id]);
                                    }
                                  }}
                                  className="rounded border-slate-300 text-orange-500 focus:ring-orange-500 cursor-pointer"
                                />
                              </td>
                            )}
                            <td className="px-5 py-3.5 font-mono font-bold text-slate-900 text-xs">{order.item_id || order.id}</td>
                            <td className="px-5 py-3.5">
                              <div className="font-bold text-slate-800 text-xs">{order.receiver_name || "Unknown"}</div>
                              <div className="text-[11px] text-slate-400 font-medium font-mono mt-0.5">
                                {order.receiver_phone} ({order.receiver_loc || "No City"})
                              </div>
                            </td>
                            <td className="px-5 py-3.5 text-right font-mono font-semibold text-slate-700">{order.cod_amount ? Number(order.cod_amount).toLocaleString() : "0"}</td>
                            <td className="px-5 py-3.5 text-right font-mono text-slate-500">{order.deli_fee ? Number(order.deli_fee).toLocaleString() : "0"}</td>
                            <td className="px-5 py-3.5 text-center">
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold">{order.fee_type || "-"}</span>
                            </td>
                            <td className="px-5 py-3.5 text-right font-mono font-bold text-slate-900">{order.total_amount ? Number(order.total_amount).toLocaleString() : "0"}</td>
                            <td className="px-5 py-3.5 text-[11px] font-mono text-slate-600">{order.deliver_date || new Date(order.created_at).toLocaleDateString()}</td>
                            <td className="px-5 py-3.5">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${order.status === "Delivered" ? "bg-green-50 text-green-700 border border-green-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
                                {order.status}
                              </span>
                            </td>
                            {activeTab === "cleared" && (
                              <td className="px-5 py-3.5 text-[11px] font-mono text-emerald-600 font-semibold">📅 {new Date(order.cleared_date).toLocaleDateString()}</td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 py-12 space-y-2">
                      <p className="text-xs">ဤ Tab အတွက် စာရင်းများ မရှိသေးပါ။</p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-3">
                <p className="text-xs font-medium">ပါဆယ်မှတ်တမ်းများ ကြည့်ရှုရန် ဘယ်ဘက်မှ ပို့ဆောင်သူ (Sender) အမည်ကို ရွေးချယ်ပါ။</p>
              </div>
            )}
          </div>

        </div>
      </div>

      <SenderModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleModalSuccess}
        mode={modalMode}
        editData={modalMode === "edit" ? selectedSender : null}
        activeBranch={activeBranch}
      />
    </div>
  );
}