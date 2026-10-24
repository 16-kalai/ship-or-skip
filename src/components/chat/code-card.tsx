"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

const KEYWORDS = new Set(
  (
    "function const let var return if else for while async await new class import from export default " +
    "def elif in not and or None True False self public private protected static final void throws " +
    "true false null undefined typeof this"
  ).split(" "),
);

// Strings, comments, numbers, words: enough to make AI code readable at a glance.
const TOKEN = /(\/\/.*$|#.*$|"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|`(?:\\.|[^`])*`|\b\d+(?:\.\d+)?\b|@\w+|\b[A-Za-z_]\w*\b)/gm;

function highlight(line: string) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const match of line.matchAll(TOKEN)) {
    const [token] = match;
    const at = match.index ?? 0;
    if (at > last) parts.push(line.slice(last, at));
    let cls = "";
    if (token.startsWith("//") || (token.startsWith("#") && !token.startsWith("#{"))) cls = "text-[#717680] italic";
    else if (/^["'`]/.test(token)) cls = "text-[#067647]";
    else if (/^\d/.test(token)) cls = "text-[#b54708]";
    else if (token.startsWith("@")) cls = "text-[#b54708]";
    else if (KEYWORDS.has(token)) cls = "text-[#6941c6]";
    parts.push(
      cls ? (
        <span key={at} className={cls}>
          {token}
        </span>
      ) : (
        token
      ),
    );
    last = at + token.length;
  }
  if (last < line.length) parts.push(line.slice(last));
  return parts;
}

// AI-written code, shown like a file in an editor: tab, line numbers, copy button.
export function CodeCard({
  filename,
  code,
  tone,
}: {
  filename: string;
  code: string;
  // Diff lines in a fix ("-" removed, "+" added) get a tinted background.
  tone?: "diff";
}) {
  const [copied, setCopied] = useState(false);
  const lines = code.split("\n");
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background shadow-xs">
      <div className="flex items-center justify-between border-b border-border bg-background-secondary/60 px-3 py-2">
        <span className="rounded-md bg-background px-2.5 py-1 font-mono text-[12.5px] font-medium text-foreground-secondary shadow-xs ring-1 ring-border">
          {filename}
        </span>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(code).catch(() => {});
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[13px] text-foreground-tertiary hover:bg-background hover:text-foreground"
        >
          <CopyIcon />
          {copied ? "Copied" : "Copy code"}
        </button>
      </div>
      <pre className="overflow-x-auto py-3 font-mono text-[13.5px] leading-[1.7]">
        {lines.map((line, i) => {
          const mark = tone === "diff" ? line[0] : null;
          return (
            <div
              key={i}
              className={cn(
                "flex px-4",
                mark === "-" && "bg-[#fef3f2] text-[#b42318]",
                mark === "+" && "bg-[#ecfdf3] text-[#067647]",
              )}
            >
              <span className="w-8 shrink-0 select-none pr-3 text-right text-foreground-quaternary/70">
                {tone === "diff" ? mark : i + 1}
              </span>
              <code className="whitespace-pre">{tone === "diff" ? line.slice(2) : highlight(line)}</code>
            </div>
          );
        })}
      </pre>
    </div>
  );
}

export function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V6a2 2 0 0 1 2-2h9" />
    </svg>
  );
}
