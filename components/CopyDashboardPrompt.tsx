"use client";
import { useState } from "react";
/** Bouton de copie des guides (nom historique : premier usage dans le guide Dashboards). */
export default function CopyDashboardPrompt({ text, label = "Copier le prompt" }: { text: string; label?: string }) {
  const [status,setStatus]=useState<"idle"|"done"|"error">("idle");
  async function copy() { try { await navigator.clipboard.writeText(text); setStatus("done"); } catch { setStatus("error"); } }
  return <button type="button" onClick={copy} aria-label={label} className="shrink-0 rounded-lg bg-[#1D9E75] px-4 py-2.5 text-sm font-semibold text-[#081D12] hover:bg-[#26C08F] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#26C08F]">{status==="done"?"Copié":status==="error"?"Sélectionner le texte":label}</button>;
}
