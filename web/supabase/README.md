# Supabase for Solveli

The app reads `SUPABASE_URL` and `SUPABASE_KEY` (the **publishable** key) from `web/.env`; `next.config.ts` exposes them to the
browser as `NEXT_PUBLIC_SUPABASE_*` and refuses to start if a secret/service-role key is put there. No service-role key is used
anywhere — every query runs as the signed-in user, under Row Level Security.

## 1. Apply the migrations (once, then after schema changes)

In the Supabase dashboard → **SQL Editor**, run these files in order (both are safe to re-run):

1. `migrations/20260923120000_solveli_schema.sql` — tables, keys, indexes, triggers, RLS policies, column grants
2. `migrations/20260923120100_seed_catalog.sql` — worlds, lessons, challenges, guides, library, achievements, community topics and prompts

Or with the Supabase CLI: `npx supabase link --project-ref <ref>` then `npx supabase db push`.

The seed is generated from the app's own data. After changing lessons, challenges, guides etc., regenerate it with the dev
server running: `curl -s localhost:3000/api/dev/seed-sql > supabase/migrations/20260923120100_seed_catalog.sql`.

Check the schema locally without touching the project: `npm run test:db` (runs both migrations on PGlite and tests the
triggers and every RLS rule as real `anon`/`authenticated` users).

## 2. Enable Google sign-in

1. Google Cloud Console → APIs & Services → Credentials → **Create OAuth client ID** (Web application).
   Authorised redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`
2. Supabase → Authentication → **Sign In / Providers → Google**: enable, paste the client ID and secret.
3. Supabase → Authentication → **URL Configuration**: Site URL = your deployed URL; add Redirect URLs
   `http://localhost:3000/auth/callback` and `https://<your-domain>/auth/callback`.

Until Google is enabled, the "Continue with Google" button says so instead of failing.

## How it fits together

| Piece | File |
| --- | --- |
| Browser client (cookie session, auto refresh) | `src/lib/supabase/client.ts` |
| Server client (Server Components, route handlers) | `src/lib/supabase/server.ts` |
| Session refresh + protected routes (`/academy/account`) | `src/proxy.ts` |
| OAuth + email-confirmation callback | `src/app/auth/callback/route.ts` |
| Auth state, profile + progress sync | `src/lib/auth.ts` |
| Profile creation | `handle_new_user()` trigger on `auth.users` (one profile per auth id — never duplicated) |

Sign-up: stage 1 (`/signup`, personal details) creates the Supabase Auth user; the trigger creates the profile and stats row;
stages 2–5 (`/onboarding`) save role, level, companion and guide to that profile. With email confirmation on, stages 2–5 are
kept on the device and saved as soon as the confirmed user signs in.

Progress: the Academy keeps working for guests (browser storage). When signed in, progress is loaded from Supabase, guest
progress on that device is merged in once (max, never double-counted), and every change is written back as upserts.
