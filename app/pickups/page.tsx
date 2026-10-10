"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

// Types သတ်မှတ်ခြင်း (Database ၏ Address အကြီးကို လက်ခံနိုင်ရန် ပြင်ဆင်ထားသည်)
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

type Pickup = {
  id: number;
  sender_id: number;
  rider_id: string | number | null;
  status: "Pending" | "Assigned" | "Completed";
  quantity: number;
  created_at: string;
  senders: Sender;
  riders?: Rider | null;
};

export default function PickupsPage() {
  const [pickups, setPickups] = useState<Pickup[]>([]);
  const [senders, setSenders] = useState<Sender[]>([]);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("All");

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);

  // Form States
  const [selectedPickup, setSelectedPickup] = useState<Pickup | null>(null);
  const [formData, setFormData] = useState({
    sender_id: "",
    rider_id: "",
    quantity: 1,
    status: "Pending" as "Pending" | "Assigned" | "Completed",
  });

  const [assignRiderId, setAssignRiderId] = useState<string>("");
  const [completeQty, setCompleteQty] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState("");

  // Data ယူခြင်း
  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    await Promise.all([fetchPickups(), fetchSenders(), fetchRiders()]);
    setLoading(false);
  };

  const fetchPickups = async () => {
    // 1. Pickups စာရင်း သီးသန့်ခေါ်ခြင်း
    const { data: pickupsData, error: pickupsError } = await supabase
      .from("pickups")
      .select("*")
      .order("created_at", { ascending: false });

    if (pickupsError) {
      console.error("Error fetching pickups:", pickupsError.message);
      setLoading(false);
      return;
    }

    // 2. Senders နှင့် Riders စာရင်းများကိုပါ သီးသန့်ခေါ်ခြင်း
    const [sendersRes, ridersRes] = await Promise.all([
      supabase.from("senders").select("*"),
      supabase.from("riders").select("*")
    ]);

    const sendersList = sendersRes.data || [];
    const ridersList = ridersRes.data || [];

    // 3. ID ဖြင့် Map လုပ်ပြီး Data ချိတ်ဆက်ခြင်း (Manual Join)
    const sendersMap = new Map(sendersList.map((s) => [s.id, s]));
    const ridersMap = new Map(ridersList.map((r) => [r.id, r]));

    const mergedPickups = (pickupsData || []).map((item: any) => ({
      ...item,
      senders: sendersMap.get(item.sender_id) || { id: item.sender_id, name: "Unknown Sender", Address: "လိပ်စာမရှိ" },
      riders: item.rider_id ? ridersMap.get(item.rider_id) || null : null,
    }));

    setPickups(mergedPickups);
    setLoading(false);
  };

  const fetchSenders = async () => {
    const { data } = await supabase.from("senders").select("*").order("name");
    if (data) setSenders(data);
  };

  const fetchRiders = async () => {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      console.error("Error fetching authenticated branch:", sessionError.message);
      setRiders([]);
      return;
    }

    if (!session) {
      console.error("Cannot fetch branch riders: no authenticated user");
      setRiders([]);
      return;
    }

    const branch = session.user.user_metadata?.branch || "MDY";
    const { data, error } = await supabase
      .from("riders")
      .select("*")
      .eq("branch", branch)
      .order("name");

    if (error) {
      console.error("Error fetching branch riders:", error.message);
      setRiders([]);
      return;
    }

    setRiders(data || []);
  };

  // 1. Pickup အသစ်ထည့်ခြင်း
  const handleAddPickup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.sender_id) return alert("Sender ရွေးချယ်ပါ");

    const initialStatus = formData.rider_id ? "Assigned" : "Pending";

    const { error } = await supabase.from("pickups").insert({
      sender_id: Number(formData.sender_id),
      rider_id: formData.rider_id ? formData.rider_id : null,
      quantity: Number(formData.quantity) || 1,
      status: initialStatus,
    });

    if (error) {
      alert("Error adding pickup: " + error.message);
    } else {
      setIsAddModalOpen(false);
      resetForm();
      fetchPickups();
    }
  };

  // 2. Assign / Reassign Rider ပြုလုပ်ခြင်း
  const handleAssignRider = async () => {
    if (!selectedPickup || !assignRiderId) return;

    const { error } = await supabase
      .from("pickups")
      .update({
        rider_id: assignRiderId,
        status: "Assigned",
      })
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
      .update({
        quantity: Number(completeQty),
        status: "Completed",
      })
      .eq("id", selectedPickup.id);

    if (error) {
      alert("Error completing pickup: " + error.message);
    } else {
      setIsCompleteModalOpen(false);
      setSelectedPickup(null);
      fetchPickups();
    }
  };

  // 4. Edit Pickup ပြုလုပ်ခြင်း
  const handleUpdatePickup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPickup) return;

    const { error } = await supabase
      .from("pickups")
      .update({
        rider_id: formData.rider_id ? formData.rider_id : null,
        quantity: Number(formData.quantity),
        status: formData.status,
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

  const resetForm = () => {
    setFormData({ sender_id: "", rider_id: "", quantity: 1, status: "Pending" });
  };

  const filteredPickups = pickups.filter((item) => {
    const matchesTab = activeTab === "All" || item.status === activeTab;
    const senderAddress = item.senders?.Address || item.senders?.address || "";
    const matchesSearch =
      item.senders?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      senderAddress.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.riders?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 text-slate-800">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">📦 Pickups စာရင်း</h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Sender အလိုက် ပစ္စည်းသိမ်းယူမှုများကို စီမံခန့်ခွဲပါ
            </p>
          </div>
          <button
            onClick={() => {
              resetForm();
              setIsAddModalOpen(true);
            }}
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 active:scale-95 transition text-white px-5 py-2.5 rounded-xl font-medium shadow-md shadow-blue-500/20"
          >
            <span>➕</span>
            <span>Pickup အသစ်ထည့်မည်</span>
          </button>
        </div>

        {/* Filter Controls & Tabs */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex bg-slate-200/80 p-1 rounded-xl w-full md:w-auto overflow-x-auto">
            {["All", "Pending", "Assigned", "Completed"].map((tab) => {
              const count =
                tab === "All"
                  ? pickups.length
                  : pickups.filter((p) => p.status === tab).length;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition whitespace-nowrap flex-1 md:flex-initial justify-center ${
                    activeTab === tab
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <span>{tab}</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      activeTab === tab
                        ? "bg-slate-100 text-slate-800"
                        : "bg-slate-300 text-slate-700"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-72">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
            <input
              type="text"
              placeholder="Sender, Rider သို့မဟုတ် လိပ်စာ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
            />
          </div>
        </div>

        {/* Cards Grid List */}
        {loading ? (
          <div className="text-center py-12 text-slate-400">Loading pickups...</div>
        ) : filteredPickups.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-100 text-slate-500">
            စာရင်း မရှိသေးပါ။
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPickups.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <StatusBadge status={item.status} />
                    <button
                      onClick={() => {
                        setSelectedPickup(item);
                        setFormData({
                          sender_id: String(item.sender_id),
                          rider_id: item.rider_id ? String(item.rider_id) : "",
                          quantity: item.quantity,
                          status: item.status,
                        });
                        setIsEditModalOpen(true);
                      }}
                      className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition"
                      title="Edit"
                    >
                      ✏️
                    </button>
                  </div>

                  <div className="mt-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-slate-900 text-lg leading-tight">
                        {item.senders?.name || "Unassigned Sender"}
                      </h3>
                      <span className="bg-blue-50 text-blue-700 text-xs font-semibold px-2.5 py-1 rounded-lg flex items-center gap-1 shrink-0">
                        📦 {item.quantity} ခု
                      </span>
                    </div>

                    <div className="flex items-start gap-2 text-slate-600 text-sm">
                      <span className="shrink-0 mt-0.5">📍</span>
                      <p className="line-clamp-2">
                        {item.senders?.Address || item.senders?.address || "လိပ်စာမရှိပါ"}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 text-slate-600 text-sm pt-2">
                      <span>👤</span>
                      <span className="font-medium">
                        Rider:{" "}
                        <span className={item.riders ? "text-slate-800 font-semibold" : "text-amber-600 italic"}>
                          {item.riders?.name || "မသတ်မှတ်ရသေးပါ"}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom Action Buttons */}
                <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                  <button
                    onClick={() => {
                      setSelectedPickup(item);
                      setCompleteQty(item.quantity);
                      setIsCompleteModalOpen(true);
                    }}
                    disabled={item.status === "Completed"}
                    className={`flex-1 py-2 px-3 rounded-xl font-medium text-xs flex items-center justify-center gap-1.5 transition ${
                      item.status === "Completed"
                        ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                        : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 active:scale-95"
                    }`}
                  >
                    <span>✅</span>
                    <span>Completed</span>
                  </button>

                  {item.status === "Pending" ? (
                    <button
                      onClick={() => {
                        setSelectedPickup(item);
                        setAssignRiderId("");
                        setIsAssignModalOpen(true);
                      }}
                      className="flex-1 bg-blue-50 text-blue-700 hover:bg-blue-100 py-2 px-3 rounded-xl font-medium text-xs flex items-center justify-center gap-1.5 active:scale-95 transition"
                    >
                      <span>👉</span>
                      <span>Assign Rider</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setSelectedPickup(item);
                        setAssignRiderId(item.rider_id ? String(item.rider_id) : "");
                        setIsAssignModalOpen(true);
                      }}
                      disabled={item.status === "Completed"}
                      className={`flex-1 py-2 px-3 rounded-xl font-medium text-xs flex items-center justify-center gap-1.5 transition ${
                        item.status === "Completed"
                          ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                          : "bg-purple-50 text-purple-700 hover:bg-purple-100 active:scale-95"
                      }`}
                    >
                      <span>🔄</span>
                      <span>Reassign</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ----------------- MODALS ----------------- */}

      {/* 1. Add Pickup Modal */}
      {isAddModalOpen && (
        <Modal title="Pickup အသစ်ထည့်မည်" onClose={() => setIsAddModalOpen(false)}>
          <form onSubmit={handleAddPickup} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Sender ရွေးချယ်ပါ *
              </label>
              <select
                required
                value={formData.sender_id}
                onChange={(e) => setFormData({ ...formData, sender_id: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Sender ရွေးပါ --</option>
                {senders.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.Address || s.address || ""})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Rider (မထည့်လည်းရသည်)
              </label>
              <select
                value={formData.rider_id}
                onChange={(e) => setFormData({ ...formData, rider_id: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- တန်းမသတ်မှတ်သေးပါ (Pending) --</option>
                {riders.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                အရေအတွက် (Quantity)
              </label>
              <input
                type="number"
                min="1"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-medium text-sm hover:bg-slate-50"
              >
                မလုပ်တော့ပါ
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-medium text-sm hover:bg-blue-700"
              >
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
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAssignModalOpen(false)}
                className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-medium text-sm hover:bg-slate-50"
              >
                မလုပ်တော့ပါ
              </button>
              <button
                type="button"
                onClick={handleAssignRider}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-medium text-sm hover:bg-blue-700"
              >
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
              <label className="block text-sm font-medium text-slate-700 mb-1">
                သိမ်းယူခဲ့သည့် အရေအတွက် (Qty)
              </label>
              <input
                type="number"
                min="1"
                value={completeQty}
                onChange={(e) => setCompleteQty(Number(e.target.value))}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCompleteModalOpen(false)}
                className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-medium text-sm hover:bg-slate-50"
              >
                မလုပ်တော့ပါ
              </button>
              <button
                type="button"
                onClick={handleCompletePickup}
                className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl font-medium text-sm hover:bg-emerald-700"
              >
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
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Sender အမည်</label>
              <input
                type="text"
                disabled
                value={selectedPickup.senders?.name || ""}
                className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-500 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Rider ပြင်ရန်</label>
              <select
                value={formData.rider_id}
                onChange={(e) => setFormData({ ...formData, rider_id: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- တာဝန်မပေးသေးပါ --</option>
                {riders.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status ပြင်ရန်</label>
              <select
                value={formData.status}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    status: e.target.value as "Pending" | "Assigned" | "Completed",
                  })
                }
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

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-medium text-sm hover:bg-slate-50"
              >
                မလုပ်တော့ပါ
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-medium text-sm hover:bg-blue-700"
              >
                ပြင်ဆင်မှု သိမ်းမည်
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ----------------- SUB-COMPONENTS -----------------

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "Pending":
      return (
        <span className="bg-amber-50 text-amber-700 border border-amber-200/60 text-xs font-semibold px-2.5 py-1 rounded-lg">
          Pending
        </span>
      );
    case "Assigned":
      return (
        <span className="bg-blue-50 text-blue-700 border border-blue-200/60 text-xs font-semibold px-2.5 py-1 rounded-lg">
          Assigned
        </span>
      );
    case "Completed":
      return (
        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/60 text-xs font-semibold px-2.5 py-1 rounded-lg">
          Completed
        </span>
      );
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 relative space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}