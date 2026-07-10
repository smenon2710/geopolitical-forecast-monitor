import type { DailyDigest } from "@/types";
import { LENS_LABELS, SEVERITY_LABEL, SEVERITY_STATUS } from "@/types";

const STATUS_COLOR_VAR: Record<string, string> = {
  good: "var(--status-good)",
  warning: "var(--status-warning)",
  serious: "var(--status-serious)",
  critical: "var(--status-critical)",
};

export function DigestView({ digest }: { digest: DailyDigest }) {
  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
        This briefing translates today&apos;s real data into plain language — every line
        below traces back to a specific number, cited at the bottom of each section. It&apos;s
        not a crystal ball: it tells you what&apos;s true today, not a guaranteed prediction
        of tomorrow. Nothing here is financial or investment advice.
      </p>

      {digest.lenses.map((reading) => {
        const status = SEVERITY_STATUS[reading.severity];
        const color = STATUS_COLOR_VAR[status];
        return (
          <section
            key={reading.lens}
            className="rounded-2xl p-5"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <h2
                className="text-lg"
                style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)", fontWeight: 600 }}
              >
                {LENS_LABELS[reading.lens]}
              </h2>
              <span
                className="text-xs font-semibold uppercase tracking-wide rounded-full px-2 py-1"
                style={{ background: color, color: "var(--ink-deep)" }}
              >
                {SEVERITY_LABEL[reading.severity]}
              </span>
            </div>
            <p className="text-base leading-relaxed" style={{ color: "var(--text-primary)" }}>
              {reading.narrative}
            </p>
            <ul className="mt-3 flex flex-col gap-1">
              {reading.metrics.map((m, i) => (
                <li key={i} className="text-xs" style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                  {m.label}: {m.value} — {m.sourceName}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
