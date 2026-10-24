import { ApiError, GoogleGenAI, type Content } from "@google/genai";
import { z } from "zod";
import { serverEnv } from "@/lib/env";

let client: GoogleGenAI | undefined;

function gemini() {
  client ??= new GoogleGenAI({ apiKey: serverEnv().GEMINI_API_KEY });
  return client;
}

// The model answered, but not in the shape we asked for.
export class AiOutputError extends Error {}
// Every configured model is rate limited, down, or too slow right now.
export class AiUnavailableError extends Error {}

const TIMEOUT_MS = 25_000;
// Gemini's latency swings between ~1 s and 10 s+ for the same model (measured 24 Oct). If the
// first model hasn't answered by now, also ask the next one and take whichever answers first.
const HEDGE_AFTER_MS = 2_500;

// Rate limits, server errors and timeouts are worth trying on another model.
function isRetryable(error: unknown) {
  if (error instanceof AiOutputError) return true;
  if (error instanceof ApiError) return error.status === 429 || error.status >= 500;
  return error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError");
}

async function callModel<T extends z.ZodType>(
  model: string,
  args: { schema: T; system: string; contents: Content[]; temperature?: number },
  jsonSchema: Record<string, unknown>,
  signal: AbortSignal,
): Promise<z.infer<T>> {
  const response = await gemini().models.generateContent({
    model,
    contents: args.contents,
    config: {
      systemInstruction: args.system,
      responseMimeType: "application/json",
      responseJsonSchema: jsonSchema,
      temperature: args.temperature ?? 0.4,
      abortSignal: AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)]),
    },
  });
  const text = response.text;
  if (!text) throw new AiOutputError("Empty response");
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new AiOutputError("Invalid JSON");
  }
  const parsed = args.schema.safeParse(raw);
  if (!parsed.success) throw new AiOutputError(`Schema mismatch: ${parsed.error.message}`);
  return parsed.data;
}

// Asks Gemini for JSON matching a zod schema. Tries the configured models in order, starts the
// next one early if the current one is slow (a hedged request), and returns the first valid answer.
export function generateJson<T extends z.ZodType>(args: {
  schema: T;
  system: string;
  contents: Content[];
  temperature?: number;
}): Promise<{ data: z.infer<T>; model: string }> {
  const jsonSchema = z.toJSONSchema(args.schema) as Record<string, unknown>;
  delete jsonSchema.$schema;
  const models = serverEnv().GEMINI_TEXT_MODELS;

  return new Promise((resolve, reject) => {
    const controllers: AbortController[] = [];
    let next = 0;
    let running = 0;
    let settled = false;
    let lastError: unknown;

    const finish = (fn: () => void) => {
      settled = true;
      clearTimeout(hedge);
      // Cancel the slower calls so they don't keep using quota.
      for (const c of controllers) c.abort();
      fn();
    };

    const launch = () => {
      if (settled || next >= models.length) return;
      const model = models[next++];
      const controller = new AbortController();
      controllers.push(controller);
      running++;
      callModel(model, args, jsonSchema, controller.signal).then(
        (data) => {
          if (!settled) finish(() => resolve({ data, model }));
        },
        (error: unknown) => {
          running--;
          if (settled) return;
          lastError = error;
          if (!isRetryable(error)) return finish(() => reject(error));
          if (next < models.length) launch();
          else if (running === 0) {
            finish(() => reject(new AiUnavailableError(`All Gemini models failed: ${String(lastError)}`)));
          }
        },
      );
    };

    launch();
    const hedge = setTimeout(launch, HEDGE_AFTER_MS);
  });
}
