"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import L from "leaflet";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

export interface RiderPosition {
  rider_id: string;
  latitude: number;
  longitude: number;
  timestamp: number;
}

export interface SenderLocation {
  id: string | number;
  name: string;
  phone: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
}

interface LiveRiderMapProps {
  riders: RiderPosition[];
  riderNames: Record<string, string>;
  selectedRiderId: string | null;
  selectedRiderPosition: RiderPosition | undefined;
  selectionRequest: number;
  now: number;
  onSelectRider: (riderId: string) => void;
  senders: SenderLocation[];
  selectedSenderId: string | null;
  selectedSenderPosition: [number, number] | null;
  senderSelectionRequest: number;
  draftSenderPosition: [number, number] | null;
  allowLocationPick: boolean;
  onSelectSender: (senderId: string) => void;
  onMapPick: (position: [number, number]) => void;
}

const MYANMAR_CENTER: [number, number] = [21.9162, 95.956];
const LOCATION_FOCUS_ZOOM = 17;
const riderIcon = L.divIcon({
  className: "rider-map-marker",
  html: '<span class="rider-map-marker__dot"></span>',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});
const senderIcon = L.divIcon({
  className: "sender-map-marker",
  html: '<span style="display:block;width:20px;height:20px;border:3px solid white;border-radius:50% 50% 50% 0;background:#f97316;transform:rotate(-45deg);box-shadow:0 1px 5px #33415599"></span>',
  iconSize: [26, 26],
  iconAnchor: [13, 23],
});
const draftLocationIcon = L.divIcon({
  className: "sender-map-marker",
  html: '<span style="display:block;width:20px;height:20px;border:3px solid white;border-radius:50% 50% 50% 0;background:#2563eb;transform:rotate(-45deg);box-shadow:0 1px 5px #33415599"></span>',
  iconSize: [26, 26],
  iconAnchor: [13, 23],
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
        LOCATION_FOCUS_ZOOM,
        {
          duration: 0.8,
        },
      );
    }
  }, [map, selectedRiderId, selectedRiderPosition, selectionRequest]);

  return null;
}

function SenderMapController({
  selectedSenderId,
  selectedSenderPosition,
  senderSelectionRequest,
}: Pick<
  LiveRiderMapProps,
  "selectedSenderId" | "selectedSenderPosition" | "senderSelectionRequest"
>) {
  const map = useMap();
  const lastSelectionRequest = useRef(0);

  useEffect(() => {
    if (
      senderSelectionRequest !== lastSelectionRequest.current &&
      selectedSenderId &&
      selectedSenderPosition
    ) {
      lastSelectionRequest.current = senderSelectionRequest;
      map.flyTo(selectedSenderPosition, LOCATION_FOCUS_ZOOM, {
        duration: 0.8,
      });
    }
  }, [
    map,
    selectedSenderId,
    selectedSenderPosition,
    senderSelectionRequest,
  ]);

  return null;
}

function MapClickHandler({
  allowLocationPick,
  onMapPick,
}: Pick<LiveRiderMapProps, "allowLocationPick" | "onMapPick">) {
  useMapEvents({
    click(event) {
      if (allowLocationPick) {
        onMapPick([event.latlng.lat, event.latlng.lng]);
      }
    },
  });

  return null;
}

function EnsureTilePane() {
  const map = useMap();

  useLayoutEffect(() => {
    if (!map.getPane("tilePane")) {
      map.createPane("tilePane");
    }
  }, [map]);

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
  senders,
  selectedSenderId,
  selectedSenderPosition,
  senderSelectionRequest,
  draftSenderPosition,
  allowLocationPick,
  onSelectSender,
  onMapPick,
}: LiveRiderMapProps) {
  return (
    <MapContainer
      center={MYANMAR_CENTER}
      zoom={6}
      scrollWheelZoom
      className={`h-full min-h-[420px] w-full ${
        allowLocationPick ? "cursor-crosshair" : ""
      }`}
      aria-label="Live rider locations map"
    >
      <EnsureTilePane />
      <TileLayer
        pane="tilePane"
        maxZoom={LOCATION_FOCUS_ZOOM}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapController
        selectedRiderId={selectedRiderId}
        selectedRiderPosition={selectedRiderPosition}
        selectionRequest={selectionRequest}
      />
      <SenderMapController
        selectedSenderId={selectedSenderId}
        selectedSenderPosition={selectedSenderPosition}
        senderSelectionRequest={senderSelectionRequest}
      />
      <MapClickHandler
        allowLocationPick={allowLocationPick}
        onMapPick={onMapPick}
      />
      {senders.map((sender) => {
        if (sender.latitude === null || sender.longitude === null) return null;

        const senderId = String(sender.id);
        return (
          <Marker
            key={`sender-${senderId}`}
            position={[sender.latitude, sender.longitude]}
            icon={senderIcon}
            riseOnHover
            eventHandlers={{
              click: () => onSelectSender(senderId),
            }}
          >
            <Tooltip
              permanent={selectedSenderId === senderId}
              direction="top"
              offset={[0, -18]}
              className="!rounded-md !border-0 !bg-orange-600 !px-2 !py-1 !text-[11px] !font-semibold !text-white !shadow-md"
            >
              {sender.name || `Sender ${senderId}`}
            </Tooltip>
            <Popup>
              <div className="min-w-44 space-y-1 text-slate-800">
                <p className="font-semibold">{sender.name || "Unnamed sender"}</p>
                {sender.phone && (
                  <p className="text-xs text-slate-500">{sender.phone}</p>
                )}
                {sender.address && (
                  <p className="text-xs text-slate-500">{sender.address}</p>
                )}
                <p>
                  {sender.latitude.toFixed(6)}, {sender.longitude.toFixed(6)}
                </p>
              </div>
            </Popup>
          </Marker>
        );
      })}
      {draftSenderPosition && (
        <Marker position={draftSenderPosition} icon={draftLocationIcon}>
          <Popup>Selected sender location</Popup>
        </Marker>
      )}
      {riders.map((rider) => (
        <Marker
          key={rider.rider_id}
          position={[rider.latitude, rider.longitude]}
          icon={riderIcon}
          riseOnHover
          eventHandlers={{
            click: () => onSelectRider(rider.rider_id),
          }}
        >
          <Tooltip
            permanent={selectedRiderId === rider.rider_id}
            direction="top"
            offset={[0, -18]}
            className="!rounded-md !border-0 !bg-slate-800 !px-2 !py-1 !text-[11px] !font-semibold !text-white !shadow-md"
          >
            {riderNames[rider.rider_id] ?? rider.rider_id}
          </Tooltip>
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
