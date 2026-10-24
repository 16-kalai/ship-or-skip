import { serverEnv } from "@/lib/env";

export type AgentRun = {
  status: "completed" | "failed" | "hitl_triggered" | "budget_exceeded" | string;
  confidence: number | null;
  output: unknown;
};

// Runs a Pine Labs AgenticOrg agent by its UUID (POST /api/v1/agents/{id}/run). Server only:
// the API key never reaches the browser. Returns null when AgenticOrg isn't configured.
export async function runAgent(agentId: string, task: string, timeoutMs = 90_000): Promise<AgentRun | null> {
  const { AGENTICORG_API_KEY: key, AGENTICORG_BASE_URL: base } = serverEnv();
  if (!key) return null;
  const res = await fetch(`${base}/api/v1/agents/${encodeURIComponent(agentId)}/run`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ action: "process", inputs: { task }, context: {} }),
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`AgenticOrg run failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as { status?: string; confidence?: number | null; output?: unknown };
  return { status: data.status ?? "failed", confidence: data.confidence ?? null, output: data.output ?? null };
}
