"use client";

import { useState } from "react";
import type { DailyDigest } from "@/types";
import { DigestView } from "./DigestView";
import { DashboardView } from "./DashboardView";

type Mode = "read" | "skim";

export function HomeClient({ digest }: { digest: DailyDigest }) {
  const [mode, setMode] = useState<Mode>("skim");

  return (
    <div className="flex flex-col gap-6 p-6 max-w-6xl mx-auto w-full">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
            Geopolitical Impact Monitor
          </h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {digest.date} · US lens
            {digest.isMockData && (
              <span
                className="ml-2 rounded-full px-2 py-0.5 text-xs"
                style={{ background: "var(--status-warning)", color: "#1a1a19" }}
              >
                One or more sources unavailable — showing mock data for those
              </span>
            )}
          </p>
        </div>
        <div
          className="inline-flex rounded-md self-start"
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
              className="px-4 py-1.5 text-sm font-medium rounded-md transition-colors"
              style={{
                background: mode === m ? "var(--series-1)" : "transparent",
                color: mode === m ? "#ffffff" : "var(--text-secondary)",
              }}
            >
              {m === "skim" ? "Skim" : "Read"}
            </button>
          ))}
        </div>
      </header>

      {mode === "skim" ? <DashboardView digest={digest} /> : <DigestView digest={digest} />}
    </div>
  );
}
