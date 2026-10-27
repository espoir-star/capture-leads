import type { ReactNode } from "react";
import type { Metadata } from "next";
import BrandLogo from "@/components/BrandLogo";
import { AGENT_SURVEILLANCE as fiche, einvoiceTableTsv } from "@/content/guides/agent-surveillance";
import ManualReviewCalculator from "@/components/ManualReviewCalculator";
import CopyPillButton from "@/components/CopyPillButton";
import { Icon, type IconName } from "@/components/icons/lucide";

export const metadata: Metadata = {
 title:"Agent Surveillance : la fiche complète — Althoce",
 description:"La checklist des portails de vos clients (impôts, URSSAF, BODACC, facturation électronique), le tableau de suivi à copier, puis l’agent qui l’applique chaque nuit.",
 robots:{index:false,follow:false},
};

const CAL_URL = "https://cal.com/althoce-conseil-4ncbuz/30min";

const label = "text-[11px] font-semibold uppercase tracking-[0.16em]";
const card = "rounded-[18px] border border-[color:var(--border)] bg-[color:var(--surface)]";
const tile = "flex size-7 shrink-0 items-center justify-center rounded-lg bg-[color:var(--surface-2)] text-[color:var(--fg-muted)]";
const pill = "inline-flex items-center gap-2 rounded-full px-[22px] py-3 text-[14px] font-medium transition-colors duration-150 active:scale-[0.985]";
const primary = `${pill} bg-action text-white hover:bg-action-hover`;

function Refs({ ns }: { ns: number[] }) {
 return <>{ns.map(n=><a key={n} href="#sources" className="ml-1 text-[12px] text-[color:var(--accent)] tabular-nums hover:underline">[{n}]</a>)}</>;
}

function Section({ id, eyebrow, title, sub, children }: { id: string; eyebrow: string; title: string; sub?: ReactNode; children: ReactNode }) {
 return <section id={id} className="mt-20 scroll-mt-8"><p className={`${label} text-[color:var(--accent)]`}>{eyebrow}</p><h2 className="mt-3 text-[26px] font-semibold leading-[1.15] tracking-[-0.03em] sm:text-[28px]">{title}</h2>{sub && <p className="mt-2 text-[15px] leading-relaxed text-[color:var(--fg-muted)]">{sub}</p>}<div className="mt-7">{children}</div></section>;
}

