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
  const [receivedStartDate, setReceivedStartDate] = useState("");
  const [receivedEndDate, setReceivedEndDate] = useState("");
  const [loadingSenders, setLoadingSenders] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Search & Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [activeBranch, setActiveBranch] = useState("MDY");
 const [activeTab, setActiveTab] = useState<
  "all" | "uncleared" | "cleared" | "not_delivered" | "returned"
>("uncleared");
  const [hideClearedInAll, setHideClearedInAll] = useState(true);

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
  }, [activeTab, activeBranch, selectedSender, hideClearedInAll]);

  useEffect(() => {
    const checkUserRole = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.user_metadata) {
        setRealBranch(session.user.user_metadata.branch || "MDY");
      }
    };
    checkUserRole();
  }, []);

  const fetchSenders = async () => {
    setLoadingSenders(true);
    const { data, error } = await supabase
      .from("senders")
      .select("*, orders(id, status, cleared_date)")
      .eq("LOC", activeBranch);

    if (error) {
      console.error("Error fetching senders:", error);
    } else {
      const processedSenders = (data || []).map((sender) => {
        const unclearedCount =
          sender.orders?.filter(
            (o: any) =>
              (o.status === "Delivered" || o.status === "Settled") &&
              !o.cleared_date
          ).length || 0;

       const notDeliveredCount =
  sender.orders?.filter(
    (o: any) =>
      o.status !== "Delivered" &&
      o.status !== "Settled" &&
      o.status !== "Returned"
  ).length || 0;

        return {
          ...sender,
          unclearedCount,
          notDeliveredCount,
          hasUncleared: unclearedCount > 0,
        };
      });

      processedSenders.sort((a, b) => {
        if (a.hasUncleared && !b.hasUncleared) return -1;
        if (!a.hasUncleared && b.hasUncleared) return 1;
        return (a.name || "").localeCompare(b.name || "", "my");
      });

      setSenders(processedSenders);
      setFilteredSenders(processedSenders);

      if (selectedSender) {
        const updated = processedSenders.find(
          (s) => s.id === selectedSender.id
        );
        if (updated) setSelectedSender(updated);
      }
    }
    setLoadingSenders(false);
  };

  useEffect(() => {
    fetchSenders();
  }, [activeBranch]);

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
    setReceivedStartDate("");
    setReceivedEndDate("");

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

  const filteredOrders = orders.filter((order) => {
    const searchLower = orderSearchTerm.toLowerCase();
    const matchesSearch =
      !orderSearchTerm.trim() ||
      (order.item_id || "").toLowerCase().includes(searchLower) ||
      (order.id || "").toLowerCase().includes(searchLower) ||
      (order.receiver_name || "").toLowerCase().includes(searchLower) ||
      (order.receiver_phone || "").toLowerCase().includes(searchLower) ||
      (order.receiver_loc || "").toLowerCase().includes(searchLower);

    const matchesFeeType =
      filterFeeType === "All" || order.fee_type === filterFeeType;
    const matchesLoc = filterLoc === "All" || order.receiver_loc === filterLoc;

    const orderDate =
      order.deliver_date ||
      (order.created_at ? order.created_at.split("T")[0] : "");
    const receivedDate = order.received_date
      ? String(order.received_date).split("T")[0]
      : "";
    const matchesStartDate = !startDate || orderDate >= startDate;
    const matchesEndDate = !endDate || orderDate <= endDate;
    const matchesReceivedStartDate =
      !receivedStartDate || receivedDate >= receivedStartDate;
    const matchesReceivedEndDate =
      !receivedEndDate || receivedDate <= receivedEndDate;

    return (
      matchesSearch &&
      matchesFeeType &&
      matchesLoc &&
      matchesStartDate &&
      matchesEndDate &&
      matchesReceivedStartDate &&
      matchesReceivedEndDate
    );
  });

 const unclearedOrders = filteredOrders.filter(
  (o) =>
    (o.status === "Delivered" || o.status === "Settled") &&
    !o.cleared_date
);
const clearedOrders = filteredOrders.filter((o) => o.cleared_date);
const returnedOrders = filteredOrders.filter((o) => o.status === "Returned");
const notDeliveredOrders = filteredOrders.filter(
  (o) =>
    o.status !== "Delivered" &&
    o.status !== "Settled" &&
    o.status !== "Returned"
);
  const allOrders = hideClearedInAll
    ? filteredOrders.filter((o) => !o.cleared_date)
    : filteredOrders;

 const handleBulkClear = async () => {
    if (selectedOrderIds.length === 0) return;
    if (!clearedDateInput) {
      alert("ကျေးဇူးပြု၍ ရက်စွဲရွေးချယ်ပေးပါရန်။");
      return;
    }

    setClearing(true);

    // ရွေးချယ်ထားသော orders များထဲမှ Returned status နှင့် အခြား status များကို ခွဲထုတ်ခြင်း
    const selectedOrders = orders.filter((o) => selectedOrderIds.includes(o.id));
    const returnedIds = selectedOrders
      .filter((o) => o.status === "Returned")
      .map((o) => o.id);
    const otherIds = selectedOrders
      .filter((o) => o.status !== "Returned")
      .map((o) => o.id);

    let updateError: any = null;

    // Returned မဟုတ်သော အော်ဒါများကို cleared_date သို့ ထည့်မည်
    if (otherIds.length > 0) {
      const { error } = await supabase
        .from("orders")
        .update({ cleared_date: clearedDateInput })
        .in("id", otherIds);
      if (error) updateError = error;
    }

    // Returned အော်ဒါများကို cleared_date ကို မထိဘဲ refund_date သို့သာ ထည့်မည်
    if (returnedIds.length > 0) {
      const { error } = await supabase
        .from("orders")
        .update({ refund_date: clearedDateInput })
        .in("id", returnedIds);
      if (error) updateError = error;
    }

    setClearing(false);

    if (updateError) {
      console.error("Error clearing orders:", updateError);
      alert(
        "စာရင်းရှင်းရာတွင် အမှားအယွင်းရှိခဲ့ပါသည်: " + updateError.message
      );
    } else {
      setSelectedOrderIds([]);
      await fetchSenders();
      if (selectedSender) {
        handleSenderClick(selectedSender);
      }
    }
  };

  const getDisplayOrders = () => {
  if (activeTab === "all") return allOrders;
  if (activeTab === "uncleared") return unclearedOrders;
  if (activeTab === "cleared") return clearedOrders;
  if (activeTab === "returned") return returnedOrders;
  return notDeliveredOrders;
};

  const selectableOrders = getDisplayOrders().filter((o) => !o.cleared_date);
  const canSelectOrders = activeTab !== "cleared";

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

  const getStatusBadge = (status: string) => {
    const isCompleted = status === "Delivered" || status === "Settled";
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold border ${
          isCompleted
            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
            : "bg-amber-50 text-amber-700 border-amber-200"
        }`}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            isCompleted ? "bg-emerald-500" : "bg-amber-500"
          }`}
        ></span>
        {status}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-slate-100 p-3 sm:p-4 font-sans w-full">
      <div className="w-full max-w-[1800px] mx-auto space-y-3">
        {/* ─── COMPACT TOP BAR ─── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white px-4 py-2.5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-orange-100 text-orange-600 rounded-lg flex items-center justify-center">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </div>
              <div>
                <h1 className="text-base font-bold text-slate-800">
                  Senders Finance
                </h1>
                <p className="text-xs text-slate-400">
                  စာရင်းရှင်းလင်းမှု စီမံခန့်ခွဲရန်
                </p>
              </div>
            </div>
            <Link
              href="/senders/pickup-list"
              className="shrink-0 text-[11px] font-semibold text-orange-600 hover:text-orange-700 hover:bg-orange-50 px-2.5 py-1 rounded-lg transition-colors border border-orange-200"
            >
              Pickup Report →
            </Link>
          </div>

          {/* Branch Toggle */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 self-start sm:self-center shrink-0">
            <button
              onClick={() => {
                setActiveBranch("MDY");
                setSelectedSender(null);
                setOrders([]);
              }}
              className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all ${
                activeBranch === "MDY"
                  ? "bg-white text-orange-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              MDY
            </button>
            <button
              onClick={() => {
                setActiveBranch("YGN");
                setSelectedSender(null);
                setOrders([]);
              }}
              className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all ${
                activeBranch === "YGN"
                  ? "bg-white text-purple-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              YGN
            </button>
          </div>
        </div>

        {/* ─── MAIN GRID (WIDTH ADJUSTED) ─── */}
        {/* Changed from xl:grid-cols-4 to xl:grid-cols-12 to give more width to the table */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 items-stretch">
          
          {/* ─── LEFT: SENDERS LIST (NOW NARROWER) ─── */}
          <div className="xl:col-span-2 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col h-[65vh] xl:h-[calc(100vh-120px)]">
            {/* Sender List Header */}
            <div className="px-3 py-2.5 border-b border-slate-100 bg-slate-50/70 space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-slate-700 text-xs flex items-center gap-1.5">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      activeBranch === "MDY" ? "bg-orange-500" : "bg-purple-500"
                    }`}
                  ></span>
                  Senders
                  <span className="text-xs font-normal text-slate-400">
                    ({filteredSenders.length})
                  </span>
                </h2>
                <button
                  onClick={() => {
                    setModalMode("add");
                    setIsModalOpen(true);
                  }}
                  className="px-2 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded-md text-[10px] font-semibold shadow-sm transition-colors"
                >
                  + Add
                </button>
              </div>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search name or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-7 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] focus:outline-none focus:ring-2 focus:ring-orange-500/20 text-slate-800 placeholder:text-slate-300"
                />
                <svg
                  className="w-3.5 h-3.5 text-slate-300 absolute left-2 top-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
            </div>

            {/* Sender Cards */}
            <div className="flex-1 overflow-y-auto p-1.5 space-y-1 custom-scrollbar">
              {loadingSenders ? (
                <div className="text-center py-8 text-slate-400 text-xs animate-pulse">
                  Loading...
                </div>
              ) : filteredSenders.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  No senders found.
                </div>
              ) : (
                filteredSenders.map((sender) => (
                  <button
                    key={sender.id}
                    onClick={() => handleSenderClick(sender)}
                    className={`w-full text-left p-2 rounded-lg transition-all border group ${
                      selectedSender?.id === sender.id
                        ? "bg-orange-50 border-orange-300 ring-1 ring-orange-400/30"
                        : "bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-semibold text-slate-800 text-sm truncate">
                        {sender.name}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        {sender.notDeliveredCount > 0 && (
                          <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[9px] font-bold border border-amber-200">
                            {sender.notDeliveredCount} 📦
                          </span>
                        )}
                        {sender.hasUncleared ? (
                          <span className="px-1.5 py-0.5 bg-rose-100 text-rose-700 rounded text-[9px] font-bold border border-rose-200">
                            {sender.unclearedCount} 💰
                          </span>
                        ) : (
                          <span
                            className="w-1.5 h-1.5 rounded-full bg-emerald-400"
                            title="All Cleared"
                          ></span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
                      <span>
                        📞{" "}
                        {sender.phone === "EMPTY" || !sender.phone
                          ? "—"
                          : sender.phone}
                      </span>
                      <span>📍 {sender.LOC || "—"}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* ─── RIGHT: ORDERS TABLE (NOW WIDER) ─── */}
          <div className="xl:col-span-10 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden h-[65vh] xl:h-[calc(100vh-120px)]">
            {selectedSender ? (
              <>
                {/* Selected Sender Info Bar */}
                <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-bold text-slate-800 truncate">
                      👤 {selectedSender.name}
                    </span>
                    <span className="text-xs text-slate-400 font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                      {selectedSender.phone === "EMPTY" ||
                      !selectedSender.phone
                        ? "No Phone"
                        : selectedSender.phone}
                    </span>
                    <span className="text-xs text-slate-400">
                      | {selectedSender.LOC}
                    </span>
                  </div>
                  {realBranch === "ADMIN" && (
                    <button
                      onClick={() => {
                        setModalMode("edit");
                        setIsModalOpen(true);
                      }}
                      className="px-2 py-1 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors border border-slate-200"
                    >
                      ✏️ Edit
                    </button>
                  )}
                </div>

                {/* Tabs + Filters */}
                <div className="border-b border-slate-100 bg-white">
                  {/* Tabs Row */}
                  <div className="flex items-center overflow-x-auto px-3 gap-0.5">
                    {[
  {
    key: "all",
    label: "All",
    count: allOrders.length,
    color: "slate",
  },
  {
    key: "uncleared",
    label: "Uncleared",
    count: unclearedOrders.length,
    color: "orange",
  },
  {
    key: "cleared",
    label: "Cleared",
    count: clearedOrders.length,
    color: "emerald",
  },
  {
    key: "returned",
    label: "Returned",
    count: returnedOrders.length,
    color: "rose",
  },
  {
    key: "not_delivered",
    label: "Not Delivered",
    count: notDeliveredOrders.length,
    color: "amber",
  },
].map((tab) => {
  const isActive = activeTab === tab.key;
  const colorMap: Record<string, string> = {
    slate: isActive
      ? "border-slate-700 text-slate-800 bg-slate-50"
      : "border-transparent text-slate-500 hover:text-slate-700",
    orange: isActive
      ? "border-orange-500 text-orange-600 bg-orange-50/50"
      : "border-transparent text-slate-500 hover:text-slate-700",
    emerald: isActive
      ? "border-emerald-500 text-emerald-600 bg-emerald-50/50"
      : "border-transparent text-slate-500 hover:text-slate-700",
    rose: isActive
      ? "border-rose-500 text-rose-600 bg-rose-50/50"
      : "border-transparent text-slate-500 hover:text-slate-700",
    amber: isActive
      ? "border-amber-500 text-amber-600 bg-amber-50/50"
      : "border-transparent text-slate-500 hover:text-slate-700",
  };
  const badgeColorMap: Record<string, string> = {
    slate: isActive
      ? "bg-slate-200 text-slate-700"
      : "bg-slate-100 text-slate-500",
    orange: isActive
      ? "bg-orange-100 text-orange-600"
      : "bg-slate-100 text-slate-500",
    emerald: isActive
      ? "bg-emerald-100 text-emerald-600"
      : "bg-slate-100 text-slate-500",
    rose: isActive
      ? "bg-rose-100 text-rose-600"
      : "bg-slate-100 text-slate-500",
    amber: isActive
      ? "bg-amber-100 text-amber-600"
      : "bg-slate-100 text-slate-500",
  };
                      return (
                        <button
                          key={tab.key}
                          onClick={() => setActiveTab(tab.key as any)}
                          className={`py-2 px-3 text-sm font-bold border-b-2 whitespace-nowrap transition-all flex items-center gap-1.5 ${colorMap[tab.color]}`}
                        >
                          {tab.label}
                          <span
                            className={`px-1.5 py-0.5 text-xs rounded-full font-bold ${badgeColorMap[tab.color]}`}
                          >
                            {tab.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Filters Row */}
                  <div className="flex flex-wrap items-center gap-1.5 px-3 py-1.5 border-t border-slate-50">
                    {activeTab === "all" && (
                      <label className="flex items-center gap-1 px-2 py-1 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-600 font-semibold cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={hideClearedInAll}
                          onChange={(e) =>
                            setHideClearedInAll(e.target.checked)
                          }
                          className="rounded border-slate-300 text-orange-500 focus:ring-orange-500 cursor-pointer w-3.5 h-3.5"
                        />
                        Hide Cleared
                      </label>
                    )}

                    <div className="relative flex-1 min-w-[180px] max-w-[260px]">
                      <input
                        type="text"
                        placeholder="Search..."
                        value={orderSearchTerm}
                        onChange={(e) => setOrderSearchTerm(e.target.value)}
                        className="w-full pl-7 pr-2 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-orange-300 text-slate-700 placeholder:text-slate-300"
                      />
                      <svg
                        className="w-3.5 h-3.5 text-slate-300 absolute left-2 top-2"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                      </svg>
                    </div>

                    <select
                      value={filterFeeType}
                      onChange={(e) => setFilterFeeType(e.target.value)}
                      className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-md text-sm text-slate-600 font-medium focus:outline-none focus:ring-1 focus:ring-orange-300"
                    >
                      <option value="All">Fee: All</option>
                      <option value="Deli">Deli</option>
                      <option value="Kpay">Kpay</option>
                      <option value="Cash">Cash</option>
                      <option value="Bill">Bill</option>
                    </select>

                    <select
                      value={filterLoc}
                      onChange={(e) => setFilterLoc(e.target.value)}
                      className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-md text-sm text-slate-600 font-medium focus:outline-none focus:ring-1 focus:ring-orange-300"
                    >
                      <option value="All">Loc: All</option>
                      {Array.from(
                        new Set(
                          orders
                            .map((o) => o.receiver_loc)
                            .filter(Boolean)
                        )
                      ).map((loc) => (
                        <option key={loc} value={loc}>
                          {loc}
                        </option>
                      ))}
                    </select>

                    <div className="flex items-center gap-1 text-xs text-slate-500 bg-slate-50 px-2 py-1 border border-slate-200 rounded-md">
                      <span className="font-semibold text-slate-400">Deli</span>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="bg-transparent focus:outline-none text-slate-700 text-sm w-[102px]"
                        title="Start"
                      />
                      <span className="text-slate-300">—</span>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="bg-transparent focus:outline-none text-slate-700 text-sm w-[102px]"
                        title="End"
                      />
                      {(startDate || endDate) && (
                        <button
                          onClick={() => {
                            setStartDate("");
                            setEndDate("");
                          }}
                          className="text-rose-400 hover:text-rose-600 font-bold text-sm"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1 text-xs text-slate-500 bg-slate-50 px-2 py-1 border border-slate-200 rounded-md">
                      <span className="font-semibold text-slate-400">Rcvd</span>
                      <input
                        type="date"
                        value={receivedStartDate}
                        onChange={(e) =>
                          setReceivedStartDate(e.target.value)
                        }
                        className="bg-transparent focus:outline-none text-slate-700 text-sm w-[102px]"
                        title="Start"
                      />
                      <span className="text-slate-300">—</span>
                      <input
                        type="date"
                        value={receivedEndDate}
                        onChange={(e) =>
                          setReceivedEndDate(e.target.value)
                        }
                        className="bg-transparent focus:outline-none text-slate-700 text-sm w-[102px]"
                        title="End"
                      />
                      {(receivedStartDate || receivedEndDate) && (
                        <button
                          onClick={() => {
                            setReceivedStartDate("");
                            setReceivedEndDate("");
                          }}
                          className="text-rose-400 hover:text-rose-600 font-bold text-sm"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bulk Clear Action Bar */}
                {canSelectOrders && selectedOrderIds.length > 0 && (
                  <div className="bg-orange-50/80 border-b border-orange-100 px-3 py-1.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 animate-fadeIn">
                    <div className="text-sm font-semibold text-orange-800">
                      <span className="font-mono bg-orange-200/60 px-1.5 py-0.5 rounded text-orange-700">
                        {selectedOrderIds.length}
                      </span>{" "}
                      selected · COD:{" "}
                      <span className="font-mono text-orange-600 font-bold">
                        {totalSelectedCod.toLocaleString()} Ks
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={clearedDateInput}
                        onChange={(e) =>
                          setClearedDateInput(e.target.value)
                        }
                        className="px-2 py-1 bg-white border border-orange-200 rounded-md text-sm font-semibold text-slate-800"
                      />
                      <button
                        onClick={handleBulkClear}
                        disabled={clearing}
                        className="px-3 py-1 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white rounded-md text-sm font-bold transition-all shadow-sm"
                      >
                        {clearing ? "Saving..." : "Clear Selected"}
                      </button>
                    </div>
                  </div>
                )}

                {/* ─── EXCEL-STYLE TABLE ─── */}
                <div className="flex-1 overflow-auto custom-scrollbar">
                  {getDisplayOrders().length > 0 ? (
                    <table className="min-w-[1180px] w-full border-collapse text-sm">
                      <thead>
                        <tr className="bg-slate-100 sticky top-0 z-10">
                          {canSelectOrders && (
                            <th className="px-2 py-2 text-center border-b-2 border-slate-300 w-8">
                              <input
                                type="checkbox"
                                checked={
                                  selectableOrders.length > 0 &&
                                  selectableOrders.every((o) =>
                                    selectedOrderIds.includes(o.id)
                                  )
                                }
                                onChange={(e) => {
                                  if (e.target.checked)
                                    setSelectedOrderIds(
                                      selectableOrders.map((o) => o.id)
                                    );
                                  else setSelectedOrderIds([]);
                                }}
                                className="rounded border-slate-400 text-orange-500 focus:ring-orange-500 cursor-pointer w-3.5 h-3.5"
                              />
                            </th>
                          )}
                          <th className="sticky left-0 bg-slate-100 px-3 py-2 text-left font-bold text-slate-600 uppercase tracking-wider text-sm border-b-2 border-slate-300 border-r border-slate-200">
                            Way ID
                          </th>
                          <th className="px-3 py-2 text-left font-bold text-slate-600 uppercase tracking-wider text-sm border-b-2 border-slate-300 border-r border-slate-200">
                            Rcvd Date
                          </th>
                          <th className="px-3 py-2 text-left font-bold text-slate-600 uppercase tracking-wider text-sm border-b-2 border-slate-300 border-r border-slate-200">
                            Receiver Name
                          </th>
                          <th className="px-3 py-2 text-left font-bold text-slate-600 uppercase tracking-wider text-sm border-b-2 border-slate-300 border-r border-slate-200">
                            Phone
                          </th>
                          <th className="px-3 py-2 text-left font-bold text-slate-600 uppercase tracking-wider text-sm border-b-2 border-slate-300 border-r border-slate-200">
                            Location
                          </th>
                          <th className="px-3 py-2 text-right font-bold text-slate-600 uppercase tracking-wider text-sm border-b-2 border-slate-300 border-r border-slate-200">
                            COD (Ks)
                          </th>
                          <th className="px-3 py-2 text-right font-bold text-slate-600 uppercase tracking-wider text-sm border-b-2 border-slate-300 border-r border-slate-200">
                            Deli Fee
                          </th>
                          <th className="px-3 py-2 text-center font-bold text-slate-600 uppercase tracking-wider text-sm border-b-2 border-slate-300 border-r border-slate-200">
                            Fee Type
                          </th>
                          <th className="px-3 py-2 text-right font-bold text-slate-600 uppercase tracking-wider text-sm border-b-2 border-slate-300 border-r border-slate-200">
                            Total
                          </th>
                          <th className="px-3 py-2 text-left font-bold text-slate-600 uppercase tracking-wider text-sm border-b-2 border-slate-300 border-r border-slate-200">
                            Deli Date
                          </th>
                          <th className="px-3 py-2 text-center font-bold text-slate-600 uppercase tracking-wider text-sm border-b-2 border-slate-300 border-r border-slate-200">
                            Status
                          </th>
                          {(activeTab === "cleared" ||
                            activeTab === "all") && (
                            <th className="px-3 py-2 text-left font-bold text-slate-600 uppercase tracking-wider text-sm border-b-2 border-slate-300">
                              Cleared Date
                            </th>
                          )}
                          {activeTab === "returned" && (
                            <th className="px-3 py-2 text-left font-bold text-slate-600 uppercase tracking-wider text-sm border-b-2 border-slate-300">
                              Refund Date
                            </th>
                          )}
                          
                        </tr>
                      </thead>
                      <tbody>
                        {getDisplayOrders().map((order, index) => (
                          <tr
                            key={order.id || index}
                            className={`transition-colors ${
                              index % 2 === 0
                                ? "bg-white"
                                : "bg-slate-50/50"
                            } hover:bg-blue-50/60`}
                          >
                            {canSelectOrders && (
                              <td className="px-2 py-2 text-center border-b border-slate-200 border-r border-slate-100">
                                {!order.cleared_date && (
                                  <input
                                    type="checkbox"
                                    checked={selectedOrderIds.includes(
                                      order.id
                                    )}
                                    onChange={() => {
                                      if (
                                        selectedOrderIds.includes(
                                          order.id
                                        )
                                      ) {
                                        setSelectedOrderIds(
                                          selectedOrderIds.filter(
                                            (id) => id !== order.id
                                          )
                                        );
                                      } else {
                                        setSelectedOrderIds([
                                          ...selectedOrderIds,
                                          order.id,
                                        ]);
                                      }
                                    }}
                                    className="rounded border-slate-300 text-orange-500 focus:ring-orange-500 cursor-pointer w-3.5 h-3.5"
                                  />
                                )}
                              </td>
                            )}
                            <td className="sticky left-0 bg-inherit px-3 py-2 font-mono font-bold text-slate-800 border-b border-slate-200 border-r border-slate-100 text-sm">
                              {order.item_id || order.id}
                            </td>
                            <td className="px-3 py-2 font-mono text-slate-500 border-b border-slate-200 border-r border-slate-100 text-sm">
                              {order.received_date
                                ? String(order.received_date).split(
                                    "T"
                                  )[0]
                                : "—"}
                            </td>
                            <td className="px-3 py-2 font-semibold text-slate-700 border-b border-slate-200 border-r border-slate-100 text-sm">
                              {order.receiver_name || "Unknown"}
                            </td>
                            <td className="px-3 py-2 font-mono text-slate-500 border-b border-slate-200 border-r border-slate-100 text-sm">
                              {order.receiver_phone || "—"}
                            </td>
                            <td className="px-3 py-2 font-mono text-slate-500 border-b border-slate-200 border-r border-slate-100 text-sm">
                              {order.receiver_loc || "—"}
                            </td>
                            <td className="px-3 py-2 text-right font-mono font-semibold text-slate-700 border-b border-slate-200 border-r border-slate-100">
                              {order.cod_amount
                                ? Number(
                                    order.cod_amount
                                  ).toLocaleString()
                                : "0"}
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-slate-500 border-b border-slate-200 border-r border-slate-100">
                              {order.deli_fee
                                ? Number(
                                    order.deli_fee
                                  ).toLocaleString()
                                : "0"}
                            </td>
                            <td className="px-3 py-2 text-center border-b border-slate-200 border-r border-slate-100">
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs font-bold">
                                {order.fee_type || "—"}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right font-mono font-bold text-slate-800 border-b border-slate-200 border-r border-slate-100">
                              {order.total_amount
                                ? Number(
                                    order.total_amount
                                  ).toLocaleString()
                                : "0"}
                            </td>
                            <td className="px-3 py-2 font-mono text-slate-500 border-b border-slate-200 border-r border-slate-100 text-sm">
                              {order.deliver_date ||
                                new Date(
                                  order.created_at
                                ).toLocaleDateString()}
                            </td>
                            <td className="px-3 py-2 text-center border-b border-slate-200 border-r border-slate-100">
                              {getStatusBadge(order.status)}
                            </td>
                            {(activeTab === "cleared" ||
                              activeTab === "all") && (
                              <td className="px-3 py-2 font-mono text-emerald-600 font-semibold border-b border-slate-200 text-sm">
                                {order.cleared_date
                                  ? `📅 ${new Date(
                                      order.cleared_date
                                    ).toLocaleDateString()}`
                                  : "—"}
                              </td>
                            )}
                            {activeTab === "returned" && (
                              <td className="px-3 py-2 font-mono text-rose-600 font-semibold border-b border-slate-200 text-sm">
                                {order.refund_date
                                  ? `📅 ${new Date(
                                      order.refund_date
                                    ).toLocaleDateString()}`
                                  : "—"}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 py-12 space-y-2">
                      <svg
                        className="w-8 h-8 text-slate-200"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      <p className="text-sm font-medium">
                        No orders in this tab.
                      </p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-3">
                <svg
                  className="w-10 h-10 text-slate-200"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"
                  />
                </svg>
                <p className="text-sm font-medium">
                  Select a sender from the left panel to view orders.
                </p>
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

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
          height: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}