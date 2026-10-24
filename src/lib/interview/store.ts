import type { SupabaseClient } from "@supabase/supabase-js";
import { canvasFor, type Plan } from "@/lib/interview/plan";
import type { QuestionTranscript } from "@/lib/interview/report";
import type { InterviewTurn, InterviewView, Level, Report } from "@/lib/interview/types";

export type InterviewRow = {
  id: string;
  user_id: string;
  role_title: string;
  company: string | null;
  level: Level;
  plan: Plan;
  status: InterviewView["status"];
  current_index: number;
  report: Report | null;
};

const TURN_COLUMNS = "id, role, kind, question_index, content, card, created_at";

// Loads an interview only if it belongs to this user (these tables have no browser read policy).
export async function loadInterview(admin: SupabaseClient, id: string, userId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await admin
    .from("interviews")
    .select("id, user_id, role_title, company, level, plan, status, current_index, report")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle<InterviewRow>();
  return data;
}

export async function loadTurns(admin: SupabaseClient, interviewId: string) {
  const { data, error } = await admin
    .from("interview_turns")
    .select(TURN_COLUMNS)
    .eq("interview_id", interviewId)
    .order("created_at", { ascending: true })
    .returns<InterviewTurn[]>();
  if (error) throw error;
  return data;
}

export async function addTurns(
  admin: SupabaseClient,
  interview: Pick<InterviewRow, "id" | "user_id">,
  turns: Array<Omit<InterviewTurn, "id" | "created_at" | "card"> & { card?: InterviewTurn["card"] }>,
) {
  const { data, error } = await admin
    .from("interview_turns")
    .insert(turns.map((t) => ({ ...t, card: t.card ?? null, interview_id: interview.id, user_id: interview.user_id })))
    .select(TURN_COLUMNS)
    .returns<InterviewTurn[]>();
  if (error) throw error;
  return data;
}

// The call transcript grouped by question, for scoring.
export function transcriptByQuestion(turns: InterviewTurn[], count: number): QuestionTranscript[] {
  const grouped: QuestionTranscript[] = Array.from({ length: count }, () => ({ interviewer: [], candidate: [] }));
  for (const t of turns) {
    const q = grouped[Math.min(Math.max(t.question_index, 0), count - 1)];
    (t.role === "candidate" ? q.candidate : q.interviewer).push(t.content);
  }
  return grouped;
}

export function toView(row: InterviewRow, turns: InterviewTurn[]): InterviewView {
  return {
    id: row.id,
    roleTitle: row.role_title,
    company: row.company,
    candidateName: row.plan.candidate_name ?? null,
    status: row.status,
    canvas: canvasFor(row.plan),
    turns,
    report: row.report,
  };
}
