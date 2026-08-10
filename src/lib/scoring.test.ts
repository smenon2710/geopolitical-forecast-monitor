import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  scoreCostOfLiving,
  scoreInvestments,
  scoreStandardOfLiving,
  scoreSecurity,
  scoreDailyRoutine,
} from "./scoring";

// Boundary convention used throughout scoring.ts: a threshold value that
// appears in two adjacent bands (e.g. rubric text "0.1–0.3%" then "0.3–0.5%")
// belongs to the LOWER band in code (`x <= 0.3` closes the minor band, the
// moderate band starts at `x > 0.3`). These tests lock in that convention
// exactly as implemented, not just the rubric prose.

describe("scoreCostOfLiving", () => {
  test("negligible: within the ±0.1% / <2% band", () => {
    assert.equal(scoreCostOfLiving({ cpiMoMPct: 0.1, gasPctChange: 1.9 }), 0);
    assert.equal(scoreCostOfLiving({ cpiMoMPct: -0.1, gasPctChange: 0 }), 0);
  });

  test("minor: CPI just above 0.1% up to and including 0.3%", () => {
    assert.equal(scoreCostOfLiving({ cpiMoMPct: 0.11, gasPctChange: 0 }), 1);
    assert.equal(scoreCostOfLiving({ cpiMoMPct: 0.3, gasPctChange: 0 }), 1);
  });

  test("minor: gas 2%–5% inclusive", () => {
    assert.equal(scoreCostOfLiving({ cpiMoMPct: 0, gasPctChange: 2 }), 1);
    assert.equal(scoreCostOfLiving({ cpiMoMPct: 0, gasPctChange: 5 }), 1);
    assert.equal(scoreCostOfLiving({ cpiMoMPct: 0, gasPctChange: -5 }), 1); // abs()
  });

  test("moderate: CPI just above 0.3% up to and including 0.5%", () => {
    assert.equal(scoreCostOfLiving({ cpiMoMPct: 0.31, gasPctChange: 0 }), 2);
    assert.equal(scoreCostOfLiving({ cpiMoMPct: 0.5, gasPctChange: 0 }), 2);
  });

  test("moderate: gas just above 5% up to and including 10%", () => {
    assert.equal(scoreCostOfLiving({ cpiMoMPct: 0, gasPctChange: 5.1 }), 2);
    assert.equal(scoreCostOfLiving({ cpiMoMPct: 0, gasPctChange: 10 }), 2);
  });

  test("moderate: a category-specific policy event forces moderate regardless of magnitude", () => {
    assert.equal(
      scoreCostOfLiving({ cpiMoMPct: 0, gasPctChange: 0, hasCategorySpecificPolicyEvent: true }),
      2
    );
  });

  test("major: CPI beyond 0.5% or gas beyond 10%", () => {
    assert.equal(scoreCostOfLiving({ cpiMoMPct: 0.51, gasPctChange: 0 }), 3);
    assert.equal(scoreCostOfLiving({ cpiMoMPct: 0, gasPctChange: 10.1 }), 3);
  });

  test("major: an energy supply shock forces major regardless of magnitude", () => {
    assert.equal(
      scoreCostOfLiving({ cpiMoMPct: 0, gasPctChange: 0, hasEnergySupplyShock: true }),
      3
    );
  });
});

