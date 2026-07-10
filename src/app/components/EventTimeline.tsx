"use client";

import { useState } from "react";
import type { GeoEvent } from "@/types";
import { SEVERITY_STATUS } from "@/types";

const STATUS_COLOR_VAR: Record<string, string> = {
  good: "var(--status-good)",
  warning: "var(--status-warning)",
  serious: "var(--status-serious)",
  critical: "var(--status-critical)",
};

function trailingDays(referenceDate: string, count: number): string[] {
  const ref = new Date(referenceDate + "T00:00:00Z");
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(ref);
    d.setUTCDate(d.getUTCDate() - (count - 1 - i));
    return d.toISOString().slice(0, 10);
  });
}

export function EventTimeline({ events, referenceDate }: { events: GeoEvent[]; referenceDate: string }) {
  const [hovered, setHovered] = useState<GeoEvent | null>(null);
  const days = trailingDays(referenceDate, 7);

  return (
    <div
      className="rounded-2xl p-4 relative"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div
        className="text-xs font-semibold uppercase tracking-wide mb-3"
        style={{ color: "var(--text-secondary)", fontFamily: "var(--font-display)" }}
      >
        The last 7 days
      </div>
      <div className="flex gap-1">
        {days.map((day) => {
          const dayEvents = events.filter((e) => e.date === day);
          return (
            <div key={day} className="flex-1 flex flex-col items-center gap-2 min-w-0">
              <div
                className="w-full flex flex-wrap gap-1 justify-center items-center"
                style={{ minHeight: 24, borderTop: "1px solid var(--baseline)", paddingTop: 6 }}
              >
                {dayEvents.map((e) => (
                  <button
                    key={e.id}
                    onMouseEnter={() => setHovered(e)}
                    onMouseLeave={() => setHovered(null)}
                    onFocus={() => setHovered(e)}
                    onBlur={() => setHovered(null)}
                    aria-label={e.title}
                    className="rounded-full"
                    style={{
                      width: 10,
                      height: 10,
                      background: STATUS_COLOR_VAR[SEVERITY_STATUS[e.severity]],
                    }}
                  />
                ))}
              </div>
              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                {day.slice(5)}
              </span>
            </div>
          );
        })}
      </div>
      {hovered && (
        <div
          className="absolute left-4 right-4 bottom-full mb-2 rounded-md px-3 py-2 text-xs"
          style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
        >
          <div className="font-medium">{hovered.title}</div>
          <div style={{ color: "var(--text-muted)" }}>
            {hovered.date} — {hovered.sourceName}
          </div>
        </div>
      )}
    </div>
  );
}
