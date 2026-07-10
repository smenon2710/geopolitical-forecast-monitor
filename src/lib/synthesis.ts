import { fetchWithTimeout } from "./fetchWithTimeout";
import type { CitedMetric, Lens, LensReading, Severity } from "@/types";
import { LENS_LABELS, SEVERITY_LABEL } from "@/types";

/**
 * Turns scored, cited metrics into the reader-facing narrative per lens.
 *
 * `synthesizeLensNarrative` is the fallback: every sentence is built directly
 * from a CitedMetric, so nothing here can drift into unsourced claims.
 * `synthesizeAllLenses` is the real entry point — it writes all five lenses'
 * narratives in a SINGLE OpenRouter call (one request/day instead of five),
 * still grounding-checking each lens's narrative independently and falling
 * back to the template per-lens if that one section's output isn't grounded
 * or the whole call fails.
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

export interface LensSynthesisInput {
  lens: Lens;
  severity: Severity;
  metrics: CitedMetric[];
}

const OPENROUTER_BASE = "https://openrouter.ai/api/v1/chat/completions";
// Free-tier OpenRouter model by default — swap via OPENROUTER_MODEL once
// quality/cost tradeoffs matter (see https://openrouter.ai/models).
const DEFAULT_MODEL = "google/gemini-2.0-flash-exp:free";

export async function synthesizeAllLenses(inputs: LensSynthesisInput[]): Promise<LensReading[]> {
  const fallbacks = inputs.map((i) => synthesizeLensNarrative(i.lens, i.severity, i.metrics));

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return fallbacks;

  const sections = inputs
    .map((i) => {
      const label = LENS_LABELS[i.lens];
      const severityWord = SEVERITY_LABEL[i.severity];
      const metricLines = i.metrics.length
        ? i.metrics.map((m) => `  - ${m.label}: ${m.value} (source: ${m.sourceName})`).join("\n")
        : "  (no data today)";
      return `Key "${i.lens}" — "${label}", currently reading "${severityWord}":\n${metricLines}`;
    })
    .join("\n\n");

  const keys = inputs.map((i) => `"${i.lens}"`).join(", ");
  const prompt =
    `You are writing a daily briefing called the Geopolitical Forecast Monitor, for a reader with no economics ` +
    `or policy background — not a trader, not an analyst. They want to know, in plain words, what today means ` +
    `for their own life: their bills, their savings, their job, their safety, their day.\n\n` +
    `Below are ${inputs.length} independent sections. Write 2-3 short plain-English sentences for EACH one. ` +
    `A section may ONLY use the data listed under it — never borrow a number, event, or comparison from a ` +
    `different section, even if two sections mention the same underlying thing (e.g. gas prices) for different reasons.\n\n` +
    `${sections}\n\n` +
    `Hard rules for every section — breaking any of these makes that section's output unusable:\n` +
    `1. Every number in a section's output must be one of the numbers listed under that section, unchanged. Do not compute, round, convert, or restate a number in different units.\n` +
    `2. Do not add any date, year, historical comparison, or trend claim ("since 2023", "the smallest in five years", "record high", "for the first time") unless that exact comparison appears in that section's data. You do not know history beyond what's listed — do not imply that you do.\n` +
    `3. Do not name a specific cause, country, company, or event that isn't in that section's data.\n` +
    `4. Do not add qualifiers implying certainty about direction or causality beyond the bare numbers ("driven by", "due to", "signals a trend").\n` +
    `5. Do not use technical jargon, acronyms, or financial/policy terminology (e.g. no "CPI", "basis points", "Goldstein score", "quarter-over-quarter") — say what the underlying label already says in plain words instead.\n` +
    `6. If you are unsure whether a sentence is fully supported by that section's data, cut it.\n\n` +
    `Write like you're texting a friend who asked "should I worry about anything today?" — warm, direct, no hedging filler, no speculation beyond what these numbers show.\n\n` +
    `Return ONLY a JSON object, no markdown code fences, no commentary before or after — exactly one key per section (${keys}), each mapped to that section's narrative string.`;

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
    if (!res.ok) return fallbacks;
    const json = await res.json();
    const content: string | undefined = json.choices?.[0]?.message?.content?.trim();
    if (!content) return fallbacks;

    const parsed = parseJsonObject(content);
    if (!parsed) {
      console.warn("[synthesis] batched response wasn't valid JSON, using template fallback for all lenses");
      return fallbacks;
    }

    return inputs.map((input, idx) => {
      const narrative = parsed[input.lens];
      if (typeof narrative !== "string" || !isGroundedInMetrics(narrative, input.metrics)) {
        console.warn(`[synthesis] rejected ungrounded or missing LLM output for ${input.lens}, using template fallback`);
        return fallbacks[idx];
      }
      return { lens: input.lens, severity: input.severity, oneLiner: fallbacks[idx].oneLiner, narrative, metrics: input.metrics };
    });
  } catch (err) {
    console.warn(`[synthesis] batched call failed, using template fallback for all lenses: ${(err as Error).message}`);
    return fallbacks;
  }
}

/** Models sometimes wrap JSON in ```json fences despite instructions not to. */
function parseJsonObject(content: string): Record<string, unknown> | null {
  const stripped = content.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  try {
    const parsed = JSON.parse(stripped);
    return typeof parsed === "object" && parsed !== null ? parsed : null;
  } catch {
    return null;
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
