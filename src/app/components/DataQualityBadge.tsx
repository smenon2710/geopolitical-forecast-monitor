import type { DataQuality } from "@/types";
import { DATA_QUALITY_DESCRIPTION, DATA_QUALITY_LABEL } from "@/types";

const DOT_COLOR: Record<DataQuality, string> = {
  live: "var(--dial-good, var(--status-good))",
  stale: "var(--dial-warning, var(--status-warning))",
  demo: "var(--dial-serious, var(--status-serious))",
};

/**
 * A small panel-light indicator rather than a generic status pill — a real
 * instrument shows "running on backup feed" with a pilot light, not a chip.
 * Renders nothing when live; callers should only mount this when relevant.
 */
export function DataQualityBadge({ quality, tone = "paper" }: { quality: DataQuality; tone?: "paper" | "ink" }) {
  const textColor = tone === "ink" ? "var(--dial-paper-muted, var(--text-muted))" : "var(--text-muted)";
  return (
    <span
      title={DATA_QUALITY_DESCRIPTION[quality]}
      className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wide"
      style={{ color: textColor, fontFamily: "var(--font-mono)" }}
    >
      <span
        className="indicator-pulse rounded-full"
        style={{ width: 6, height: 6, background: DOT_COLOR[quality] }}
        aria-hidden="true"
      />
      {DATA_QUALITY_LABEL[quality]}
    </span>
  );
}
