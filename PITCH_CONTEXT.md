# Prompt for the pitch deck agent

You're building the pitch deck for **Ship or Skip**, a product our team built today at **AI Builders Day '26** (Airtribe, Bengaluru, Sat 24 Oct 2026), a 12-hour build-and-launch hackathon.

- **Track:** AI for Learning.
- **Judging:** demo and judging run from 19:30 to 21:00. Finalists pitch to VC partners from **Blume, Antler and Activate**.
- **Deck length:** 10–12 slides for a 3-minute pitch plus Q&A.
- **Honesty:** everything below is true as of 14:15 IST. Where a number isn't known yet, leave a clearly marked placeholder. **Never invent traction, market figures or quotes.** If you add a market or industry number, find a source and cite it on the slide (small footnote); otherwise leave it out.

---

## 1. The one-liner

**Ship or Skip teaches developers to judge the code AI writes for them.** You talk to Rev, an AI code buddy, by text or voice. Rev shows you code an AI wrote. You decide "Ship it" or "Skip it" and say why. Rev teaches you what you missed. You earn an **AI Code Judgement score out of 10** that a hiring manager can read at a glance.

## 2. The problem (our words)

AI now writes much of the code developers ship, but most developers were never taught to *judge* it, so hidden bugs, missed requirements and security holes slip into real products. Code-review skill used to come from years of senior feedback, which most learners in India never get.

**The story we tell (also the animation on our sign-up screen):**

- **Friday, 7:42 PM:** an AI agent opens a pull request: "Festive sale: 10% off on orders above ₹500". All 12 tests pass. You click **Approve**.
- **Saturday, 11:06 AM, #payments-alerts:**
  - average order value is down 87%;
  - 2,140 orders were charged only 10% of their price;
  - **₹18.6 lakh lost over the weekend**;
  - the CTO: "Who approved PR #482? @you".
- **The bug:** one character, `total * 0.1` instead of `total * 0.9`. The tests passed because the same AI wrote them.
- **The punchline: "AI wrote it. You approved it."** When it breaks, your name is on it.
- **The rewind:** Rev catches it in 30 seconds, before it ships.

(The ₹18.6 lakh is an illustrative scenario: 2,140 orders × about ₹870 lost each. Label it as a scenario, not a real incident.)

## 3. Why now

- AI coding assistants have made *writing* code cheap. The scarce skill is now *judging* it: knowing when to ship and when to push back.
- Existing platforms test whether you can *write* code (LeetCode-style DSA). Hiring signals built on that are weakening when AI can write the solution.
- Assessment tools for AI fluency are appearing. One the team noted is HackerRank's "Chakra" (reported launch 5 Oct 2026); **verify before citing**. Our angle: they *assess*, we *build* the skill, and the score comes from practice.

## 4. The product (built and working today)

