import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Runs before every page: refreshes the Supabase session cookie (so logins survive refreshes and token expiry) and
// guards account-only pages on the server. The Academy itself stays open to guests ("Explore as Guest").
const PROTECTED = ["/academy/account"];
const AUTH_PAGES = ["/signin", "/signup"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });
  // getUser() validates the token with Supabase Auth and refreshes it when needed (never trust getSession() here).
  const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));

  const path = request.nextUrl.pathname;
  const redirect = (to: string) => {
    const r = NextResponse.redirect(new URL(to, request.url));
    for (const c of response.cookies.getAll()) r.cookies.set(c);
    return r;
  };
  if (!user && PROTECTED.some((p) => path.startsWith(p))) return redirect(`/signin?next=${encodeURIComponent(path)}`);
  if (user && AUTH_PAGES.includes(path)) return redirect("/academy");
  return response;
}

export const config = {
  // Pages only: skip Next internals, API routes, the auth callback and any file with an extension (images, video, fonts).
  matcher: ["/((?!_next/|api/|auth/|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)"],
};
