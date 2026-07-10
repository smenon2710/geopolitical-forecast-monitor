import type { LensReading } from "@/types";
import { LENS_LABELS, SEVERITY_LABEL, SEVERITY_STATUS } from "@/types";

const STATUS_COLOR_VAR: Record<string, string> = {
  good: "var(--status-good)",
  warning: "var(--status-warning)",
  serious: "var(--status-serious)",
  critical: "var(--status-critical)",
};

/** Distinct icon per status so severity never relies on color alone. */
function StatusIcon({ status }: { status: string }) {
  const color = STATUS_COLOR_VAR[status];
  const common = { width: 20, height: 20, "aria-hidden": true } as const;
  switch (status) {
    case "good":
      return (
        <svg {...common} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
          <circle cx={12} cy={12} r={9} />
          <path d="M8 12.5l2.5 2.5L16 9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "warning":
      return (
        <svg {...common} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2}>
          <path d="M12 3l10 18H2L12 3z" strokeLinejoin="round" />
          <path d="M12 10v4" strokeLinecap="round" />
          <circle cx={12} cy={17.5} r={0.75} fill={color} stroke="none" />
        </svg>
      );
    case "serious":
      return (
        <svg {...common} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4}>
          <path d="M12 3l10 18H2L12 3z" strokeLinejoin="round" />
          <path d="M12 10v4" strokeLinecap="round" />
          <circle cx={12} cy={17.5} r={0.75} fill={color} stroke="none" />
        </svg>
      );
    default:
      return (
        <svg {...common} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4}>
          <path
            d="M8 2h8l6 6v8l-6 6H8l-6-6V8l6-6z"
            strokeLinejoin="round"
          />
          <path d="M12 8v5" strokeLinecap="round" />
          <circle cx={12} cy={16} r={0.9} fill={color} stroke="none" />
        </svg>
      );
  }
}

export function SeverityCard({ reading }: { reading: LensReading }) {
  const status = SEVERITY_STATUS[reading.severity];
  const color = STATUS_COLOR_VAR[status];

  return (
    <div
      className="rounded-lg p-4 flex flex-col gap-2 min-w-0"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderLeft: `3px solid ${color}`,
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
          {LENS_LABELS[reading.lens]}
        </span>
        <StatusIcon status={status} />
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-lg font-semibold" style={{ color }}>
          {SEVERITY_LABEL[reading.severity]}
        </span>
      </div>
      <p className="text-sm leading-snug" style={{ color: "var(--text-primary)" }}>
        {reading.oneLiner}
      </p>
    </div>
  );
}
