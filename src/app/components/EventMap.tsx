"use client";

import "leaflet/dist/leaflet.css";
import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import type { GeoEvent } from "@/types";
import { SEVERITY_STATUS } from "@/types";

const STATUS_COLOR_VAR: Record<string, string> = {
  good: "#4ba05f",
  warning: "#b07d1f",
  serious: "#c97a45",
  critical: "#c9524a",
};

const US_CENTER: [number, number] = [39.8283, -98.5795];

export function EventMap({ events }: { events: GeoEvent[] }) {
  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ border: "1px solid var(--border)", height: 320 }}
    >
      <MapContainer center={US_CENTER} zoom={3} style={{ height: "100%", width: "100%" }} scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {events.map((e) => (
          <CircleMarker
            key={e.id}
            center={[e.lat, e.lon]}
            radius={8}
            pathOptions={{
              color: STATUS_COLOR_VAR[SEVERITY_STATUS[e.severity]],
              fillColor: STATUS_COLOR_VAR[SEVERITY_STATUS[e.severity]],
              fillOpacity: 0.7,
              weight: 2,
            }}
          >
            <Popup>
              <div style={{ fontSize: 13 }}>
                <strong>{e.title}</strong>
                <div style={{ color: "#666", marginTop: 2 }}>
                  {e.date} — {e.sourceName}
                </div>
                <div style={{ marginTop: 4 }}>{e.description}</div>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
