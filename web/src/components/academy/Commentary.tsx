"use client";

import { useState } from "react";

const NAMES = { kalaignar: "கலைஞர் உரை", mu_va: "மு.வ உரை", solomon_pappaiah: "சாலமன் பாப்பையா உரை" } as const;

export default function Commentary({ c }: { c: Record<keyof typeof NAMES, string> }) {
  const keys = (Object.keys(NAMES) as (keyof typeof NAMES)[]).filter((k) => c[k]);
  const [on, setOn] = useState(keys[0]);
  if (!keys.length) return null;
  return (
    <section className="commentary">
      <div className="lp-tabs mini" role="tablist" aria-label="Commentaries">
        {keys.map((k) => (
          <button key={k} role="tab" aria-selected={on === k} className={on === k ? "on" : ""} onClick={() => setOn(k)} lang="ta">{NAMES[k]}</button>
        ))}
      </div>
      <p key={on} className="swap" lang="ta" role="tabpanel">{c[on]}</p>
    </section>
  );
}