**The flow, all inside one ChatGPT-style chat:**
1. **Sign up** (Google or email). The sign-up page tells the ₹18.6 lakh story as a short animated timeline.
2. **Onboarding with Rev, as cards in the chat:**
   1. "What are you doing right now?" (student, developer, switching into tech, working professional) as tap tiles, or typed;
   2. **resume upload** (a PDF; Gemini reads it directly and doesn't store it) or "I don't have one" → "what have you built?";
   3. **goals** (crack interviews, review AI code at work, write better code with AI, curious) as multi-select;
   4. "Let's start with a small problem" with a 3-step how-it-works card.
3. **A problem card:**
   - the request someone gave an AI, and the code the AI wrote (an editor-style card with a file tab, line numbers and copy);
   - big **🚢 Ship it / ✋ Skip it** buttons;
   - you then say *why*, typed or spoken.
4. **Up to 3 tries with nudges:** a wrong answer gets a Socratic nudge, never the answer (e.g. "Try a ₹1,000 order. What does the customer pay?"). After 3 misses, Rev teaches it.
5. **The result card:**
   - a score out of 10 (right call 3, named the issue 4, reasoning 2, first try 1);
   - the fix as a red and green diff;
   - "How a pro would say it" (a senior-style review comment);
   - the rule to keep.
6. **The progress card:** AI Code Judgement score, points, rank, problems solved, and a score graph. Then "Your profile is ready, tap your avatar."
7. **The profile:**
   - name, role, stack, goals, GitHub (the avatar comes from GitHub);
   - an **AI Code Judgement hero card** with score /10, band, a one-line meaning for hiring managers, and evidence (right-call %, named-issue %, first-try %, average tries);
   - a score graph and the list of problems;
   - Rev's AI-written summary: headline, strengths, gaps, next step.

**Voice: Rev talks.**
- Rev reads every message aloud using **Gemini Live**.
- Learners answer by tapping, typing, or pressing **Speak** (push-to-talk, transcribed by Gemini).
- An optional **"Call Rev"** mode is a full live voice conversation, with interruptions, where Rev runs the same flow by voice.

**The problem bank today:** 6 hand-written problems across JavaScript, Node/Express, Python, Java/Spring and React, at beginner, intermediate and advanced levels. Skills covered:
- checking the AI did what was asked;
- off-by-one at boundaries;
- missing input checks (OTP expiry);
- React effect dependencies;
- access control (an IDOR in a Spring controller).

One problem's code is correct, so "Ship it" is sometimes the right call. That matters: the skill is judgement, not suspicion.

## 5. The AI Code Judgement score (the hiring signal)

- **The calculation:** a difficulty-weighted average of the learner's **last 10** problems (beginner ×1, intermediate ×1.25, advanced ×1.5). It reflects current skill, and grinding easy problems can't inflate it.
- **Graded on our server** against a fixed answer key the AI voice never sees. Hints and extra tries lower the score.
- **Provisional until 3 problems,** so nobody is judged on one lucky answer.
- **Bands:** Learning (0–3.9) · Developing (4–5.9) · Solid (6–7.9) · Strong (8–8.9) · Exceptional (9–10).
- **Every number shows its evidence,** so a recruiter sees *why* someone is a 7.4.

## 6. How it's built (for a "technology" slide, keep it light)

- **App:** Next.js 16, TypeScript, Tailwind; Supabase (Postgres, auth, row-level security on every table).
- **AI:** Google Gemini only.
  - Gemini Flash-Lite reads resumes and grades answers;
  - **Gemini Live** is Rev's voice. The server mints a single-use, locked token, and the browser streams audio straight to Gemini.
- **Built for scale and integrity:**
  - **Answer keys and grading never leave the server,** so the AI voice can't leak answers.
  - **Hedged AI requests:** if one model is slow, the other is asked too, which cut grading from 12–30 s to about 4 s.
  - **Database guarantees:** one open problem per learner at a time, and atomic points updates.
  - **Per-user rate limits** on chat and voice.
  - **Voice sessions** close when idle, and fall back to the browser's voice if Gemini Live is busy.

## 7. Business model (proposed: present as a plan, not as validated)

- **Learners: free** to practise, with a public profile and score.
- **Hiring teams and recruiters** pay for verified AI-judgement scores and candidate shortlists.
- **Colleges and bootcamps** pay per cohort for practice plus dashboards.
- **Later:** company-specific problem packs (review code in *their* stack) for onboarding engineers.

## 8. Go-to-market (proposed)

- **Today:** onboard real users at the event (target: 20 people from outside the team).
- **Next:** college developer communities and clubs, LinkedIn shares of the score card (a public profile link is the next feature), and a weekly "Ship or Skip" challenge.
- **India-first:** a voice-first, chat-first experience familiar to anyone who has used ChatGPT.

## 9. Traction (fill in at the event; leave placeholders until then)

- [ ] Users signed up: **[__]**
- [ ] Completed onboarding: **[__]**
- [ ] Problems attempted / solved: **[__] / [__]**
- [ ] Average AI Code Judgement score: **[__]/10**
- [ ] % who caught the ₹500 discount bug on the first try: **[__]%**
- [ ] One real user quote: **"[__]"** (only if a user actually said it)

## 10. The ask / what's next

- **Next 30 days:**
  - a shareable public profile;
  - 50+ problems across stacks, AI-generated and verified;
  - a recruiter view;
  - pilots with 2–3 colleges and 1–2 hiring teams.
- **The ask:** leave as a placeholder **[__]** for the team to decide (e.g. pilot introductions, mentorship, or a pre-seed conversation).

## 11. Team

Leave placeholders: **[Name, role, one line each]** for 4 people.

---

## Deck structure (suggested; adjust if you have a better flow)

1. **Title:** Ship or Skip, with "Learn to judge the code AI writes for you."
2. **The hook:** the Friday → Saturday story with the ₹18.6 lakh moment. "AI wrote it. You approved it."
3. **The problem:** developers were taught to write code, not to judge AI's.
4. **Why now:** AI writes the code; judgement is the new scarce skill.
5. **The product:** Rev, a chat-and-voice code buddy (screenshots: onboarding cards and the problem card).
6. **How a session works:** request → AI code → Ship or Skip + why → nudge → teach → score.
7. **The score:** AI Code Judgement /10 with evidence (the profile hero card).
8. **Technology and integrity:** Gemini Live voice, server-side grading, built to scale.
9. **Business model and go-to-market.**
10. **Traction:** event numbers (placeholders).
11. **Roadmap and ask.**
12. **Team.**

## Visual style

- **Colours:** monochrome (white, greys, near-black `#0a0d12`). The **only colour** is Rev's orb: a soft swirling gradient of violet `#7f56d9`, blue `#2e90fa`, cyan `#06aed4` and pink `#ee46bc`. Use it sparingly as the accent.
- **Fonts:** **Inter** with slightly tight letter spacing for text; **Geist Mono** for code.
- **Feel:** premium, minimal, lots of white space, like a modern SaaS (Linear or Vercel). One idea per slide, big type, very little text.
- **The hook slide** may use the dark timeline style from our sign-up page: a dark background, three timestamped cards, and the ₹18.6 lakh figure in soft red `#f97066`.
- **Code** appears in an editor-style card: the file tab "pricing.js", line numbers, and the bad line `if (total > 500) return total * 0.1;` highlighted.
- Use placeholder boxes labelled **[Screenshot: …]** where real product screenshots go (onboarding tiles, problem card, result card, profile score card). We'll drop them in.

## What I need from you

1. The deck itself, in your best available deck format.
2. **Speaker notes** for each slide that fit a **3-minute** pitch in total (about 400 words).
3. A list of every placeholder the team must fill in before 19:30.
4. A short list of **likely judge questions**, each with a crisp, honest answer, based only on the facts above. Cover:
   - "How is this different from LeetCode or HackerRank?"
   - "How do you stop people gaming the score?"
   - "Who pays?"
   - "Why will people come back?"
   - "What does it cost to run?"
