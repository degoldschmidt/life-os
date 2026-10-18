import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { and, eq, gte, sql } from "drizzle-orm";
import type { ZodType } from "zod";
import { db, schema } from "@/lib/db";
import { costUsd, MAX_RUNS_PER_HOUR } from "@/lib/ai/models";

export type AiResult<T> = { ok: true; data: T; costUsd: number } | { ok: false; error: string };

/** True when a key is configured, or the dev-only stub is on (never in production). */
export function aiAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY) || stubOn();
}

export function stubOn(): boolean {
  return process.env.AI_STUB === "1" && process.env.NODE_ENV !== "production";
}

let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic());

async function runsLastHour(userId: string): Promise<number> {
  const [r] = await db()
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.aiRuns)
    .where(and(eq(schema.aiRuns.userId, userId), gte(schema.aiRuns.createdAt, new Date(Date.now() - 3_600_000))));
  return r?.n ?? 0;
}

/**
 * One structured Claude call. The model's JSON is validated against `schema`; anything else
 * (refusal, truncation, bad JSON, API trouble) comes back as a plain error string the UI can show.
 * Every real call is logged with its token counts and cost, and capped per hour.
 */
export async function runStructured<T>(opts: {
  userId: string;
  feature: string;
  model: string;
  system: string;
  prompt: string;
  schema: ZodType<T>;
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
  stub?: () => T;
}): Promise<AiResult<T>> {
  if (stubOn() && opts.stub) return { ok: true, data: opts.stub(), costUsd: 0 };
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, error: "Claude isn't set up yet. Add ANTHROPIC_API_KEY in Vercel." };
  if ((await runsLastHour(opts.userId)) >= MAX_RUNS_PER_HOUR) return { ok: false, error: "That's a lot of requests for one hour. Try again later." };

  try {
    const response = await getClient().messages.parse({
      model: opts.model,
      max_tokens: opts.maxTokens ?? 4000,
      system: opts.system,
      messages: [{ role: "user", content: opts.prompt }],
      output_config: { effort: opts.effort ?? "medium", format: zodOutputFormat(opts.schema as never) },
    });

    const cost = costUsd(opts.model, response.usage.input_tokens, response.usage.output_tokens);
    await db().insert(schema.aiRuns).values({
      userId: opts.userId,
      feature: opts.feature,
      model: opts.model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      costUsd: cost,
    });

    if (response.stop_reason === "refusal") return { ok: false, error: "Claude declined this request." };
    if (response.stop_reason === "max_tokens") return { ok: false, error: "The answer was cut off. Try with less text." };
    if (response.parsed_output == null) return { ok: false, error: "Couldn't read Claude's answer. Try again." };
    return { ok: true, data: response.parsed_output as T, costUsd: cost };
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return { ok: false, error: "Claude is busy. Try again in a minute." };
    if (e instanceof Anthropic.AuthenticationError) return { ok: false, error: "The Claude API key was rejected. Check ANTHROPIC_API_KEY." };
    if (e instanceof Anthropic.BadRequestError) {
      console.error("[ai] bad request:", e.message);
      return { ok: false, error: "Claude couldn't process that request." };
    }
    if (e instanceof Anthropic.APIError) {
      console.error("[ai] api error:", e.status, e.message);
      return { ok: false, error: "Claude is unavailable right now. Try again shortly." };
    }
    console.error("[ai] unexpected:", e);
    return { ok: false, error: "Something went wrong talking to Claude." };
  }
}
