-- Solveli schema. Derived from the app itself:
--   content catalog  worlds · lessons · challenges · guides · library_texts · achievements   (read-only to clients, seeded by the next migration)
--   people           profiles (1:1 with auth.users — passwords live only in Supabase Auth)
--   progress         user_stats · user_lesson_progress · user_challenge_progress · user_world_visits · user_words · user_sources
--                    user_active_days (streaks) · user_activity (timeline) · user_achievements
--   community        community_topics · community_posts · community_comments · community_reactions · community_bookmarks
-- Not duplicated here on purpose: verses and kurals (sentamizh-corpus + datasets/thirukkural.json stay the source, referenced by
-- their stable verse ids such as KURAL-72 or PURN-192) and the search index (built in memory by src/lib/search.ts).
-- Safe to re-run: every object is created only if missing.

create extension if not exists pgcrypto;

-- ---------- helpers ----------
create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ---------- content catalog ----------
create table if not exists public.worlds (
  id          text primary key,
  title       text not null,
  subtitle    text not null,
  description text not null,
  period      text,
  color       text,
  image       text,
  position    int  not null default 0,
  active      boolean not null default true,
  metadata    jsonb not null default '{}'
);

create table if not exists public.lessons (
  id        text primary key,
  world_id  text not null references public.worlds(id) on delete cascade,
  title     text not null,
  summary   text not null,
  level     text not null check (level in ('Beginner', 'Intermediate', 'Advanced')),
  image     text,
  source    text not null,              -- citation for the lesson's material
  steps     jsonb not null default '[]',-- [{ta, en, note, verse?}] — every step is a concept or a real verse with its source
  position  int  not null default 0,
  active    boolean not null default true,
  metadata  jsonb not null default '{}'
);
create index if not exists lessons_world_idx on public.lessons (world_id, position);

create table if not exists public.challenges (
  id             text primary key,
  world_id       text not null references public.worlds(id) on delete cascade,
  lesson_id      text references public.lessons(id) on delete set null,
  kind           text not null check (kind in ('daily', 'world', 'quiz')),
  title          text not null,
  summary        text not null,
  image          text,
  round_size     int  not null check (round_size > 0),
  question_count int  not null check (question_count >= round_size),
  xp_per_correct int  not null default 15,
  source         text not null,
  position       int  not null default 0,
  active         boolean not null default true,
  metadata       jsonb not null default '{}'
  -- Questions are generated deterministically from the verified corpus (challengeCatalog() in src/lib/corpus.ts):
  -- the correct answer is always the dataset's own label, so they are not copied here.
);
create index if not exists challenges_world_idx on public.challenges (world_id, position);

create table if not exists public.guides (
  id         text primary key,
  name       text not null,
  name_ta    text not null,
  category   text not null check (category in ('sangam', 'philosophers', 'bhakti', 'grammarians', 'epic', 'modern')),
  era        text not null,
  sort_order int  not null default 0,
  tags       text[] not null default '{}',
  world_id   text references public.worlds(id) on delete set null,
  glyph      text,
  image      text,
  bio        text not null,
  poet_names text[] not null default '{}',   -- name forms used in corpus attributions
  active     boolean not null default true
);
create index if not exists guides_category_idx on public.guides (category, sort_order);

create table if not exists public.library_texts (
  slug        text primary key,
  name        text not null,
  name_ta     text not null,
  layer       text not null,
  period      text not null,
  description text not null,
  unit        text not null,
  item_count  int  not null default 0,
  world_id    text references public.worlds(id) on delete set null,
  authors     text[] not null default '{}',
  reference   text,                           -- where the edition comes from
  status      text not null default 'available' check (status in ('available', 'unavailable')),
  metadata    jsonb not null default '{}'
);
create index if not exists library_world_idx on public.library_texts (world_id);

create table if not exists public.achievements (
  id          text primary key,
  title       text not null,
  description text not null,
  goal        int  not null default 1,
  xp          int  not null default 0,
  diamonds    int  not null default 0,
  position    int  not null default 0
);

create table if not exists public.community_topics (
  id       text primary key,
  label    text not null,
  position int  not null default 0
);

