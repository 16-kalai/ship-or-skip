import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { HOME_PATH } from "@/lib/safe-next";

const PROTECTED_PREFIXES = ["/chat", "/profile", "/interview", "/admin"];
// The landing page (/) is public for everyone; only the sign-up page sends signed-in users on.
const AUTH_PAGES = ["/signup"];

// Refreshes the Supabase session on each navigation and keeps signed-out users out of app pages.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
          for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
        },
      },
    },
  );

  // getClaims verifies the JWT locally when the project uses asymmetric signing keys,
  // so most navigations don't need a round trip to Supabase Auth.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const path = request.nextUrl.pathname;

  if (!signedIn && PROTECTED_PREFIXES.some((p) => path.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/signup";
    url.search = `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }

  if (signedIn && AUTH_PAGES.includes(path)) {
    const url = request.nextUrl.clone();
    url.pathname = HOME_PATH;
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
