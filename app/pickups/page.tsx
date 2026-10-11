"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

// ----------------- TYPES -----------------

type Sender = {
  id: number;
  name: string;
  address?: string;
  Address?: string;
  phone?: string;
};

type Rider = {
  id: string | number;
  name: string;
  phone?: string;
};

type ManualSenderData = {
  isManual: boolean;
  name: string;
  phone: string;
  address: string;
  note: string;
};

type Pickup = {
  id: number;
  sender_id: number;
  rider_id: string | number | null;
  status: "Pending" | "Assigned" | "Completed";
  quantity: number;
  note: string | null;
  created_at: string;
  senders: Sender;
  riders?: Rider | null;
  manualSender?: ManualSenderData | null;
};

// ----------------- MANUAL SENDER NOTE HELPERS -----------------
const MANUAL_TAG = "[MANUAL_SENDER]";

function encodeManualSenderNote(senderName: string, phone: string, address: string, note: string): string {
  const payload = {
    m: true,
    n: senderName.trim(),
    p: phone.trim(),
    a: address.trim(),
    rem: note.trim(),
  };
  return `${MANUAL_TAG}${JSON.stringify(payload)}`;
}

function parseManualSender(note: string | null | undefined): { manual: ManualSenderData | null; cleanNote: string } {
  if (!note || !note.includes(MANUAL_TAG)) {
    return { manual: null, cleanNote: note || "" };
  }

  const rawJson = note.replace(MANUAL_TAG, "").trim();
  try {
    const parsed = JSON.parse(rawJson);
    if (parsed && parsed.m) {
      return {
        manual: {
          isManual: true,
          name: parsed.n || "Manual Sender",
          phone: parsed.p || "",
          address: parsed.a || "",
          note: parsed.rem || "",
        },
        cleanNote: parsed.rem || "",
      };
    }
  } catch (e) {
    // If not json format, fallback
  }

  return { manual: null, cleanNote: note };
}

// ----------------- SVG ICONS -----------------

const IconPackage = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 10V11" />
  </svg>
);

const IconPlus = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
  </svg>
);

const IconSearch = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <circle cx="11" cy="11" r="8" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
  </svg>
);

const IconEdit = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const IconTrash = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <polyline points="3 6 5 6 21 6" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 11v6M14 11v6" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
  </svg>
);

const IconMapPin = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const IconPhone = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
  </svg>
);

const IconUser = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const IconCheck = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M20 6L9 17l-5-5" />
  </svg>
);

const IconArrowRight = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
  </svg>
);

const IconRefresh = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const IconX = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const IconWarning = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
  </svg>
);

const IconNote = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

// ----------------- MAIN COMPONENT -----------------

