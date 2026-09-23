import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Per-request server client (Server Components, Route Handlers). It acts as the signed-in user through their session
// cookie — RLS applies exactly as in the browser. No service-role key exists in this app, by design.
export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        // Server Components cannot set cookies; the proxy refreshes the session on every request instead.
        try { for (const { name, value, options } of list) store.set(name, value, options); } catch {}
      },
    },
  });
}

/** The verified user for this request (validated with Supabase Auth, not just decoded from the cookie). */
export async function currentUser() {
  const { data } = await (await supabaseServer()).auth.getUser();
  return data.user;
}
