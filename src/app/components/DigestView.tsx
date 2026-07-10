import type { DailyDigest } from "@/types";
import { SEVERITY_LABEL, SEVERITY_STATUS } from "@/types";

const STATUS_COLOR_VAR: Record<string, string> = {
  good: "var(--status-good)",
  warning: "var(--status-warning)",
  serious: "var(--status-serious)",
  critical: "var(--status-critical)",
};

export function DigestView({ digest }: { digest: DailyDigest }) {
  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        This is an impact monitor, not a forecast — it translates today&apos;s data into
        plain language, grounded in the cited sources below each section. It does not
        predict what happens next. Nothing here is financial or investment advice.
      </p>

      {digest.lenses.map((reading) => {
        const status = SEVERITY_STATUS[reading.severity];
        const color = STATUS_COLOR_VAR[status];
        return (
          <section
            key={reading.lens}
            className="rounded-lg p-5"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-center gap-2 mb-2">
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ background: color }}
                aria-hidden
              />
              <span className="text-sm font-semibold" style={{ color }}>
                {SEVERITY_LABEL[reading.severity]}
              </span>
            </div>
            <p className="text-base leading-relaxed" style={{ color: "var(--text-primary)" }}>
              {reading.narrative}
            </p>
            <ul className="mt-3 flex flex-col gap-1">
              {reading.metrics.map((m, i) => (
                <li key={i} className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {m.label}: {m.value} — source: {m.sourceName}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
