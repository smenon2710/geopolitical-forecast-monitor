"use client";

import dynamic from "next/dynamic";
import type { DailyDigest } from "@/types";
import { DialCard } from "./DialCard";
import { TrendSparkline } from "./TrendSparkline";
import { SectorHeatmap } from "./SectorHeatmap";
import { EventTimeline } from "./EventTimeline";

const EventMap = dynamic(() => import("./EventMap").then((m) => m.EventMap), {
  ssr: false,
  loading: () => (
    <div
      className="rounded-2xl p-4 flex items-center justify-center text-sm"
      style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-muted)", minHeight: 383 }}
    >
      Loading map…
    </div>
  ),
});

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="text-sm uppercase tracking-[0.12em] mb-2"
      style={{ color: "var(--text-muted)", fontFamily: "var(--font-display)" }}
    >
      {children}
    </h2>
  );
}

export function DashboardView({ digest }: { digest: DailyDigest }) {
  return (
    <div className="flex flex-col gap-8">
      <section>
        <div className="flex items-baseline justify-between mb-2">
          <h2
            className="text-lg italic"
            style={{ color: "var(--brass)", fontFamily: "var(--font-display)", fontWeight: 600 }}
          >
            Today&apos;s readings
          </h2>
          <span
            className="text-[10px] uppercase tracking-[0.15em]"
            style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}
          >
            5-lens instrument panel
          </span>
        </div>
        <div className="instrument-panel rounded-2xl overflow-hidden grid grid-cols-2 lg:grid-cols-5 gap-px">
          {digest.lenses.map((reading, i) => (
            <DialCard
              key={reading.lens}
              reading={reading}
              className={i === digest.lenses.length - 1 && digest.lenses.length % 2 === 1 ? "col-span-2 lg:col-span-1" : ""}
            />
          ))}
        </div>
      </section>

      <section>
        <SectionLabel>Trends over time</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {digest.trends.map((series) => (
            <TrendSparkline key={series.id} series={series} />
          ))}
        </div>
      </section>

      <section>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <EventMap events={digest.events} />
          <SectorHeatmap sectors={digest.sectors} />
        </div>
      </section>

      <section>
        <SectionLabel>This week</SectionLabel>
        <EventTimeline events={digest.events} referenceDate={digest.date} />
      </section>
    </div>
  );
}
