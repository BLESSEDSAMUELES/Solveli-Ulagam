import type { NextConfig } from "next";

// Supabase: .env holds SUPABASE_URL and SUPABASE_KEY (the project's publishable key). Both are safe in the browser, so they
// are exposed under the NEXT_PUBLIC_ names the Supabase clients read. A secret/service-role key must never be exposed:
// refuse to start if one is put in SUPABASE_KEY by mistake.
const key = process.env.SUPABASE_KEY ?? "";
const jwtRole = (() => { try { return JSON.parse(Buffer.from(key.split(".")[1] ?? "", "base64url").toString()).role; } catch { return undefined; } })();
if (key.startsWith("sb_secret_") || jwtRole === "service_role") {
  throw new Error("SUPABASE_KEY is a secret key. Use the publishable (anon) key there; keep secret keys out of NEXT_PUBLIC_ variables.");
}

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.SUPABASE_URL ?? "",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key,
  },
};

export default nextConfig;
