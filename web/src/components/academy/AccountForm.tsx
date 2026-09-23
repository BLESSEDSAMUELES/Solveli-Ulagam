"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Loader2, LogOut } from "lucide-react";
import { friendly, signOut } from "@/lib/auth";
import { lang } from "@/lib/profile";
import { supabase } from "@/lib/supabase/client";

// Editable part of My Account: display name (RLS: only your own row) and sign-out.
export default function AccountForm({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [value, setValue] = useState(name);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState("");
  const l = lang.use().lang;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const full_name = value.trim();
    if (full_name.length < 2) return setError("Use at least two characters.");
    setError("");
    setState("saving");
    const { error } = await supabase().from("profiles").update({ full_name }).eq("id", id);
    if (error) { setState("idle"); return setError(friendly(error)); }
    setState("saved");
    router.refresh();
  }

  return (
    <div className="account-form">
      <form onSubmit={save}>
        <label>Display name
          <input value={value} onChange={(e) => { setValue(e.target.value); setState("idle"); }} maxLength={80} autoComplete="name" />
        </label>
        <button className="btn teal small" disabled={state === "saving" || value.trim() === name}>
          {state === "saving" ? <Loader2 size={16} className="spin" /> : state === "saved" ? <Check size={16} /> : null} {state === "saved" ? "Saved" : "Save"}
        </button>
      </form>
      <label className="account-lang">Interface language
        <select value={l} onChange={(e) => lang.set({ lang: e.target.value as "en" | "ta" })}>
          <option value="en">English</option><option value="ta">தமிழ்</option>
        </select>
      </label>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <button className="btn outline small" onClick={async () => { await signOut(); router.push("/signin"); router.refresh(); }}>
        <LogOut size={16} /> Sign out
      </button>
    </div>
  );
}
