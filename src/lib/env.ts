import { z } from "zod";

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

const serverSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(1),
  GEMINI_API_KEY: z.string().min(1),
  // Tried in order; the next one is used when a model is rate limited or down.
  // 3.1 first: measured ~1.4s per chat turn vs ~6.7s for 3.5 (24 Oct).
  GEMINI_TEXT_MODELS: z
    .string()
    .default("gemini-3.1-flash-lite,gemini-3.5-flash-lite")
    .transform((v) => v.split(",").map((m) => m.trim()).filter(Boolean)),
  // Rev's live voice (Gemini Live; the same API key).
  GEMINI_LIVE_MODEL: z.string().min(1).default("gemini-3.1-flash-live-preview"),
  // Pine Labs AgenticOrg: the Coach agent. Without these, Rev writes the plan itself.
  AGENTICORG_API_KEY: z.string().min(1).optional(),
  AGENTICORG_COACH_AGENT_ID: z.string().uuid().optional(),
  AGENTICORG_BASE_URL: z.url().default("https://agenticorg.hackathon.pinelabs.com"),
  // Who can open /admin: comma-separated emails.
  ADMIN_EMAILS: z
    .string()
    .default("")
    .transform((v) => v.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)),
});

// Next inlines NEXT_PUBLIC_* only when referenced literally, so list them explicitly.
export const publicEnv = publicSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
});

let cachedServerEnv: z.infer<typeof serverSchema> | undefined;

// Secrets, validated on first use. Throws if called from browser code.
export function serverEnv() {
  if (typeof window !== "undefined") throw new Error("serverEnv() must not be called in the browser");
  cachedServerEnv ??= serverSchema.parse(process.env);
  return cachedServerEnv;
}
