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
    ? `${label} is ${severityWord} today: ${metrics[0].label} ${metrics[0].value} (${metrics[0].sourceName}).`
    : `${label} is ${severityWord} today — no notable data points.`;

  const narrative = metrics.length
    ? `${label} reads ${severityWord}. ` +
      metrics.map((m) => `${m.label} is ${m.value}, per ${m.sourceName}.`).join(" ")
    : `${label} reads ${severityWord}. No metrics crossed a scoring threshold today.`;

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
  const prompt =
    `You are writing one short paragraph (2-3 sentences) for a daily geopolitical impact monitor's "${label}" section, ` +
    `currently reading "${severityWord}". Cite ONLY the following data points, verbatim — never introduce a number, ` +
    `event, or source that isn't in this list:\n` +
    metrics.map((m) => `- ${m.label}: ${m.value} (source: ${m.sourceName})`).join("\n") +
    `\n\nWrite in plain, non-partisan language. No speculation beyond what these numbers show.`;

  try {
    const res = await fetch(OPENROUTER_BASE, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || DEFAULT_MODEL,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) return fallback;
    const json = await res.json();
    const narrative: string | undefined = json.choices?.[0]?.message?.content?.trim();
    if (!narrative) return fallback;
    return { lens, severity, oneLiner: fallback.oneLiner, narrative, metrics };
  } catch {
    return fallback;
  }
}
