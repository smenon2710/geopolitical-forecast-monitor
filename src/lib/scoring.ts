import type { Severity } from "@/types";

/**
 * Pure scoring functions implementing the rubric locked in PLAN.md.
 * Each returns a 0-3 severity (negligible/minor/moderate/major). Thresholds
 * are the ones agreed in the "Scoring Rubric (locked)" section — change them
 * there first, then mirror here.
 */

export function scoreCostOfLiving(input: {
  cpiMoMPct: number;
  gasPctChange: number;
  hasCategorySpecificPolicyEvent?: boolean;
  hasEnergySupplyShock?: boolean;
}): Severity {
  const { cpiMoMPct, gasPctChange, hasCategorySpecificPolicyEvent, hasEnergySupplyShock } = input;
  const absCpi = Math.abs(cpiMoMPct);
  const absGas = Math.abs(gasPctChange);

  if (hasEnergySupplyShock || absCpi > 0.5 || absGas > 10) return 3;
  if (hasCategorySpecificPolicyEvent || (absCpi > 0.3 && absCpi <= 0.5) || (absGas > 5 && absGas <= 10)) return 2;
  if ((absCpi > 0.1 && absCpi <= 0.3) || (absGas >= 2 && absGas <= 5)) return 1;
  return 0;
}

export function scoreInvestments(input: {
  indexPctChange: number;
  vix: number;
  maxSectorEtfPctChange?: number;
}): Severity {
  const { indexPctChange, vix, maxSectorEtfPctChange = 0 } = input;
  const absIndex = Math.abs(indexPctChange);
  const absSector = Math.abs(maxSectorEtfPctChange);

  if (absIndex > 3 || vix > 25) return 3;
  if (absIndex > 1.5 || vix > 20 || absSector > 3) return 2;
  if (absIndex >= 0.5 || vix >= 15) return 1;
  return 0;
}

export function scoreStandardOfLiving(input: {
  unemploymentDeltaPts: number;
  realWageNegativeMonths: number;
  gdpContraction?: boolean;
  majorDisasterDeclared?: boolean;
}): Severity {
  const { unemploymentDeltaPts, realWageNegativeMonths, gdpContraction, majorDisasterDeclared } = input;
  const absDelta = Math.abs(unemploymentDeltaPts);

  if (absDelta > 0.4 || gdpContraction || majorDisasterDeclared) return 3;
  if ((absDelta > 0.2 && absDelta <= 0.4) || realWageNegativeMonths >= 2) return 2;
  if (absDelta > 0.1 && absDelta <= 0.2) return 1;
  return 0;
}

export function scoreSecurity(input: {
  goldstein: number;
  eventVolumeTrendRising: boolean;
  usRelevance: "none" | "low" | "medium" | "high" | "direct";
  nearbyQuakeMagnitude?: number;
}): Severity {
  const { goldstein, eventVolumeTrendRising, usRelevance, nearbyQuakeMagnitude = 0 } = input;

  if (goldstein < -8 && eventVolumeTrendRising) return 3;
  if (usRelevance === "direct") return 3;
  if (eventVolumeTrendRising && goldstein < -5 && (usRelevance === "medium" || usRelevance === "high")) return 2;
  if (goldstein < -2 && goldstein >= -5 && (usRelevance === "low" || usRelevance === "medium")) return 1;
  if (nearbyQuakeMagnitude >= 5) return Math.min(3, Math.max(1, Math.round(nearbyQuakeMagnitude - 4))) as Severity;
  return 0;
}

export function scoreDailyRoutine(input: {
  gasPctChange: number;
  travelAdvisoryUpgraded?: boolean;
  regionalSupplyDisruption?: boolean;
  nationwideFuelShortage?: boolean;
  advisoryAgainstMajorHub?: boolean;
  severeWeatherAlert?: "none" | "isolated" | "widespread";
}): Severity {
  const {
    gasPctChange,
    travelAdvisoryUpgraded,
    regionalSupplyDisruption,
    nationwideFuelShortage,
    advisoryAgainstMajorHub,
    severeWeatherAlert = "none",
  } = input;

  if (nationwideFuelShortage || advisoryAgainstMajorHub) return 3;
  if (travelAdvisoryUpgraded || regionalSupplyDisruption || severeWeatherAlert === "widespread") return 2;
  if (Math.abs(gasPctChange) >= 2 || severeWeatherAlert === "isolated") return 1;
  return 0;
}
