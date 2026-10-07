"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useMobileDockVisibility } from "@/components/AppLayout";
import type {
  RiderPosition,
  SenderLocation,
} from "@/components/LiveRiderMap";

const LiveRiderMap = dynamic(() => import("@/components/LiveRiderMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-slate-100 text-sm font-medium text-slate-500">
      Loading map…
    </div>
  ),
});

// Mobile App ၏ Heartbeat မှာ ၁၅ စက္ကန့် ဖြစ်သောကြောင့် အနည်းဆုံး ၆၀ စက္ကန့် (၁ မိနစ်) အတွင်း Update ရရှိပါက Active ဟု သတ်မှတ်မည်
const RIDER_ACTIVE_TIMEOUT_MS = 60_000;

type ConnectionState = "connecting" | "connected" | "disconnected";
type PanelMode = "riders" | "senders";

function toCoordinate(
  value: unknown,
  minimum: number,
  maximum: number,
): number | null {
  if (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "")
  ) {
    return null;
  }
  const coordinate = typeof value === "number" ? value : Number(value);
  return Number.isFinite(coordinate) &&
    coordinate >= minimum &&
    coordinate <= maximum
    ? coordinate
    : null;
}

function normalizeTimestamp(timestamp: number): number {
  return timestamp < 1_000_000_000_000 ? timestamp * 1000 : timestamp;
}

function isRiderPosition(payload: unknown): payload is RiderPosition {
  if (typeof payload !== "object" || payload === null) return false;
  const position = payload as Record<string, unknown>;

  return (
    typeof position.rider_id === "string" &&
    position.rider_id.trim().length > 0 &&
    typeof position.latitude === "number" &&
    Number.isFinite(position.latitude) &&
    position.latitude >= -90 &&
    position.latitude <= 90 &&
    typeof position.longitude === "number" &&
    Number.isFinite(position.longitude) &&
    position.longitude >= -180 &&
    position.longitude <= 180 &&
    typeof position.timestamp === "number" &&
    Number.isFinite(position.timestamp) &&
    position.timestamp > 0
  );
}

