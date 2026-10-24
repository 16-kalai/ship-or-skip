"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Orb } from "@/components/orb";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/cn";
import { SAMPLE_JDS } from "@/lib/interview/samples";

const MAX_PDF_BYTES = 5 * 1024 * 1024;

// Two steps before the call: the job description, then the candidate's resume.
export function NewInterview() {
  const router = useRouter();
  const [jd, setJd] = useState("");
  const [resume, setResume] = useState<File | null>(null);
  const [noResume, setNoResume] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const jdReady = jd.trim().length >= 80;

  function pick(file: File | undefined) {
    if (!file) return;
    if (file.type !== "application/pdf") return setError("Upload your resume as a PDF.");
    if (file.size > MAX_PDF_BYTES) return setError("That resume is over 5 MB. Try a smaller PDF.");
    setError(null);
    setResume(file);
    setNoResume(false);
  }

  async function start() {
    if (busy) return;
    setError(null);
    if (!jdReady) return setError("Paste a bit more of the job description (at least a few lines).");
    if (!resume && !noResume) return setError("Add your resume, or choose to use what you told Rev.");
    setBusy(true);
    try {
      const body = new FormData();
      body.set("jd", jd);
      if (resume) body.set("resume", resume);
      const res = await fetch("/api/interview", { method: "POST", body });
      const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!res.ok || !data.id) throw new Error(data.error ?? "Couldn't prepare that interview. Try again.");
      router.push(`/interview/${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't prepare that interview. Try again.");
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-6 rounded-3xl border border-border bg-background p-6">
      <Step n={1} title="The job you're preparing for" done={jdReady}>
        <textarea
          value={jd}
          onChange={(e) => setJd(e.target.value)}
          maxLength={12000}
          rows={6}
          disabled={busy}
          placeholder="Paste the job description: role, responsibilities, skills…"
          className="w-full resize-y rounded-2xl border border-border-strong bg-background px-4 py-3 text-[15px] leading-relaxed outline-none placeholder:text-foreground-quaternary focus:border-foreground-quaternary focus:ring-4 focus:ring-border"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-[13px] text-foreground-quaternary">No JD handy? Try:</span>
          {SAMPLE_JDS.map((s) => (
            <button
              key={s.label}
              type="button"
              disabled={busy}
              onClick={() => setJd(s.jd)}
              className="rounded-full border border-border-strong px-3 py-1 text-[13px] font-medium text-foreground-secondary transition-colors hover:bg-background-secondary"
            >
              {s.label}
            </button>
          ))}
        </div>
      </Step>

      <Step n={2} title="Your resume" done={Boolean(resume) || noResume}>
        <p className="mb-3 text-[14px] text-foreground-tertiary">
          {BRAND.tutor} asks about your real projects, just like an interviewer reading your resume would.
        </p>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              pick(e.dataTransfer.files[0]);
            }}
            className={cn(
              "flex items-center gap-3 rounded-2xl border-2 border-dashed px-5 py-4 text-left transition-colors",
              resume ? "border-foreground bg-background-secondary" : "border-border-strong hover:bg-background-secondary/60",
            )}
          >
            <span className="text-[20px]" aria-hidden="true">{resume ? "📄" : "⬆️"}</span>
            <span className="flex flex-col">
              <span className="text-[15px] font-semibold">{resume ? resume.name : "Upload resume (PDF)"}</span>
              <span className="text-[12.5px] text-foreground-tertiary">{resume ? "Tap to change" : "Read for this interview, never stored"}</span>
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              pick(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setNoResume(!noResume);
              setResume(null);
            }}
            className={cn(
              "rounded-2xl border px-4 py-4 text-[14px] font-medium transition-colors",
              noResume ? "border-foreground bg-background-secondary" : "border-border-strong text-foreground-secondary hover:bg-background-secondary",
            )}
          >
            {noResume ? "✓ " : ""}No resume: use what I told {BRAND.tutor}
          </button>
        </div>
      </Step>

      {error && <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => void start()}
          disabled={busy}
          className="flex items-center gap-2.5 rounded-xl bg-primary px-5 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-70"
        >
          {busy && <Orb size={18} speaking />}
          {busy ? "Reading the JD and your resume…" : "Prepare my interview call →"}
        </button>
        {!busy && <span className="text-[13px] text-foreground-quaternary">5 questions · voice call · ~8 minutes</span>}
      </div>
    </section>
  );
}

function Step({ n, title, done, children }: { n: number; title: string; done: boolean; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full font-mono text-[13px]",
          done ? "bg-primary text-white" : "border border-border-strong text-foreground-secondary",
        )}
      >
        {done ? "✓" : n}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <h2 className="mb-3 pt-1 text-[16px] font-semibold">{title}</h2>
        {children}
      </div>
    </div>
  );
}
