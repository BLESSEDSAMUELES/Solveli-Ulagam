// npm run test:db — runs the Solveli migrations on PGlite with a minimal Supabase auth stand-in, then checks triggers + RLS as real roles.
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL("../migrations", import.meta.url));
const db = new PGlite({ extensions: { pgcrypto } });
let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`); if (!cond) failures++; };

// --- Supabase stand-ins: roles, auth.users, auth.uid() from the JWT claim, default grants like Supabase ---
await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}',
    raw_app_meta_data jsonb default '{}', created_at timestamptz default now());
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema public, auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;
  alter default privileges in schema public grant execute on functions to anon, authenticated;
  -- a user who existed before the migration (backfill check)
  insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-00000000000a', 'early@example.com', '{"name":"Early Bird"}');
`);

for (const f of fs.readdirSync(dir).sort()) {
  await db.exec(fs.readFileSync(`${dir}/${f}`, "utf8"));
  console.log(`applied ${f}`);
}
// idempotency: both migrations must be safe to run twice
for (const f of fs.readdirSync(dir).sort()) await db.exec(fs.readFileSync(`${dir}/${f}`, "utf8"));
console.log("re-applied both migrations (idempotent)");

const one = async (sql, p) => (await db.query(sql, p)).rows[0];
const count = async (t) => Number((await one(`select count(*)::int n from ${t}`)).n);
ok(await count("public.worlds") === 5, "5 worlds seeded");
ok(await count("public.lessons") >= 10, `lessons seeded (${await count("public.lessons")})`);
ok(await count("public.challenges") >= 6, `challenges seeded (${await count("public.challenges")})`);
ok(await count("public.guides") === 12, "12 guides seeded");
ok(await count("public.library_texts") >= 10, `library texts seeded (${await count("public.library_texts")})`);
ok(await count("public.community_posts where is_official") === 8, "8 official prompts seeded");
ok(!!(await one(`select 1 x from public.profiles where id = '00000000-0000-0000-0000-00000000000a' and full_name = 'Early Bird'`)), "pre-existing auth user backfilled into profiles");

// --- sign-up trigger: email and Google users ---
const A = (await one(`insert into auth.users (email, raw_user_meta_data) values ('asha@example.com', '{"full_name":"Asha"}') returning id`)).id;
const G = (await one(`insert into auth.users (email, raw_user_meta_data, raw_app_meta_data) values ('guru@gmail.com', '{"name":"Guru G","picture":"https://lh3.googleusercontent.com/x"}', '{"provider":"google"}') returning id`)).id;
const pa = await one(`select * from public.profiles where id = $1`, [A]);
const pg = await one(`select * from public.profiles where id = $1`, [G]);
ok(pa?.full_name === "Asha" && pa.provider === "email" && pa.onboarded === false, "email sign-up creates profile (name, provider=email, not onboarded)");
ok(pg?.full_name === "Guru G" && pg.provider === "google" && pg.avatar_url?.startsWith("https://"), "Google sign-up creates profile with name + avatar");
ok(!!(await one(`select 1 x from public.user_stats where user_id = $1`, [A])), "user_stats initialised on sign-up");
await db.query(`update auth.users set raw_app_meta_data = '{"provider":"google"}' where id = $1`, [A]); // same user logs in with Google later
ok(await count(`public.profiles where email = 'asha@example.com'`) === 1, "second login method does not duplicate the profile");

