import type { Metadata } from "next";
import Link from "next/link";
import MiniDiagnostic from "@/components/MiniDiagnostic";
import { MINI_DIAGNOSTIC as d } from "@/content/guides/mini-diagnostic-ia-finance";

/** Ressource des newsletters : accès direct, aucun formulaire ni abonnement. */
export const metadata: Metadata = {
 title:"Mini-diagnostic IA pour la finance — Althoce",
 description:"15 minutes pour identifier un premier processus à automatiser, évaluer sa faisabilité et savoir par où commencer.",
 robots:{index:false,follow:false},
};

const CAL_URL = "https://cal.com/althoce-conseil-4ncbuz/30min";

export default function Page() {
 return <main className="min-h-screen bg-[#0A0A0A] text-white"><div className="mx-auto max-w-[790px] px-5 pb-20 pt-10 sm:px-8">
   <header className="flex items-center justify-between gap-3 border-b border-[#26382D] pb-6"><Link href="https://althoce.com" className="font-display text-2xl font-bold">Althoce<span className="text-[#26C08F]">.</span></Link><span className="text-right text-[10px] uppercase tracking-[0.16em] text-[#A0A0A0]">Cabinet de conseil &amp; intégration IA</span></header>

   <div className="pt-12"><p className="text-xs font-semibold tracking-[0.16em] text-[#51D9AA]">MINI-DIAGNOSTIC · FINANCE</p><h1 className="mt-4 font-display text-4xl font-bold tracking-tight sm:text-[50px] sm:leading-[1.15]">Par où commencer l’IA <span className="text-[#51D9AA]">dans votre organisation financière ?</span></h1><p className="mt-5 text-base leading-7 text-[#C5D1C9]">15 minutes pour identifier un premier processus à automatiser, évaluer sa faisabilité et savoir par où commencer.</p><nav aria-label="Étapes" className="mt-6 flex flex-wrap gap-2 text-xs">{[["taches","1. Trois tâches"],["potentiel","2. Potentiel IA"],["cas","3. Cas concrets"],["feuille-de-route","4. Feuille de route"]].map(([id,label])=><a key={id} href={`#${id}`} className="rounded-full border border-[#2B4233] px-3 py-1.5 text-[#C5D1C9] hover:border-[#51D9AA] hover:text-white">{label}</a>)}</nav></div>

   <MiniDiagnostic />

   <section className="mt-14 rounded-xl border border-[#2C4234] bg-[#122019] p-5 sm:p-6" id="sources"><h2 className="text-lg font-bold">Données et limites de l’IA</h2><p className="mt-2 text-sm leading-6 text-[#C4D1C6]">Testez d’abord avec des données fictives ou anonymisées, et ne saisissez dans un outil d’IA que les informations que vous êtes autorisé à partager. Une IA générative peut produire des réponses inexactes mais plausibles : vérifiez chaque résultat avant de l’utiliser, comme le recommande la CNIL. Ce mini-diagnostic aide à réfléchir ; il ne remplace ni une analyse de conformité ni un diagnostic professionnel.</p><ol className="mt-3 space-y-1.5 text-xs leading-5">{d.sources.map((s,i)=><li key={s.url}><span className="font-bold text-[#51D9AA]">{i+1}.</span> <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-[#E6F5EB] underline underline-offset-4">{s.label} ↗</a></li>)}</ol><p className="mt-2 text-xs text-[#82988A]">Sources consultées le {d.edition}.</p></section>

   <footer className="mt-14 border-t border-[#2A3A2D] pt-8"><h2 className="text-2xl font-semibold">Vous avez identifié un processus à automatiser ?</h2><p className="mt-3 text-sm leading-7 text-[#ADBCB0]">Chez Althoce, nous vous aidons à vérifier sa faisabilité, choisir les outils adaptés et structurer un premier déploiement maîtrisé.</p><a href={CAL_URL} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex rounded-lg bg-[#1D9E75] px-5 py-3 text-sm font-semibold text-[#081D12] hover:bg-[#26C08F]">Échanger 30 minutes avec Althoce ↗</a><p className="mt-8 text-xs text-[#82988A]">Althoce · Cabinet de conseil &amp; intégration IA · Le partenaire IA des professions réglementées</p></footer>
 </div></main>
}
