"use client";

import Link from "next/link";
import { Globe } from "lucide-react";
import { useEffect } from "react";
import { lang } from "@/lib/profile";

export function Logo() {
  return (
    <Link href="/" className="logo" aria-label="Solveli home">
      <svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true">
        <g fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="24" cy="24" r="11" />
          <circle cx="24" cy="24" r="15.5" strokeDasharray="2 3" />
          {Array.from({ length: 8 }, (_, i) => (
            <path key={i} d="M24 2 L26 8 L24 6.5 L22 8 Z" transform={`rotate(${i * 45} 24 24)`} fill="currentColor" />
          ))}
        </g>
        <circle cx="24" cy="21.5" r="3.4" fill="currentColor" />
        <path d="M22.4 23.5h3.2l1.2 7.5h-5.6z" fill="currentColor" />
      </svg>
      <span>
        <span className="logo-en">SOLVELI</span>
        <span className="logo-ta" lang="ta">சொல்வெளி</span>
      </span>
    </Link>
  );
}

export function Tagline() {
  return <p className="tagline">Every Tamil word<br />has a world inside it.</p>;
}

// Saves the preference and switches the Academy interface strings (lib/i18n). Evidence always stays in Tamil.
export function LangToggle() {
  const { lang: l } = lang.use();
  useEffect(() => { document.documentElement.lang = l; }, [l]);
  return (
    <button
      type="button"
      className="pill lang"
      aria-label={`Language: ${l === "ta" ? "Tamil" : "English"}. Switch to ${l === "ta" ? "English" : "Tamil"}`}
      onClick={() => lang.set({ lang: l === "ta" ? "en" : "ta" })}
    >
      <Globe size={17} className="spin-on-hover" /> <span className={l === "en" ? "on" : ""}>EN</span> <span className="sep">|</span>{" "}
      <span lang="ta" className={l === "ta" ? "on" : ""}>தமிழ்</span>
    </button>
  );
}

export function FooterLine({ className = "" }: { className?: string }) {
  return (
    <p className={`footer-line ${className}`}>
      <b>SOLVELI</b> <span className="sep">|</span> PEOPLE · WORDS · WORLDS · TOGETHER
    </p>
  );
}
