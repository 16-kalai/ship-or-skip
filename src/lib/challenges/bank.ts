import type { PublicProblem } from "@/lib/challenges/types";

// Server only: never import from client components. Each problem's answer key is here.
export type Problem = PublicProblem & {
  level: "beginner" | "intermediate" | "advanced";
  // "logic": the AI answered a reasoning question; the learner judges the answer, not code.
  kind?: "code" | "logic";
  // The onboarding area this problem practises (generated problems set it).
  area?: string;
  // Stack words that make this a good match (compared against the learner's stack, lowercase).
  matches: string[];
  answer: "ship" | "skip";
  // What's wrong (or, for "ship", why it's right), for the grader. Never shown before grading.
  flaw: string;
  fix: { before: string; after: string } | null;
  rule: string;
  hint: string;
};

export const PROBLEMS: Problem[] = [
  {
    id: "festive-discount",
    title: "Festive sale discount",
    skill: "Checking AI does what was asked",
    level: "beginner",
    matches: ["javascript", "js", "node", "react", "typescript", "next"],
    language: "javascript",
    filename: "pricing.js",
    request: "Festive sale: give 10% off on orders above ₹500.",
    code: `function finalPrice(total) {
  if (total > 500) {
    return total * 0.1;
  }
  return total;
}`,
    answer: "skip",
    flaw: "Line 3 returns total * 0.1, which charges only 10% of the price instead of taking 10% off. A ₹1,000 order would cost ₹100 instead of ₹900. It should be total * 0.9.",
    fix: { before: "return total * 0.1;", after: "return total * 0.9;" },
    rule: "Test AI code with one real number from the request before you trust it.",
    hint: "Try it with a ₹1,000 order. What does the customer pay?",
  },
  {
    id: "free-delivery",
    title: "Free delivery threshold",
    skill: "Checking AI does what was asked",
    level: "beginner",
    matches: ["javascript", "js", "node", "react", "typescript"],
    language: "javascript",
    filename: "delivery.js",
    request: "Free delivery on orders of ₹499 or more. Otherwise delivery is ₹40.",
    code: `function deliveryFee(orderTotal) {
  const FREE_DELIVERY_FROM = 499;
  return orderTotal >= FREE_DELIVERY_FROM ? 0 : 40;
}`,
    answer: "ship",
    flaw: "The code is correct: '₹499 or more' is exactly orderTotal >= 499, it returns 0 for free delivery and 40 otherwise. Checking the boundary (499 gets free delivery, 498 pays 40) shows it matches the request.",
    fix: null,
    rule: "Not all AI code is wrong. Check the boundary from the request, and ship it when it holds.",
    hint: "Check the exact boundary: what happens at ₹499, and at ₹498?",
  },
  {
    id: "pagination-offset",
    title: "Paginated product list",
    skill: "Off-by-one at the boundaries",
    level: "intermediate",
    matches: ["python", "django", "flask", "fastapi", "sql", "postgres"],
    language: "python",
    filename: "products.py",
    request: "Paginate products, 20 per page. Page 1 shows the first 20.",
    code: `PAGE_SIZE = 20

def get_page(products, page):
    start = page * PAGE_SIZE
    end = start + PAGE_SIZE
    return products[start:end]`,
    answer: "skip",
    flaw: "Line 4 uses page * PAGE_SIZE, so page 1 starts at item 20 and the first 20 products are never shown. It should be (page - 1) * PAGE_SIZE.",
    fix: { before: "start = page * PAGE_SIZE", after: "start = (page - 1) * PAGE_SIZE" },
    rule: "Walk through the first page by hand. Off-by-one bugs live at the boundaries.",
    hint: "Which products does page 1 return?",
  },
  {
    id: "otp-expiry",
    title: "OTP login",
    skill: "Missing input checks",
    level: "intermediate",
    matches: ["node", "express", "javascript", "typescript", "nest", "backend"],
    language: "javascript",
    filename: "auth.js",
    request: "Verify the login OTP. OTPs expire after 5 minutes and can only be used once.",
    code: `app.post("/login/verify", async (req, res) => {
  const { phone, otp } = req.body;
  const record = await db.otps.findOne({ phone });
  if (!record || record.code !== otp) {
    return res.status(401).json({ error: "Invalid OTP" });
  }
  await db.otps.deleteOne({ phone });
  res.json({ token: signToken(phone) });
});`,
    answer: "skip",
    flaw: "It never checks expiry: the request says OTPs expire after 5 minutes, but there's no check of record.expiresAt (or createdAt), so an old OTP still logs you in. Single use is handled by the delete.",
    fix: {
      before: "if (!record || record.code !== otp) {",
      after: "if (!record || record.code !== otp || record.expiresAt < Date.now()) {",
    },
    rule: "Turn the request into a checklist and tick every item. AI often drops one.",
    hint: "The request has two rules. Find where each one is enforced.",
  },
  {
    id: "react-search",
    title: "Live search box",
    skill: "Checking AI does what was asked",
    level: "intermediate",
    matches: ["react", "next", "nextjs", "javascript", "typescript", "frontend"],
    language: "tsx",
    filename: "Search.tsx",
    request: "Show search results as the user types.",
    code: `function Search() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);

  useEffect(() => {
    fetch(\`/api/search?q=\${query}\`)
      .then((res) => res.json())
      .then(setResults);
  }, []);

  return <input value={query} onChange={(e) => setQuery(e.target.value)} />;
}`,
    answer: "skip",
    flaw: "The effect's dependency array is empty ([]), so it only fetches once on mount with an empty query. Typing never triggers a new search. It needs [query] as the dependency.",
    fix: { before: "}, []);", after: "}, [query]);" },
    rule: "Ask when the code runs, not just what it does.",
    hint: "When does this effect run again after the first render?",
  },
  {
    id: "order-ownership",
    title: "Get order by ID",
    skill: "Access control",
    level: "advanced",
    matches: ["java", "spring", "kotlin", "backend"],
    language: "java",
    filename: "OrderController.java",
    request: "Logged-in customers can view their own order details by order ID.",
    code: `@GetMapping("/orders/{id}")
public OrderDto getOrder(@PathVariable Long id,
                         @AuthenticationPrincipal User user) {
    Order order = orderRepository.findById(id)
        .orElseThrow(() -> new NotFoundException("Order not found"));
    return OrderDto.from(order);
}`,
    answer: "skip",
    flaw: "It never checks that the order belongs to the logged-in user. Any customer can read anyone's order by changing the ID (an IDOR). It should look up by id and user, or compare order.getUserId() with user.getId().",
    fix: {
      before: "Order order = orderRepository.findById(id)",
      after: "Order order = orderRepository.findByIdAndUserId(id, user.getId())",
    },
    rule: "AI checks that a thing exists, and forgets to check who's asking.",
    hint: "The method receives the user. Is it used?",
  },

  // ── Easy fundamentals (the first ten problems come from here) ──────────────────────────────
  {
    id: "even-check",
    title: "Is it even?",
    skill: "Checking AI does what was asked",
    level: "beginner",
    matches: ["javascript", "js", "node", "react", "typescript"],
    language: "javascript",
    filename: "numbers.js",
    request: "Return true if a number is even.",
    code: `function isEven(n) {
  return n % 2 === 1;
}`,
    answer: "skip",
    flaw: "n % 2 === 1 is true for ODD numbers, so isEven(4) returns false and isEven(3) returns true. It should be n % 2 === 0.",
    fix: { before: "return n % 2 === 1;", after: "return n % 2 === 0;" },
    rule: "Run the function in your head with one easy input, like 4.",
    hint: "What does isEven(4) return?",
  },
  {
    id: "average-marks",
    title: "Average marks",
    skill: "Checking AI does what was asked",
    level: "beginner",
    matches: ["python", "django", "flask", "fastapi"],
    language: "python",
    filename: "marks.py",
    request: "Return the average of a student's marks. Decimals are fine, e.g. 72.5.",
    code: `def average(marks):
    return sum(marks) // len(marks)`,
    answer: "skip",
    flaw: "// is integer (floor) division in Python, so average([70, 75]) returns 72 instead of 72.5. It should use / for true division.",
    fix: { before: "return sum(marks) // len(marks)", after: "return sum(marks) / len(marks)" },
    rule: "Check the example in the request. It's there for a reason.",
    hint: "What does average([70, 75]) return?",
  },
  {
    id: "highest-temperature",
    title: "Highest temperature",
    skill: "Edge cases",
    level: "beginner",
    matches: ["javascript", "js", "node", "react", "typescript"],
    language: "javascript",
    filename: "weather.js",
    request: "Find the highest temperature of the week. In Leh, every day can be below zero.",
    code: `function highest(temps) {
  let max = 0;
  for (const t of temps) {
    if (t > max) max = t;
  }
  return max;
}`,
    answer: "skip",
    flaw: "max starts at 0, so if every temperature is negative (like [-8, -3, -5]) it returns 0, a temperature that never happened. It should start at temps[0] or -Infinity.",
    fix: { before: "let max = 0;", after: "let max = -Infinity;" },
    rule: "Try the edge case the request warns you about.",
    hint: "Try highest([-8, -3, -5]).",
  },
  {
    id: "reverse-text",
    title: "Reverse a name",
    skill: "Checking AI does what was asked",
    level: "beginner",
    matches: ["python", "django", "flask"],
    language: "python",
    filename: "text.py",
    request: "Reverse a string, e.g. 'rahul' becomes 'luhar'.",
    code: `def reverse(text):
    return text[::-1]`,
    answer: "ship",
    flaw: "The code is correct: text[::-1] is Python's slice that steps backwards through the whole string, so 'rahul' becomes 'luhar', and an empty string stays empty.",
    fix: null,
    rule: "Not all AI code is wrong. If it does what was asked, ship it.",
    hint: "What does 'rahul'[::-1] give?",
  },
  {
    id: "password-length",
    title: "Password rule",
    skill: "Off-by-one at the boundaries",
    level: "beginner",
    matches: ["javascript", "js", "node", "react", "typescript"],
    language: "javascript",
    filename: "signup.js",
    request: "A password must be at least 8 characters long.",
    code: `function isLongEnough(password) {
  return password.length > 8;
}`,
    answer: "skip",
    flaw: "'At least 8' includes 8, but > 8 rejects an 8-character password like 'mango123'. It should be >= 8.",
    fix: { before: "return password.length > 8;", after: "return password.length >= 8;" },
    rule: "'At least' means >=. Check the exact boundary.",
    hint: "Is 'mango123' (8 characters) allowed?",
  },
  {
    id: "sum-to-n",
    title: "Sum from 1 to n",
    skill: "Off-by-one at the boundaries",
    level: "beginner",
    matches: ["java", "spring", "kotlin"],
    language: "java",
    filename: "MathUtil.java",
    request: "Add up all numbers from 1 to n, so sumTo(3) is 6.",
    code: `static int sumTo(int n) {
    int total = 0;
    for (int i = 1; i < n; i++) {
        total += i;
    }
    return total;
}`,
    answer: "skip",
    flaw: "The loop stops before n (i < n), so sumTo(3) adds 1 + 2 and returns 3 instead of 6. It should be i <= n.",
    fix: { before: "for (int i = 1; i < n; i++) {", after: "for (int i = 1; i <= n; i++) {" },
    rule: "Walk through the loop with the example from the request.",
    hint: "Count what sumTo(3) actually adds.",
  },
  {
    id: "voting-age",
    title: "Voting age",
    skill: "Checking AI does what was asked",
    level: "beginner",
    matches: ["python", "django", "flask", "fastapi"],
    language: "python",
    filename: "eligibility.py",
    request: "A person can vote if they are 18 or older.",
    code: `def can_vote(age):
    return age >= 18`,
    answer: "ship",
    flaw: "The code is correct: '18 or older' is exactly age >= 18. 18 can vote, 17 can't.",
    fix: null,
    rule: "Check the boundary: if 18 and 17 behave as asked, ship it.",
    hint: "What happens at 18? And at 17?",
  },
  {
    id: "last-item",
    title: "Last item in the cart",
    skill: "Off-by-one at the boundaries",
    level: "beginner",
    matches: ["javascript", "js", "node", "react", "typescript", "next"],
    language: "javascript",
    filename: "cart.js",
    request: "Show the last item the customer added to their cart.",
    code: `function lastItem(items) {
  return items[items.length];
}`,
    answer: "skip",
    flaw: "Arrays start at index 0, so the last item is at items.length - 1. items[items.length] is always undefined.",
    fix: { before: "return items[items.length];", after: "return items[items.length - 1];" },
    rule: "Indexes start at 0. The last one is length - 1.",
    hint: "With 3 items, which indexes exist?",
  },
  // ── Logic and analytical: the AI answered a reasoning question; judge the answer ──────────
  {
    id: "bat-and-ball",
    title: "The bat and the ball",
    skill: "Logical reasoning",
    level: "beginner",
    kind: "logic",
    matches: [],
    language: "text",
    filename: "AI's answer",
    request: "A bat and a ball cost ₹110 in total. The bat costs ₹100 more than the ball. How much does the ball cost?",
    code: `The ball costs ₹10.
The bat costs ₹100, and together they make ₹110.`,
    answer: "skip",
    flaw: "If the ball were ₹10, the bat (₹100 more) would be ₹110 and the total ₹120. The ball is ₹5 and the bat ₹105: ₹5 + ₹105 = ₹110.",
    fix: { before: "The ball costs ₹10.", after: "The ball costs ₹5 (and the bat ₹105)." },
    rule: "Check the AI's answer against EVERY condition in the question.",
    hint: "If the ball is ₹10, how much is the bat?",
  },
  {
    id: "widgets",
    title: "Machines and widgets",
    skill: "Logical reasoning",
    level: "beginner",
    kind: "logic",
    matches: [],
    language: "text",
    filename: "AI's answer",
    request: "5 machines make 5 widgets in 5 minutes. How long do 100 machines take to make 100 widgets?",
    code: `100 machines making 100 widgets takes 100 minutes.`,
    answer: "skip",
    flaw: "Each machine makes one widget in 5 minutes. 100 machines working at the same time make 100 widgets in the same 5 minutes.",
    fix: { before: "takes 100 minutes.", after: "takes 5 minutes." },
    rule: "Work out the rate per unit before scaling up.",
    hint: "How long does ONE machine take to make ONE widget?",
  },
  {
    id: "time-zones",
    title: "Meeting across time zones",
    skill: "Logical reasoning",
    level: "beginner",
    kind: "logic",
    matches: [],
    language: "text",
    filename: "AI's answer",
    request: "Our standup is at 11:00 AM IST. What time is that for a teammate in London in winter? (IST is 5 hours 30 minutes ahead of London in winter.)",
    code: `It's 5:30 AM in London.`,
    answer: "ship",
    flaw: "The answer is correct: 11:00 minus 5 hours 30 minutes is 5:30 AM in London.",
    fix: null,
    rule: "Do the arithmetic yourself once; if it checks out, trust it.",
    hint: "Subtract 5 hours 30 minutes from 11:00.",
  },
  // ── Medium ──────────────────────────────────────────────────────────────────────────────
  {
    id: "orders-today",
    title: "Orders placed today",
    skill: "Checking AI does what was asked",
    level: "intermediate",
    matches: ["sql", "postgres", "mysql", "python", "java", "node", "backend"],
    language: "sql",
    filename: "report.sql",
    request: "Count the orders placed today. created_at is a timestamp (date and time).",
    code: `SELECT COUNT(*)
FROM orders
WHERE created_at = CURRENT_DATE;`,
    answer: "skip",
    flaw: "created_at has a time, so it almost never equals CURRENT_DATE (midnight). The count is ~0. Compare the date part, e.g. created_at >= CURRENT_DATE AND created_at < CURRENT_DATE + 1, or CAST(created_at AS DATE) = CURRENT_DATE.",
    fix: { before: "WHERE created_at = CURRENT_DATE;", after: "WHERE created_at >= CURRENT_DATE AND created_at < CURRENT_DATE + 1;" },
    rule: "Check the data type the request mentions: timestamps aren't dates.",
    hint: "Does 2026-10-24 14:05 equal 2026-10-24?",
  },
  {
    id: "ai-cost-estimate",
    title: "Monthly AI bill",
    skill: "Analytical reasoning",
    level: "intermediate",
    kind: "logic",
    matches: [],
    language: "text",
    filename: "AI's answer",
    request: "We have 10,000 daily users. Each makes 20 AI calls a day at ₹0.01 per call. What's our monthly AI bill (30 days)?",
    code: `10,000 users × 20 calls × ₹0.01 = ₹2,000.
Your monthly AI bill is about ₹2,000.`,
    answer: "skip",
    flaw: "₹2,000 is the DAILY cost. For 30 days it's ₹2,000 × 30 = ₹60,000 a month, 30 times more than the AI said.",
    fix: { before: "Your monthly AI bill is about ₹2,000.", after: "That's ₹2,000 a day, about ₹60,000 a month." },
    rule: "Check the units: per day, per month, per user.",
    hint: "₹2,000 covers how many days?",
  },
  // ── Hard ────────────────────────────────────────────────────────────────────────────────
  {
    id: "payment-retry",
    title: "Retry a failed payment",
    skill: "Safe retries",
    level: "advanced",
    matches: ["node", "express", "javascript", "typescript", "backend", "payments"],
    language: "javascript",
    filename: "payments.js",
    request: "If the payment gateway times out, retry up to 3 times. Never charge a customer twice.",
    code: `async function charge(order) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await gateway.charge({ amount: order.total, card: order.cardToken });
    } catch (err) {
      if (err.code !== "TIMEOUT") throw err;
    }
  }
  throw new Error("Payment failed");
}`,
    answer: "skip",
    flaw: "A timeout doesn't mean the charge failed: the gateway may have charged the card and only the reply was lost. Retrying without an idempotency key (e.g. order.id) can charge the customer up to 3 times.",
    fix: {
      before: "return await gateway.charge({ amount: order.total, card: order.cardToken });",
      after: "return await gateway.charge({ amount: order.total, card: order.cardToken, idempotencyKey: order.id });",
    },
    rule: "A timeout is 'unknown', not 'failed'. Retries need an idempotency key.",
    hint: "When the gateway times out, are you sure the card wasn't charged?",
  },
  {
    id: "shared-cache",
    title: "Cache the profile",
    skill: "Cache safety",
    level: "advanced",
    matches: ["node", "express", "javascript", "typescript", "backend", "redis"],
    language: "javascript",
    filename: "profile.js",
    request: "Cache each user's profile for 5 minutes so the page loads faster.",
    code: `app.get("/me", async (req, res) => {
  const cached = await redis.get("profile");
  if (cached) return res.json(JSON.parse(cached));

  const profile = await db.users.findById(req.user.id);
  await redis.set("profile", JSON.stringify(profile), "EX", 300);
  res.json(profile);
});`,
    answer: "skip",
    flaw: "The cache key is the same for everyone ('profile'), so after the first request every user sees the FIRST user's profile for 5 minutes, a data leak. The key must include the user, e.g. `profile:${req.user.id}`.",
    fix: { before: 'await redis.get("profile");', after: "await redis.get(`profile:${req.user.id}`);" },
    rule: "Every cache key needs to say WHOSE data it is.",
    hint: "Two different users call /me. What does the second one get?",
  },
];

