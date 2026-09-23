"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

// One browser client for the whole app. The session lives in cookies (shared with the server client and proxy), so it
// survives refreshes and is refreshed automatically. Only the publishable key is ever used here.
let client: SupabaseClient | undefined;
export function supabase() {
  return (client ??= createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!));
}

export const configured = () => !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