describe("scoreInvestments", () => {
  test("negligible: index <0.5%, VIX <15", () => {
    assert.equal(scoreInvestments({ indexPctChange: 0.4, vix: 14.9 }), 0);
  });

  test("minor: index 0.5%–1.5% inclusive, VIX 15–20 inclusive", () => {
    assert.equal(scoreInvestments({ indexPctChange: 0.5, vix: 0 }), 1);
    assert.equal(scoreInvestments({ indexPctChange: 1.5, vix: 0 }), 1); // lower-band convention
    assert.equal(scoreInvestments({ indexPctChange: 0, vix: 15 }), 1);
    assert.equal(scoreInvestments({ indexPctChange: 0, vix: 20 }), 1); // lower-band convention
  });

  test("moderate: index beyond 1.5% up to and including 3%, or VIX beyond 20 up to 25", () => {
    assert.equal(scoreInvestments({ indexPctChange: 1.51, vix: 0 }), 2);
    assert.equal(scoreInvestments({ indexPctChange: 3, vix: 0 }), 2);
    assert.equal(scoreInvestments({ indexPctChange: 0, vix: 25 }), 2);
  });

  test("moderate: a single sector ETF move beyond 3% forces moderate", () => {
    assert.equal(
      scoreInvestments({ indexPctChange: 0, vix: 0, maxSectorEtfPctChange: 3.1 }),
      2
    );
  });

  test("major: index beyond 3% or VIX beyond 25", () => {
    assert.equal(scoreInvestments({ indexPctChange: 3.1, vix: 0 }), 3);
    assert.equal(scoreInvestments({ indexPctChange: 0, vix: 25.1 }), 3);
  });

  test("10yr Treasury yield move escalates severity like the other inputs", () => {
    assert.equal(scoreInvestments({ indexPctChange: 0, vix: 0, yieldChangePts: 0.05 }), 0);
    assert.equal(scoreInvestments({ indexPctChange: 0, vix: 0, yieldChangePts: 0.06 }), 1);
    assert.equal(scoreInvestments({ indexPctChange: 0, vix: 0, yieldChangePts: 0.11 }), 2);
    assert.equal(scoreInvestments({ indexPctChange: 0, vix: 0, yieldChangePts: 0.21 }), 3);
    // Direction doesn't matter, only magnitude.
    assert.equal(scoreInvestments({ indexPctChange: 0, vix: 0, yieldChangePts: -0.21 }), 3);
  });
});

describe("scoreStandardOfLiving", () => {
  test("negligible: no unemployment change, no negative real wage streak", () => {
    assert.equal(
      scoreStandardOfLiving({ unemploymentDeltaPts: 0, realWageNegativeMonths: 0 }),
      0
    );
  });

  test("minor: unemployment delta just above 0.1pt up to and including 0.2pt", () => {
    assert.equal(
      scoreStandardOfLiving({ unemploymentDeltaPts: 0.11, realWageNegativeMonths: 0 }),
      1
    );
    assert.equal(
      scoreStandardOfLiving({ unemploymentDeltaPts: 0.2, realWageNegativeMonths: 0 }),
      1
    );
  });

  test("moderate: unemployment delta just above 0.2pt up to and including 0.4pt", () => {
    assert.equal(
      scoreStandardOfLiving({ unemploymentDeltaPts: 0.21, realWageNegativeMonths: 0 }),
      2
    );
    assert.equal(
      scoreStandardOfLiving({ unemploymentDeltaPts: 0.4, realWageNegativeMonths: 0 }),
      2
    );
  });

  test("moderate: 2+ consecutive months of negative real wages forces moderate", () => {
    assert.equal(
      scoreStandardOfLiving({ unemploymentDeltaPts: 0, realWageNegativeMonths: 2 }),
      2
    );
    // 1 month alone isn't enough
    assert.equal(
      scoreStandardOfLiving({ unemploymentDeltaPts: 0, realWageNegativeMonths: 1 }),
      0
    );
  });

  test("major: unemployment delta beyond 0.4pt", () => {
    assert.equal(
      scoreStandardOfLiving({ unemploymentDeltaPts: 0.41, realWageNegativeMonths: 0 }),
      3
    );
  });

  test("major: GDP contraction or a major disaster forces major regardless of other inputs", () => {
    assert.equal(
      scoreStandardOfLiving({ unemploymentDeltaPts: 0, realWageNegativeMonths: 0, gdpContraction: true }),
      3
    );
    assert.equal(
      scoreStandardOfLiving({
        unemploymentDeltaPts: 0,
        realWageNegativeMonths: 0,
        majorDisasterDeclared: true,
      }),
      3
    );
  });
});

