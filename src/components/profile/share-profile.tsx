"use client";

import { useState, useTransition } from "react";
import { shareProfile, stopSharing } from "@/app/profile/actions";
import { BRAND } from "@/lib/brand";

// Share: makes the profile public and offers the link to copy or post (LinkedIn, WhatsApp, X).
export function ShareProfile({ initialUrl, name, score }: { initialUrl: string | null; name: string; score: number | null }) {
  const [url, setUrl] = useState(initialUrl);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const message = score !== null
    ? `My AI Code Judgement score on ${BRAND.name} is ${score.toFixed(1)}/10. AI writes the code now; I practise catching what it gets wrong.`
    : `I'm practising how to judge AI-written code on ${BRAND.name}.`;

  function onShare() {
    setError(null);
    if (url) return setOpen(!open);
    startTransition(async () => {
      const result = await shareProfile();
      if ("error" in result) return setError(result.error);
      setUrl(result.url);
      setOpen(true);
    });
  }

  const enc = encodeURIComponent;
  const targets = url
    ? [
        { label: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}` },
        { label: "WhatsApp", href: `https://wa.me/?text=${enc(`${message} ${url}`)}` },
        { label: "X", href: `https://twitter.com/intent/tweet?text=${enc(message)}&url=${enc(url)}` },
      ]
    : [];

  return (
    <div className="relative sm:self-start">
      <button
        type="button"
        onClick={onShare}
        disabled={pending}
        aria-expanded={open}
        className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-70"
      >
        <ShareIcon />
        {pending ? "Creating your link…" : "Share profile"}
      </button>
      {error && <p className="mt-2 text-[13px] text-danger">{error}</p>}
      {open && url && (
        <div className="absolute right-0 z-20 mt-2 w-[340px] max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-background p-4 shadow-[0_20px_40px_-16px_rgba(10,13,18,0.25)]">
          <p className="text-[14px] font-semibold">Your public profile</p>
          <p className="mt-0.5 text-[12.5px] text-foreground-tertiary">
            Anyone with the link sees your score, skills and problems. Never your answers or email.
          </p>
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-border-strong bg-background-secondary px-3 py-2">
            <span className="min-w-0 flex-1 truncate font-mono text-[12.5px]">{url}</span>
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(url).catch(() => {});
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="shrink-0 text-[13px] font-semibold hover:underline"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {targets.map((t) => (
              <a
                key={t.label}
                href={t.href}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl border border-border-strong px-3 py-2 text-center text-[13.5px] font-medium hover:bg-background-secondary"
              >
                {t.label}
              </a>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-[13px]">
            <a href={url} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline">
              View as others see it ↗
            </a>
            <button
              type="button"
              onClick={() =>
                startTransition(async () => {
                  await stopSharing();
                  setUrl(null);
                  setOpen(false);
                })
              }
              className="text-foreground-tertiary hover:text-danger"
            >
              Stop sharing
            </button>
          </div>
          <p className="mt-2 text-[12px] text-foreground-quaternary">{name}, your link stays the same if you share again.</p>
        </div>
      )}
    </div>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
    </svg>
  );
}
