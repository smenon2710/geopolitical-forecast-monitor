import type { LensReading } from "@/types";
import { LENS_LABELS, LENS_SUBLABELS, SEVERITY_LABEL, SEVERITY_STATUS } from "@/types";
import { Dial } from "./Dial";

const STATUS_COLOR_VAR: Record<string, string> = {
  good: "var(--status-good)",
  warning: "var(--status-warning)",
  serious: "var(--status-serious)",
  critical: "var(--status-critical)",
};

export function DialCard({ reading }: { reading: LensReading }) {
  const status = SEVERITY_STATUS[reading.severity];
  const color = STATUS_COLOR_VAR[status];

  return (
    <div
      className="rounded-2xl p-4 flex flex-col items-center gap-1 min-w-0"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <Dial severity={reading.severity} size={168} />
      <span
        className="text-lg font-semibold tracking-wide -mt-2"
        style={{ color, fontFamily: "var(--font-display)" }}
      >
        {SEVERITY_LABEL[reading.severity]}
      </span>
      <span
        className="text-base font-semibold text-center"
        style={{ color: "var(--text-primary)", fontFamily: "var(--font-display)" }}
      >
        {LENS_LABELS[reading.lens]}
      </span>
      <span className="text-xs text-center mb-1" style={{ color: "var(--text-muted)" }}>
        {LENS_SUBLABELS[reading.lens]}
      </span>
      <p className="text-sm leading-snug text-center" style={{ color: "var(--text-secondary)" }}>
        {reading.oneLiner}
      </p>
    </div>
  );
}
