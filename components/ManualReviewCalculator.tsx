"use client";
import { useState } from "react";
import { manualReviewHours } from "@/content/guides/agent-surveillance";

/** Fiche Agent Surveillance : temps du relevé à la main, à partir des chiffres du lecteur (rien n'est enregistré). */
const FIELDS = [
  { key: "files", label: "Dossiers", max: 5000 },
  { key: "portals", label: "Portails", max: 10 },
  { key: "minutes", label: "Min. / portail", max: 60 },
  { key: "perMonth", label: "Relevés / mois", max: 31 },
] as const;
type Key = (typeof FIELDS)[number]["key"];

export default function ManualReviewCalculator() {
  const [v, setV] = useState<Record<Key, number>>({ files: 80, portals: 3, minutes: 3, perMonth: 4 });
  const { month, year } = manualReviewHours(v);
  const fr = (n: number) => n.toLocaleString("fr-FR");
  return <div className="rounded-[18px] border border-[color:var(--border)] bg-[color:var(--surface)] p-6 sm:p-7">
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">{FIELDS.map(f=><label key={f.key} className="block"><span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--fg-subtle)]">{f.label}</span><input type="number" inputMode="numeric" min={0} max={f.max} value={Number.isFinite(v[f.key]) ? v[f.key] : ""} onChange={e=>setV({...v,[f.key]:Math.min(f.max, Number(e.target.value))})} className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-2)] px-3.5 py-2.5 text-[15px] tabular-nums text-[color:var(--fg)] transition-colors duration-150 focus:border-[rgb(81_217_170/0.55)] focus:outline-none"/></label>)}</div>
    <div className="mt-7 flex flex-wrap items-end gap-x-6 gap-y-2 border-t border-[color:var(--border)] pt-6" aria-live="polite">
      <p><span className="text-[36px] font-semibold leading-none tracking-[-0.03em] tabular-nums">{fr(month)}</span><span className="ml-1.5 text-[15px] text-[color:var(--fg-muted)]">h par mois</span></p>
      <p className="pb-1 text-[13px] tabular-nums text-[color:var(--fg-muted)]">soit {fr(year)} h par an à ouvrir des portails</p>
    </div>
    <p className="mt-3 text-[11.5px] text-[color:var(--fg-subtle)]">Valeurs d’exemple : remplacez-les par celles de votre cabinet. Rien n’est enregistré.</p>
  </div>;
}
