"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { refreshCoachPlan } from "@/lib/coach/coach";

// Saves (or clears) the learner's GitHub username. Only the username is stored.
export async function saveGithub(formData: FormData) {
  const user = await getUser();
  if (!user) return;
  const raw = String(formData.get("github") ?? "")
    .trim()
    .replace(/^@/, "")
    .replace(/^https?:\/\/(www\.)?github\.com\//i, "")
    .replace(/\/.*$/, "");
  if (raw && !/^[A-Za-z0-9-]{1,39}$/.test(raw)) return;
  await createAdminClient().from("profiles").update({ github: raw || null }).eq("user_id", user.id);
  revalidatePath("/profile");
  revalidatePath("/chat");
}

// Asks the Coach agent for a fresh plan, at most once every 2 minutes per learner.
export async function askCoach() {
  const user = await getUser();
  if (!user) return;
  const admin = createAdminClient();
  const { data } = await admin.from("profiles").select("coach_at").eq("user_id", user.id).maybeSingle<{ coach_at: string | null }>();
  if (data?.coach_at && Date.now() - new Date(data.coach_at).getTime() < 2 * 60 * 1000) return;
  await refreshCoachPlan(admin, user.id);
  revalidatePath("/profile");
}
