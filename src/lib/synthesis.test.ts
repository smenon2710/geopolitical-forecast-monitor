import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { isGroundedInMetrics } from "./synthesis";
import type { CitedMetric } from "@/types";

const cpiMetric: CitedMetric = { label: "How fast prices are rising", value: "0.42%", sourceName: "FRED (CPIAUCSL)" };
const gasMetric: CitedMetric = { label: "Price at the pump", value: "$3.29/gal", sourceName: "EIA" };

describe("isGroundedInMetrics", () => {
  test("rejects narratives too short to be real prose, even if numerically correct", () => {
    assert.equal(isGroundedInMetrics("CPI is 0.42%.", [cpiMetric]), false);
  });

  test("accepts a narrative whose numbers all appear verbatim in the source metrics", () => {
    const narrative = "Prices are climbing at 0.42% this month, and gas is running $3.29 a gallon.";
    assert.equal(isGroundedInMetrics(narrative, [cpiMetric, gasMetric]), true);
  });

  test("rejects a narrative containing a number absent from the source (fabrication)", () => {
    const narrative = "Prices are up 0.42% this month, the highest since 2023.";
    assert.equal(isGroundedInMetrics(narrative, [cpiMetric]), false);
  });

  test("rejects a rounded/recomputed number even when it's numerically close to the source", () => {
    // Source says 0.42% — a narrative that rounds to 0.4% must be rejected,
    // since the model isn't allowed to recompute or round figures.
    const narrative = "Prices are up about 0.4% this month according to the latest reading.";
    assert.equal(isGroundedInMetrics(narrative, [cpiMetric]), false);
  });

  test("does not let a substring of a source number count as grounded", () => {
    // Source has "42" only as part of "0.42" — "42" alone must not match.
    const narrative = "Something about the number 42 appears here as filler text today.";
    assert.equal(isGroundedInMetrics(narrative, [cpiMetric]), false);
  });

  test("rejects a non-answer with zero numbers when the metrics have real numbers to cite", () => {
    const narrative = "This section could not be completed due to a content policy restriction.";
    assert.equal(isGroundedInMetrics(narrative, [cpiMetric]), false);
  });

  test("accepts a number-free narrative when the metrics themselves have no numbers", () => {
    const textOnlyMetric: CitedMetric = { label: "Status", value: "no data available", sourceName: "EIA" };
    const narrative = "Nothing crossed the threshold worth flagging in today's reading.";
    assert.equal(isGroundedInMetrics(narrative, [textOnlyMetric]), true);
  });

  test("accepts the same source number cited more than once", () => {
    const narrative = "Prices rose 0.42% this month. That 0.42% move is the whole story today.";
    assert.equal(isGroundedInMetrics(narrative, [cpiMetric]), true);
  });
});