// --- act as a role with a JWT subject, like PostgREST does ---
async function as(role, sub, fn) {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub', '${sub ?? ""}', false);`);
  try { return await fn(); } finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`); }
}
const denied = async (sql, p) => { try { const r = await db.query(sql, p); return r.affectedRows === 0 && !/^select/i.test(sql.trim()); } catch { return true; } };

await as("anon", null, async () => {
  ok((await db.query(`select id from public.lessons`)).rows.length > 0, "guest can read lessons");
  ok((await db.query(`select id from public.community_posts`)).rows.every(() => true) && (await db.query(`select id from public.community_posts where not is_official`)).rows.length === 0, "guest sees only official posts");
  ok(await denied(`select * from public.profiles`), "guest cannot read profiles");
  ok(await denied(`select * from public.user_stats`), "guest cannot read progress");
  ok(await denied(`insert into public.worlds (id, title, subtitle, description) values ('x','x','x','x')`), "guest cannot write catalog");
});

await as("authenticated", A, async () => {
  ok((await db.query(`update public.profiles set full_name = 'Asha R', guide_id = 'avvaiyar', onboarded = true where id = $1`, [A])).affectedRows === 1, "user updates own profile + onboarding");
  ok(await denied(`update public.profiles set full_name = 'hacked' where id = $1`, [G]), "user cannot update another profile");
  ok(await denied(`update public.profiles set email = 'x@y.z' where id = $1`, [A]), "user cannot change stored email via API");
  ok(await denied(`select email from public.profiles`), "email column hidden from API");
  ok((await db.query(`select full_name from public.profiles where id = $1`, [G])).rows[0]?.full_name === "Guru G", "members can see each other's display name");
  await db.query(`update public.user_stats set xp = 120, correct = 3, answered = 4 where user_id = $1`, [A]);
  await db.query(`insert into public.user_lesson_progress (user_id, lesson_id, steps_reached, completed_at) values ($1, 'muppal', 3, now())`, [A]);
  await db.query(`insert into public.user_words (user_id, word) values ($1, 'அன்பு')`, [A]);
  await db.query(`insert into public.user_active_days (user_id, day) values ($1, current_date), ($1, current_date - 1), ($1, current_date - 2)`, [A]);
  await db.query(`insert into public.user_activity (user_id, kind, label, href) values ($1, 'lesson', 'Completed lesson muppal', '/academy/lessons/muppal')`, [A]);
  await db.query(`insert into public.user_achievements (user_id, achievement_id, progress, unlocked_at) values ($1, 'discover-3', 3, now())`, [A]);
  ok(Number((await one(`select public.current_streak() n`)).n) === 3, "current_streak() = 3 consecutive days");
  ok(await denied(`insert into public.user_words (user_id, word) values ($1, 'x')`, [G]), "user cannot write another user's progress");
  ok(await denied(`insert into public.user_lesson_progress (user_id, lesson_id) values ($1, 'no-such-lesson')`, [A]), "FK rejects unknown lesson ids");
  // community
  const post = (await one(`insert into public.community_posts (topic_id, title, body, tags) values ('discussions', 'Reading Kural 72', 'What does அன்பு mean here?', '{Thirukkural}') returning id, author_id, is_official`));
  ok(post.author_id === A && post.is_official === false, "post author is set by the database to the caller");
  ok(await denied(`insert into public.community_posts (author_id, topic_id, title, body) values ($1, 'discussions', 'Impersonation', 'Posting as someone else')`, [G]), "cannot post as another user");
  ok(await denied(`insert into public.community_posts (is_official, author_id, topic_id, title, body) values (true, null, 'discussions', 'Fake official', 'Pretending to be Solveli')`), "cannot create official posts");
  globalThis.postId = post.id;
  await db.query(`insert into public.community_reactions (post_id) values ($1)`, [post.id]);
  await db.query(`insert into public.community_comments (post_id, body) values ($1, 'My own first reply')`, [post.id]);
  ok(await denied(`insert into public.community_reactions (post_id) values ($1)`, [post.id]), "double like rejected (one reaction per user)");
  ok(await denied(`update public.community_posts set is_official = true where id = $1`, [post.id]), "cannot promote own post to official");
});

await as("authenticated", G, async () => {
  ok((await db.query(`select id from public.community_posts where not is_official`)).rows.length === 1, "other members can read member posts");
  ok(await denied(`update public.community_posts set title = 'Edited by someone else' where id = $1`, [globalThis.postId]), "cannot edit another member's post");
  ok(await denied(`delete from public.community_posts where id = $1`, [globalThis.postId]), "cannot delete another member's post");
  ok((await db.query(`select * from public.user_stats`)).rows.every((r) => r.user_id === G), "sees only own stats");
  ok((await db.query(`select * from public.user_words`)).rows.length === 0, "cannot see another user's words");
  const c = await one(`select count(*)::int n from public.community_reactions where post_id = $1`, [globalThis.postId]);
  ok(c.n === 1, "reaction counts are readable by members");
});

await as("authenticated", A, async () => {
  ok((await db.query(`delete from public.community_posts where id = $1`, [globalThis.postId])).affectedRows === 1, "author can delete own post");
});
ok(await count(`public.community_comments`) === 0 && await count(`public.community_reactions`) === 0, "comments + reactions cascade with the post");

await db.query(`delete from auth.users where id = $1`, [A]);
ok(await count(`public.profiles where id = '${A}'`) === 0 && await count(`public.user_words`) === 0, "deleting the auth user removes profile and progress (cascade)");

console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
