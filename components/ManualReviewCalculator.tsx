"use client";
import { useState } from "react";
import { manualReviewHours } from "@/content/guides/agent-surveillance";

/** Fiche Agent Surveillance : temps du relevé à la main, à partir des chiffres du lecteur (rien n'est enregistré). */
const FIELDS = [
  { key: "files", label: "Dossiers suivis", max: 5000 },
  { key: "portals", label: "Portails par dossier", max: 10 },
  { key: "minutes", label: "Minutes par portail", max: 60 },
  { key: "perMonth", label: "Relevés par mois", max: 31 },
] as const;
type Key = (typeof FIELDS)[number]["key"];

export default function ManualReviewCalculator() {
  const [v, setV] = useState<Record<Key, number>>({ files: 80, portals: 3, minutes: 3, perMonth: 4 });
  const { month, year } = manualReviewHours(v);
  const fr = (n: number) => n.toLocaleString("fr-FR");
  return <div className="rounded-xl border border-[#2B4233] bg-[#111711] p-5 sm:p-6">
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{FIELDS.map(f=><label key={f.key} className="text-xs text-[#A9B9AB]">{f.label}<input type="number" inputMode="numeric" min={0} max={f.max} value={Number.isFinite(v[f.key]) ? v[f.key] : ""} onChange={e=>setV({...v,[f.key]:Math.min(f.max, Number(e.target.value))})} className="mt-1.5 w-full rounded-lg border border-[#2D4335] bg-[#090E0A] px-3 py-2.5 text-base font-semibold text-white focus:border-[#51D9AA] focus:outline-none"/></label>)}</div>
    <p className="mt-5 text-sm text-[#C5D8CB]" aria-live="polite">Soit environ <strong className="text-2xl text-[#51D9AA]">{fr(month)} h</strong> par mois, <strong className="text-white">{fr(year)} h</strong> par an, passées à ouvrir des portails.</p>
    <p className="mt-2 text-xs leading-5 text-[#82988A]">Valeurs d’exemple : remplacez-les par celles de votre cabinet. Rien n’est enregistré.</p>
  </div>;
}
