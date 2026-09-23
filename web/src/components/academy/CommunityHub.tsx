"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  ArrowRight, Bookmark, CalendarDays, FolderGit2, Heart, HelpCircle, Image as ImageIcon, LayoutGrid, Loader2, LogIn, MessageCircle,
  MessageSquare, Plus, Search, ShieldCheck, Trash2, Users, WifiOff, X,
} from "lucide-react";
import { ExploreLine } from "@/components/academy/ui";
import { friendly, useAuth, type Account } from "@/lib/auth";
import { names, profile } from "@/lib/profile";
import { levelOf, progress } from "@/lib/progress";
import { supabase } from "@/lib/supabase/client";
import { LIMITS, PROMPTS, SOLVELI, timeAgo, TOPICS, type Author, type CommunityApi, type Post, type Reply, type Topic } from "@/lib/community";

// ---- Supabase implementation of CommunityApi. RLS decides what each caller may read and write. ----
type Row = {
  id: string; slug: string | null; author_id: string | null; is_official: boolean; topic_id: Topic; title: string; body: string; tags: string[];
  ref_label: string | null; ref_href: string | null; created_at: string;
  author?: { full_name: string | null } | null;
  community_reactions?: { count: number }[]; community_comments?: { count: number }[];
};
const COLS = "id, slug, author_id, is_official, topic_id, title, body, tags, ref_label, ref_href, created_at";
const glyphOf = (name: string) => name.trim().slice(0, 1).toUpperCase() || "?";
const you = (me: Account): Author => ({ name: `${me.name} (you)`, role: "Member", glyph: glyphOf(me.name) });
const member = (name?: string | null): Author => ({ name: name || "Solveli member", role: "Member", glyph: glyphOf(name || "S") });
const toPost = (r: Row, me?: Account): Post => ({
  id: r.id, slug: r.slug ?? undefined, topic: r.topic_id, title: r.title, body: r.body, tags: r.tags ?? [], at: r.created_at,
  author: r.is_official ? SOLVELI : me && r.author_id === me.id ? you(me) : member(r.author?.full_name),
  ref: r.ref_href ? { label: r.ref_label ?? "Open reference", href: r.ref_href } : undefined,
  origin: r.is_official ? "solveli" : "member", mine: !!me && r.author_id === me.id,
  likes: r.community_reactions?.[0]?.count ?? 0, replies: r.community_comments?.[0]?.count ?? 0,
});
// Offline / not-yet-migrated fallback: Solveli's prompts, read-only.
const OFFLINE: Post[] = PROMPTS.map((x) => ({ ...x, slug: x.id, mine: false, likes: 0, replies: 0 }));
const fail = (error: { message: string } | null) => { if (error) throw error; };
const toggled = (s: Set<string>, id: string, on: boolean) => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n; };