export default function PickupsPage() {
  const [pickups, setPickups] = useState<Pickup[]>([]);
  const [senders, setSenders] = useState<Sender[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("Pending");

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);

  // Form States (Add/Edit)
  const [senderMode, setSenderMode] = useState<"select" | "manual">("select");
  const [selectedPickup, setSelectedPickup] = useState<Pickup | null>(null);
  const [formData, setFormData] = useState({
    sender_id: "",
    manual_name: "",
    manual_phone: "",
    manual_address: "",
    rider_id: "",
    quantity: 1,
    note: "",
    status: "Pending" as "Pending" | "Assigned" | "Completed",
  });

  const [assignRiderId, setAssignRiderId] = useState<string>("");
  const [completeQty, setCompleteQty] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    await Promise.all([fetchPickups(), fetchSenders(), fetchRiders()]);
    setLoading(false);
  };

  const fetchPickups = async () => {
    const { data: pickupsData, error: pickupsError } = await supabase
      .from("pickups")
      .select("*")
      .order("created_at", { ascending: false });

    if (pickupsError) {
      console.error("Error fetching pickups:", pickupsError.message);
      setLoading(false);
      return;
    }

    const [sendersRes, ridersRes] = await Promise.all([
      supabase.from("senders").select("*"),
      supabase.from("riders").select("*"),
    ]);

    const sendersList = sendersRes.data || [];
    const ridersList = ridersRes.data || [];

    const sendersMap = new Map(sendersList.map((s) => [s.id, s]));
    const ridersMap = new Map(ridersList.map((r) => [r.id, r]));

    const mergedPickups: Pickup[] = (pickupsData || []).map((item: any) => {
      const { manual } = parseManualSender(item.note);
      const regularSender = sendersMap.get(item.sender_id);

      // If this pickup was saved with manual sender details
      let senderInfo: Sender;
      if (manual) {
        senderInfo = {
          id: item.sender_id,
          name: manual.name,
          phone: manual.phone,
          Address: manual.address,
          address: manual.address,
        };
      } else {
        senderInfo = regularSender || {
          id: item.sender_id,
          name: "Unknown Sender",
          Address: "လိပ်စာမရှိ",
        };
      }

      return {
        ...item,
        senders: senderInfo,
        riders: item.rider_id ? ridersMap.get(item.rider_id) || null : null,
        manualSender: manual,
      };
    });

    setPickups(mergedPickups);
    setLoading(false);
  };

  const fetchSenders = async () => {
    const { data } = await supabase.from("senders").select("*").order("name");
    if (data) setSenders(data);
  };

  const fetchRiders = async () => {
    try {
      const storedBranch =
        typeof window !== "undefined" ? localStorage.getItem("user_branch") : null;

      let query = supabase.from("riders").select("*").order("name");

      if (storedBranch) {
        query = query.eq("branch", storedBranch);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching riders:", error.message);
        return;
      }

      if (data) setRiders(data);
    } catch (err) {
      console.error("Unexpected error fetching riders:", err);
    }
  };

  // Helper to ensure dummy manual sender ID exists in database
  const getManualSenderId = async (): Promise<number> => {
    const { data } = await supabase
      .from("senders")
      .select("id")
      .eq("name", "Manual Sender")
      .maybeSingle();

    if (data?.id) return data.id;

    // Fallback if not found, use first sender or create
    const { data: created } = await supabase
      .from("senders")
      .insert({ name: "Manual Sender", LOC: "SYSTEM", phone: "-", Address: "-" })
      .select("id")
      .single();

    return created?.id || (senders[0]?.id ?? 560);
  };

  // 1. Pickup အသစ်ထည့်ခြင်း
  const handleAddPickup = async (e: React.FormEvent) => {
    e.preventDefault();

    let targetSenderId: number;
    let finalNote: string | null = null;

    if (senderMode === "manual") {
      if (!formData.manual_name.trim()) return alert("Sender အမည် ရိုက်ထည့်ပါ");
      targetSenderId = await getManualSenderId();
      finalNote = encodeManualSenderNote(
        formData.manual_name,
        formData.manual_phone,
        formData.manual_address,
        formData.note
      );
    } else {
      if (!formData.sender_id) return alert("Sender ရွေးချယ်ပါ");
      targetSenderId = Number(formData.sender_id);
      finalNote = formData.note.trim() || null;
    }

    const initialStatus = formData.rider_id ? "Assigned" : "Pending";

    const { error } = await supabase.from("pickups").insert({
      sender_id: targetSenderId,
      rider_id: formData.rider_id ? formData.rider_id : null,
      quantity: Number(formData.quantity) || 1,
      status: initialStatus,
      note: finalNote,
    });

    if (error) {
      alert("Error adding pickup: " + error.message);
    } else {
      setIsAddModalOpen(false);
      resetForm();
      fetchPickups();
    }
  };

  // 2. Assign / Reassign Rider
  const handleAssignRider = async () => {
    if (!selectedPickup || !assignRiderId) return;

    const { error } = await supabase
      .from("pickups")
      .update({ rider_id: assignRiderId, status: "Assigned" })
      .eq("id", selectedPickup.id);

    if (error) {
      alert("Error assigning rider: " + error.message);
    } else {
      setIsAssignModalOpen(false);
      setSelectedPickup(null);
      fetchPickups();
    }
  };

  // 3. Completed သို့ ပြောင်းခြင်း
  const handleCompletePickup = async () => {
    if (!selectedPickup) return;

    const { error } = await supabase
      .from("pickups")
      .update({ quantity: Number(completeQty), status: "Completed" })
      .eq("id", selectedPickup.id);

    if (error) {
      alert("Error completing pickup: " + error.message);
    } else {
      setIsCompleteModalOpen(false);
      setSelectedPickup(null);
      fetchPickups();
    }
  };

  // 4. Edit Pickup
  const handleUpdatePickup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPickup) return;

    let targetSenderId = selectedPickup.sender_id;
    let finalNote: string | null = null;

    if (senderMode === "manual") {
      if (!formData.manual_name.trim()) return alert("Sender အမည် ရိုက်ထည့်ပါ");
      targetSenderId = await getManualSenderId();
      finalNote = encodeManualSenderNote(
        formData.manual_name,
        formData.manual_phone,
        formData.manual_address,
        formData.note
      );
    } else {
      if (!formData.sender_id) return alert("Sender ရွေးချယ်ပါ");
      targetSenderId = Number(formData.sender_id);
      finalNote = formData.note.trim() || null;
    }

    const { error } = await supabase
      .from("pickups")
      .update({
        sender_id: targetSenderId,
        rider_id: formData.rider_id ? formData.rider_id : null,
        quantity: Number(formData.quantity),
        status: formData.status,
        note: finalNote,
      })
      .eq("id", selectedPickup.id);

    if (error) {
      alert("Error updating pickup: " + error.message);
    } else {
      setIsEditModalOpen(false);
      setSelectedPickup(null);
      fetchPickups();
    }
  };

  // 5. Pickup ဖျက်ခြင်း
  const handleDeletePickup = async () => {
    if (!selectedPickup) return;

    const { error } = await supabase.from("pickups").delete().eq("id", selectedPickup.id);

    if (error) {
      alert("Error deleting pickup: " + error.message);
    } else {
      setIsDeleteModalOpen(false);
      setSelectedPickup(null);
      fetchPickups();
    }
  };

  const resetForm = () => {
    setSenderMode("select");
    setFormData({
      sender_id: "",
      manual_name: "",
      manual_phone: "",
      manual_address: "",
      rider_id: "",
      quantity: 1,
      note: "",
      status: "Pending",
    });
  };

  const filteredPickups = pickups.filter((item) => {
    const matchesTab = activeTab === "All" || item.status === activeTab;
    const senderAddress = item.senders?.Address || item.senders?.address || "";
    const senderPhone = item.senders?.phone || "";
    const cleanNoteText = parseManualSender(item.note).cleanNote;
    const query = searchQuery.toLowerCase();

    const matchesSearch =
      item.senders?.name?.toLowerCase().includes(query) ||
      senderAddress.toLowerCase().includes(query) ||
      senderPhone.toLowerCase().includes(query) ||
      item.riders?.name?.toLowerCase().includes(query) ||
      cleanNoteText.toLowerCase().includes(query);

    return matchesTab && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 text-slate-800">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 rounded-xl text-blue-600">
              <IconPackage className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Pickups စာရင်း</h1>
              <p className="text-slate-500 text-sm mt-0.5">
                Sender အလိုက် ပစ္စည်းသိမ်းယူမှုများကို စီမံခန့်ခွဲပါ
              </p>
            </div>
          </div>
          <button
            onClick={() => { resetForm(); setIsAddModalOpen(true); }}
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 active:scale-95 transition text-white px-5 py-2.5 rounded-xl font-medium shadow-md shadow-blue-500/20"
          >
            <IconPlus className="w-4 h-4" />
            <span>Pickup အသစ်ထည့်မည်</span>
          </button>
        </div>

        {/* Filter Tabs & Search */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex bg-slate-200/80 p-1 rounded-xl w-full md:w-auto overflow-x-auto">
            {["All", "Pending", "Assigned", "Completed"].map((tab) => {
              const count = tab === "All" ? pickups.length : pickups.filter((p) => p.status === tab).length;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition whitespace-nowrap flex-1 md:flex-initial justify-center ${
                    activeTab === tab ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <span>{tab}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${activeTab === tab ? "bg-slate-100 text-slate-800" : "bg-slate-300 text-slate-700"}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="relative w-full md:w-72">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <IconSearch className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder="Sender, Rider သို့မဟုတ် လိပ်စာ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
            />
          </div>
        </div>

        {/* Cards Grid */}
        {loading ? (
          <div className="text-center py-12 text-slate-400">Loading pickups...</div>
        ) : filteredPickups.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-100 text-slate-500">
            စာရင်း မရှိသေးပါ။
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPickups.map((item) => {
              const { cleanNote } = parseManualSender(item.note);
              const isManual = Boolean(item.manualSender);

              return (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between space-y-4"
                >
                  <div>
                    {/* Card Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={item.status} />
                        {isManual && (
                          <span className="bg-purple-50 text-purple-700 border border-purple-200/60 text-xs font-semibold px-2 py-0.5 rounded-md">
                            Manual
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {/* Note button */}
                        <button
                          onClick={() => { setSelectedPickup(item); setIsNoteModalOpen(true); }}
                          className={`p-1.5 rounded-lg transition ${
                            cleanNote
                              ? "text-amber-500 hover:bg-amber-50 hover:text-amber-600"
                              : "text-slate-300 hover:bg-slate-100 hover:text-slate-500"
                          }`}
                          title={cleanNote ? "Note ကြည့်မည် / ပြင်မည်" : "Note ထည့်မည်"}
                        >
                          <IconNote className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedPickup(item);
                            if (item.manualSender) {
                              setSenderMode("manual");
                              setFormData({
                                sender_id: String(item.sender_id),
                                manual_name: item.manualSender.name,
                                manual_phone: item.manualSender.phone,
                                manual_address: item.manualSender.address,
                                rider_id: item.rider_id ? String(item.rider_id) : "",
                                quantity: item.quantity,
                                note: item.manualSender.note,
                                status: item.status,
                              });
                            } else {
                              setSenderMode("select");
                              setFormData({
                                sender_id: String(item.sender_id),
                                manual_name: "",
                                manual_phone: "",
                                manual_address: "",
                                rider_id: item.rider_id ? String(item.rider_id) : "",
                                quantity: item.quantity,
                                note: item.note || "",
                                status: item.status,
                              });
                            }
                            setIsEditModalOpen(true);
                          }}
                          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition"
                          title="Edit"
                        >
                          <IconEdit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => { setSelectedPickup(item); setIsDeleteModalOpen(true); }}
                          className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500 transition"
                          title="ဖျက်မည်"
                        >
                          <IconTrash className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Card Body */}
                    <div className="mt-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-bold text-slate-900 text-lg leading-tight">
                          {item.senders?.name || "Unassigned Sender"}
                        </h3>
                        <span className="bg-blue-50 text-blue-700 text-xs font-semibold px-2.5 py-1 rounded-lg flex items-center gap-1 shrink-0">
                          <IconPackage className="w-3.5 h-3.5" />
                          {item.quantity} ခု
                        </span>
                      </div>

                      {item.senders?.phone && item.senders.phone !== "-" && (
                        <div className="flex items-center gap-2 text-slate-600 text-xs">
                          <IconPhone className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                          <span>{item.senders.phone}</span>
                        </div>
                      )}

                      <div className="flex items-start gap-2 text-slate-600 text-sm">
                        <IconMapPin className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
                        <p className="line-clamp-2">
                          {item.senders?.Address || item.senders?.address || "လိပ်စာမရှိပါ"}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 text-slate-600 text-sm">
                        <IconUser className="w-4 h-4 text-slate-400" />
                        <span className="font-medium">
                          Rider:{" "}
                          <span className={item.riders ? "text-slate-800 font-semibold" : "text-amber-600 italic"}>
                            {item.riders?.name || "မသတ်မှတ်ရသေးပါ"}
                          </span>
                        </span>
                      </div>

                      {/* Note preview */}
                      {cleanNote && (
                        <div
                          className="flex items-start gap-2 text-slate-600 text-sm bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 cursor-pointer hover:bg-amber-100 transition"
                          onClick={() => { setSelectedPickup(item); setIsNoteModalOpen(true); }}
                        >
                          <IconNote className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-500" />
                          <p className="line-clamp-2 text-amber-800 text-xs">{cleanNote}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bottom Action Buttons */}
                  <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                    {item.status === "Pending" ? (
                      <button
                        onClick={() => { setSelectedPickup(item); setAssignRiderId(""); setIsAssignModalOpen(true); }}
                        className="w-full bg-blue-50 text-blue-700 hover:bg-blue-100 py-2.5 px-3 rounded-xl font-medium text-xs flex items-center justify-center gap-1.5 active:scale-95 transition"
                      >
                        <IconArrowRight className="w-3.5 h-3.5" />
                        <span>Assign Rider</span>
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => { setSelectedPickup(item); setCompleteQty(item.quantity); setIsCompleteModalOpen(true); }}
                          disabled={item.status === "Completed"}
                          className={`flex-1 py-2 px-3 rounded-xl font-medium text-xs flex items-center justify-center gap-1.5 transition ${
                            item.status === "Completed"
                              ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                              : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 active:scale-95"
                          }`}
                        >
                          <IconCheck className="w-3.5 h-3.5" />
                          <span>Completed</span>
                        </button>

                        <button
                          onClick={() => { setSelectedPickup(item); setAssignRiderId(item.rider_id ? String(item.rider_id) : ""); setIsAssignModalOpen(true); }}
                          disabled={item.status === "Completed"}
                          className={`flex-1 py-2 px-3 rounded-xl font-medium text-xs flex items-center justify-center gap-1.5 transition ${
                            item.status === "Completed"
                              ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                              : "bg-purple-50 text-purple-700 hover:bg-purple-100 active:scale-95"
                          }`}
                        >
                          <IconRefresh className="w-3.5 h-3.5" />
                          <span>Reassign</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ----------------- MODALS ----------------- */}

      {/* 1. Add Pickup Modal */}
      {isAddModalOpen && (
        <Modal title="Pickup အသစ်ထည့်မည်" onClose={() => setIsAddModalOpen(false)}>
          <form onSubmit={handleAddPickup} className="space-y-4">

            {/* Mode Switcher Tabs */}
            <div className="flex p-1 bg-slate-100 rounded-xl gap-1">
              <button
                type="button"
                onClick={() => setSenderMode("select")}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition ${
                  senderMode === "select"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                📋 Sender List ထဲမှ ရွေးမည်
              </button>
              <button
                type="button"
                onClick={() => setSenderMode("manual")}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition ${
                  senderMode === "manual"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                ✍️ အသစ်ရိုက်ထည့်မည် (Manual)
              </button>
            </div>

            {/* Select from Senders List */}
            {senderMode === "select" ? (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Sender ရွေးချယ်ပါ *</label>
                <select
                  required
                  value={formData.sender_id}
                  onChange={(e) => setFormData({ ...formData, sender_id: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Sender ရွေးပါ --</option>
                  {senders
                    .filter((s) => s.name !== "Manual Sender")
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.Address || s.address || ""})
                      </option>
                    ))}
                </select>
              </div>
            ) : (
              /* Manual Input Mode */
              <div className="space-y-3 bg-blue-50/50 p-3.5 rounded-xl border border-blue-100">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Sender အမည် * <span className="text-slate-400 font-normal">(Senders list ထဲ မထည့်ပါ)</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.manual_name}
                    onChange={(e) => setFormData({ ...formData, manual_name: e.target.value })}
                    placeholder="ဥပမာ - မမြမြ၊ ဆိုင်အမည် စသည်..."
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">ဖုန်းနံပါတ်</label>
                    <input
                      type="text"
                      value={formData.manual_phone}
                      onChange={(e) => setFormData({ ...formData, manual_phone: e.target.value })}
                      placeholder="09..."
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">ပစ္စည်းသိမ်းမည့် လိပ်စာ</label>
                    <input
                      type="text"
                      value={formData.manual_address}
                      onChange={(e) => setFormData({ ...formData, manual_address: e.target.value })}
                      placeholder="ရပ်ကွက် / လမ်း / အိမ်အမှတ်..."
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Rider (မထည့်လည်းရသည်)</label>
              <select
                value={formData.rider_id}
                onChange={(e) => setFormData({ ...formData, rider_id: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- တန်းမသတ်မှတ်သေးပါ (Pending) --</option>
                {riders.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">အရေအတွက် (Quantity)</label>
              <input
                type="number"
                min="1"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1.5">
                <IconNote className="w-3.5 h-3.5 text-slate-400" />
                Note (မထည့်လည်းရသည်)
              </label>
              <textarea
                rows={2}
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                placeholder="မှတ်ချက်တစ်ခုခု ထည့်မည်ဆိုရင် ဒီမှာ ရေးပါ..."
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-medium text-sm hover:bg-slate-50">
                မလုပ်တော့ပါ
              </button>
              <button type="submit" className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-medium text-sm hover:bg-blue-700">
                သိမ်းဆည်းမည်
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* 2. Assign / Reassign Modal */}
      {isAssignModalOpen && selectedPickup && (
        <Modal title="Rider တာဝန်ပေးမည် / ပြောင်းမည်" onClose={() => setIsAssignModalOpen(false)}>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              <span className="font-semibold">{selectedPickup.senders?.name}</span> ထံ ပစ္စည်းသွားသိမ်းရန် Rider ရွေးချယ်ပါ
            </p>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Rider ရွေးပါ</label>
              <select
                value={assignRiderId}
                onChange={(e) => setAssignRiderId(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Rider ရွေးချယ်ပါ --</option>
                {riders.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setIsAssignModalOpen(false)} className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-medium text-sm hover:bg-slate-50">
                မလုပ်တော့ပါ
              </button>
              <button type="button" onClick={handleAssignRider} className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-medium text-sm hover:bg-blue-700">
                အတည်ပြုမည်
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* 3. Complete Confirmation Modal */}
      {isCompleteModalOpen && selectedPickup && (
        <Modal title="Pickup အပြီးသတ်မည် (Completed)" onClose={() => setIsCompleteModalOpen(false)}>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              <span className="font-semibold">{selectedPickup.senders?.name}</span> ထံမှ သိမ်းယူရရှိခဲ့သည့် အမှန်တကယ် အရေအတွက်ကို အတည်ပြုပေးပါ
            </p>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">သိမ်းယူခဲ့သည့် အရေအတွက် (Qty)</label>
              <input
                type="number"
                min="1"
                value={completeQty}
                onChange={(e) => setCompleteQty(Number(e.target.value))}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setIsCompleteModalOpen(false)} className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-medium text-sm hover:bg-slate-50">
                မလုပ်တော့ပါ
              </button>
              <button type="button" onClick={handleCompletePickup} className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl font-medium text-sm hover:bg-emerald-700">
                Completed ဟု သတ်မှတ်မည်
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* 4. Edit Pickup Modal */}
      {isEditModalOpen && selectedPickup && (
        <Modal title="Pickup အချက်အလက် ပြင်မည်" onClose={() => setIsEditModalOpen(false)}>
          <form onSubmit={handleUpdatePickup} className="space-y-4">

            {/* Mode Switcher Tabs */}
            <div className="flex p-1 bg-slate-100 rounded-xl gap-1">
              <button
                type="button"
                onClick={() => setSenderMode("select")}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition ${
                  senderMode === "select"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                📋 Sender List ထဲမှ ရွေးမည်
              </button>
              <button
                type="button"
                onClick={() => setSenderMode("manual")}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition ${
                  senderMode === "manual"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                ✍️ Manual Sender ပြင်မည်
              </button>
            </div>

            {senderMode === "select" ? (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Sender ရွေးပါ</label>
                <select
                  required
                  value={formData.sender_id}
                  onChange={(e) => setFormData({ ...formData, sender_id: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Sender ရွေးပါ --</option>
                  {senders
                    .filter((s) => s.name !== "Manual Sender")
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.Address || s.address || ""})
                      </option>
                    ))}
                </select>
              </div>
            ) : (
              <div className="space-y-3 bg-blue-50/50 p-3.5 rounded-xl border border-blue-100">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Sender အမည် *</label>
                  <input
                    type="text"
                    required
                    value={formData.manual_name}
                    onChange={(e) => setFormData({ ...formData, manual_name: e.target.value })}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">ဖုန်းနံပါတ်</label>
                    <input
                      type="text"
                      value={formData.manual_phone}
                      onChange={(e) => setFormData({ ...formData, manual_phone: e.target.value })}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">ပစ္စည်းသိမ်းမည့် လိပ်စာ</label>
                    <input
                      type="text"
                      value={formData.manual_address}
                      onChange={(e) => setFormData({ ...formData, manual_address: e.target.value })}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Rider ပြင်ရန်</label>
              <select
                value={formData.rider_id}
                onChange={(e) => setFormData({ ...formData, rider_id: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- တာဝန်မပေးသေးပါ --</option>
                {riders.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status ပြင်ရန်</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as "Pending" | "Assigned" | "Completed" })}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Pending">Pending</option>
                <option value="Assigned">Assigned</option>
                <option value="Completed">Completed</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label>
              <input
                type="number"
                min="1"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1.5">
                <IconNote className="w-3.5 h-3.5 text-slate-400" />
                Note
              </label>
              <textarea
                rows={2}
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                placeholder="မှတ်ချက်တစ်ခုခု ထည့်မည်ဆိုရင် ဒီမှာ ရေးပါ..."
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-medium text-sm hover:bg-slate-50">
                မလုပ်တော့ပါ
              </button>
              <button type="submit" className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-medium text-sm hover:bg-blue-700">
                ပြင်ဆင်မှု သိမ်းမည်
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* 5. Delete Confirmation Modal */}
      {isDeleteModalOpen && selectedPickup && (
        <Modal title="Pickup ဖျက်မည်" onClose={() => setIsDeleteModalOpen(false)}>
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-red-50 rounded-xl border border-red-100">
              <div className="shrink-0 text-red-500">
                <IconWarning className="w-5 h-5" />
              </div>
              <p className="text-sm text-red-700">
                <span className="font-bold">{selectedPickup.senders?.name}</span> ၏ Pickup ကို
                အပြီးအပိုင် ဖျက်မည်။ ဤလုပ်ဆောင်ချက်ကို ပြန်မလုပ်နိုင်ပါ။
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setIsDeleteModalOpen(false)} className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-medium text-sm hover:bg-slate-50">
                မလုပ်တော့ပါ
              </button>
              <button
                type="button"
                onClick={handleDeletePickup}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-medium text-sm hover:bg-red-700 active:scale-95 transition flex items-center justify-center gap-2"
              >
                <IconTrash className="w-4 h-4" />
                ဖျက်မည်
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* 6. Note View / Edit Modal */}
      {isNoteModalOpen && selectedPickup && (
        <NoteModal
          pickup={selectedPickup}
          onClose={() => { setIsNoteModalOpen(false); setSelectedPickup(null); }}
          onSaved={() => { setIsNoteModalOpen(false); setSelectedPickup(null); fetchPickups(); }}
        />
      )}
    </div>
  );
}

// ----------------- NOTE MODAL COMPONENT -----------------

function NoteModal({
  pickup,
  onClose,
  onSaved,
}: {
  pickup: Pickup;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { manual, cleanNote: initialCleanNote } = parseManualSender(pickup.note);
  const [note, setNote] = useState(initialCleanNote || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);

    let updatedNoteString: string | null = null;
    if (manual) {
      updatedNoteString = encodeManualSenderNote(
        manual.name,
        manual.phone,
        manual.address,
        note
      );
    } else {
      updatedNoteString = note.trim() || null;
    }

    const { error } = await supabase
      .from("pickups")
      .update({ note: updatedNoteString })
      .eq("id", pickup.id);

    setSaving(false);
    if (error) {
      alert("Error saving note: " + error.message);
    } else {
      onSaved();
    }
  };

  return (
    <Modal title="Note" onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span className="font-semibold text-slate-700">{pickup.senders?.name}</span>
          <span>·</span>
          <StatusBadge status={pickup.status} />
          {manual && (
            <span className="bg-purple-50 text-purple-700 border border-purple-200/60 text-xs font-semibold px-2 py-0.5 rounded-md">
              Manual
            </span>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1.5">
            <IconNote className="w-3.5 h-3.5 text-slate-400" />
            မှတ်ချက်
          </label>
          <textarea
            rows={5}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="မှတ်ချက်တစ်ခုခု ထည့်မည်ဆိုရင် ဒီမှာ ရေးပါ..."
            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 resize-none"
            autoFocus
          />
        </div>

        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-medium text-sm hover:bg-slate-50">
            မလုပ်တော့ပါ
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 bg-amber-500 text-white rounded-xl font-medium text-sm hover:bg-amber-600 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            <IconNote className="w-4 h-4" />
            {saving ? "သိမ်းနေသည်..." : "Note သိမ်းမည်"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ----------------- SUB-COMPONENTS -----------------

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "Pending":
      return <span className="bg-amber-50 text-amber-700 border border-amber-200/60 text-xs font-semibold px-2.5 py-1 rounded-lg">Pending</span>;
    case "Assigned":
      return <span className="bg-blue-50 text-blue-700 border border-blue-200/60 text-xs font-semibold px-2.5 py-1 rounded-lg">Assigned</span>;
    case "Completed":
      return <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/60 text-xs font-semibold px-2.5 py-1 rounded-lg">Completed</span>;
    default:
      return null;
  }
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 relative space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition">
            <IconX className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}