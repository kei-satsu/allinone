"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

export interface RiderPosition {
  rider_id: string;
  latitude: number;
  longitude: number;
  timestamp: number;
}

interface LiveRiderMapProps {
  riders: RiderPosition[];
  riderNames: Record<string, string>;
  selectedRiderId: string | null;
  selectedRiderPosition: RiderPosition | undefined;
  selectionRequest: number;
  now: number;
  onSelectRider: (riderId: string) => void;
}

const MYANMAR_CENTER: [number, number] = [21.9162, 95.956];
const riderIcon = L.divIcon({
  className: "rider-map-marker",
  html: '<span class="rider-map-marker__dot"></span>',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

function relativeUpdatedTime(timestamp: number, now: number): string {
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (seconds < 60) return `Updated ${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Updated ${minutes}m ago`;
  return `Updated ${Math.floor(minutes / 60)}h ago`;
}

function MapController({
  selectedRiderId,
  selectedRiderPosition,
  selectionRequest,
}: Pick<
  LiveRiderMapProps,
  "selectedRiderId" | "selectedRiderPosition" | "selectionRequest"
>) {
  const map = useMap();
  const lastSelectionRequest = useRef(0);

  useEffect(() => {
    if (
      selectionRequest !== lastSelectionRequest.current &&
      selectedRiderId &&
      selectedRiderPosition
    ) {
      lastSelectionRequest.current = selectionRequest;
      map.flyTo(
        [selectedRiderPosition.latitude, selectedRiderPosition.longitude],
        Math.max(map.getZoom(), 14),
        {
          duration: 0.8,
        },
      );
    }
  }, [map, selectedRiderId, selectedRiderPosition, selectionRequest]);

  return null;
}

export default function LiveRiderMap({
  riders,
  riderNames,
  selectedRiderId,
  selectedRiderPosition,
  selectionRequest,
  now,
  onSelectRider,
}: LiveRiderMapProps) {
  return (
    <MapContainer
      center={MYANMAR_CENTER}
      zoom={6}
      scrollWheelZoom
      className="h-full min-h-[420px] w-full"
      aria-label="Live rider locations map"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapController
        selectedRiderId={selectedRiderId}
        selectedRiderPosition={selectedRiderPosition}
        selectionRequest={selectionRequest}
      />
      {riders.map((rider) => (
        <Marker
          key={rider.rider_id}
          position={[rider.latitude, rider.longitude]}
          icon={riderIcon}
          eventHandlers={{
            click: () => onSelectRider(rider.rider_id),
          }}
        >
          <Popup>
            <div className="min-w-44 space-y-1 text-slate-800">
              <p className="font-semibold">
                {riderNames[rider.rider_id] ?? "Unknown rider"}
              </p>
              <p className="text-xs text-slate-500">
                Rider ID: {rider.rider_id}
              </p>
              <p>
                {rider.latitude.toFixed(5)}, {rider.longitude.toFixed(5)}
              </p>
              <p className="text-slate-500">
                {relativeUpdatedTime(rider.timestamp, now)}
              </p>
              <p className="text-xs text-slate-400">
                {new Date(rider.timestamp).toLocaleTimeString()}
              </p>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
