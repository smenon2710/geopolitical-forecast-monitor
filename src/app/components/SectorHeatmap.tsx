"use client";

import type { SectorMove } from "@/types";

/** Diverging blue (down) <-> gray (flat) <-> red (up), per the locked palette's diverging pair. */
function divergingColor(pct: number, maxAbs: number): string {
  const t = maxAbs === 0 ? 0 : Math.min(1, Math.abs(pct) / maxAbs);
  if (Math.abs(pct) < 0.05) return "var(--div-mid)";
  const varName = pct > 0 ? "--div-warm" : "--div-cool";
  // Blend toward the pole by opacity over the neutral midpoint — keeps a
  // single CSS custom property as the source of truth for each pole's hue.
  return `color-mix(in srgb, var(${varName}) ${Math.round(30 + t * 70)}%, var(--div-mid))`;
}

export function SectorHeatmap({ sectors }: { sectors: SectorMove[] }) {
  const maxAbs = Math.max(0.01, ...sectors.map((s) => Math.abs(s.pctChange)));

  return (
    <div
      className="rounded-lg p-4"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div className="text-xs font-medium mb-3" style={{ color: "var(--text-secondary)" }}>
        Sector moves today
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {sectors.map((s) => (
          <div key={s.sector} className="flex flex-col items-center gap-2">
            <div
              className="w-full rounded-md flex items-end justify-center"
              style={{
                height: 56,
                background: divergingColor(s.pctChange, maxAbs),
                border: "1px solid var(--border)",
              }}
            />
            <span className="text-xs text-center" style={{ color: "var(--text-secondary)" }}>
              {s.sector}
            </span>
            <span
              className="text-sm font-semibold"
              style={{ color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}
            >
              {s.pctChange >= 0 ? "+" : ""}
              {s.pctChange.toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
