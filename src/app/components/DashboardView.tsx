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
      className="rounded-lg flex items-center justify-center text-sm"
      style={{ height: 320, background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
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
        <SectionLabel>Today&apos;s readings</SectionLabel>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {digest.lenses.map((reading) => (
            <DialCard key={reading.lens} reading={reading} />
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
        <SectionLabel>Where it&apos;s happening</SectionLabel>
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
