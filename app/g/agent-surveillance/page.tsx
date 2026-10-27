import type { Metadata } from "next";
import Link from "next/link";
import { AGENT_SURVEILLANCE as fiche } from "@/content/guides/agent-surveillance";
import ManualReviewCalculator from "@/components/ManualReviewCalculator";

export const metadata: Metadata = {
 title:"Agent Surveillance : la fiche complète — Althoce",
 description:"Les délais qui courent quand une pièce tombe sur un portail, le temps du relevé à la main, et ce que l’agent Surveillance relève chaque nuit pour le cabinet.",
 robots:{index:false,follow:false},
};

const CAL_URL = "https://cal.com/althoce-conseil-4ncbuz/30min";

function Refs({ ns }: { ns: number[] }) {
 return <>{ns.map(n=><a key={n} href="#sources" className="ml-1 text-[#81E7B8] underline underline-offset-2">[{n}]</a>)}</>;
}

const NAV = [["enjeux","Ce que coûte un oubli"],["temps","Le relevé à la main"],["releves","Ce que l’agent relève"],["matin","Le point du matin"],["mise-en-route","Mise en route"],["garanties","Garanties"]] as const;

export default function Page() {
 return <main className="min-h-screen bg-[#0A0A0A] text-white"><div className="mx-auto max-w-[790px] px-5 pb-20 pt-10 sm:px-8">
   <header className="flex items-center justify-between gap-3 border-b border-[#26382D] pb-6"><Link href="https://althoce.com" className="font-display text-2xl font-bold">Althoce<span className="text-[#26C08F]">.</span></Link><span className="text-right text-[10px] uppercase tracking-[0.16em] text-[#A0A0A0]">Cabinet de conseil &amp; intégration IA</span></header>

   <div className="pt-12"><p className="text-xs font-semibold tracking-[0.16em] text-[#51D9AA]">AGENT ALTHOCE · FICHE COMPLÈTE · {fiche.edition.toUpperCase()}</p><h1 className="mt-4 font-display text-4xl font-bold tracking-tight sm:text-[54px] sm:leading-[1.15]">Vos clients relevés chaque nuit, <span className="text-[#51D9AA]">sans que personne ne se connecte.</span></h1><p className="mt-5 text-base leading-7 text-[#C5D1C9]">{fiche.intro}</p>
     <dl className="mt-6 grid grid-cols-3 divide-x divide-[#26382D] rounded-xl border border-[#26382D] text-center">{[[String(fiche.stakes.length),"délais vérifiés"],[String(fiche.sources.length),"sources relevées chaque nuit"],["1","point du matin"]].map(([n,l])=><div key={l} className="px-2 py-4"><dt className="sr-only">{l}</dt><dd><span className="block font-display text-3xl font-bold text-[#51D9AA]">{n}</span><span className="mt-1 block text-[11px] leading-4 text-[#A9B9AB]">{l}</span></dd></div>)}</dl>
     <nav aria-label="Sommaire" className="mt-6 flex flex-wrap gap-2 text-xs">{NAV.map(([id,label])=><a key={id} href={`#${id}`} className="rounded-full border border-[#2B4233] px-3 py-1.5 text-[#C5D1C9] hover:border-[#51D9AA] hover:text-white">{label}</a>)}</nav></div>

   <section id="enjeux" className="mt-14 scroll-mt-6"><p className="text-xs font-bold tracking-widest text-[#51D9AA]">CE QUE COÛTE UN OUBLI</p><h2 className="mt-2 text-2xl font-semibold">Les délais qui courent dès qu’une pièce tombe</h2><p className="mt-2 text-sm leading-6 text-[#ADBDB1]">Personne ne vous prévient : la pièce attend sur le portail, le délai court quand même.</p>
     <ol className="mt-6 divide-y divide-[#22322A] rounded-xl border border-[#2B4233] bg-[#111711]">{fiche.stakes.map(s=><li key={s.event} className="grid gap-1 p-4 sm:grid-cols-[200px_1fr] sm:gap-5 sm:p-5"><div><p className="text-[11px] font-bold uppercase tracking-wider text-[#51D9AA]">{s.source}</p><p className="mt-0.5 font-semibold">{s.event}</p></div><p className="text-sm leading-6 text-[#C5D8CB]">{s.rule}<Refs ns={s.refs}/></p></li>)}</ol></section>

   <section id="temps" className="mt-14 scroll-mt-6"><p className="text-xs font-bold tracking-widest text-[#51D9AA]">LE RELEVÉ À LA MAIN</p><h2 className="mt-2 text-2xl font-semibold">Combien d’heures pour votre cabinet ?</h2><p className="mt-2 text-sm leading-6 text-[#ADBDB1]">Impôts, URSSAF, BODACC : chaque portail, pour chaque dossier, à chaque passage.</p>
     <div className="mt-6"><ManualReviewCalculator/></div></section>

   <section id="releves" className="mt-14 scroll-mt-6"><p className="text-xs font-bold tracking-widest text-[#51D9AA]">CE QUE L’AGENT RELÈVE</p><h2 className="mt-2 text-2xl font-semibold">Chaque nuit, sur chaque dossier</h2>
     <div className="mt-6 grid gap-3 sm:grid-cols-2">{fiche.sources.map(s=><article key={s.id} id={`source-${s.id}`} className="rounded-xl border border-[#2B4233] bg-[#111711] p-5"><h3 className="text-lg font-semibold">{s.name}</h3><p className="mt-0.5 text-xs text-[#96B09E]">{s.where}</p><ul className="mt-3 space-y-1.5 text-sm leading-6 text-[#DAE6DC]">{s.reads.map(r=><li key={r} className="flex gap-2"><span aria-hidden="true" className="text-[#51D9AA]">✓</span><span>{r}</span></li>)}</ul>{s.detail && <p className="mt-3 text-xs leading-5 text-[#A9B9AB]">{s.detail}</p>}</article>)}</div></section>

   <section id="matin" className="mt-14 scroll-mt-6"><p className="text-xs font-bold tracking-widest text-[#51D9AA]">LE POINT DU MATIN</p><h2 className="mt-2 text-2xl font-semibold">Uniquement le neuf, rangé au bon dossier</h2>
     <figure className="mt-6 overflow-hidden rounded-xl border border-[#346B4E] bg-[#0D1A12]"><div className="flex items-center justify-between gap-3 border-b border-[#244A35] px-4 py-3 sm:px-5"><p className="text-sm font-semibold">Point du matin</p><p className="text-xs text-[#96B09E]">{fiche.morningExample.length} nouveautés · {fiche.morningExample.filter(m=>m.alert).length} alertes ouvertes</p></div>
       <ul className="divide-y divide-[#1F3A2A]">{fiche.morningExample.map(m=><li key={m.file} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5"><div className="min-w-0"><p className="text-[11px] font-bold uppercase tracking-wider text-[#51D9AA]">{m.portal} <span className="font-normal normal-case tracking-normal text-[#96B09E]">· {m.file}</span></p><p className="mt-0.5 text-sm text-[#E6F5EB]">{m.event}</p></div><span className={`shrink-0 self-start rounded-full px-2.5 py-1 text-[11px] font-semibold sm:self-center ${m.alert?"bg-[#3A1E14] text-[#F2A07B]":"bg-[#16301F] text-[#9FE3C1]"}`}>{m.status}</span></li>)}</ul>
       <figcaption className="border-t border-[#244A35] px-4 py-2.5 text-[11px] text-[#82988A] sm:px-5">Exemple fictif : dossiers anonymes, aucune donnée réelle.</figcaption></figure>
     <div className="mt-4 grid gap-3 sm:grid-cols-2">{fiche.morning.map(m=><div key={m.title} className="rounded-xl border border-[#283A2E] bg-[#111711] p-4"><h3 className="text-sm font-bold">{m.title}</h3><p className="mt-1 text-sm leading-6 text-[#ADBDB1]">{m.text}</p></div>)}</div></section>

   <section id="mise-en-route" className="mt-14 scroll-mt-6"><p className="text-xs font-bold tracking-widest text-[#51D9AA]">LA MISE EN ROUTE</p><h2 className="mt-2 text-2xl font-semibold">Trois étapes, à partir de votre liste de clients</h2>
     <ol className="mt-6 grid gap-3 sm:grid-cols-3">{fiche.steps.map((st,i)=><li key={st.title} className="rounded-xl border border-[#283A2E] bg-[#111711] p-5"><span className="text-xs font-bold text-[#51D9AA]">0{i+1}</span><h3 className="mt-2 font-bold">{st.title}</h3><p className="mt-2 text-sm leading-6 text-[#ADBDB1]">{st.text}</p></li>)}</ol>
     <p className="mt-4 text-sm leading-6 text-[#C5D1C9]">{fiche.launch}</p></section>

   <section id="garanties" className="mt-14 scroll-mt-6"><p className="text-xs font-bold tracking-widest text-[#51D9AA]">CE QUI EST GARANTI</p>
     <ul className="mt-4 grid gap-3 sm:grid-cols-3">{fiche.guarantees.map(g=><li key={g.title} className="rounded-xl border border-[#346B4E] bg-[#11251A] p-5"><h3 className="font-bold">{g.title}</h3><p className="mt-2 text-sm leading-6 text-[#C5D8CB]">{g.text}</p></li>)}</ul></section>

   <section id="proposition" className="mt-14 scroll-mt-6 border-t border-[#2A3A2D] pt-8"><p className="text-xs font-bold tracking-widest text-[#51D9AA]">NOTRE PROPOSITION</p><h2 className="mt-2 text-2xl font-semibold">Le package Surveillance, posé dans votre cabinet</h2><p className="mt-3 text-sm leading-7 text-[#ADBCB0]">{fiche.offer}</p><a href={CAL_URL} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex rounded-lg bg-[#1D9E75] px-5 py-3 text-sm font-semibold text-[#081D12] hover:bg-[#26C08F]">Voir l’agent sur votre cabinet ↗</a></section>

   <section className="mt-12" id="sources"><h2 className="text-lg font-semibold">Sources officielles</h2><p className="mt-1 text-xs text-[#A9B9AB]">Consultées le {fiche.edition}. Vérifiez à la date de votre lecture ; ce rappel ne remplace pas l’analyse de chaque dossier.</p><ol className="mt-3 space-y-1.5 text-xs leading-5">{fiche.officialSources.map((s,i)=><li key={s.url}><span className="font-bold text-[#51D9AA]">{i+1}.</span> <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-[#E6F5EB] underline underline-offset-4">{s.label} ↗</a></li>)}</ol></section>

   <footer className="mt-12 border-t border-[#2A3A2D] pt-6"><p className="text-xs leading-5 text-[#82988A]">Fiche rédigée par Espoir Mwami, Althoce · Le partenaire IA des professions réglementées. L’agent ne paie, ne déclare et ne signe jamais à la place du cabinet.</p></footer>
 </div></main>
}