function timeAgo(timestamp: number, now: number): string {
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function RiderLiveMapPage() {
  const { setHideMobileDock } = useMobileDockVisibility();
  const [ridersById, setRidersById] = useState<Map<string, RiderPosition>>(
    () => new Map()
  );
  const [riderNames, setRiderNames] = useState<Record<string, string>>({});
  const [now, setNow] = useState(() => Date.now());
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [selectedRiderId, setSelectedRiderId] = useState<string | null>(null);
  const [selectionRequest, setSelectionRequest] = useState(0);
  const [isMinimized, setIsMinimized] = useState(false);
  const [panelMode, setPanelMode] = useState<PanelMode>("senders");
  const [senders, setSenders] = useState<SenderLocation[]>([]);
  const [sendersLoading, setSendersLoading] = useState(true);
  const [sendersError, setSendersError] = useState("");
  const [senderSearch, setSenderSearch] = useState("");
  const [selectedSenderId, setSelectedSenderId] = useState<string | null>(null);
  const [senderSelectionRequest, setSenderSelectionRequest] = useState(0);
  const [latitudeInput, setLatitudeInput] = useState("");
  const [longitudeInput, setLongitudeInput] = useState("");
  const [senderLocationEditing, setSenderLocationEditing] = useState(false);
  const [allowLocationPick, setAllowLocationPick] = useState(false);
  const [savingSenderLocation, setSavingSenderLocation] = useState(false);
  const [senderLocationError, setSenderLocationError] = useState("");
  const [senderLocationSuccess, setSenderLocationSuccess] = useState("");

  useEffect(() => {
    setHideMobileDock(true);
    return () => setHideMobileDock(false);
  }, [setHideMobileDock]);

  useEffect(() => {
    let cancelled = false;

    const fetchSenders = async () => {
      setSendersLoading(true);
      setSendersError("");
      const { data, error } = await supabase
        .from("senders")
        .select('id, name, phone, "Address", latitude, longitude')
        .order("name", { ascending: true });

      if (cancelled) return;
      if (error) {
        console.error("Failed to load sender locations:", error);
        setSendersError(error.message);
        setSendersLoading(false);
        return;
      }

      setSenders(
        (data || []).map((row) => ({
          id: row.id,
          name: row.name ? String(row.name) : "",
          phone: row.phone && row.phone !== "EMPTY" ? String(row.phone) : "",
          address: row.Address ? String(row.Address) : "",
          latitude: toCoordinate(row.latitude, -90, 90),
          longitude: toCoordinate(row.longitude, -180, 180),
        })),
      );
      setSendersLoading(false);
    };

    void fetchSenders();
    return () => {
      cancelled = true;
    };
  }, []);

  // အချိန်အတိအကျ ပုံမှန် Update လုပ်ရန်
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  // ၁။ Page စဖွင့်ဖွင့်ချင်း Database (`riders` table) မှ ရိုင်ဒါများ၏ Last Known Location ကို ဆွဲယူခြင်း
  useEffect(() => {
    let cancelled = false;

    const fetchInitialRiders = async () => {
      try {
        const { data, error } = await supabase
          .from("riders")
          .select("id, name, last_latitude, last_longitude, last_seen_at");

        if (error) {
          console.error("Failed to load initial riders from DB:", error);
          return;
        }

        if (cancelled || !data) return;

        const names: Record<string, string> = {};
        const initialMap = new Map<string, RiderPosition>();

        for (const rider of data) {
          const riderId = String(rider.id);
          if (rider.name?.trim()) {
            names[riderId] = rider.name.trim();
          }

          // Database ထဲတွင် Last Location ရှိပါက Initial Position အဖြစ် ထည့်သွင်းမည်
          if (
            typeof rider.last_latitude === "number" &&
            typeof rider.last_longitude === "number" &&
            rider.last_seen_at
          ) {
            const timestamp = new Date(rider.last_seen_at).getTime();
            if (!isNaN(timestamp)) {
              initialMap.set(riderId, {
                rider_id: riderId,
                latitude: rider.last_latitude,
                longitude: rider.last_longitude,
                timestamp,
              });
            }
          }
        }

        setRiderNames(names);
        setRidersById((current) => {
          // Realtime ရရှိပြီးသား Data ရှိပါက မဖျက်ဘဲ အသစ်ဆုံး တည်နေရာကို ဦးစားပေးမည်
          const merged = new Map(initialMap);
          current.forEach((val, key) => {
            const existing = merged.get(key);
            if (!existing || val.timestamp > existing.timestamp) {
              merged.set(key, val);
            }
          });
          return merged;
        });
      } catch (err) {
        console.error("Error fetching initial riders:", err);
      }
    };

    void fetchInitialRiders();

    return () => {
      cancelled = true;
    };
  }, []);

  // ၂။ Supabase Realtime Broadcast ကို နားထောင်၍ တိုက်ရိုက် တည်နေရာ Update လုပ်ခြင်း
  useEffect(() => {
    const channel = supabase
      .channel("online-riders-stream")
      .on("broadcast", { event: "rider-pos" }, ({ payload }) => {
        if (!isRiderPosition(payload)) return;

        const rider: RiderPosition = {
          rider_id: payload.rider_id.trim(),
          latitude: payload.latitude,
          longitude: payload.longitude,
          timestamp: normalizeTimestamp(payload.timestamp),
        };

        setRidersById((current) => {
          const previous = current.get(rider.rider_id);
          if (previous && previous.timestamp > rider.timestamp) return current;
          const updated = new Map(current);
          updated.set(rider.rider_id, rider);
          return updated;
        });
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setConnection("connected");
        } else if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          setConnection("disconnected");
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const allRiders = useMemo(
    () =>
      Array.from(ridersById.values()).sort((a, b) =>
        a.rider_id.localeCompare(b.rider_id)
      ),
    [ridersById]
  );

  // Active ဖြစ်နေသော (60s အတွင်း Broadcast ရောက်ထားသော) ရိုင်ဒါများ
  const activeRiders = useMemo(
    () =>
      allRiders.filter(
        (rider) => now - rider.timestamp <= RIDER_ACTIVE_TIMEOUT_MS
      ),
    [allRiders, now]
  );

  const activeRiderIds = useMemo(
    () => new Set(activeRiders.map(({ rider_id }) => rider_id)),
    [activeRiders]
  );

  const selectedSender = senders.find(
    (sender) => String(sender.id) === selectedSenderId,
  );
  const selectedSenderPosition: [number, number] | null =
    selectedSender?.latitude !== null &&
    selectedSender?.latitude !== undefined &&
    selectedSender.longitude !== null
      ? [selectedSender.latitude, selectedSender.longitude]
      : null;
  const draftLatitude = toCoordinate(latitudeInput, -90, 90);
  const draftLongitude = toCoordinate(longitudeInput, -180, 180);
  const draftSenderPosition: [number, number] | null =
    senderLocationEditing && draftLatitude !== null && draftLongitude !== null
      ? [draftLatitude, draftLongitude]
      : null;
  const filteredSenders = useMemo(() => {
    const query = senderSearch.trim().toLocaleLowerCase();
    if (!query) return senders;
    return senders.filter((sender) =>
      [sender.name, sender.phone, sender.address, String(sender.id)]
        .join(" ")
        .toLocaleLowerCase()
        .includes(query),
    );
  }, [senderSearch, senders]);
  const sendersWithLocation = senders.filter(
    (sender) => sender.latitude !== null && sender.longitude !== null,
  ).length;

  const selectedRiderPosition = selectedRiderId
    ? ridersById.get(selectedRiderId)
    : undefined;

  const focusRider = (riderId: string) => {
    setSelectedRiderId(riderId);
    setSelectionRequest((request) => request + 1);
  };

  const focusSender = (senderId: string) => {
    const sender = senders.find((item) => String(item.id) === senderId);
    setSelectedSenderId(senderId);
    setLatitudeInput(sender?.latitude?.toString() ?? "");
    setLongitudeInput(sender?.longitude?.toString() ?? "");
    setSenderLocationEditing(false);
    setSenderSelectionRequest((request) => request + 1);
    setAllowLocationPick(false);
    setSenderLocationError("");
    setSenderLocationSuccess("");
  };

  const setDraftPosition = (position: [number, number]) => {
    setLatitudeInput(position[0].toFixed(8));
    setLongitudeInput(position[1].toFixed(8));
    setAllowLocationPick(false);
    setSenderLocationError("");
    setSenderLocationSuccess("");
  };

  const startEditingSenderLocation = () => {
    if (!selectedSender) return;
    setLatitudeInput(selectedSender.latitude?.toString() ?? "");
    setLongitudeInput(selectedSender.longitude?.toString() ?? "");
    setSenderLocationEditing(true);
    setAllowLocationPick(false);
    setSenderLocationError("");
    setSenderLocationSuccess("");
  };

  const cancelEditingSenderLocation = () => {
    setLatitudeInput(selectedSender?.latitude?.toString() ?? "");
    setLongitudeInput(selectedSender?.longitude?.toString() ?? "");
    setSenderLocationEditing(false);
    setAllowLocationPick(false);
    setSenderLocationError("");
    setSenderLocationSuccess("");
  };

  const saveSenderLocation = async () => {
    if (!selectedSender) {
      setSenderLocationError("Choose a sender before saving a location.");
      return;
    }

    if (draftLatitude === null || draftLongitude === null) {
      setSenderLocationError(
        "Enter a valid latitude (-90 to 90) and longitude (-180 to 180).",
      );
      return;
    }

    setSavingSenderLocation(true);
    setSenderLocationError("");
    setSenderLocationSuccess("");

    try {
      const { error } = await supabase
        .from("senders")
        .update({ latitude: draftLatitude, longitude: draftLongitude })
        .eq("id", selectedSender.id)
        .select("id")
        .single();

      if (error) {
        console.error("Failed to save sender location:", error);
        setSenderLocationError(error.message);
        return;
      }

      setSenders((current) =>
        current.map((sender) =>
          String(sender.id) === selectedSenderId
            ? {
                ...sender,
                latitude: draftLatitude,
                longitude: draftLongitude,
              }
            : sender,
        ),
      );
      setSenderLocationEditing(false);
      setAllowLocationPick(false);
      setSenderLocationSuccess("Location saved.");
    } catch (error) {
      console.error("Unexpected error saving sender location:", error);
      setSenderLocationError(
        error instanceof Error
          ? error.message
          : "An unexpected error occurred while saving.",
      );
    } finally {
      setSavingSenderLocation(false);
    }
  };

  return (
    <div className="relative h-screen w-full overflow-hidden bg-slate-100">
      {/* Fullscreen Live Rider Map */}
      <div className="absolute inset-0 z-0 h-full w-full">
        <LiveRiderMap
          riders={allRiders} // Map ပေါ်တွင် Last Known Location ရှိသော ရိုင်ဒါအားလုံးကို ပြသပေးမည်
          riderNames={riderNames}
          selectedRiderId={selectedRiderId}
          selectedRiderPosition={selectedRiderPosition}
          selectionRequest={selectionRequest}
          now={now}
          onSelectRider={focusRider}
          senders={senders}
          selectedSenderId={selectedSenderId}
          selectedSenderPosition={selectedSenderPosition}
          senderSelectionRequest={senderSelectionRequest}
          draftSenderPosition={draftSenderPosition}
          allowLocationPick={allowLocationPick}
          onSelectSender={focusSender}
          onMapPick={setDraftPosition}
        />
      </div>

      {/* Floating Left Panel */}
      <aside
        className={`absolute right-4 top-4 z-10 flex flex-col rounded-2xl border border-slate-200/80 bg-white/90 shadow-xl backdrop-blur-md transition-all duration-300 ${
          isMinimized
            ? "w-12 h-12 overflow-hidden p-1 justify-center items-center"
            : "w-[min(22rem,calc(100vw-2rem))] max-h-[calc(100vh-2rem)]"
        }`}
      >
        {/* Floating Header */}
        <div
          className={`flex items-center justify-between ${
            isMinimized ? "" : "border-b border-slate-100 p-3"
          }`}
        >
          {!isMinimized && (
            <div className="flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  connection === "connected"
                    ? "bg-emerald-500"
                    : connection === "connecting"
                    ? "animate-pulse bg-amber-500"
                    : "bg-rose-500"
                }`}
              />
              <span className="text-xs font-bold text-slate-800">
                {panelMode === "senders"
                  ? `Senders (${sendersWithLocation} / ${senders.length} located)`
                  : `Online (${activeRiders.length} / ${allRiders.length})`}
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsMinimized(!isMinimized)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100/80 transition"
            title={isMinimized ? "Expand Rider List" : "Minimize"}
          >
            {isMinimized ? (
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13 5l7 7-7 7M5 5l7 7-7 7"
                />
              </svg>
            ) : (
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
                />
              </svg>
            )}
          </button>
        </div>

        {/* Floating location and rider panel */}
        {!isMinimized && (
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            <div className="mb-2 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setPanelMode("senders")}
                className={`rounded-lg px-2 py-1.5 text-xs font-semibold ${
                  panelMode === "senders"
                    ? "bg-white text-orange-700 shadow-sm"
                    : "text-slate-500"
                }`}
              >
                Senders
              </button>
              <button
                type="button"
                onClick={() => setPanelMode("riders")}
                className={`rounded-lg px-2 py-1.5 text-xs font-semibold ${
                  panelMode === "riders"
                    ? "bg-white text-orange-700 shadow-sm"
                    : "text-slate-500"
                }`}
              >
                Riders
              </button>
            </div>

            {panelMode === "senders" ? (
              <div className="space-y-2">
                <input
                  type="search"
                  value={senderSearch}
                  onChange={(event) => setSenderSearch(event.target.value)}
                  placeholder="Search sender name, phone, address..."
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                />
                <div className="max-h-48 space-y-1 overflow-y-auto">
                  {sendersLoading ? (
                    <p className="py-4 text-center text-xs text-slate-400">
                      Loading senders...
                    </p>
                  ) : sendersError ? (
                    <p className="rounded-lg bg-rose-50 p-2 text-xs text-rose-700">
                      Could not load senders: {sendersError}
                    </p>
                  ) : filteredSenders.length === 0 ? (
                    <p className="py-4 text-center text-xs text-slate-400">
                      No senders found
                    </p>
                  ) : (
                    filteredSenders.map((sender) => {
                      const senderId = String(sender.id);
                      const isSelected = selectedSenderId === senderId;
                      const hasLocation =
                        sender.latitude !== null && sender.longitude !== null;
                      return (
                        <button
                          key={senderId}
                          type="button"
                          onClick={() => focusSender(senderId)}
                          className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left transition ${
                            isSelected
                              ? "bg-orange-50 ring-1 ring-orange-200"
                              : "hover:bg-slate-100"
                          }`}
                        >
                          <span
                            className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                              hasLocation ? "bg-orange-500" : "bg-slate-300"
                            }`}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-semibold text-slate-800">
                              {sender.name || `Sender ${senderId}`}
                            </span>
                            <span className="block truncate text-[10px] text-slate-400">
                              {sender.phone || sender.address || senderId}
                            </span>
                          </span>
                          <span className="shrink-0 text-[10px] text-slate-400">
                            {hasLocation ? "Located" : "No pin"}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>

                {selectedSender && (
                  <div className="space-y-2 border-t border-slate-100 pt-2">
                    <div>
                      <p className="truncate text-xs font-bold text-slate-800">
                        {selectedSender.name || `Sender ${selectedSenderId}`}
                      </p>
                      {selectedSender.address && (
                        <p className="mt-0.5 line-clamp-2 text-[10px] text-slate-500">
                          {selectedSender.address}
                        </p>
                      )}
                    </div>
                    {!senderLocationEditing ? (
                      <>
                        <button
                          type="button"
                          onClick={startEditingSenderLocation}
                          className="w-full rounded-lg bg-orange-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-orange-700"
                        >
                          {selectedSender.latitude !== null &&
                          selectedSender.longitude !== null
                            ? "Edit location"
                            : "Add location"}
                        </button>
                        {senderLocationSuccess && (
                          <p className="rounded-lg bg-emerald-50 p-2 text-[11px] text-emerald-700">
                            {senderLocationSuccess}
                          </p>
                        )}
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setAllowLocationPick(true);
                            setSenderLocationError("");
                            setSenderLocationSuccess("");
                          }}
                          className={`w-full rounded-lg px-3 py-2 text-xs font-semibold transition ${
                            allowLocationPick
                              ? "bg-blue-100 text-blue-800"
                              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                          }`}
                        >
                          {allowLocationPick
                            ? "Click the map to place the pin"
                            : "Choose location on map"}
                        </button>
                        <div className="grid grid-cols-2 gap-2">
                          <label className="text-[10px] font-medium text-slate-500">
                            Latitude
                            <input
                              type="number"
                              step="any"
                              min="-90"
                              max="90"
                              value={latitudeInput}
                              onChange={(event) => {
                                setLatitudeInput(event.target.value);
                                setSenderLocationError("");
                                setSenderLocationSuccess("");
                              }}
                              placeholder="-90 to 90"
                              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-800 outline-none focus:border-orange-400"
                            />
                          </label>
                          <label className="text-[10px] font-medium text-slate-500">
                            Longitude
                            <input
                              type="number"
                              step="any"
                              min="-180"
                              max="180"
                              value={longitudeInput}
                              onChange={(event) => {
                                setLongitudeInput(event.target.value);
                                setSenderLocationError("");
                                setSenderLocationSuccess("");
                              }}
                              placeholder="-180 to 180"
                              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-800 outline-none focus:border-orange-400"
                            />
                          </label>
                        </div>
                        {senderLocationError && (
                          <p className="rounded-lg bg-rose-50 p-2 text-[11px] text-rose-700">
                            {senderLocationError}
                          </p>
                        )}
                        {senderLocationSuccess && (
                          <p className="rounded-lg bg-emerald-50 p-2 text-[11px] text-emerald-700">
                            {senderLocationSuccess}
                          </p>
                        )}
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={cancelEditingSenderLocation}
                            disabled={savingSenderLocation}
                            className="w-full rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-200 disabled:opacity-60"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => void saveSenderLocation()}
                            disabled={savingSenderLocation}
                            className="w-full rounded-lg bg-orange-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {savingSenderLocation ? "Saving..." : "Save location"}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            ) : allRiders.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                No riders found
              </div>
            ) : (
              <ul className="space-y-1">
                {allRiders.map((rider) => {
                  const isActive = activeRiderIds.has(rider.rider_id);
                  const isSelected = selectedRiderId === rider.rider_id;

                  return (
                    <li key={rider.rider_id}>
                      <button
                        type="button"
                        onClick={() => focusRider(rider.rider_id)}
                        className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition ${
                          isSelected
                            ? "bg-orange-50 ring-1 ring-orange-200"
                            : "hover:bg-slate-100/80"
                        }`}
                      >
                        <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100">
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.7"
                            className="h-4 w-4 text-slate-500"
                          >
                            <circle cx="12" cy="8" r="3" />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M5.5 20a6.5 6.5 0 0 1 13 0"
                            />
                          </svg>
                          <span
                            className={`absolute bottom-0 right-0 h-2 w-2 rounded-full border border-white ${
                              isActive ? "bg-emerald-500" : "bg-slate-300"
                            }`}
                          />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-semibold text-slate-800">
                            {riderNames[rider.rider_id] ?? rider.rider_id}
                          </span>
                          <span className="block truncate text-[10px] text-slate-400">
                            {isActive
                              ? `Active • ${timeAgo(rider.timestamp, now)}`
                              : `Last seen ${timeAgo(rider.timestamp, now)}`}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}