type Status = "loading" | "ready" | "offline";
function useCommunity(me: Account | undefined) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<Status>("loading");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const sb = supabase();
    // Guests can't read member profiles (RLS), so only members embed author names and counts.
    const { data, error } = await sb.from("community_posts")
      .select(me ? `${COLS}, author:profiles(full_name), community_reactions(count), community_comments(count)` : COLS)
      .order("created_at", { ascending: false }).limit(200);
    if (error) { friendly(error); setPosts(OFFLINE); setStatus("offline"); return; }
    setPosts((data as unknown as Row[]).map((r) => toPost(r, me)));
    if (me) {
      const [l, s] = await Promise.all([
        sb.from("community_reactions").select("post_id").eq("user_id", me.id),
        sb.from("community_bookmarks").select("post_id").eq("user_id", me.id),
      ]);
      setLiked(new Set((l.data ?? []).map((x) => x.post_id as string)));
      setSaved(new Set((s.data ?? []).map((x) => x.post_id as string)));
    }
    setStatus("ready");
  }, [me]);

  // Every write surfaces a friendly message and rethrows, so callers can keep their form open.
  const run = async <T,>(fn: () => Promise<T>) => {
    try { return await fn(); } catch (e) { setNotice(friendly(e as Error)); throw e; }
  };

  const api: CommunityApi = {
    load,
    replies: async (postId) => {
      const { data, error } = await supabase().from("community_comments")
        .select("id, post_id, author_id, body, created_at, author:profiles(full_name)").eq("post_id", postId).order("created_at");
      fail(error);
      type C = { id: string; post_id: string; author_id: string; body: string; created_at: string; author: { full_name: string | null } | null };
      return ((data ?? []) as unknown as C[]).map((c) => ({
        id: c.id, postId: c.post_id, body: c.body, at: c.created_at, mine: c.author_id === me?.id,
        author: me && c.author_id === me.id ? you(me) : member(c.author?.full_name),
      }));
    },
    createPost: (p) => run(async () => {
      // author_id is filled by the database (default auth.uid()); clients cannot set it (column grants + RLS).
      const { data, error } = await supabase().from("community_posts").insert({ topic_id: p.topic, title: p.title, body: p.body, tags: p.tags }).select(COLS).single();
      fail(error);
      const post = toPost(data as Row, me);
      setPosts((xs) => [post, ...xs]);
      return post;
    }),
    reply: (postId, body) => run(async () => {
      const { data, error } = await supabase().from("community_comments").insert({ post_id: postId, body }).select("id, created_at").single();
      fail(error);
      setPosts((xs) => xs.map((x) => (x.id === postId ? { ...x, replies: x.replies + 1 } : x)));
      return { id: data!.id as string, postId, body, at: data!.created_at as string, mine: true, author: you(me!) } satisfies Reply;
    }),
    toggleLike: (id) => run(async () => {
      const on = liked.has(id);
      const bump = (k: number) => setPosts((xs) => xs.map((x) => (x.id === id ? { ...x, likes: x.likes + k } : x)));
      setLiked((s) => toggled(s, id, !on)); bump(on ? -1 : 1); // optimistic, rolled back on failure
      const sb = supabase();
      const { error } = on ? await sb.from("community_reactions").delete().eq("post_id", id).eq("user_id", me!.id) : await sb.from("community_reactions").insert({ post_id: id });
      if (error) { setLiked((s) => toggled(s, id, on)); bump(on ? 1 : -1); fail(error); }
    }),
    toggleSave: (id) => run(async () => {
      const on = saved.has(id);
      setSaved((s) => toggled(s, id, !on));
      const sb = supabase();
      const { error } = on ? await sb.from("community_bookmarks").delete().eq("post_id", id).eq("user_id", me!.id) : await sb.from("community_bookmarks").insert({ post_id: id });
      if (error) { setSaved((s) => toggled(s, id, on)); fail(error); }
    }),
    remove: (id) => run(async () => {
      const { error } = await supabase().from("community_posts").delete().eq("id", id);
      fail(error);
      setPosts((xs) => xs.filter((x) => x.id !== id));
    }),
  };
  return { api, posts, liked, saved, status, notice, setNotice };
}

const ICON: Record<string, typeof Users> = {
  all: LayoutGrid, discussions: MessageSquare, showcase: ImageIcon, study: Users, events: CalendarDays, questions: HelpCircle, collaborate: FolderGit2,
};
const d = (ms: number) => ({ "--d": `${ms}ms` }) as React.CSSProperties;
const noop = () => () => {};
const SIGN_IN = "/signin?next=/academy/community";

