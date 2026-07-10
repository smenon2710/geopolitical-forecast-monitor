import type { Severity } from "@/types";

const CX = 100;
const CY = 104;
const R = 78;
const ARC_STROKE = 15;
const NEEDLE_LEN = 62;

const ZONE_COLORS = ["var(--dial-good)", "var(--dial-warning)", "var(--dial-serious)", "var(--dial-critical)"];
// Zones run left-to-right across the arc; each spans 45° of the 180° sweep.
const ZONE_BOUNDS = [180, 135, 90, 45, 0];
const NEEDLE_ANGLES: Record<Severity, number> = { 0: 157.5, 1: 112.5, 2: 67.5, 3: 22.5 };

function point(angleDeg: number, radius: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: CX + radius * Math.cos(rad), y: CY - radius * Math.sin(rad) };
}

function arcPath(startAngle: number, endAngle: number, radius: number) {
  const start = point(startAngle, radius);
  const end = point(endAngle, radius);
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 0 1 ${end.x} ${end.y}`;
}

export function Dial({ severity, size = 200 }: { severity: Severity; size?: number }) {
  const needleAngle = NEEDLE_ANGLES[severity];
  const needleTip = point(needleAngle, NEEDLE_LEN);

  return (
    <svg
      viewBox="0 0 200 120"
      width={size}
      height={size * 0.6}
      className="dial-face"
      aria-hidden="true"
    >
      <rect x="0" y="0" width="200" height="120" rx="10" fill="var(--dial-ink)" />

      {ZONE_COLORS.map((color, i) => (
        <path
          key={i}
          d={arcPath(ZONE_BOUNDS[i], ZONE_BOUNDS[i + 1], R)}
          fill="none"
          stroke={color}
          strokeWidth={ARC_STROKE}
          strokeLinecap="butt"
        />
      ))}

      {ZONE_BOUNDS.map((angle, i) => {
        const inner = point(angle, R - ARC_STROKE / 2 - 3);
        const outer = point(angle, R + ARC_STROKE / 2 + 3);
        return (
          <line
            key={i}
            x1={inner.x}
            y1={inner.y}
            x2={outer.x}
            y2={outer.y}
            stroke="var(--dial-ink)"
            strokeWidth={2}
          />
        );
      })}

      <line
        x1={CX}
        y1={CY}
        x2={needleTip.x}
        y2={needleTip.y}
        stroke="var(--dial-paper)"
        strokeWidth={3}
        strokeLinecap="round"
        className="dial-needle"
        style={{ transformOrigin: `${CX}px ${CY}px` }}
      />
      <circle cx={CX} cy={CY} r={6} fill="var(--dial-brass)" />
    </svg>
  );
}
