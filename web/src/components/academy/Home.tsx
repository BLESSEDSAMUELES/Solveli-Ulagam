"use client";

import { useT } from "@/lib/i18n";
import { WorldGrid } from "@/components/academy/ui";

const d = (ms: number) => ({ "--d": `${ms}ms` }) as React.CSSProperties;

export default function Home({ counts }: { counts: Record<string, string> }) {
  const { t, lang } = useT();
  return (
    <div className="home">
      {/* Each line enters on its own beat; `key={lang}` replays a soft crossfade when the language switches. */}
      <section className="welcome">
        <h1 key={lang} lang={lang} className="swap">
          <span className="a-in" style={d(250)}>{t("welcomeTo")}</span>
          <span className="a-in title" style={d(380)}>{t("academy")}</span>
        </h1>
        <p key={`m-${lang}`} className="motto a-in swap" lang={lang} style={d(520)}>{t("motto")}</p>
        <hr className="a-in rule" style={d(640)} />
        <p lang="ta" className="welcome-ta a-in" style={d(740)}>“தமிழ் ஒரு மொழி அல்ல,<br />ஒரு உலகம்.”</p>
        <p className="quote-en a-in" style={d(840)}>Tamil is not just a language,<br />it is a world.</p>
      </section>

      <WorldGrid counts={counts} delay={700} />

      <p className="floor-mark a-in" style={d(1250)}>
        <span lang="ta">சொல்வெளி</span>
        A richer tomorrow through Tamil.
      </p>
    </div>
  );
}
