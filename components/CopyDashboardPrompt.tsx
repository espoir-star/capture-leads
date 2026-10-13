"use client";
import { useState } from "react";
export default function CopyDashboardPrompt({ text }: { text: string }) {
  const [status,setStatus]=useState<"idle"|"done"|"error">("idle");
  async function copy() { try { await navigator.clipboard.writeText(text); setStatus("done"); } catch { setStatus("error"); } }
  return <button type="button" onClick={copy} aria-label="Copier le prompt" className="rounded-lg bg-[#1D9E75] px-4 py-2.5 text-sm font-semibold text-[#081D12] hover:bg-[#26C08F] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#26C08F]">{status==="done"?"Copié":status==="error"?"Sélectionner le texte":"Copier le prompt"}</button>;
}
