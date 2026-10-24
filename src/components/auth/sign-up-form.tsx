"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";
import { BRAND } from "@/lib/brand";

type Mode = "signup" | "login";

const COPY = {
  signup: {
    title: "Create your account",
    subtitle: `Free, and ${BRAND.tutor} is waiting for you.`,
    submit: "Get started",
    switchPrompt: "Already have an account?",
    switchAction: "Log in",
  },
  login: {
    title: "Welcome back",
    subtitle: `${BRAND.tutor} kept your seat warm.`,
    submit: "Log in",
    switchPrompt: "New here?",
    switchAction: "Create an account",
  },
} as const;

// Supabase messages are written for developers; these are for people.
function friendlyError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("already registered")) return "That email already has an account. Log in instead.";
  if (m.includes("invalid login")) return "That email and password don't match. Try again.";
  if (m.includes("email not confirmed")) return "Confirm your email first. The link is in your inbox.";
  if (m.includes("rate limit")) return "Too many tries. Wait a minute, then try again.";
  if (m.includes("password")) return "Use a password with at least 8 characters.";
  return "Something went wrong. Try again.";
}

export function SignUpForm({ next, initialError }: { next: string; initialError?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"email" | "google" | null>(null);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const copy = COPY[mode];

  const callbackUrl = () =>
    `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function withGoogle() {
    setError(null);
    setBusy("google");
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl() },
    });
    // On success the browser is already leaving for Google.
    if (error) {
      setError(friendlyError(error.message));
      setBusy(null);
    }
  }

  async function withEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError(null);
    if (password.length < 8) {
      setError("Use a password with at least 8 characters.");
      return;
    }
    setBusy("email");
    const supabase = createClient();
    const result =
      mode === "signup"
        ? await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: { emailRedirectTo: callbackUrl() },
          })
        : await supabase.auth.signInWithPassword({ email: email.trim(), password });

    if (result.error) {
      setError(friendlyError(result.error.message));
      setBusy(null);
      return;
    }
    // No session means the project requires email confirmation first.
    if (!result.data.session) {
      setSentTo(email.trim());
      setBusy(null);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  if (sentTo) {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.02em]">Check your inbox</h1>
        <p className="text-foreground-tertiary">
          We sent a confirmation link to <span className="font-medium text-foreground">{sentTo}</span>. Open
          it on this device and you&apos;ll go straight in.
        </p>
        <button
          type="button"
          onClick={() => setSentTo(null)}
          className="mt-2 self-start text-sm font-semibold text-foreground-secondary hover:text-foreground"
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-[30px] font-semibold leading-tight tracking-[-0.03em]">{copy.title}</h1>
        <p className="text-foreground-tertiary">{copy.subtitle}</p>
      </div>

      <div className="flex flex-col gap-5">
        <button
          type="button"
          onClick={withGoogle}
          disabled={busy !== null}
          className={cn(
            "flex h-11 w-full items-center justify-center gap-3 rounded-lg border border-border-strong bg-background",
            "text-[15px] font-semibold text-foreground-secondary shadow-xs transition-colors hover:bg-background-secondary",
            "disabled:cursor-not-allowed disabled:opacity-60",
          )}
        >
          {busy === "google" ? <Spinner /> : <GoogleMark />}
          Continue with Google
        </button>

        <div className="flex items-center gap-3 text-sm text-foreground-quaternary">
          <span className="h-px flex-1 bg-border" />
          or
          <span className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={withEmail} className="flex flex-col gap-4" noValidate>
          <Field
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={setEmail}
          />
          <Field
            label="Password"
            type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            placeholder={mode === "signup" ? "At least 8 characters" : "Your password"}
            value={password}
            onChange={setPassword}
          />

          {error && (
            <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy !== null || !email.trim() || !password}
            className={cn(
              "mt-1 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary",
              "text-[15px] font-semibold text-white transition-colors hover:bg-primary-hover",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            {busy === "email" && <Spinner light />}
            {copy.submit}
          </button>
        </form>
      </div>

      <p className="text-center text-sm text-foreground-tertiary">
        {copy.switchPrompt}{" "}
        <button
          type="button"
          onClick={() => {
            setMode(mode === "signup" ? "login" : "signup");
            setError(null);
          }}
          className="font-semibold text-foreground hover:underline"
        >
          {copy.switchAction}
        </button>
      </p>
    </div>
  );
}

function Field({
  label,
  type,
  autoComplete,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  type: string;
  autoComplete: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground-secondary">{label}</span>
      <input
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        className={cn(
          "h-11 rounded-lg border border-border-strong bg-background px-3.5 text-[15px] shadow-xs outline-none",
          "placeholder:text-foreground-quaternary focus:border-foreground-secondary focus:ring-4 focus:ring-border",
        )}
      />
    </label>
  );
}

function Spinner({ light = false }: { light?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "size-4 animate-spin rounded-full border-2",
        light ? "border-white/30 border-t-white" : "border-border-strong border-t-foreground",
      )}
    />
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5">
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.56-5.17 3.56-8.81Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.92l-3.88-3c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.29 14.28a7.2 7.2 0 0 1 0-4.56v-3.1H1.28a12 12 0 0 0 0 10.76l4.01-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44A11.5 11.5 0 0 0 12 0 12 12 0 0 0 1.28 6.62l4.01 3.1C6.23 6.88 8.88 4.77 12 4.77Z"
      />
    </svg>
  );
}
