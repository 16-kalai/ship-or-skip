import Link from "next/link";
import { Orb } from "@/components/orb";
import { CodeCard } from "@/components/chat/code-card";
import { StoryPanel } from "@/components/auth/story-panel";
import { Reveal } from "@/components/landing/reveal";
import { BRAND } from "@/lib/brand";

// The one-page landing: the shift, the pain, how it works, the features, and the call to start.
export default function LandingPage() {
  return (
    <main className="bg-background">
      <Nav />
      <Hero />
      <Shift />
      <Familiar />
      <HowItWorks />
      <Features />
      <Interview />
      <Score />
      <FinalCta />
      <Footer />
    </main>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1160px] items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-2.5 font-semibold">
          <Orb size={26} />
          {BRAND.name}
        </Link>
        <nav className="hidden items-center gap-7 text-[14.5px] text-foreground-tertiary md:flex">
          <a href="#how" className="hover:text-foreground">How it works</a>
          <a href="#features" className="hover:text-foreground">Features</a>
          <a href="#interview" className="hover:text-foreground">Mock interviews</a>
          <a href="#score" className="hover:text-foreground">Your score</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/signup" className="hidden rounded-full px-4 py-2 text-[14.5px] font-medium text-foreground-secondary hover:bg-background-secondary sm:block">
            Log in
          </Link>
          <Link href="/signup" className="rounded-full bg-primary px-4 py-2 text-[14.5px] font-semibold text-white hover:bg-primary-hover">
            Start free
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute -top-40 left-1/2 size-[720px] -translate-x-1/2 rounded-full opacity-[0.13] blur-[120px]"
        style={{ background: "conic-gradient(from 90deg, #7f56d9, #2e90fa, #06aed4, #ee46bc, #7f56d9)" }}
      />
      <div className="relative mx-auto grid max-w-[1160px] items-center gap-12 px-5 pb-20 pt-16 lg:grid-cols-[1.05fr_1fr] lg:pt-24">
        <Reveal>
          <span className="inline-flex items-center gap-2 rounded-full border border-border-strong bg-background px-3 py-1 text-[13px] font-medium text-foreground-secondary">
            <Orb size={14} speaking /> For developers in the AI era
          </span>
          <h1 className="mt-6 text-[44px] font-semibold leading-[1.04] tracking-[-0.045em] sm:text-[60px]">
            AI writes your code now.
            <br />
            <span className="text-foreground-quaternary">Can you tell when it&apos;s wrong?</span>
          </h1>
          <p className="mt-6 max-w-[540px] text-[18px] leading-relaxed text-foreground-tertiary">
            {BRAND.name} trains the one skill AI can&apos;t replace: judgement. Review AI-written code with {BRAND.tutor}, your AI
            code buddy, practise real interviews on a voice call, and know exactly where you stand before it counts.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/signup" className="rounded-full bg-primary px-6 py-3.5 text-[16px] font-semibold text-white transition-transform hover:-translate-y-0.5 hover:bg-primary-hover">
              Start practising, it&apos;s free →
            </Link>
            <Link href="/signup?next=/interview" className="rounded-full border border-border-strong px-6 py-3.5 text-[16px] font-semibold transition-colors hover:bg-background-secondary">
              Try a mock interview
            </Link>
          </div>
          <p className="mt-5 text-[13.5px] text-foreground-quaternary">Voice-first · Talk, type or tap · Scored out of 10</p>
        </Reveal>
        <Reveal delay={150}>
          <div className="h-[620px] overflow-hidden rounded-[28px] shadow-[0_30px_80px_-30px_rgba(10,13,18,0.45)]">
            <StoryPanel />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

const SHIFTS = [
  {
    title: "AI writes the first draft",
    body: "Copilot, Cursor, ChatGPT: most code now starts as an AI suggestion. Your real job is deciding what ships.",
  },
  {
    title: "Interviews are catching up",
    body: "Companies are starting to test how you work with AI: reviewing its code, catching its mistakes, explaining your call.",
  },
  {
    title: "Judgement is the new seniority",
    body: "Anyone can generate code. The people who get hired, and trusted, are the ones who know when it's wrong.",
  },
];

function Shift() {
  return (
    <section className="border-y border-border bg-background-secondary/50">
      <div className="mx-auto max-w-[1160px] px-5 py-20">
        <Reveal>
          <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-foreground-quaternary">The shift</p>
          <h2 className="mt-3 max-w-[720px] text-[36px] font-semibold leading-[1.1] tracking-[-0.035em] sm:text-[44px]">
            The job changed while you were still learning it.
          </h2>
        </Reveal>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {SHIFTS.map((s, i) => (
            <Reveal key={s.title} delay={i * 120}>
              <div className="h-full rounded-3xl border border-border bg-background p-6 transition-transform hover:-translate-y-1">
                <span className="font-mono text-[13px] text-foreground-quaternary">0{i + 1}</span>
                <h3 className="mt-3 text-[20px] font-semibold tracking-[-0.02em]">{s.title}</h3>
                <p className="mt-2 text-[15.5px] leading-relaxed text-foreground-tertiary">{s.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

const QUOTES = [
  "I accepted the suggestion because it looked right.",
  "I can build anything with AI… until the interviewer asks me why.",
  "The tests passed. Then production didn't.",
  "I won't know if I'm ready until the rejection email arrives.",
];

function Familiar() {
  return (
    <section className="mx-auto max-w-[1160px] px-5 py-20">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <Reveal>
          <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-foreground-quaternary">Sound familiar?</p>
          <h2 className="mt-3 text-[36px] font-semibold leading-[1.1] tracking-[-0.035em] sm:text-[44px]">
            You&apos;re not bad at coding. Nobody taught you to judge it.
          </h2>
          <p className="mt-5 text-[17px] leading-relaxed text-foreground-tertiary">
            Code review used to come from years of a senior looking over your shoulder. Most of us never got that. Now the
            code comes from AI, and the senior is you.
          </p>
        </Reveal>
        <div className="flex flex-col gap-3">
          {QUOTES.map((q, i) => (
            <Reveal key={q} delay={i * 110} className={i % 2 ? "self-end" : "self-start"}>
              <p className="max-w-[440px] rounded-3xl bg-background-secondary px-5 py-3.5 text-[16px] ring-1 ring-border">&ldquo;{q}&rdquo;</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  { title: "Judge", body: "Rev shows you code an AI wrote. Ship it or skip it, and say why." },
  { title: "Learn", body: "Wrong? You get a nudge, not the answer. Three tries, then Rev teaches it." },
  { title: "Interview", body: "Give Rev a JD and your resume. Then a real mock interview on a voice call." },
  { title: "Know where you stand", body: "A score out of 10, your rank, and exactly what to fix before the real one." },
];

function HowItWorks() {
  return (
    <section id="how" className="bg-primary text-white">
      <div className="mx-auto max-w-[1160px] px-5 py-20">
        <Reveal>
          <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-white/45">How it works</p>
          <h2 className="mt-3 max-w-[720px] text-[36px] font-semibold leading-[1.1] tracking-[-0.035em] sm:text-[44px]">
            Practise like it&apos;s the real job. Because soon it will be.
          </h2>
        </Reveal>
        <div className="mt-12 grid gap-px overflow-hidden rounded-3xl bg-white/10 md:grid-cols-4">
          {STEPS.map((s, i) => (
            <Reveal key={s.title} delay={i * 120} className="h-full">
              <div className="flex h-full flex-col gap-3 bg-primary p-6">
                <span className="flex size-9 items-center justify-center rounded-full bg-white font-mono text-[14px] font-semibold text-[#0a0d12]">
                  {i + 1}
                </span>
                <h3 className="mt-2 text-[20px] font-semibold">{s.title}</h3>
                <p className="text-[15px] leading-relaxed text-white/65">{s.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

const FEATURES = [
  { icon: "🎙", title: `${BRAND.tutor}, your AI code buddy`, body: "Speaks every message out loud. Type, tap, or just talk back. Learning feels like a conversation, not a test." },
  { icon: "📈", title: "Problems that climb with you", body: "Your first ten are easy fundamentals. Then medium, then hard, in your own stack." },
  { icon: "🧠", title: "Code and logic", body: "Buggy code, wrong AI reasoning, bad estimates. The mistakes real AI makes at work." },
  { icon: "💡", title: "Nudges, not answers", body: "Like a good mentor: a hint that makes you think, then the fix and the rule to keep." },
  { icon: "📞", title: "Mock interviews on a live call", body: "From your JD and resume: questions on screen, real follow-ups, a live transcript." },
  { icon: "🏆", title: "Your score and rank", body: "An AI Code Judgement score out of 10, with the evidence behind it, and where you rank." },
];

function Features() {
  return (
    <section id="features" className="mx-auto max-w-[1160px] px-5 py-20">
      <Reveal>
        <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-foreground-quaternary">Features</p>
        <h2 className="mt-3 max-w-[760px] text-[36px] font-semibold leading-[1.1] tracking-[-0.035em] sm:text-[44px]">
          Everything you need to get good at the part AI can&apos;t do.
        </h2>
      </Reveal>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f, i) => (
          <Reveal key={f.title} delay={(i % 3) * 110}>
            <div className="group h-full rounded-3xl border border-border bg-background p-6 transition-all hover:-translate-y-1 hover:shadow-[0_20px_40px_-24px_rgba(10,13,18,0.25)]">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-background-secondary text-[22px] ring-1 ring-border transition-transform group-hover:scale-110">
                {f.icon}
              </span>
              <h3 className="mt-4 text-[18px] font-semibold tracking-[-0.015em]">{f.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-foreground-tertiary">{f.body}</p>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal className="mt-14">
        <div className="grid items-center gap-10 rounded-[28px] border border-border bg-background-secondary/50 p-6 sm:p-10 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-foreground-quaternary">Try one now</p>
            <h3 className="mt-3 text-[30px] font-semibold leading-tight tracking-[-0.03em]">
              &ldquo;Free delivery on orders of ₹499 or more.&rdquo; Would you ship this?
            </h3>
            <p className="mt-4 text-[16px] text-foreground-tertiary">
              Not all AI code is wrong. Knowing when it&apos;s <em>right</em> is half the skill.
            </p>
            <Link href="/signup" className="mt-6 inline-block rounded-full bg-primary px-5 py-3 text-[15px] font-semibold text-white hover:bg-primary-hover">
              Make the call →
            </Link>
          </div>
          <CodeCard
            filename="delivery.js"
            code={`function deliveryFee(orderTotal) {\n  const FREE_DELIVERY_FROM = 499;\n  return orderTotal >= FREE_DELIVERY_FROM ? 0 : 40;\n}`}
          />
        </div>
      </Reveal>
    </section>
  );
}

function Interview() {
  return (
    <section id="interview" className="border-y border-border bg-background-secondary/50">
      <div className="mx-auto grid max-w-[1160px] items-center gap-12 px-5 py-20 lg:grid-cols-2">
        <Reveal>
          <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-foreground-quaternary">Mock interviews</p>
          <h2 className="mt-3 text-[36px] font-semibold leading-[1.1] tracking-[-0.035em] sm:text-[44px]">
            Walk into the interview already knowing your score.
          </h2>
          <ul className="mt-6 flex flex-col gap-3 text-[16px] text-foreground-secondary">
            {[
              "Paste the job description and upload your resume.",
              "Get on a voice call with Rev: questions appear on screen as they're asked.",
              "Real follow-ups on your own projects, an AI-written pull request, and a twist.",
              "A readiness score out of 10, and a stronger answer for every question.",
            ].map((t) => (
              <li key={t} className="flex gap-3">
                <span className="mt-1 text-[#067647]">✓</span>
                {t}
              </li>
            ))}
          </ul>
          <Link href="/signup?next=/interview" className="mt-8 inline-block rounded-full bg-primary px-5 py-3 text-[15px] font-semibold text-white hover:bg-primary-hover">
            Practise an interview →
          </Link>
        </Reveal>
        <Reveal delay={150}>
          <div className="overflow-hidden rounded-[28px] border border-border bg-background shadow-[0_30px_80px_-40px_rgba(10,13,18,0.4)]">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <span className="text-[14px] font-semibold">Backend Engineer · Swiftcart</span>
              <span className="flex items-center gap-2 rounded-full bg-[#fef3f2] px-3 py-1 text-[12.5px] font-semibold text-[#b42318]">
                <span className="size-2 animate-pulse rounded-full bg-[#f04438]" /> Live · 03:12
              </span>
            </div>
            <div className="grid sm:grid-cols-[1.3fr_1fr]">
              <div className="border-b border-border p-5 sm:border-b-0 sm:border-r">
                <p className="font-mono text-[11.5px] text-foreground-quaternary">QUESTION 2 OF 5 · YOUR WORK</p>
                <p className="mt-2 text-[18px] font-semibold leading-snug tracking-[-0.02em]">Scaling your food delivery backend</p>
                <div className="mt-3 rounded-xl bg-background-secondary px-3 py-2 text-[13px] ring-1 ring-border">
                  <span className="font-semibold text-foreground-quaternary">FROM YOUR RESUME · </span>
                  Built a Node and Postgres backend handling 2k orders a day
                </div>
              </div>
              <div className="flex flex-col gap-2.5 p-5 text-[13.5px]">
                <p className="text-[12px] font-semibold text-foreground-quaternary">LIVE TRANSCRIPT</p>
                <p>
                  <span className="font-semibold">Rev: </span>What broke first when orders doubled?
                </p>
                <p className="text-foreground-secondary">
                  <span className="font-semibold">You: </span>The order status updates. We were polling the DB every second…
                </p>
                <p>
                  <span className="font-semibold">Rev: </span>Why polling, and what would you change?
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 border-t border-border px-5 py-3">
              <Orb size={30} speaking />
              <span className="text-[14px] font-medium">Rev is listening…</span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Score() {
  return (
    <section id="score" className="mx-auto max-w-[1160px] px-5 py-20">
      <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
        <Reveal>
          <div className="overflow-hidden rounded-[28px] bg-primary p-7 text-white shadow-[0_30px_80px_-30px_rgba(10,13,18,0.5)] sm:p-9">
            <p className="text-[12.5px] font-medium uppercase tracking-[0.1em] text-white/55">AI Code Judgement</p>
            <p className="mt-2 flex items-baseline gap-1.5">
              <span className="text-[72px] font-semibold leading-none tracking-[-0.05em]">7.4</span>
              <span className="text-[24px] text-white/50">/10</span>
            </p>
            <span className="mt-3 inline-block rounded-full bg-white px-3 py-1 text-[13.5px] font-semibold text-[#0a0d12]">Solid</span>
            <p className="mt-5 text-[16px] text-white/80">Catches common flaws in AI-written code; sometimes needs a nudge on subtler ones.</p>
            <div className="mt-6 grid grid-cols-4 gap-4 border-t border-white/10 pt-5">
              {[
                ["86%", "Right calls"],
                ["71%", "Named the issue"],
                ["57%", "First try"],
                ["#12", "Rank"],
              ].map(([v, l]) => (
                <div key={l}>
                  <p className="text-[20px] font-semibold">{v}</p>
                  <p className="text-[12px] text-white/50">{l}</p>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
        <Reveal delay={150}>
          <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-foreground-quaternary">Your score</p>
          <h2 className="mt-3 text-[36px] font-semibold leading-[1.1] tracking-[-0.035em] sm:text-[44px]">
            One number a hiring manager understands in a second.
          </h2>
          <p className="mt-5 text-[17px] leading-relaxed text-foreground-tertiary">
            Your AI Code Judgement score is the difficulty-weighted average of your recent reviews, graded against a fixed
            answer key. Hints and extra tries count. The evidence sits right underneath: right calls, issues named, first-try
            rate. It&apos;s earned, not claimed.
          </p>
          <p className="mt-3 text-[13.5px] text-foreground-quaternary">Example card shown. Yours is built from your own practice.</p>
        </Reveal>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="px-5 pb-20">
      <Reveal>
        <div className="relative mx-auto max-w-[1160px] overflow-hidden rounded-[32px] bg-primary px-6 py-16 text-center text-white sm:px-12">
          <div
            aria-hidden="true"
            className="absolute left-1/2 top-1/2 size-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-25 blur-[110px]"
            style={{ background: "conic-gradient(from 90deg, #7f56d9, #2e90fa, #06aed4, #ee46bc, #7f56d9)" }}
          />
          <div className="relative flex flex-col items-center gap-6">
            <Orb size={64} speaking />
            <h2 className="max-w-[720px] text-[38px] font-semibold leading-[1.08] tracking-[-0.04em] sm:text-[52px]">
              Know where you stand before the interview does.
            </h2>
            <p className="max-w-[520px] text-[17px] text-white/65">
              Two minutes to your first problem. Free. Rev is waiting.
            </p>
            <Link href="/signup" className="rounded-full bg-white px-7 py-3.5 text-[16px] font-semibold text-[#0a0d12] transition-transform hover:-translate-y-0.5">
              Start practising →
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-[1160px] flex-wrap items-center justify-between gap-4 px-5 py-8 text-[13.5px] text-foreground-quaternary">
        <span className="flex items-center gap-2 font-semibold text-foreground">
          <Orb size={20} />
          {BRAND.name}
        </span>
        <span>Learn to judge the code AI writes for you. Built at AI Builders Day &apos;26, Bengaluru.</span>
      </div>
    </footer>
  );
}
