"use client";
import { useState } from "react";

/** Bouton de copie en pilule (fiches au standard davinci). Rien n'est envoyé : copie locale dans le presse-papiers. */
export default function CopyPillButton({ text, label, done = "Copié" }: { text: string; label: string; done?: string }) {
  const [status, setStatus] = useState<"idle" | "done" | "error">("idle");
  /* Repli sans API presse-papiers (navigateur intégré, page non sécurisée) : zone de texte temporaire. */
  function fallback(): boolean {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
  async function copy() {
    try { await navigator.clipboard.writeText(text); setStatus("done"); } catch { setStatus(fallback() ? "done" : "error"); }
  }
  return <button type="button" onClick={copy} className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[color:var(--border-strong)] px-4 py-2 text-[13px] font-medium text-[color:var(--fg)] transition-colors duration-150 hover:bg-[color:var(--surface-2)] active:scale-[0.985]">{status === "done" ? done : status === "error" ? "Copie impossible ici" : label}</button>;
}
