import { fetchWithTimeout } from "./fetchWithTimeout";
import type { CitedMetric, Lens, LensReading, Severity } from "@/types";
import { LENS_LABELS, SEVERITY_LABEL } from "@/types";

/**
 * Turns scored, cited metrics into the reader-facing narrative per lens.
 *
 * `synthesizeLensNarrative` is the fallback: every sentence is built directly
 * from a CitedMetric, so nothing here can drift into unsourced claims. Once
 * OPENROUTER_API_KEY is set, `synthesizeWithLlm` calls out to OpenRouter
 * (https://openrouter.ai — one key, pick-your-model gateway) with a prompt
 * that passes the same metrics verbatim and instructs the model to cite only
 * those values, falling back to the template on any error.
 */

export function synthesizeLensNarrative(lens: Lens, severity: Severity, metrics: CitedMetric[]): LensReading {
  const label = LENS_LABELS[lens];
  const severityWord = SEVERITY_LABEL[severity].toLowerCase();

  const oneLiner = metrics.length
    ? `${label}: ${severityWord} today. ${metrics[0].label} — ${metrics[0].value}.`
    : `${label}: ${severityWord} today. Nothing notable to report.`;

  const narrative = metrics.length
    ? `${label} is ${severityWord} today. ` + metrics.map((m) => `${m.label}: ${m.value}.`).join(" ")
    : `${label} is ${severityWord} today. Nothing crossed the threshold worth flagging.`;

  return { lens, severity, oneLiner, narrative, metrics };
}

const OPENROUTER_BASE = "https://openrouter.ai/api/v1/chat/completions";
// Free-tier OpenRouter model by default — swap via OPENROUTER_MODEL once
// quality/cost tradeoffs matter (see https://openrouter.ai/models).
const DEFAULT_MODEL = "google/gemini-2.0-flash-exp:free";

export async function synthesizeWithLlm(
  lens: Lens,
  severity: Severity,
  metrics: CitedMetric[]
): Promise<LensReading> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const fallback = synthesizeLensNarrative(lens, severity, metrics);
  if (!apiKey || metrics.length === 0) return fallback;

  const label = LENS_LABELS[lens];
  const severityWord = SEVERITY_LABEL[severity];
  const metricLines = metrics.map((m) => `- ${m.label}: ${m.value} (source: ${m.sourceName})`).join("\n");
  const prompt =
    `You are writing 2-3 short sentences for a daily briefing called the Geopolitical Forecast Monitor, in the ` +
    `"${label}" section, currently reading "${severityWord}". The reader is a curious adult with no economics ` +
    `or policy background — not a trader, not an analyst. They want to know, in plain words, what this means ` +
    `for their own life: their bills, their savings, their job, their safety, their day. Here is the ONLY data ` +
    `you may reference:\n${metricLines}\n\n` +
    `Hard rules — breaking any of these makes the output unusable:\n` +
    `1. Every number in your output must be one of the numbers listed above, unchanged. Do not compute, round, convert, or restate a number in different units.\n` +
    `2. Do not add any date, year, historical comparison, or trend claim ("since 2023", "the smallest in five years", "record high", "for the first time") unless that exact comparison appears in the data above. You do not know history beyond what's listed — do not imply that you do.\n` +
    `3. Do not name a specific cause, country, company, or event that isn't in the data above.\n` +
    `4. Do not add qualifiers implying certainty about direction or causality beyond the bare numbers ("driven by", "due to", "signals a trend").\n` +
    `5. Do not use technical jargon, acronyms, or financial/policy terminology (e.g. no "CPI", "basis points", "Goldstein score", "quarter-over-quarter") — say what the underlying label already says in plain words instead.\n` +
    `6. If you are unsure whether a sentence is fully supported by the data above, cut it.\n\n` +
    `Write like you're texting a friend who asked "should I worry about anything today?" — warm, direct, no hedging filler, no speculation beyond what these numbers show.`;

  try {
    const res = await fetchWithTimeout(OPENROUTER_BASE, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || DEFAULT_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0,
      }),
    });
    if (!res.ok) return fallback;
    const json = await res.json();
    const narrative: string | undefined = json.choices?.[0]?.message?.content?.trim();
    if (!narrative) return fallback;
    if (!isGroundedInMetrics(narrative, metrics)) {
      console.warn(`[synthesis] rejected ungrounded LLM output for ${lens}, using template fallback`);
      return fallback;
    }
    return { lens, severity, oneLiner: fallback.oneLiner, narrative, metrics };
  } catch {
    return fallback;
  }
}

/**
 * Defense in depth against the prompt alone: reject any narrative containing
 * a number that doesn't appear anywhere in the source metrics (e.g. a
 * fabricated year like "since 2023", or a recomputed/rounded figure). This
 * catches exactly the class of hallucination the hard rules above target,
 * without trusting the model to have followed them.
 */
function isGroundedInMetrics(narrative: string, metrics: CitedMetric[]): boolean {
  if (narrative.trim().length < 20) return false; // too short to be real prose

  const sourceText = metrics.map((m) => `${m.label} ${m.value} ${m.sourceName}`).join(" ");
  const sourceNumbers = new Set(sourceText.match(/\d+(\.\d+)?/g) ?? []);
  const narrativeNumbers = narrative.match(/\d+(\.\d+)?/g) ?? [];

  // If the metrics carry real numbers, the narrative must actually cite at
  // least one — catches non-answers (moderation artifacts, refusals, generic
  // filler) that contain zero numbers and so'd otherwise vacuously pass.
  if (sourceNumbers.size > 0 && narrativeNumbers.length === 0) return false;

  return narrativeNumbers.every((n) => sourceNumbers.has(n));
}