export default function CommunityHub({ quote, focus }: { quote?: { lines: string[]; cite: string; href: string; ctx: string }; focus?: string }) {
  const n = names(profile.use());
  const p = progress.use();
  const auth = useAuth();
  const me = auth.account;
  const { api, posts, liked, saved, status, notice, setNotice } = useCommunity(me);
  const mounted = useSyncExternalStore(noop, () => true, () => false); // relative times depend on the viewer's clock
  const [tab, setTab] = useState<"all" | Topic | "saved">("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"latest" | "liked" | "replies">("latest");
  const [open, setOpen] = useState<string | undefined>();
  const [focused, setFocused] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const signedIn = auth.status === "user";
  const { load } = api;

  // Load once the session is known, and again when it changes (guest → member adds names, counts and your likes).
  useEffect(() => { if (auth.status !== "loading") void load(); }, [auth.status, load]);

  // ?post=slug-or-id (from global search): open that post once the feed has it, then scroll to it.
  const target = focus ? posts.find((x) => x.slug === focus || x.id === focus) : undefined;
  if (target && !focused) { setFocused(true); setOpen(target.id); }
  useEffect(() => {
    if (target) document.getElementById(`post-${target.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [target]);

  const s = q.trim().toLowerCase();
  const list = posts
    .filter((x) => (tab === "all" ? true : tab === "saved" ? saved.has(x.id) : x.topic === tab))
    .filter((x) => !s || `${x.title} ${x.body} ${x.tags.join(" ")} ${x.author.name}`.toLowerCase().includes(s))
    .sort((a, b) => (sort === "liked" ? b.likes - a.likes : sort === "replies" ? b.replies - a.replies : 0) || b.at.localeCompare(a.at));
  const mine = posts.filter((x) => x.mine);
  const compose = () => dialog.current?.showModal();
  const canWrite = signedIn && status === "ready";
  const signInLink = <Link href={SIGN_IN} className="btn small ghost"><LogIn size={16} /> Sign in to post</Link>;

  return (
    <div className="lessons-page community-page">
      <div className="lp-main">
        <header className="lp-head">
          <div className="a-in" style={d(100)}>
            <h1>Community</h1>
            <p className="lp-motto">Learn together. Share, discuss, create and grow — as one Tamil world.</p>
          </div>
          {quote && (
            <Link href={quote.href} className="lp-quote glass a-in" style={d(250)}>
              <p lang="ta">“{quote.lines[0]}”</p>
              <cite>— {quote.cite}</cite>
            </Link>
          )}
        </header>

        <nav className="lp-tabs glass a-in cm-tabs" style={d(350)} aria-label="Community topics">
          {(["all", ...TOPICS.map((t) => t.id)] as const).map((id) => {
            const Icon = ICON[id];
            const label = id === "all" ? "All Posts" : TOPICS.find((t) => t.id === id)!.label;
            return <button key={id} className={tab === id ? "on" : ""} aria-pressed={tab === id} onClick={() => setTab(id)}><Icon size={18} /> {label}</button>;
          })}
          {signedIn && <button className={tab === "saved" ? "on" : ""} aria-pressed={tab === "saved"} onClick={() => setTab("saved")}><Bookmark size={18} /> Saved <small>{saved.size}</small></button>}
          {signedIn
            ? <button className="cm-new" onClick={compose} disabled={!canWrite}><Plus size={18} /> New Post</button>
            : <Link href={SIGN_IN} className="cm-new cm-signin"><LogIn size={18} /> Sign in to post</Link>}
        </nav>

        {tab === "all" && !q && (
          <section className="cm-spot glass a-in" style={d(420)}>
            <Image src="/lessons/madurai.webp" alt="" fill sizes="(min-width: 1080px) 60vw, 100vw" className="cm-spot-img" />
            <div className="cm-spot-copy">
              <span className="cm-badge">Community Spotlight</span>
              <h2>Together for a Greater Tamil Tomorrow</h2>
              <p>Share what you read, ask what puzzles you, and help Solveli grow.</p>
              {signedIn ? <button className="btn small ghost" onClick={compose} disabled={!canWrite}>Share your reading <ArrowRight size={16} /></button> : signInLink}
            </div>
            {quote && <blockquote lang="ta"><ExploreLine line={quote.lines[0]} ctx={quote.ctx} /><cite>— {quote.cite}</cite></blockquote>}
          </section>
        )}

        <section className="lp-section glass a-in" style={d(480)}>
          <header>
            <div><h2>{tab === "all" ? "Latest from the Community" : tab === "saved" ? "Saved posts" : TOPICS.find((t) => t.id === tab)!.label}</h2>
              <p>{status === "loading" ? "Loading…" : `${list.length} post${list.length === 1 ? "" : "s"}`}</p></div>
            <div className="gd-tools">
              <label className="lp-search"><Search size={16} aria-hidden="true" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search discussions, tags…" aria-label="Search community posts" />
              </label>
              <label className="gd-sort">Sort
                <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
                  <option value="latest">Latest</option><option value="liked">Most liked</option><option value="replies">Most replies</option>
                </select>
              </label>
            </div>
          </header>

          {notice && <p className="wc-warn" role="alert">{notice} <button className="link-btn" onClick={() => setNotice("")}>Dismiss</button></p>}
          {status === "offline" && <p className="wc-warn"><WifiOff size={15} /> The community server can’t be reached right now — showing Solveli’s prompts only.</p>}
          {!signedIn && auth.status !== "loading" && status === "ready" && <p className="notice">Members’ posts are visible after signing in. Guests can read Solveli’s prompts.</p>}

          {status === "loading" ? (
            <ul className="cm-feed" aria-busy="true">{[0, 1, 2].map((i) => <li key={i} className="cm-post cm-skeleton" />)}</ul>
          ) : tab === "events" ? (
            <div className="empty"><p>No events scheduled</p><p className="sub">Live events need moderators first. Until then, study circles run at your own pace.</p>
              <button className="btn outline small" onClick={() => setTab("study")}>Open Study Groups</button></div>
          ) : list.length === 0 ? (
            <div className="empty">
              <p>{tab === "saved" && !q ? "Nothing saved yet" : q ? `No posts match “${q}”` : "No posts here yet"}</p>
              <p className="sub">{tab === "saved" && !q ? "Tap the bookmark on any post to keep it here." : "Start the conversation."}</p>
              {tab !== "saved" && (signedIn ? <button className="btn teal small" onClick={compose} disabled={!canWrite}><Plus size={16} /> New Post</button> : signInLink)}
            </div>
          ) : (
            <ul className="cm-feed">
              {list.map((x, i) => (
                <PostCard key={x.id} post={x} i={i} api={api} time={mounted ? timeAgo(x.at) : ""} open={open === x.id} canWrite={canWrite}
                  liked={liked.has(x.id)} saved={saved.has(x.id)} onToggle={() => setOpen(open === x.id ? undefined : x.id)} />
              ))}
            </ul>
          )}
        </section>
      </div>

      <aside className="lp-side">
        <section className="glass journey a-in" style={d(300)}>
          <header><h2>Your Community</h2></header>
          {me ? (
            <>
              <div className="cm-me">
                <span className="avatar">{glyphOf(me.name)}</span>
                <span><b>{me.name}</b><small>Level {levelOf(p.xp)} · {n.role} · Guide: {n.guide}</small></span>
              </div>
              <ul className="jstats four">
                <li><MessageSquare size={20} /><b>{mine.length}</b>Posts</li>
                <li><Heart size={20} /><b>{mine.reduce((a, x) => a + x.likes, 0)}</b>Likes received</li>
                <li><MessageCircle size={20} /><b>{mine.reduce((a, x) => a + x.replies, 0)}</b>Replies received</li>
                <li><Bookmark size={20} /><b>{saved.size}</b>Saved</li>
              </ul>
            </>
          ) : (
            <div className="cm-me-guest">
              <p className="sub">Sign in to post, reply, like and save discussions. Your posts appear under your account name.</p>
              <Link href={SIGN_IN} className="btn small enter-world"><LogIn size={16} /> Sign in</Link>
            </div>
          )}
        </section>

        <section className="glass suggestion a-in" style={d(420)}>
          <h2><ShieldCheck size={18} /> Before you post</h2>
          <ul className="cm-rules">
            <li>You always post as <b>yourself</b> — your account name is shown and can’t be changed per post.</li>
            <li>Solveli is used by young learners too: be kind, and keep personal details out of posts.</li>
            <li>Cite your verse: link a kural or verse reference so others can check it.</li>
          </ul>
        </section>

        <section className="glass suggestion a-in" style={d(520)}>
          <h2><Users size={18} /> Study Circles</h2>
          <ul className="cm-circles">
            {posts.filter((x) => x.topic === "study" && x.origin === "solveli").map((x) => (
              <li key={x.id}><button className="link-btn" onClick={() => { setTab("study"); setOpen(x.id); }}>{x.title} <ArrowRight size={14} /></button></li>
            ))}
          </ul>
        </section>
      </aside>

      {signedIn && <NewPost dialog={dialog} onCreate={async (post) => { const made = await api.createPost(post); setTab("all"); setQ(""); setOpen(made.id); }} />}
    </div>
  );
}

function PostCard({ post: x, i, api, time, open, canWrite, liked, saved, onToggle }: {
  post: Post; i: number; api: CommunityApi; time: string; open: boolean; canWrite: boolean; liked: boolean; saved: boolean; onToggle: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [replies, setReplies] = useState<Reply[] | null>(null);
  const [busy, setBusy] = useState(false);
  const topic = TOPICS.find((t) => t.id === x.topic)?.label;

  useEffect(() => {
    if (!open || !canWrite || replies) return;
    api.replies(x.id).then(setReplies).catch(() => setReplies([]));
  }, [open, canWrite, replies, api, x.id]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const b = draft.trim();
    if (!b) return;
    setBusy(true);
    try { const r = await api.reply(x.id, b); setReplies((rs) => [...(rs ?? []), r]); setDraft(""); } catch {} finally { setBusy(false); }
  }

  return (
    <li id={`post-${x.id}`} className={`cm-post lesson-card-wrap ${x.origin}`} style={d(i * 60)}>
      <span className="avatar" lang="ta">{x.author.glyph}</span>
      <div className="cm-body">
        <p className="cm-meta"><b>{x.author.name}</b> <span>{time}</span> <span>· {topic}</span>
          {x.origin === "solveli" ? <span className="cm-prompt">{x.author.role}</span> : x.mine ? <span className="cm-local">Your post</span> : null}</p>
        <h3>{x.title}</h3>
        <p className="cm-text" lang={/[஀-௿]/.test(x.body) ? "ta" : undefined}>{x.body}</p>
        {x.ref && <Link href={x.ref.href} className="link-btn cm-ref">{x.ref.label} <ArrowRight size={14} /></Link>}
        {x.tags.length > 0 && <ul className="cm-tags">{x.tags.map((t) => <li key={t}>#{t}</li>)}</ul>}
        <div className="cm-actions">
          <button className={`cm-like ${liked ? "on" : ""}`} onClick={() => api.toggleLike(x.id).catch(() => {})} disabled={!canWrite} aria-pressed={liked}
            aria-label={liked ? "Unlike" : "Like"} title={canWrite ? undefined : "Sign in to like"}>
            <Heart size={18} fill={liked ? "currentColor" : "none"} /> {x.likes > 0 && x.likes} {liked ? "Liked" : "Like"}
          </button>
          <button onClick={onToggle} aria-expanded={open}><MessageCircle size={18} /> {x.replies} {x.replies === 1 ? "reply" : "replies"}</button>
          {canWrite && (
            <button className={saved ? "on" : ""} onClick={() => api.toggleSave(x.id).catch(() => {})} aria-pressed={saved} aria-label={saved ? "Remove bookmark" : "Save post"}>
              <Bookmark size={18} fill={saved ? "currentColor" : "none"} />
            </button>
          )}
          {x.mine && (
            <button onClick={() => confirm("Delete this post and its replies?") && api.remove(x.id).catch(() => {})} aria-label="Delete post"><Trash2 size={17} /></button>
          )}
        </div>
        {open && (
          <div className="cm-thread swap">
            {!canWrite ? <p className="sub"><Link href={SIGN_IN}>Sign in</Link> to read and write replies.</p> : replies === null ? (
              <p className="sub"><Loader2 size={15} className="spin" /> Loading replies…</p>
            ) : (
              <>
                {replies.length === 0 && <p className="sub">No replies yet — be the first.</p>}
                <ul>{replies.map((r) => <li key={r.id}><b>{r.author.name}</b> <small>{new Date(r.at).toLocaleDateString()}</small><p>{r.body}</p></li>)}</ul>
                <form onSubmit={send}>
                  <textarea value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={LIMITS.reply} rows={2} placeholder="Write a reply…" aria-label="Reply" />
                  <button className="btn teal small" disabled={!draft.trim() || busy}>{busy && <Loader2 size={15} className="spin" />} Reply</button>
                </form>
              </>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

function NewPost({ dialog, onCreate }: { dialog: React.RefObject<HTMLDialogElement | null>; onCreate: (p: Pick<Post, "topic" | "title" | "body" | "tags">) => Promise<void> }) {
  const [topic, setTopic] = useState<Topic>("discussions");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const close = () => { dialog.current?.close(); setError(""); };
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (title.trim().length < 5) return setError("Give your post a title of at least 5 characters.");
    if (body.trim().length < 10) return setError("Write at least a sentence (10 characters).");
    const t = tags.split(/[,\s#]+/).map((x) => x.trim()).filter(Boolean).slice(0, LIMITS.tags);
    setBusy(true);
    try {
      await onCreate({ topic, title: title.trim(), body: body.trim(), tags: t });
      setTitle(""); setBody(""); setTags(""); close();
    } catch (err) {
      setError(friendly(err as Error, "Your post couldn’t be published. Please try again."));
    } finally { setBusy(false); }
  }
  return (
    <dialog ref={dialog} className="cm-dialog" aria-labelledby="new-post-title" onClick={(e) => e.target === e.currentTarget && close()}>
      <form onSubmit={submit}>
        <header><h2 id="new-post-title">New Post</h2><button type="button" className="pop-x" onClick={close} aria-label="Close"><X size={18} /></button></header>
        <label>Topic
          <select value={topic} onChange={(e) => setTopic(e.target.value as Topic)}>{TOPICS.filter((t) => t.id !== "events").map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select>
        </label>
        <label>Title <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={LIMITS.title} placeholder="e.g. What does கேளிர் mean here?" /></label>
        <label>Post <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={LIMITS.body} rows={5} placeholder="Tamil, English or Tanglish. Cite the kural or verse you mean." />
          <small>{body.length} / {LIMITS.body}</small></label>
        <label>Tags <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Thirukkural, Sangam…" /></label>
        {error && <p className="wc-warn" role="alert">{error}</p>}
        <p className="fine">Posted under your account name for signed-in members to read.</p>
        <footer><button type="button" className="btn outline small" onClick={close}>Cancel</button><button className="btn teal small" disabled={busy}>{busy && <Loader2 size={15} className="spin" />} Post</button></footer>
      </form>
    </dialog>
  );
}
