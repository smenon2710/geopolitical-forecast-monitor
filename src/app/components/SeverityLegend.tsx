import type { Severity } from "@/types";
import { SEVERITY_LABEL } from "@/types";

const SEVERITIES: Severity[] = [0, 1, 2, 3];

/** colors keyed by severity, since callers sit on different backgrounds (fixed-dark map vs. theme-adaptive card) and need different color sources. */
export function SeverityLegend({ colors }: { colors: Record<Severity, string> }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1" aria-hidden="true">
      {SEVERITIES.map((s) => (
        <span key={s} className="inline-flex items-center gap-1.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
          <span className="rounded-full" style={{ width: 8, height: 8, background: colors[s] }} />
          {SEVERITY_LABEL[s]}
        </span>
      ))}
    </div>
  );
}
