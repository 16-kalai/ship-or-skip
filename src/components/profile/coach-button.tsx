"use client";

import { useActionState } from "react";
import { Orb } from "@/components/orb";
import { askCoach, type CoachRequest } from "@/app/profile/actions";

// Asks the Coach agent for a new plan (it can take up to a minute) and always says what happened.
export function CoachButton({ label }: { label: string }) {
  const [state, action, pending] = useActionState<CoachRequest>(askCoach, { status: "idle", message: "" });
  return (
    <form action={action} className="flex flex-col items-end gap-1.5">
      <button
        type="submit"
        disabled={pending}
        className="flex items-center gap-2 rounded-xl border border-border-strong px-3.5 py-2 text-[13.5px] font-semibold transition-colors hover:bg-background-secondary disabled:opacity-70"
      >
        {pending && <Orb size={16} speaking />}
        {pending ? "Your coach is planning…" : label}
      </button>
      {!pending && state.message && (
        <span role="status" className={state.status === "error" ? "text-[12.5px] text-danger" : "text-[12.5px] text-foreground-tertiary"}>
          {state.message}
        </span>
      )}
    </form>
  );
}
