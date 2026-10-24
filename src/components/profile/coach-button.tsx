"use client";

import { useFormStatus } from "react-dom";
import { Orb } from "@/components/orb";

// Shows progress while the Coach agent writes a new plan (it can take up to a minute).
export function CoachButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex items-center gap-2 rounded-xl border border-border-strong px-3.5 py-2 text-[13.5px] font-semibold transition-colors hover:bg-background-secondary disabled:opacity-70"
    >
      {pending && <Orb size={16} speaking />}
      {pending ? "Your coach is planning…" : label}
    </button>
  );
}
