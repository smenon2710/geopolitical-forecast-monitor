import type { DailyDigest } from "@/types";
import { LENS_LABELS, SEVERITY_LABEL, SEVERITY_STATUS } from "@/types";

const STATUS_COLOR_VAR: Record<string, string> = {
  good: "var(--status-good)",
  warning: "var(--status-warning)",
  serious: "var(--status-serious)",
  critical: "var(--status-critical)",
};

export function DigestView({ digest }: { digest: DailyDigest }) {
  // Split narrative into up to 3 short sentences for readability
  function splitNarrative(narrative: string): string[] {
    const parts = narrative
      .split(/(?<=[.?!])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    return parts.slice(0, 3);
  }

  // Simple, deterministic recommendations based on severity and lens
  function getRecommendation(lens: string, severity: number): string {
    if (severity === 0) return "No action needed today — stay informed as usual.";
    if (severity === 1) return "Keep an eye on the numbers this week; nothing to change yet.";
    if (severity === 2)
      return "Consider short-term precautions or monitoring (e.g., budget a small buffer or check travel plans).";
    return "Take immediate caution and review plans that could be affected (e.g., travel, large purchases, or emergency prep).";
  }

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
        const bullets = splitNarrative(reading.narrative);
        const recommendation = getRecommendation(reading.lens, reading.severity);

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

            <ul className="mt-2 list-disc pl-5">
              {bullets.map((b, i) => (
                <li key={i} className="text-base leading-relaxed" style={{ color: "var(--text-primary)" }}>
                  {b}
                </li>
              ))}
            </ul>

            <div className="mt-4">
              <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                Data & sources
              </h3>
              <ul className="mt-2 flex flex-col gap-1">
                {reading.metrics.map((m, i) => (
                  <li key={i} className="text-xs" style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                    {m.label}: {m.value} — {m.sourceUrl ? (
                      <a href={m.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">
                        {m.sourceName}
                      </a>
                    ) : (
                      m.sourceName
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-3">
              <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                Recommendation
              </h3>
              <p className="text-sm mt-1" style={{ color: "var(--text-primary)" }}>
                {recommendation}
              </p>
            </div>
          </section>
        );
      })}
    </div>
  );
}
