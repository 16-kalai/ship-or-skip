"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { refreshCoachPlan } from "@/lib/coach/coach";
import { revalidateTag } from "next/cache";
import { siteOrigin } from "@/lib/site";

export type CoachRequest = { status: "idle" | "updated" | "wait" | "error"; message: string };

const COACH_COOLDOWN_MS = 45_000;

// Asks the Coach agent for a fresh plan. A short cooldown protects AgenticOrg's shared rate
// limit; the learner is always told what happened.
export async function askCoach(): Promise<CoachRequest> {
  const user = await getUser();
  if (!user) return { status: "error", message: "Sign in again." };
  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("coach_at").eq("user_id", user.id).maybeSingle<{ coach_at: string | null }>();
  const since = data?.coach_at ? Date.now() - new Date(data.coach_at).getTime() : Infinity;
  if (since < COACH_COOLDOWN_MS) {
    const wait = Math.ceil((COACH_COOLDOWN_MS - since) / 1000);
    return { status: "wait", message: `Your coach just made this plan. Ask again in ${wait}s.` };
  }
  await refreshCoachPlan(admin, user.id);
  const { data: after } = await admin.from("profiles").select("coach_plan").eq("user_id", user.id).maybeSingle<{ coach_plan: { source?: string; runStatus?: string } | null }>();
  revalidatePath("/profile");
  const plan = after?.coach_plan;
  if (plan?.source === "agenticorg") return { status: "updated", message: "New plan ready from your Coach agent." };
  return {
    status: "updated",
    message: plan?.runStatus === "error" || plan?.runStatus === "failed"
      ? "The Coach agent couldn't respond, so Rev made your plan."
      : "New plan ready.",
  };
}

function slug(name: string) {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  return base.length >= 2 ? base : "reviewer";
}

// Makes the learner's profile public and returns its link. Reuses their handle if they have one.
export async function shareProfile(): Promise<{ url: string } | { error: string }> {
  const user = await getUser();
  if (!user) return { error: "Sign in again." };
  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("name, share_handle").eq("user_id", user.id).maybeSingle<{ name: string | null; share_handle: string | null }>();
  let handle = data?.share_handle ?? null;
  const name = data?.name ?? (user.user_metadata?.full_name as string | undefined) ?? user.email?.split("@")[0] ?? "reviewer";
  for (let i = 0; !handle && i < 5; i++) {
    const candidate = `${slug(name)}-${Math.random().toString(36).slice(2, 6)}`;
    const { error } = await admin.from("profiles").update({ share_handle: candidate }).eq("user_id", user.id).is("share_handle", null);
    if (!error) handle = candidate;
    else if (error.code !== "23505") return { error: "Couldn't create your link. Try again." };
  }
  if (!handle) return { error: "Couldn't create your link. Try again." };
  await admin.from("profiles").update({ shared_at: new Date().toISOString() }).eq("user_id", user.id);
  revalidateTag(`public-profile:${handle}`, "max");
  revalidatePath("/profile");
  return { url: `${await siteOrigin()}/u/${handle}` };
}

// Takes the public profile down. The link stops working at once.
export async function stopSharing() {
  const user = await getUser();
  if (!user) return;
  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("share_handle").eq("user_id", user.id).maybeSingle<{ share_handle: string | null }>();
  await admin.from("profiles").update({ shared_at: null }).eq("user_id", user.id);
  if (data?.share_handle) revalidateTag(`public-profile:${data.share_handle}`, "max");
  revalidatePath("/profile");
}
