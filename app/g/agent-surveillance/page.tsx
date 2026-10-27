import type { Metadata } from "next";
import Link from "next/link";
import { AGENT_SURVEILLANCE as fiche } from "@/content/guides/agent-surveillance";

export const metadata: Metadata = {
 title:"Agent Surveillance : la fiche complète — Althoce",
 description:"Ce que l’agent Surveillance relève chaque nuit sur les espaces officiels de vos clients, ce que vous recevez le matin, la mise en route et les garanties.",
 robots:{index:false,follow:false},
};

const CAL_URL = "https://cal.com/althoce-conseil-4ncbuz/30min";

function Refs({ ns }: { ns: number[] }) {
 return <>{ns.map(n=><a key={n} href="#sources" className="ml-1 text-[#81E7B8] underline underline-offset-2">[{n}]</a>)}</>;
}

const NAV = [["releves","Ce qu’il relève"],["matin","Le matin"],["mise-en-route","Mise en route"],["garanties","Garanties"],["proposition","Proposition"]] as const;

export default function Page() {
 return <main className="min-h-screen bg-[#0A0A0A] text-white"><div className="mx-auto max-w-[790px] px-5 pb-20 pt-10 sm:px-8">
   <header className="flex items-center justify-between gap-3 border-b border-[#26382D] pb-6"><Link href="https://althoce.com" className="font-display text-2xl font-bold">Althoce<span className="text-[#26C08F]">.</span></Link><span className="text-right text-[10px] uppercase tracking-[0.16em] text-[#A0A0A0]">Cabinet de conseil &amp; intégration IA</span></header>

   <div className="pt-12"><p className="text-xs font-semibold tracking-[0.16em] text-[#51D9AA]">AGENT ALTHOCE · FICHE COMPLÈTE · {fiche.edition.toUpperCase()}</p><h1 className="mt-4 font-display text-4xl font-bold tracking-tight sm:text-[54px] sm:leading-[1.15]">Vos clients relevés chaque nuit, <span className="text-[#51D9AA]">sans que personne ne se connecte.</span></h1><p className="mt-5 text-base leading-7 text-[#C5D1C9]">{fiche.intro}</p><p className="mt-4 text-sm text-[#96B09E]">Pour les experts-comptables et dirigeants de cabinets · {fiche.sources.length} sources surveillées · lecture seule</p>
     <nav aria-label="Sommaire" className="mt-6 flex flex-wrap gap-2 text-xs">{NAV.map(([id,label])=><a key={id} href={`#${id}`} className="rounded-full border border-[#2B4233] px-3 py-1.5 text-[#C5D1C9] hover:border-[#51D9AA] hover:text-white">{label}</a>)}</nav></div>

   <section id="releves" className="mt-12 scroll-mt-6"><p className="text-xs font-bold tracking-widest text-[#51D9AA]">CE QU’IL RELÈVE</p><h2 className="mt-2 text-2xl font-semibold">Sur chaque dossier du portefeuille</h2>
     <div className="mt-6 grid gap-3 sm:grid-cols-2">{fiche.sources.map(s=><article key={s.id} id={`source-${s.id}`} className="flex flex-col rounded-xl border border-[#2B4233] bg-[#111711] p-5"><h3 className="text-lg font-semibold">{s.name}</h3><p className="mt-0.5 text-xs text-[#96B09E]">{s.where}</p><ul className="mt-3 space-y-1.5 text-sm leading-6 text-[#DAE6DC]">{s.reads.map(r=><li key={r} className="flex gap-2"><span aria-hidden="true" className="text-[#51D9AA]">✓</span><span>{r}</span></li>)}</ul>{s.detail && <p className="mt-3 text-xs leading-5 text-[#A9B9AB]">{s.detail}</p>}{s.context && <div className="mt-auto pt-4"><p className="border-t border-[#2D4335] pt-3 text-xs leading-5 text-[#C5D8CB]"><span className="font-semibold text-white">Bon à savoir. </span>{s.context.text}<Refs ns={s.context.sources}/></p></div>}</article>)}</div></section>

   <section id="matin" className="mt-12 scroll-mt-6"><p className="text-xs font-bold tracking-widest text-[#51D9AA]">LE MATIN</p><h2 className="mt-2 text-2xl font-semibold">Ce que vous recevez</h2>
     <div className="mt-6 grid gap-3 sm:grid-cols-2">{fiche.morning.map(m=><div key={m.title} className="rounded-xl border border-[#283A2E] bg-[#111711] p-5"><h3 className="font-bold">{m.title}</h3><p className="mt-2 text-sm leading-6 text-[#ADBDB1]">{m.text}</p></div>)}</div>
     <p className="mt-4 rounded-xl border border-[#346B4E] bg-[#11251A] px-5 py-4 text-base font-semibold leading-7 text-[#DAF5E6]">{fiche.highlight}</p></section>

   <section id="mise-en-route" className="mt-12 scroll-mt-6"><p className="text-xs font-bold tracking-widest text-[#51D9AA]">LA MISE EN ROUTE</p><h2 className="mt-2 text-2xl font-semibold">Trois étapes, à partir de votre liste de clients</h2>
     <ol className="mt-6 grid gap-3 sm:grid-cols-3">{fiche.steps.map((st,i)=><li key={st.title} className="rounded-xl border border-[#283A2E] bg-[#111711] p-5"><span className="text-xs font-bold text-[#51D9AA]">0{i+1}</span><h3 className="mt-2 font-bold">{st.title}</h3><p className="mt-2 text-sm leading-6 text-[#ADBDB1]">{st.text}</p></li>)}</ol>
     <p className="mt-4 text-sm leading-6 text-[#C5D1C9]">{fiche.launch}</p></section>

   <section id="garanties" className="mt-12 scroll-mt-6 rounded-xl border border-[#346B4E] bg-[#11251A] p-5 sm:p-6"><p className="text-xs font-bold tracking-widest text-[#51D9AA]">CE QUI EST GARANTI</p>
     <ul className="mt-4 space-y-4">{fiche.guarantees.map(g=><li key={g.title}><h3 className="font-bold">{g.title}</h3><p className="mt-1 text-sm leading-6 text-[#C5D8CB]">{g.text}</p></li>)}</ul></section>

   <section id="proposition" className="mt-12 scroll-mt-6 border-t border-[#2A3A2D] pt-8"><p className="text-xs font-bold tracking-widest text-[#51D9AA]">NOTRE PROPOSITION</p><h2 className="mt-2 text-2xl font-semibold">Le package Surveillance, posé dans votre cabinet</h2><p className="mt-3 text-sm leading-7 text-[#ADBCB0]">{fiche.offer}</p><a href={CAL_URL} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex rounded-lg bg-[#1D9E75] px-5 py-3 text-sm font-semibold text-[#081D12] hover:bg-[#26C08F]">Voir l’agent sur votre cabinet ↗</a></section>

   <section className="mt-12" id="sources"><h2 className="text-lg font-semibold">Sources officielles</h2><p className="mt-1 text-xs text-[#A9B9AB]">Pour les encadrés « Bon à savoir ». Consultées le {fiche.edition} : vérifiez à la date de votre lecture.</p><ol className="mt-3 space-y-1.5 text-xs leading-5">{fiche.officialSources.map((s,i)=><li key={s.url}><span className="font-bold text-[#51D9AA]">{i+1}.</span> <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-[#E6F5EB] underline underline-offset-4">{s.label} ↗</a></li>)}</ol></section>

   <footer className="mt-12 border-t border-[#2A3A2D] pt-6"><p className="text-xs leading-5 text-[#82988A]">Fiche rédigée par Espoir Mwami, Althoce · Le partenaire IA des professions réglementées. L’agent ne paie, ne déclare et ne signe jamais à la place du cabinet.</p></footer>
 </div></main>
}
