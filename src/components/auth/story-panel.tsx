import { Orb } from "@/components/orb";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/cn";

// Why this matters, as one timeline: you approve an AI pull request on Friday, it costs lakhs by
// Saturday, then the rewind where Rev catches it in 30 seconds. Steps rise in once, in order, and
// stay. The numbers add up: 2,140 orders × ~₹870 lost ≈ ₹18.6 lakh.
export function StoryPanel() {
  return (
    <div className="relative flex h-full flex-col justify-between gap-8 overflow-hidden bg-[#0a0d12] px-14 py-11 text-white [@media(max-height:840px)]:gap-4 [@media(max-height:840px)]:py-7">
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.09) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
        }}
      />
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-[45%] size-[440px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.16] blur-[120px]"
        style={{ background: "conic-gradient(from 90deg, #7f56d9, #2e90fa, #06aed4, #ee46bc, #7f56d9)" }}
      />

      <div className="relative flex items-center gap-2.5 font-semibold">
        <Orb size={24} />
        {BRAND.name}
      </div>

      <ol className="relative mx-auto flex w-full max-w-[480px] flex-col" aria-hidden="true">
        <Step at={0.4} time="Fri · 7:42 PM" tone="neutral">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[14.5px] font-medium">Festive sale: 10% off above ₹500</p>
            <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-white/55">
              <SparkIcon /> AI agent
            </span>
          </div>
          <CodeRow className="mt-2.5 bg-[#17b26a]/[0.10]">
            <span className="text-white/30">+ </span>if (total &gt; 500) <Kw>return</Kw> total * 0.1;
          </CodeRow>
          <div className="story-step mt-2.5 flex items-center gap-2 text-[13px] text-white/60" style={{ animationDelay: "1.4s" }}>
            <CheckIcon className="text-[#75e0a7]" />
            12 tests passed · <span className="font-semibold text-white">Approved by you</span>
          </div>
        </Step>

        <Step at={2.8} time="Sat · 11:06 AM" tone="danger">
          <p className="text-[13px] text-white/50">#payments-alerts</p>
          <p className="mt-1 flex items-baseline gap-2">
            <span className="text-[26px] font-semibold tracking-[-0.03em] text-[#f97066]">₹18.6 lakh</span>
            <span className="text-[14px] text-white/70">lost over the weekend</span>
          </p>
          <p className="text-[13.5px] text-white/60">2,140 orders were charged just 10% of their price.</p>
          <div
            className="story-step mt-3 flex items-center gap-2.5 border-t border-white/[0.07] pt-3 text-[14px]"
            style={{ animationDelay: "4s" }}
          >
            <span className="flex size-6 items-center justify-center rounded-md bg-white/10 text-[11px] font-semibold">
              M
            </span>
            <span className="text-white/55">CTO:</span>
            <span className="text-white/90">Who approved PR #482?</span>
            <span className="rounded bg-white/10 px-1.5 py-0.5 text-[13px] font-medium">@you</span>
          </div>
        </Step>

        <Step at={5.4} time={`Rewind · with ${BRAND.tutor}`} tone="good" last>
          <div className="flex gap-3">
            <Orb size={24} speaking className="mt-0.5" />
            <p className="text-[14.5px] leading-relaxed text-white/90">
              Hold on. <Code>total * 0.1</Code> charges 10% of the price, it doesn&apos;t take 10% off. You meant{" "}
              <Code>total * 0.9</Code>.
            </p>
          </div>
          <div className="story-step mt-3" style={{ animationDelay: "6.6s" }}>
            <span className="inline-flex items-center gap-2 rounded-full border border-[#75e0a7]/25 bg-[#17b26a]/10 px-3 py-1 text-[13px] text-[#a6f4c5]">
              <CheckIcon className="text-[#75e0a7]" />
              Caught in 30 seconds, before it shipped
            </span>
          </div>
        </Step>
      </ol>

      <div className="relative">
        <h2 className="text-[42px] font-semibold leading-[1.05] tracking-[-0.04em] [@media(max-height:840px)]:text-[34px]">
          AI wrote it.
          <br />
          <span className="text-white/45">You approved it.</span>
        </h2>
        <p className="mt-3 max-w-[440px] text-[16.5px] text-white/60 [@media(max-height:840px)]:hidden">
          When it breaks, your name is on it. Practise catching AI&apos;s mistakes with {BRAND.tutor}, before they
          cost real money.
        </p>
      </div>
    </div>
  );
}

const TONES = {
  neutral: "bg-white/40",
  danger: "bg-[#f04438] shadow-[0_0_12px_2px_rgba(240,68,56,0.55)]",
  good: "bg-[#17b26a] shadow-[0_0_12px_2px_rgba(23,178,106,0.5)]",
} as const;

// One moment on the timeline: a time label and dot on the left, the card on the right.
function Step({
  at,
  time,
  tone,
  last = false,
  children,
}: {
  // Seconds after load when this step rises in.
  at: number;
  time: string;
  tone: keyof typeof TONES;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="story-step relative flex gap-4" style={{ animationDelay: `${at}s` }}>
      <div className="flex w-3 shrink-0 flex-col items-center pt-[7px]">
        <span className={cn("size-2.5 rounded-full", TONES[tone])} />
        {!last && <span className="mt-2 w-px flex-1 bg-white/10" />}
      </div>
      <div className={cn("min-w-0 flex-1", !last && "pb-5 [@media(max-height:840px)]:pb-3")}>
        <p className="mb-2 font-mono text-[11.5px] uppercase tracking-[0.08em] text-white/40">{time}</p>
        <div className="rounded-xl border border-white/10 bg-[#12161d]/90 px-4 py-3.5 backdrop-blur [@media(max-height:840px)]:py-2.5">{children}</div>
      </div>
    </li>
  );
}

function Kw({ children }: { children: React.ReactNode }) {
  return <span className="text-[#c4b5fd]">{children}</span>;
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-white/10 px-1 py-0.5 font-mono text-[13px] text-white">{children}</code>;
}

function CodeRow({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("whitespace-pre rounded-md px-3 py-1.5 font-mono text-[12.5px] text-white/85", className)}>
      {children}
    </div>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("size-3.5 shrink-0", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12.5 10 17 19 7" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-3" fill="currentColor">
      <path d="M12 2l1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9z" />
    </svg>
  );
}
