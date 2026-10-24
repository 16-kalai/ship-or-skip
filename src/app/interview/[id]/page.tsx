import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { Orb } from "@/components/orb";
import { InterviewRoom } from "@/components/interview/interview-room";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";
import { loadInterview, loadTurns, toView } from "@/lib/interview/store";

export default function InterviewPage(props: PageProps<"/interview/[id]">) {
  return (
    <Suspense
      fallback={
        <main className="flex h-dvh items-center justify-center">
          <Orb size={40} speaking />
        </main>
      }
    >
      <Room params={props.params} />
    </Suspense>
  );
}

async function Room({ params }: { params: PageProps<"/interview/[id]">["params"] }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) redirect(`/signup?next=/interview/${id}`);
  const admin = createAdminClient();
  const interview = await loadInterview(admin, id, user.id);
  if (!interview || interview.status === "abandoned") notFound();
  const turns = await loadTurns(admin, interview.id);
  return <InterviewRoom view={toView(interview, turns)} />;
}
