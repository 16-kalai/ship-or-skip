import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Orb } from "@/components/orb";
import { Chat } from "@/components/chat/chat";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadAttempts } from "@/lib/chat/actions";
import { EMPTY_PROFILE, PROFILE_COLUMNS, greeting, stageFor } from "@/lib/chat/onboarding";
import type { ChatMessage, Profile } from "@/lib/chat/types";
import { createClient, getUser } from "@/lib/supabase/server";

// The whole product after sign-up: one conversation with Rev.
export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <main className="flex h-dvh items-center justify-center">
          <Orb size={40} speaking />
        </main>
      }
    >
      <Conversation />
    </Suspense>
  );
}

// Loads the saved conversation and where the learner is, so a refresh picks up exactly there.
async function Conversation() {
  const user = await getUser();
  if (!user) redirect("/signup?next=/chat");
  const fullName: string | undefined = user.user_metadata?.full_name ?? user.user_metadata?.name;
  const firstName = fullName?.split(" ")[0] ?? null;

  const supabase = await createClient();
  const [{ data }, { data: saved }, attempts] = await Promise.all([
    supabase
      .from("messages")
      .select("id, role, content, meta, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100)
      .returns<ChatMessage[]>(),
    supabase.from("profiles").select(PROFILE_COLUMNS).eq("user_id", user.id).maybeSingle<Profile>(),
    loadAttempts(createAdminClient(), user.id),
  ]);
  const profile: Profile = { ...EMPTY_PROFILE, ...saved, stack: saved?.stack ?? [], goals: saved?.goals ?? [] };
  const stage = stageFor(profile, { open: Boolean(attempts.open), count: attempts.count });

  return (
    <Chat
      greeting={greeting(firstName)}
      initialMessages={(data ?? []).reverse()}
      initialStage={stage}
      user={{
        initial: (firstName ?? user.email ?? "?").charAt(0).toUpperCase(),
        avatarUrl: null,
      }}
    />
  );
}
