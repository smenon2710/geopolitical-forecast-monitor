import type { LensReading } from "@/types";
import { LENS_LABELS, LENS_SUBLABELS, SEVERITY_LABEL, SEVERITY_STATUS } from "@/types";
import { Dial } from "./Dial";
import { DataQualityBadge } from "./DataQualityBadge";

const STATUS_DIAL_VAR: Record<string, string> = {
  good: "var(--dial-good)",
  warning: "var(--dial-warning)",
  serious: "var(--dial-serious)",
  critical: "var(--dial-critical)",
};

export function DialCard({ reading, className = "" }: { reading: LensReading; className?: string }) {
  const status = SEVERITY_STATUS[reading.severity];
  const color = STATUS_DIAL_VAR[status];

  return (
    <div className={`p-4 flex flex-col items-center gap-1 min-w-0 ${className}`}>
      <Dial severity={reading.severity} size={168} />
      <span
        className="text-lg font-semibold tracking-wide -mt-2"
        style={{ color, fontFamily: "var(--font-display)" }}
      >
        {SEVERITY_LABEL[reading.severity]}
      </span>
      <span
        className="text-base font-semibold text-center"
        style={{ color: "var(--dial-paper)", fontFamily: "var(--font-display)" }}
      >
        {LENS_LABELS[reading.lens]}
      </span>
      <span className="text-xs text-center mb-1" style={{ color: "var(--dial-paper-muted)" }}>
        {LENS_SUBLABELS[reading.lens]}
      </span>
      <p className="text-sm leading-snug text-center" style={{ color: "var(--dial-paper-muted)" }}>
        {reading.oneLiner}
      </p>
      {reading.dataQuality !== "live" && (
        <div className="mt-1">
          <DataQualityBadge quality={reading.dataQuality} tone="ink" />
        </div>
      )}
    </div>
  );
}
