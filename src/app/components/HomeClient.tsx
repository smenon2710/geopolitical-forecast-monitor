"use client";

import { useEffect, useState } from "react";
import type { DailyDigest } from "@/types";
import { SUPPORTED_METROS } from "@/types";
import { DigestView } from "./DigestView";
import { DashboardView } from "./DashboardView";

type Mode = "read" | "skim";

const METRO_STORAGE_KEY = "geo-monitor-metro";

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/**
 * Swaps the national Cost of Living reading for the selected metro's, if any
 * — everything else in the digest (the other four lenses, trends, events,
 * map, sectors) stays national, since only Cost of Living has metro-level
 * data behind it. Returns the digest unchanged for "national" or an unknown
 * metro id, so DashboardView/DigestView never need to know this exists.
 */
function applyMetro(digest: DailyDigest, metroId: string): DailyDigest {
  if (metroId === "national") return digest;
  const metro = digest.metroReadings.find((m) => m.metroId === metroId);
  if (!metro) return digest;
  return {
    ...digest,
    lenses: digest.lenses.map((l) =>
      l.lens === "costOfLiving"
        ? { ...l, severity: metro.severity, oneLiner: metro.oneLiner, narrative: metro.narrative, metrics: metro.metrics, dataQuality: metro.dataQuality }
        : l
    ),
  };
}

export function HomeClient({ digest }: { digest: DailyDigest }) {
  const [mode, setMode] = useState<Mode>("skim");
  const [metro, setMetro] = useState<string>("national");

  useEffect(() => {
    const saved = window.localStorage.getItem(METRO_STORAGE_KEY);
    if (saved) setMetro(saved);
  }, []);

  function handleMetroChange(next: string) {
    setMetro(next);
    window.localStorage.setItem(METRO_STORAGE_KEY, next);
  }

  const effectiveDigest = applyMetro(digest, metro);

  return (
    <div className="min-h-full flex flex-col" style={{ background: "var(--page)" }}>
      <div className="flex flex-col gap-8 p-6 max-w-6xl mx-auto w-full">
        <header className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <span
                className="text-xs uppercase tracking-[0.2em]"
                style={{ color: "var(--brass)", fontFamily: "var(--font-mono)" }}
              >
                Daily briefing · {formatDate(digest.date)}
              </span>
              <h1
                className="text-3xl sm:text-4xl italic leading-tight"
                style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)", fontWeight: 600 }}
              >
                Geopolitical Forecast Monitor
              </h1>
            </div>

            <div
              className="inline-flex rounded-full self-start p-1"
              style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
              role="tablist"
              aria-label="View mode"
            >
              {(["skim", "read"] as const).map((m) => (
                <button
                  key={m}
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => setMode(m)}
                  className="px-4 py-1.5 text-sm font-medium rounded-full transition-colors"
                  style={{
                    background: mode === m ? "var(--brass)" : "transparent",
                    color: mode === m ? "var(--ink-deep)" : "var(--text-secondary)",
                  }}
                >
                  {m === "skim" ? "Skim" : "Read"}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label
              htmlFor="metro-select"
              className="text-xs uppercase tracking-wide"
              style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}
            >
              Prices You Pay, for:
            </label>
            <select
              id="metro-select"
              value={metro}
              onChange={(e) => handleMetroChange(e.target.value)}
              className="text-sm rounded-md px-2 py-1"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
                fontFamily: "var(--font-mono)",
              }}
            >
              <option value="national">National average</option>
              {SUPPORTED_METROS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <p className="text-xs leading-relaxed max-w-2xl" style={{ color: "var(--text-muted)" }}>
            Not a crystal ball: today&apos;s real numbers, not a guaranteed prediction of tomorrow.
            Nothing here is financial or investment advice.
          </p>

          {digest.dataQuality !== "live" && (
            <p
              className="text-xs rounded-md px-3 py-2 self-start"
              style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
            >
              {digest.dataQuality === "stale"
                ? "Some sources didn't respond today — showing their last known reading instead of a guess."
                : "Some sources have no reading yet — showing placeholder demo data until the first real pull."}
            </p>
          )}
        </header>

        {mode === "skim" ? <DashboardView digest={effectiveDigest} /> : <DigestView digest={effectiveDigest} />}
      </div>
    </div>
  );
}
