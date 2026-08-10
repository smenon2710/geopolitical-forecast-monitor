"use client";

import { useEffect, useState } from "react";
import "leaflet/dist/leaflet.css";
import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import type { GeoEvent, Severity } from "@/types";
import { SEVERITY_STATUS } from "@/types";
import { SeverityLegend } from "./SeverityLegend";

const STATUS_COLOR_VAR: Record<string, string> = {
  good: "#4ba05f",
  warning: "#b07d1f",
  serious: "#c97a45",
  critical: "#c9524a",
};

const LEGEND_COLORS: Record<Severity, string> = {
  0: STATUS_COLOR_VAR.good,
  1: STATUS_COLOR_VAR.warning,
  2: STATUS_COLOR_VAR.serious,
  3: STATUS_COLOR_VAR.critical,
};

const US_CENTER: [number, number] = [39.8283, -98.5795];

// CARTO's free basemap tiles — muted grey/paper rather than stock OSM's
// saturated blue/yellow, so the map reads as part of the same dossier
// instead of a bright intrusion. No-key, standard attribution.
const TILE_URL = {
  light: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png",
  dark: "https://{s}.basemaps.cartocdn.com/rastertiles/dark_nolabels/{z}/{x}/{y}{r}.png",
};

function useIsDarkTheme(): boolean {
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    setIsDark(mql.matches);
    const listener = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mql.addEventListener("change", listener);
    return () => mql.removeEventListener("change", listener);
  }, []);
  return isDark;
}

export function EventMap({ events }: { events: GeoEvent[] }) {
  const isDark = useIsDarkTheme();

  return (
    <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div
          className="text-xs font-semibold uppercase tracking-wide"
          style={{ color: "var(--text-secondary)", fontFamily: "var(--font-display)" }}
        >
          Flagged events
        </div>
        <SeverityLegend colors={LEGEND_COLORS} />
      </div>
      <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)", height: 320 }}>
        <MapContainer center={US_CENTER} zoom={3} style={{ height: "100%", width: "100%" }} scrollWheelZoom={false}>
          <TileLayer
            key={isDark ? "dark" : "light"}
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url={isDark ? TILE_URL.dark : TILE_URL.light}
          />
          {events.map((e) => (
            <CircleMarker
              key={e.id}
              center={[e.lat, e.lon]}
              radius={7}
              pathOptions={{
                color: STATUS_COLOR_VAR[SEVERITY_STATUS[e.severity]],
                fillColor: STATUS_COLOR_VAR[SEVERITY_STATUS[e.severity]],
                fillOpacity: 0.75,
                weight: 1.5,
              }}
            >
              <Popup>
                <div style={{ fontSize: 13, fontFamily: "var(--font-sans)" }}>
                  <strong>{e.title}</strong>
                  <div style={{ color: "#78716c", marginTop: 2, fontFamily: "var(--font-mono)", fontSize: 11 }}>
                    {e.date} — {e.sourceName}
                  </div>
                  <div style={{ marginTop: 4 }}>{e.description}</div>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
