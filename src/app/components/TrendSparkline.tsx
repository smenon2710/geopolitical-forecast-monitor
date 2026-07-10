"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import type { TrendSeries } from "@/types";

function SparklineTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
  unit: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-md px-2 py-1 text-xs"
      style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
    >
      <div style={{ color: "var(--text-muted)" }}>{label}</div>
      <div className="font-medium" style={{ fontVariantNumeric: "tabular-nums" }}>
        {payload[0].value.toLocaleString(undefined, { maximumFractionDigits: 2 })} {unit}
      </div>
    </div>
  );
}

export function TrendSparkline({ series }: { series: TrendSeries }) {
  const last = series.points.at(-1);
  const first = series.points[0];
  const changePct = first && last && first.value !== 0 ? ((last.value - first.value) / first.value) * 100 : 0;

  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-1"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-baseline justify-between">
        <span
          className="text-xs font-semibold uppercase tracking-wide"
          style={{ color: "var(--text-secondary)", fontFamily: "var(--font-display)" }}
        >
          {series.label}
        </span>
        <span className="text-xs" style={{ color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
          {changePct >= 0 ? "+" : ""}
          {changePct.toFixed(1)}%
        </span>
      </div>
      <div className="flex items-baseline gap-1">
        <span
          className="text-xl font-semibold"
          style={{ color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}
        >
          {last?.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </span>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          {series.unit}
        </span>
      </div>
      <div style={{ height: 48 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series.points} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
            <YAxis hide domain={["dataMin", "dataMax"]} />
            <Tooltip
              content={(props) => (
                <SparklineTooltip
                  active={props.active}
                  payload={props.payload as unknown as { value: number }[] | undefined}
                  label={props.label as string}
                  unit={series.unit}
                />
              )}
              cursor={{ stroke: "var(--gridline)", strokeWidth: 1 }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="var(--series-1)"
              strokeWidth={2}
              dot={false}
              strokeLinecap="round"
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