function Badge({ tone, className = "", children }: { tone: "warn" | "ok"; className?: string; children: ReactNode }) {
 const c = tone === "warn" ? "border-alerte/25 bg-alerte/10 text-alerte" : "border-accent/25 bg-accent/10 text-accent";
 return <span className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-medium tabular-nums ${c} ${className}`}><span className="size-1.5 rounded-full bg-current"/>{children}</span>;
}

export default function Page() {
 const alerts = fiche.morningExample.filter(m=>m.alert).length;
 const t = fiche.einvoiceTable;
 return <main className="min-h-screen bg-fond text-texte antialiased"><div className="mx-auto max-w-[760px] px-5 pb-24 pt-8 sm:px-8">
   <header className="flex items-center justify-between gap-3 border-b border-[color:var(--border)] pb-6"><BrandLogo/><span className={`${label} text-right text-[color:var(--fg-subtle)]`}>Conseil &amp; intégration IA</span></header>

   <div className="pt-14"><p className={`${label} text-[color:var(--accent)]`}>Agent Althoce · Surveillance</p>
     <h1 className="mt-4 text-[36px] font-semibold leading-[1.05] tracking-[-0.03em] sm:text-[52px]">Vos clients relevés chaque nuit, <span className="text-accent">sans que personne ne se connecte.</span></h1>
     <p className="mt-6 max-w-[600px] text-[16px] leading-relaxed text-[color:var(--fg-muted)]">{fiche.intro}</p>
     <div className="mt-8 flex flex-wrap gap-3"><a href="#checklist" className={primary}>La checklist du cabinet<Icon name="arrowDown" size={14}/></a><a href={CAL_URL} target="_blank" rel="noopener noreferrer" className={`${pill} border border-[color:var(--border-strong)] text-[color:var(--fg)] hover:bg-[color:var(--surface-2)]`}>Voir l’agent sur votre cabinet<Icon name="arrowUpRight" size={14}/></a></div>
     <p className="mt-5 flex items-center gap-2 text-[13px] text-[color:var(--fg-muted)]"><Icon name="check" size={14} className="text-[color:var(--accent)]"/>{fiche.proof}</p></div>

   <Section id="checklist" eyebrow="La méthode, portail par portail" title="Ce qu’il faut guetter, et quoi faire" sub="Applicable dès demain, avec ou sans agent.">
     <ol className={`${card} divide-y divide-[color:var(--border)]`}>{fiche.checklist.map(c=><li key={c.item} className="flex gap-4 px-5 py-5 sm:px-6"><span className={`${tile} mt-0.5`}><Icon name={c.icon as IconName} size={14}/></span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><div><p className="text-[11.5px] text-[color:var(--fg-subtle)]">{c.portal}</p><p className="mt-0.5 text-[15px] font-semibold leading-tight">{c.item}</p></div><Badge tone="warn">{c.when}</Badge></div>{"where" in c && c.where && <p className="mt-2 text-[12.5px] leading-relaxed text-[color:var(--fg-subtle)]">{c.where}</p>}<p className="mt-2 text-[13.5px] leading-relaxed text-[color:var(--fg-muted)]"><span className="font-medium text-[color:var(--fg)]">À faire : </span>{c.action}<Refs ns={c.refs}/></p></div></li>)}</ol>
   </Section>

   <Section id="tableau" eyebrow="Facturation électronique" title="Le tableau de suivi, prêt à copier" sub={<>{t.note}<Refs ns={t.refs}/></>}>
     <div className={card}>
       <ol className="grid gap-x-8 gap-y-5 p-6 sm:grid-cols-2 sm:p-7">{t.columns.map((col,i)=><li key={col} className="flex gap-3"><span className="w-5 shrink-0 pt-px text-[12px] font-medium tabular-nums text-[color:var(--fg-subtle)]">{String(i+1).padStart(2,"0")}</span><div><p className="text-[13.5px] font-semibold leading-tight">{col}</p><p className="mt-1 text-[12.5px] text-[color:var(--fg-subtle)]">Ex. : {t.example[i] || "à compléter"}</p></div></li>)}</ol>
       <div className="flex flex-col gap-3 border-t border-[color:var(--border)] px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7"><p className="text-[12px] text-[color:var(--fg-subtle)]">Une ligne par client. Exemple fictif.</p><CopyPillButton text={einvoiceTableTsv()} label="Copier pour Excel ou Sheets" done="Copié : collez dans votre tableur"/></div>
     </div>
   </Section>

   <Section id="temps" eyebrow="Le relevé à la main" title="Combien d’heures pour votre cabinet ?" sub="Chaque portail, chaque dossier, chaque passage. Et si personne ne relève, c’est la checklist qui tombe.">
     <ManualReviewCalculator/>
   </Section>

   <Section id="releves" eyebrow="L’agent Surveillance" title="Toute la checklist, chaque nuit, sans vous" sub={fiche.proof}>
     <div className="grid gap-4 sm:grid-cols-2">{fiche.sources.map(s=><article key={s.id} id={`source-${s.id}`} className={`${card} p-6`}><div className="flex items-center gap-3"><span className={tile}><Icon name={s.icon as IconName} size={14}/></span><div><h3 className="text-[17px] font-semibold leading-tight tracking-[-0.02em]">{s.name}</h3><p className="mt-0.5 text-[12px] text-[color:var(--fg-subtle)]">{s.where}</p></div></div><ul className="mt-5 space-y-2.5">{s.reads.map(r=><li key={r} className="flex gap-2.5 text-[13.5px] leading-snug text-[color:var(--fg-muted)]"><Icon name="check" size={14} className="mt-0.5 shrink-0 text-[color:var(--accent)]"/><span>{r}</span></li>)}</ul></article>)}</div>
     <div className={`${card} mt-4 flex gap-4 p-6`}><span className={tile}><Icon name="mail" size={14}/></span><div><h3 className="text-[15px] font-semibold leading-tight">Relié à votre boîte mail</h3><p className="mt-1.5 text-[13.5px] leading-relaxed text-[color:var(--fg-muted)]">{fiche.mail}</p></div></div>
   </Section>

   <Section id="matin" eyebrow="Le point du matin" title="Uniquement le nouveau, rangé au bon dossier">
     <figure className={`${card} overflow-hidden`}><div className="flex items-center justify-between gap-3 border-b border-[color:var(--border)] px-5 py-3.5 sm:px-6"><p className="text-[13px] font-semibold">Point du matin</p><p className="text-[12px] tabular-nums text-[color:var(--fg-subtle)]">{fiche.morningExample.length} nouveautés · {alerts} alertes</p></div>
       <ul className="divide-y divide-[color:var(--border)]">{fiche.morningExample.map(m=><li key={m.file} className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6"><div className="min-w-0"><p className="text-[11.5px] text-[color:var(--fg-subtle)]">{m.portal} · <span className="tabular-nums">{m.file}</span></p><p className="mt-0.5 text-[13.5px]">{m.event}</p></div><Badge tone={m.alert ? "warn" : "ok"} className="self-start sm:self-center">{m.status}</Badge></li>)}</ul>
       <figcaption className="border-t border-[color:var(--border)] px-5 py-3 text-[11.5px] text-[color:var(--fg-subtle)] sm:px-6">Exemple fictif : dossiers anonymes, aucune donnée réelle.</figcaption></figure>
     <ul className="mt-6 grid gap-x-6 gap-y-4 sm:grid-cols-2">{fiche.morning.map(m=><li key={m.title} className="flex gap-2.5"><Icon name="check" size={14} className="mt-[3px] shrink-0 text-[color:var(--accent)]"/><p className="text-[13.5px] leading-snug"><span className="font-semibold">{m.title}.</span> <span className="text-[color:var(--fg-muted)]">{m.text}</span></p></li>)}</ul>
   </Section>

   <Section id="mise-en-route" eyebrow="La mise en route" title="Trois étapes, depuis votre liste de clients" sub={fiche.launch}>
     <ol className="grid gap-4 sm:grid-cols-3">{fiche.steps.map((st,i)=><li key={st.title} className={`${card} p-6`}><span className="text-[12px] font-medium tabular-nums text-[color:var(--fg-subtle)]">0{i+1}</span><h3 className="mt-3 text-[15px] font-semibold leading-tight">{st.title}</h3><p className="mt-2 text-[13.5px] leading-relaxed text-[color:var(--fg-muted)]">{st.text}</p></li>)}</ol>
   </Section>

   <Section id="garanties" eyebrow="Ce qui est garanti" title="Lecture seule, envois validés, données chez vous">
     <ul className="grid gap-4 sm:grid-cols-3">{fiche.guarantees.map((g,i)=><li key={g.title} className={`${card} p-6`}><span className={tile}><Icon name={(["lock","shieldCheck","server"] as const)[i]} size={14}/></span><h3 className="mt-4 text-[15px] font-semibold leading-tight">{g.title}</h3><p className="mt-2 text-[13.5px] leading-relaxed text-[color:var(--fg-muted)]">{g.text}</p></li>)}</ul>
   </Section>

   <section id="proposition" className={`${card} mt-20 scroll-mt-8 p-7 sm:p-9`}><p className={`${label} text-[color:var(--accent)]`}>{fiche.proof}</p><h2 className="mt-3 text-[26px] font-semibold leading-[1.15] tracking-[-0.03em] sm:text-[28px]">Voyons ce qu’il relèverait sur vos dossiers</h2><p className="mt-4 text-[15px] leading-relaxed text-[color:var(--fg-muted)]">{fiche.offer}</p><a href={CAL_URL} target="_blank" rel="noopener noreferrer" className={`${primary} mt-7`}>Voir l’agent sur votre cabinet<Icon name="arrowUpRight" size={14}/></a></section>

   <section className="mt-16" id="sources"><h2 className={`${label} text-[color:var(--fg-subtle)]`}>Sources officielles</h2><p className="mt-2 text-[12px] text-[color:var(--fg-subtle)]">Consultées le {fiche.edition}. Vérifiez-les à la date de votre lecture : cette checklist ne remplace pas l’analyse de chaque dossier.</p><ol className="mt-4 space-y-2 text-[12.5px] leading-snug">{fiche.officialSources.map((s,i)=><li key={s.url} className="flex gap-2"><span className="tabular-nums text-[color:var(--fg-subtle)]">{i+1}.</span><a href={s.url} target="_blank" rel="noopener noreferrer" className="text-[color:var(--fg-muted)] underline decoration-[color:var(--border-strong)] underline-offset-4 hover:text-[color:var(--fg)]">{s.label}</a></li>)}</ol></section>

   <footer className="mt-14 border-t border-[color:var(--border)] pt-6"><p className="text-[12px] leading-relaxed text-[color:var(--fg-subtle)]">Fiche rédigée par Espoir Mwami, Althoce · Le partenaire IA des professions réglementées. L’agent ne paie, ne déclare et ne signe jamais à la place du cabinet.</p></footer>
 </div></main>
}
