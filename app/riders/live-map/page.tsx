"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useMobileDockVisibility } from "@/components/AppLayout";
import type { RiderPosition } from "@/components/LiveRiderMap";

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

  useEffect(() => {
    setHideMobileDock(true);
    return () => setHideMobileDock(false);
  }, [setHideMobileDock]);

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

  const selectedRiderPosition = selectedRiderId
    ? ridersById.get(selectedRiderId)
    : undefined;

  const focusRider = (riderId: string) => {
    setSelectedRiderId(riderId);
    setSelectionRequest((request) => request + 1);
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
        />
      </div>

      {/* Floating Left Panel */}
      <aside
        className={`absolute right-4 top-4 z-10 flex flex-col rounded-2xl border border-slate-200/80 bg-white/90 shadow-xl backdrop-blur-md transition-all duration-300 ${
          isMinimized
            ? "w-12 h-12 overflow-hidden p-1 justify-center items-center"
            : "w-72 max-h-[calc(100vh-2rem)]"
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
                Online ({activeRiders.length} / {allRiders.length})
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

        {/* Floating Rider List Body */}
        {!isMinimized && (
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {allRiders.length === 0 ? (
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