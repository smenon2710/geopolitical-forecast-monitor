"use client";

import { useState } from "react";
import type { DailyDigest } from "@/types";
import { DigestView } from "./DigestView";
import { DashboardView } from "./DashboardView";

type Mode = "read" | "skim";

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export function HomeClient({ digest }: { digest: DailyDigest }) {
  const [mode, setMode] = useState<Mode>("skim");

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

        {mode === "skim" ? <DashboardView digest={digest} /> : <DigestView digest={digest} />}
      </div>
    </div>
  );
}