describe("scoreSecurity", () => {
  test("negligible: calm Goldstein, no relevance, no quake", () => {
    assert.equal(
      scoreSecurity({ goldstein: 0, eventVolumeTrendRising: false, usRelevance: "none" }),
      0
    );
  });

  test("minor: Goldstein strictly between -2 and -5 with low/medium relevance", () => {
    assert.equal(
      scoreSecurity({ goldstein: -2.1, eventVolumeTrendRising: false, usRelevance: "low" }),
      1
    );
    assert.equal(
      scoreSecurity({ goldstein: -5, eventVolumeTrendRising: false, usRelevance: "medium" }),
      1 // -5 exactly is still in the minor band (>= -5), not moderate
    );
  });

  test("exactly -2 Goldstein does not cross into the minor band", () => {
    assert.equal(
      scoreSecurity({ goldstein: -2, eventVolumeTrendRising: false, usRelevance: "low" }),
      0
    );
  });

  test("moderate: rising event volume, Goldstein beyond -5, medium/high relevance", () => {
    assert.equal(
      scoreSecurity({ goldstein: -5.1, eventVolumeTrendRising: true, usRelevance: "medium" }),
      2
    );
    assert.equal(
      scoreSecurity({ goldstein: -8, eventVolumeTrendRising: true, usRelevance: "high" }),
      2 // -8 exactly stays moderate; major requires strictly < -8
    );
  });

  test("moderate is not reached without rising event volume", () => {
    assert.equal(
      scoreSecurity({ goldstein: -6, eventVolumeTrendRising: false, usRelevance: "medium" }),
      0
    );
  });

  test("major: Goldstein beyond -8 with rising volume", () => {
    assert.equal(
      scoreSecurity({ goldstein: -8.1, eventVolumeTrendRising: true, usRelevance: "none" }),
      3
    );
  });

  test("major: direct US relevance always wins, regardless of Goldstein", () => {
    assert.equal(
      scoreSecurity({ goldstein: 0, eventVolumeTrendRising: false, usRelevance: "direct" }),
      3
    );
  });

  test("earthquake fallback only applies when no Goldstein/relevance path already scored", () => {
    // Calm Goldstein/no relevance, but a real quake nearby.
    assert.equal(
      scoreSecurity({
        goldstein: 0,
        eventVolumeTrendRising: false,
        usRelevance: "none",
        nearbyQuakeMagnitude: 5,
      }),
      1
    );
    assert.equal(
      scoreSecurity({
        goldstein: 0,
        eventVolumeTrendRising: false,
        usRelevance: "none",
        nearbyQuakeMagnitude: 7,
      }),
      3
    );
    // Formula clamps at 3 even for extreme magnitudes.
    assert.equal(
      scoreSecurity({
        goldstein: 0,
        eventVolumeTrendRising: false,
        usRelevance: "none",
        nearbyQuakeMagnitude: 9,
      }),
      3
    );
    // Below the M5 threshold, no quake-driven severity.
    assert.equal(
      scoreSecurity({
        goldstein: 0,
        eventVolumeTrendRising: false,
        usRelevance: "none",
        nearbyQuakeMagnitude: 4.9,
      }),
      0
    );
  });
});

describe("scoreDailyRoutine", () => {
  test("negligible: no advisories, small gas move, no weather", () => {
    assert.equal(scoreDailyRoutine({ gasPctChange: 1.9 }), 0);
  });

  test("minor: gas move beyond 2%, or an isolated weather alert", () => {
    assert.equal(scoreDailyRoutine({ gasPctChange: 2 }), 1);
    assert.equal(scoreDailyRoutine({ gasPctChange: -2 }), 1); // abs()
    assert.equal(scoreDailyRoutine({ gasPctChange: 0, severeWeatherAlert: "isolated" }), 1);
  });

  test("moderate: travel advisory upgrade, regional supply disruption, or widespread weather", () => {
    assert.equal(scoreDailyRoutine({ gasPctChange: 0, travelAdvisoryUpgraded: true }), 2);
    assert.equal(scoreDailyRoutine({ gasPctChange: 0, regionalSupplyDisruption: true }), 2);
    assert.equal(scoreDailyRoutine({ gasPctChange: 0, severeWeatherAlert: "widespread" }), 2);
  });

  test("major: nationwide fuel shortage or an advisory against a major hub", () => {
    assert.equal(scoreDailyRoutine({ gasPctChange: 0, nationwideFuelShortage: true }), 3);
    assert.equal(scoreDailyRoutine({ gasPctChange: 0, advisoryAgainstMajorHub: true }), 3);
  });
});
