/** Models the Settings screen offers, with USD per million tokens (first-party API, Oct 2026). */
export const MODELS = {
  "claude-sonnet-5-5": { label: "Sonnet 5.5", inPerMTok: 2, outPerMTok: 10 },
  "claude-opus-5-5": { label: "Opus 5.5", inPerMTok: 4, outPerMTok: 20 },
  "claude-fable-5-1": { label: "Fable 5.1", inPerMTok: 10, outPerMTok: 50 },
} as const;

export type ModelId = keyof typeof MODELS;
export const DEFAULT_MODEL: ModelId = "claude-sonnet-5-5";

export function isModelId(v: string): v is ModelId {
  return v in MODELS;
}

/** Cost of one call. Cache reads are ignored (we don't cache short, varied prompts). Rounded to 1e-6 dollars. */
export function costUsd(model: string, inputTokens: number, outputTokens: number): number {
  const m = isModelId(model) ? MODELS[model] : MODELS[DEFAULT_MODEL];
  const usd = (inputTokens * m.inPerMTok + outputTokens * m.outPerMTok) / 1_000_000;
  return Math.round(usd * 1e6) / 1e6;
}

/** A hard ceiling on runs per hour, so a bug or a loop can never run up a bill. */
export const MAX_RUNS_PER_HOUR = 40;