const LEVEL_RANK = { beginner: 0, intermediate: 1, advanced: 2 } as const;

type LevelName = "beginner" | "intermediate" | "advanced";

// Which onboarding area (lib/chat/quick-replies.ts AREAS) each skill belongs to.
const SKILL_AREA: Record<string, string> = {
  "Checking AI does what was asked": "requirements",
  "Edge cases": "edge_cases",
  "Off-by-one at the boundaries": "edge_cases",
  "Missing input checks": "security",
  "Access control": "security",
  "Cache safety": "performance",
  "Safe retries": "reliability",
  "Logical reasoning": "reasoning",
  "Analytical reasoning": "reasoning",
};

// Difficulty climbs with practice: the first 10 problems are easy fundamentals, then easy to
// medium, medium, medium to hard, and hard. `done` is how many problems they've started.
export function levelsFor(done: number): LevelName[] {
  if (done < 10) return ["beginner"];
  if (done < 15) return ["beginner", "intermediate"];
  if (done < 20) return ["intermediate"];
  if (done < 25) return ["intermediate", "advanced"];
  return ["advanced"];
}

// Next problem: unseen, at the right stage of difficulty, in their stack when possible, with a
// logic or analytical problem every fourth turn. An interview passes `level` to skip the stages.
export function pickProblem(
  learner: { level: LevelName | null; stack: string[]; weaknesses?: string[] | null },
  seen: Set<string>,
  options: { level?: LevelName } = {},
): Problem {
  const levels = options.level ? [options.level] : levelsFor(seen.size);
  const stack = learner.stack.map((s) => s.toLowerCase());
  const wantLogic = !options.level && seen.size % 4 === 3;
  const inStack = (p: Problem) => p.matches.some((m) => stack.some((s) => s.includes(m) || m.includes(s)));
  const score = (p: Problem) =>
    (levels.includes(p.level) ? 100 : -Math.abs(LEVEL_RANK[p.level] - LEVEL_RANK[levels[0]]) * 20) +
    (inStack(p) ? 10 : 0) +
    // Lean towards the areas they said they want to improve.
    ((learner.weaknesses ?? []).includes(SKILL_AREA[p.skill] ?? "") ? 15 : 0) +
    (p.kind === "logic" ? (wantLogic ? 30 : options.level ? -50 : -5) : 0) +
    // Everyone's first problem is the festive discount: short, universal, and memorable.
    (seen.size === 0 && !options.level && p.id === "festive-discount" ? 1000 : 0);
  const unseen = PROBLEMS.filter((p) => !seen.has(p.id));
  // Seen them all: repeat, but not any of the last 8 (seen keeps attempt order).
  const recent = new Set([...seen].slice(-8));
  const pool = unseen.length ? unseen : PROBLEMS.filter((p) => !recent.has(p.id));
  return [...pool].sort((a, b) => score(b) - score(a))[0];
}

export function getProblem(id: string) {
  return PROBLEMS.find((p) => p.id === id) ?? null;
}

// The problem an attempt was for: its saved snapshot (generated problems), or the bank entry.
export function resolveProblem(row: { problem_id: string; problem?: Problem | null }) {
  return row.problem ?? getProblem(row.problem_id);
}

export function toPublic(p: Problem): PublicProblem {
  return {
    id: p.id,
    title: p.title,
    skill: p.skill,
    language: p.language,
    filename: p.filename,
    request: p.request,
    code: p.code,
  };
}
