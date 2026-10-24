import { Suspense } from "react";
import { Orb } from "@/components/orb";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { StoryPanel } from "@/components/auth/story-panel";
import { BRAND } from "@/lib/brand";
import { safeNext } from "@/lib/safe-next";

// Reads the URL, so it renders at request time inside Suspense; the rest of the page is static.
async function SignUpFormFromUrl({ searchParams }: { searchParams: PageProps<"/signup">["searchParams"] }) {
  const params = await searchParams;
  const next = safeNext(typeof params.next === "string" ? params.next : null);
  const authFailed = params.error === "auth";
  return (
    <SignUpForm
      next={next}
      initialError={authFailed ? "That sign-in link didn't work. Try again." : undefined}
    />
  );
}

export default function SignUpPage({ searchParams }: PageProps<"/signup">) {
  return (
    <main className="grid h-dvh lg:grid-cols-2">
      <section aria-label={`What ${BRAND.name} is`} className="hidden lg:block">
        <StoryPanel />
      </section>

      <section className="flex flex-col overflow-y-auto">
        {/* The story panel carries the brand on desktop; phones only see this side. */}
        <header className="flex items-center gap-2.5 px-6 pt-6 font-semibold lg:hidden">
          <Orb size={24} />
          {BRAND.name}
        </header>
        <div className="flex flex-1 items-center justify-center px-6 py-10">
          <div className="w-full max-w-[380px]">
            <Suspense fallback={<div className="h-[440px]" />}>
              <SignUpFormFromUrl searchParams={searchParams} />
            </Suspense>
          </div>
        </div>
      </section>
    </main>
  );
}