-- ---------- profiles ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text check (char_length(full_name) <= 80),
  email       text,
  avatar_url  text,
  provider    text not null default 'email',
  role        text not null default 'student'  check (role in ('student', 'educator', 'researcher', 'explorer')),
  tamil_level text not null default 'new'      check (tamil_level in ('new', 'basic', 'reader', 'deep')),
  companion   text not null default 'yaazhini' check (companion in ('yaazhini', 'valavan')),
  guide_id    text not null default 'thiruvalluvar' references public.guides(id),
  lang        text not null default 'en'       check (lang in ('en', 'ta')),
  onboarded   boolean not null default false,  -- finished the five onboarding stages
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();

-- ---------- progress ----------
create table if not exists public.user_stats (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  xp         int not null default 0 check (xp >= 0),
  diamonds   int not null default 0 check (diamonds >= 0),
  hearts     int not null default 5 check (hearts between 0 and 5),
  correct    int not null default 0 check (correct >= 0),
  answered   int not null default 0 check (answered >= correct),
  updated_at timestamptz not null default now()
);
drop trigger if exists user_stats_updated_at on public.user_stats;
create trigger user_stats_updated_at before update on public.user_stats for each row execute function public.set_updated_at();

create table if not exists public.user_lesson_progress (
  user_id       uuid not null references public.profiles(id) on delete cascade,
  lesson_id     text not null references public.lessons(id) on delete cascade,
  steps_reached int  not null default 0 check (steps_reached >= 0),
  completed_at  timestamptz,
  updated_at    timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create table if not exists public.user_challenge_progress (
  user_id      uuid not null references public.profiles(id) on delete cascade,
  challenge_id text not null references public.challenges(id) on delete cascade,
  best_score   numeric(4, 3) not null default 0 check (best_score between 0 and 1),
  plays        int not null default 0,
  completed    boolean not null default false,
  perfect      boolean not null default false,
  round_state  jsonb,                          -- unfinished round {at, right, total, qs}, so "continue" works across devices
  updated_at   timestamptz not null default now(),
  primary key (user_id, challenge_id)
);

create table if not exists public.user_world_visits (
  user_id          uuid not null references public.profiles(id) on delete cascade,
  world_id         text not null references public.worlds(id) on delete cascade,
  first_visited_at timestamptz not null default now(),
  last_visited_at  timestamptz not null default now(),
  primary key (user_id, world_id)
);

create table if not exists public.user_words (
  user_id       uuid not null references public.profiles(id) on delete cascade,
  word          text not null check (char_length(word) between 1 and 60),
  mastery       text not null default 'discovered' check (mastery in ('discovered', 'learning', 'familiar', 'mastered')),
  discovered_at timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (user_id, word)
);

create table if not exists public.user_sources (
  user_id   uuid not null references public.profiles(id) on delete cascade,
  verse_id  text not null,                     -- corpus verse id (KURAL-72, PURN-192…)
  opened_at timestamptz not null default now(),
  primary key (user_id, verse_id)
);

create table if not exists public.user_active_days (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day     date not null,
  primary key (user_id, day)
);

create table if not exists public.user_activity (
  id      bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind    text not null check (kind in ('word', 'source', 'lesson', 'challenge', 'quest', 'world')),
  label   text not null check (char_length(label) <= 200),
  href    text check (href is null or href like '/%'),
  at      timestamptz not null default now(),
  unique (user_id, at, label)                  -- idempotent re-sync
);
create index if not exists user_activity_user_idx on public.user_activity (user_id, at desc);

create table if not exists public.user_achievements (
  user_id        uuid not null references public.profiles(id) on delete cascade,
  achievement_id text not null references public.achievements(id) on delete cascade,
  progress       int not null default 0,
  unlocked_at    timestamptz,
  primary key (user_id, achievement_id)
);

-- Streak = consecutive active days ending today or yesterday (same rule as streakOf() in src/lib/progress.ts).
create or replace function public.current_streak(uid uuid default auth.uid()) returns int language sql stable security invoker as $$
  with recursive run(day) as (
    select max(day) from public.user_active_days where user_id = uid and day >= current_date - 1
    union all
    select r.day - 1 from run r where exists (select 1 from public.user_active_days d where d.user_id = uid and d.day = r.day - 1)
  )
  select count(day)::int from run where day is not null;
$$;

-- ---------- community ----------
create table if not exists public.community_posts (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique,                     -- stable handle for Solveli's own prompts (search links ?post=slug)
  author_id   uuid default auth.uid() references public.profiles(id) on delete cascade,
  is_official boolean not null default false,
  topic_id    text not null references public.community_topics(id),
  title       text not null check (char_length(btrim(title)) between 5 and 120),
  body        text not null check (char_length(btrim(body)) between 10 and 1200),
  tags        text[] not null default '{}' check (cardinality(tags) <= 5),
  ref_label   text check (char_length(ref_label) <= 120),
  ref_href    text check (ref_href is null or ref_href like '/%'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check ((is_official and author_id is null) or (not is_official and author_id is not null))
);
create index if not exists community_posts_topic_idx on public.community_posts (topic_id, created_at desc);
create index if not exists community_posts_author_idx on public.community_posts (author_id);
drop trigger if exists community_posts_updated_at on public.community_posts;
create trigger community_posts_updated_at before update on public.community_posts for each row execute function public.set_updated_at();

create table if not exists public.community_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.community_posts(id) on delete cascade,
  parent_id  uuid references public.community_comments(id) on delete cascade,   -- a reply to another comment
  author_id  uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  body       text not null check (char_length(btrim(body)) between 1 and 600),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists community_comments_post_idx on public.community_comments (post_id, created_at);
drop trigger if exists community_comments_updated_at on public.community_comments;
create trigger community_comments_updated_at before update on public.community_comments for each row execute function public.set_updated_at();

create table if not exists public.community_reactions (
  post_id    uuid not null references public.community_posts(id) on delete cascade,
  user_id    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  kind       text not null default 'like' check (kind in ('like')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id, kind)
);
create index if not exists community_reactions_user_idx on public.community_reactions (user_id);

create table if not exists public.community_bookmarks (
  post_id    uuid not null references public.community_posts(id) on delete cascade,
  user_id    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

-- ---------- auth → profile ----------
-- One profile per auth user, keyed by the auth id: email sign-up and Google both land here, and a Google login for an
-- existing email is linked by Supabase to the same auth user, so `on conflict do nothing` never duplicates anyone.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, provider)
  values (
    new.id, new.email,
    nullif(left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'), 80), ''),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture'),
    coalesce(new.raw_app_meta_data ->> 'provider', 'email'))
  on conflict (id) do nothing;
  insert into public.user_stats (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Keep email / provider current and fill name + avatar from Google if the profile has none yet.
create or replace function public.handle_user_updated() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles p set
    email      = new.email,
    provider   = coalesce(new.raw_app_meta_data ->> 'provider', p.provider),
    full_name  = coalesce(p.full_name, nullif(left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'), 80), '')),
    avatar_url = coalesce(p.avatar_url, new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  where p.id = new.id;
  return new;
end $$;
drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated after update of email, raw_user_meta_data, raw_app_meta_data on auth.users
  for each row execute function public.handle_user_updated();

-- ---------- row level security ----------
alter table public.worlds                  enable row level security;
alter table public.lessons                 enable row level security;
alter table public.challenges              enable row level security;
alter table public.guides                  enable row level security;
alter table public.library_texts           enable row level security;
alter table public.achievements            enable row level security;
alter table public.community_topics        enable row level security;
alter table public.profiles                enable row level security;
alter table public.user_stats              enable row level security;
alter table public.user_lesson_progress    enable row level security;
alter table public.user_challenge_progress enable row level security;
alter table public.user_world_visits       enable row level security;
alter table public.user_words              enable row level security;
alter table public.user_sources            enable row level security;
alter table public.user_active_days        enable row level security;
alter table public.user_activity           enable row level security;
alter table public.user_achievements       enable row level security;
alter table public.community_posts         enable row level security;
alter table public.community_comments      enable row level security;
alter table public.community_reactions     enable row level security;
alter table public.community_bookmarks     enable row level security;

-- Public catalog: anyone may read; nobody writes through the API (migrations / SQL editor only).
do $$ declare t text; begin
  foreach t in array array['worlds', 'lessons', 'challenges', 'guides', 'library_texts', 'achievements', 'community_topics'] loop
    execute format('drop policy if exists "catalog is public" on public.%I', t);
    execute format('create policy "catalog is public" on public.%I for select to anon, authenticated using (true)', t);
  end loop;
end $$;

-- Profiles: signed-in members can see each other's display fields (community author names); only you can change yours.
-- Email is hidden from the API by column privileges — your own comes from your auth session.
drop policy if exists "members read profiles" on public.profiles;
create policy "members read profiles" on public.profiles for select to authenticated using (true);
drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
revoke insert, update, select on public.profiles from anon, authenticated;
grant select (id, full_name, avatar_url, provider, role, tamil_level, companion, guide_id, lang, onboarded, created_at, updated_at) on public.profiles to authenticated;
grant update (full_name, avatar_url, role, tamil_level, companion, guide_id, lang, onboarded) on public.profiles to authenticated;

-- Your progress is yours alone: read and write only rows with your own user_id.
do $$ declare t text; begin
  foreach t in array array['user_stats', 'user_lesson_progress', 'user_challenge_progress', 'user_world_visits', 'user_words',
                           'user_sources', 'user_active_days', 'user_activity', 'user_achievements'] loop
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format('create policy "own rows" on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- Community: guests can read Solveli's prompts; members read everything, and write only as themselves.
drop policy if exists "read posts" on public.community_posts;
create policy "read posts" on public.community_posts for select to anon, authenticated using (is_official or auth.uid() is not null);
drop policy if exists "write own posts" on public.community_posts;
create policy "write own posts" on public.community_posts for insert to authenticated with check (author_id = auth.uid() and not is_official);
drop policy if exists "edit own posts" on public.community_posts;
create policy "edit own posts" on public.community_posts for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid() and not is_official);
drop policy if exists "delete own posts" on public.community_posts;
create policy "delete own posts" on public.community_posts for delete to authenticated using (author_id = auth.uid());
-- Clients may only fill content columns; id, author_id (defaults to auth.uid()), slug and is_official are not theirs to set.
revoke insert, update on public.community_posts from anon, authenticated;
grant insert (topic_id, title, body, tags, ref_label, ref_href) on public.community_posts to authenticated;
grant update (topic_id, title, body, tags, ref_label, ref_href) on public.community_posts to authenticated;

drop policy if exists "members read comments" on public.community_comments;
create policy "members read comments" on public.community_comments for select to authenticated using (true);
drop policy if exists "write own comments" on public.community_comments;
create policy "write own comments" on public.community_comments for insert to authenticated with check (author_id = auth.uid());
drop policy if exists "edit own comments" on public.community_comments;
create policy "edit own comments" on public.community_comments for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
drop policy if exists "delete own comments" on public.community_comments;
create policy "delete own comments" on public.community_comments for delete to authenticated using (author_id = auth.uid());
revoke insert, update on public.community_comments from anon, authenticated;
grant insert (post_id, parent_id, body) on public.community_comments to authenticated;
grant update (body) on public.community_comments to authenticated;

drop policy if exists "members read reactions" on public.community_reactions;
create policy "members read reactions" on public.community_reactions for select to authenticated using (true);
drop policy if exists "react as yourself" on public.community_reactions;
create policy "react as yourself" on public.community_reactions for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "unreact own" on public.community_reactions;
create policy "unreact own" on public.community_reactions for delete to authenticated using (user_id = auth.uid());
revoke insert, update on public.community_reactions from anon, authenticated;
grant insert (post_id, kind) on public.community_reactions to authenticated;

drop policy if exists "own bookmarks" on public.community_bookmarks;
create policy "own bookmarks" on public.community_bookmarks for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.community_bookmarks from anon;
revoke insert, update on public.community_bookmarks from authenticated;
grant insert (post_id) on public.community_bookmarks to authenticated;
