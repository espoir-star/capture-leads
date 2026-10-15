import type { Metadata } from "next";
import Link from "next/link";
import { CLAUDE_FINANCE_SKILLS_GUIDE as guide, skillFile } from "@/content/guides/claude-finance-skills";
import CopyDashboardPrompt from "@/components/CopyDashboardPrompt";

export const metadata: Metadata = {
 title:"12 skills Claude pour la finance — Althoce",
 description:"12 compétences finance à copier dans Claude, l'installation en 3 étapes et les sources officielles.",
 robots:{index:false,follow:false},
};

const INSTALL_PHRASE = "Crée une compétence à partir de ce fichier SKILL.md. Garde exactement le nom, la description et la procédure, sans rien ajouter.";

function Ref({ n }: { n: string }) {
 return <a href="#sources" className="text-[#81E7B8] underline underline-offset-2">[{n}]</a>;
}

export default function Page() {
 return <main className="min-h-screen bg-[#0A0A0A] text-white"><div className="mx-auto max-w-[790px] px-5 pb-20 pt-10 sm:px-8">
   <header className="flex items-center justify-between gap-3 border-b border-[#26382D] pb-6"><Link href="https://althoce.com" className="font-display text-2xl font-bold">Althoce<span className="text-[#26C08F]">.</span></Link><span className="text-right text-[10px] uppercase tracking-[0.16em] text-[#A0A0A0]">Cabinet de conseil en IA</span></header>

   <div className="pt-12"><p className="text-xs font-semibold tracking-[0.16em] text-[#51D9AA]">GUIDE · ÉDITION DU {guide.edition.toUpperCase()}</p><h1 className="mt-4 font-display text-4xl font-bold tracking-tight sm:text-[54px] sm:leading-[1.15]">12 skills Claude <span className="text-[#51D9AA]">pour la finance.</span></h1><p className="mt-5 text-base leading-7 text-[#C5D1C9]">{guide.intro}</p></div>

   <section className="mt-10 rounded-xl border border-[#346B4E] bg-[#11251A] p-5 sm:p-6"><h2 className="text-xl font-bold">Installer en 3 étapes</h2><p className="mt-2 text-sm leading-6 text-[#C5D8CB]">Prérequis : « Exécution de code et création de fichiers » activée dans Paramètres &gt; Capacités <Ref n="1"/>.</p><ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-6 text-[#DAE6DC]"><li>Copiez une compétence ci-dessous.</li><li>Dans une nouvelle conversation, collez-la avec cette phrase :</li></ol><div className="mt-3 flex flex-col gap-3 rounded-lg border border-[#2D4335] bg-[#090E0A] p-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-[13px] leading-6 text-[#DAE6DC]">{INSTALL_PHRASE}</p><CopyDashboardPrompt text={INSTALL_PHRASE} label="Copier la phrase"/></div><ol start={3} className="mt-3 list-decimal pl-5 text-sm leading-6 text-[#DAE6DC]"><li>Enregistrez le fichier proposé par Claude <Ref n="3"/>. Il apparaît dans Personnaliser &gt; Compétences <Ref n="1"/>.</li></ol><p className="mt-4 text-xs leading-5 text-[#A9B9AB]">Sans conversation : texte dans <code>analyse-balance/SKILL.md</code>, dossier compressé en ZIP, puis Personnaliser &gt; Compétences &gt; « + » <Ref n="1"/>. Pas de déclenchement ? Nommez la compétence dans votre demande.</p></section>

   <section className="mt-12"><h2 className="text-2xl font-semibold">Les 12 compétences</h2><p className="mt-2 text-sm leading-6 text-[#ADBDB1]">Activez seulement celles de votre période : {guide.periods.map((p,i)=><span key={p.period}>{i>0?" · ":""}{p.period.toLowerCase()} {p.skills.join(", ")}</span>)}.</p>
     {guide.families.map(f=><div key={f.id} id={`famille-${f.id}`} className="mt-8 scroll-mt-6"><h3 className="text-xs font-bold uppercase tracking-widest text-[#51D9AA]">{f.label}</h3><div className="mt-3 space-y-3">{guide.skills.filter(s=>s.family===f.id).map(s=><article key={s.name} id={s.name} className="scroll-mt-6 rounded-xl border border-[#2B4233] bg-[#111711] p-4 sm:p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0 flex-1"><h4 className="text-lg font-semibold"><span className="text-[#51D9AA]">{s.number}</span> {s.title}</h4><p className="mt-1 text-sm leading-6 text-[#A9B9AB]">{s.description}</p></div><CopyDashboardPrompt text={skillFile(s)} label="Copier la compétence"/></div><details className="mt-3 rounded-lg border border-[#2D4335] bg-[#090E0A]"><summary className="cursor-pointer px-4 py-2.5 text-xs text-[#C4D1C6]">Voir le fichier</summary><pre className="whitespace-pre-wrap break-words border-t border-[#2D4335] p-4 font-mono text-[12px] leading-6 text-[#DAE6DC]">{skillFile(s)}</pre></details></article>)}</div></div>)}
   </section>

   <section className="mt-12"><h2 className="text-2xl font-semibold">Les adapter, créer les vôtres</h2><ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-[#C4D1C6]"><li>Ajoutez votre plan comptable (01 à 03), vos seuils de significativité (01, 03, 04) et votre formule de DSO (08).</li><li>Une nouvelle compétence = une tâche fréquente, une description de 200 caractères maximum (ce qu’elle fait, quand l’utiliser) <Ref n="2"/>, une procédure et des règles de vigilance.</li><li>Claude peut écrire le premier jet : décrivez la tâche avec un exemple de bon résultat <Ref n="3"/>.</li></ul></section>

   <section className="mt-12 rounded-xl border border-[#2C4234] bg-[#122019] p-5 sm:p-6"><h2 className="text-lg font-bold">Données clients</h2><p className="mt-2 text-sm leading-6 text-[#C4D1C6]">Testez avec des fichiers fictifs ou anonymisés <Ref n="6"/>. Sur les offres individuelles, l’usage de vos conversations pour améliorer Claude dépend de vos paramètres de confidentialité <Ref n="4"/> ; le DPA d’Anthropic couvre Claude for Work et l’API <Ref n="5"/>. Ces compétences préparent un contrôle, elles ne valident rien.</p></section>

   <section className="mt-12" id="sources"><h2 className="text-lg font-semibold">Sources officielles</h2><p className="mt-1 text-xs text-[#A9B9AB]">Consultées le {guide.edition}.</p><ol className="mt-3 space-y-1.5 text-xs leading-5">{guide.sources.map((s,i)=><li key={s.url}><span className="font-bold text-[#51D9AA]">{i+1}.</span> <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-[#E6F5EB] underline underline-offset-4">{s.label} ↗</a></li>)}</ol></section>

   <footer className="mt-12 border-t border-[#2A3A2D] pt-6"><p className="text-sm leading-6 text-[#ADBCB0]">Des compétences construites sur vos process ? Althoce forme les équipes finance et construit des compétences sur mesure.</p><a href="https://cal.com/althoce-conseil-4ncbuz/30min" target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex rounded-lg bg-[#1D9E75] px-5 py-3 text-sm font-semibold text-[#081D12]">Réserver 30 minutes ↗</a><p className="mt-6 text-xs text-[#82988A]">Guide rédigé par Espoir Mwami — Althoce</p></footer>
 </div></main>
}
