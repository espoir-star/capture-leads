import type { ReactNode } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import BrandLogo from "@/components/BrandLogo";
import CopyPillButton from "@/components/CopyPillButton";
import BookingCalendar from "@/components/BookingCalendar";
import { Icon } from "@/components/icons/lucide";
import { SAISIE_PIECES as r, skillFile } from "@/content/guides/saisie-pieces-comptables";
import { ESPOIR, PRE_AUDIT_BOOKING_EMBED, PRE_AUDIT_BOOKING_URL } from "@/config/rdvPages";

/**
 * Ressource « Saisie des pièces comptables » (post du 20/11/2026, experts-comptables), envoyée
 * par email après la page de capture /r/saisie-pieces-comptables. Même présentation que la fiche
 * « Claude en réunion » : les pièces traitées, le skill à télécharger, les 3 prompts, et le
 * pré-audit gratuit sur la page même.
 */

export const metadata: Metadata = {
  title: `${r.metaTitle} — Althoce`,
  description: r.metaDescription,
  openGraph: { title: r.metaTitle, description: r.metaDescription, type: "article", locale: "fr_FR" },
  robots: { index: false, follow: false },
};

const label = "text-[11px] font-semibold uppercase tracking-[0.16em]";
const card = "rounded-[18px] border border-bordure bg-carte";
const tile = "flex size-7 shrink-0 items-center justify-center rounded-lg bg-carte-2 text-secondaire";
const pill = "inline-flex items-center justify-center gap-2 rounded-full px-[22px] py-3 text-[14px] font-medium transition-colors duration-150 active:scale-[0.985]";
const primary = `${pill} bg-action text-white hover:bg-action-hover`;
const ghost = `${pill} border border-bordure-forte text-texte hover:bg-carte-2`;

/** Mot composé jamais coupé au trait d'union en fin de ligne */
function SansCoupure({ texte }: { texte: string }) {
  return <>{texte.split(/(\S+-\S+)/).map((s, i) => (i % 2 === 1 ? <span key={i} className="whitespace-nowrap">{s}</span> : s))}</>;
}

/** Titre avec <accent>…</accent> : mot mis en avant en bleu */
function Accent({ brut }: { brut: string }) {
  return <>{brut.split(/<accent>|<\/accent>/).map((part, i) => (i % 2 === 1 ? <span key={i} className="text-accent"><SansCoupure texte={part} /></span> : <SansCoupure key={i} texte={part} />))}</>;
}

function Section({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="mt-20 scroll-mt-8">
      <p className={`${label} text-accent`}>{eyebrow}</p>
      <h2 className="mt-3 text-[26px] font-semibold leading-[1.15] tracking-[-0.03em] sm:text-[28px]">{title}</h2>
      <div className="mt-7">{children}</div>
    </section>
  );
}

function TextBlock({ text }: { text: string }) {
  return <pre className="whitespace-pre-wrap break-words rounded-xl border border-bordure bg-fond p-4 font-mono text-[12.5px] leading-relaxed text-texte">{text}</pre>;
}

export default function Page() {
  const file = skillFile(r.skill);
  return (
    <main className="min-h-screen bg-fond text-texte antialiased">
      <div className="mx-auto max-w-[760px] px-5 pb-16 pt-8 sm:px-8">
        <header className="flex items-center justify-between gap-3 border-b border-bordure pb-6">
          <BrandLogo />
          <span className={`${label} text-right text-discret`}>Conseil &amp; intégration IA</span>
        </header>

        <div className="pt-14">
          <p className={`${label} text-accent`}>{r.eyebrow}</p>
          <h1 className="mt-4 text-[32px] font-semibold leading-[1.08] tracking-[-0.03em] text-balance sm:text-[52px] sm:leading-[1.05]">
            <Accent brut={r.title} />
          </h1>
          <p className="mt-6 max-w-[620px] text-[16px] leading-relaxed text-secondaire sm:text-[17px]">{r.subtitle}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#skill" className={primary}>
              Les 10 prompts et le skill
              <Icon name="arrowDown" size={14} />
            </a>
            <a href="#creneaux" className={ghost}>
              Pré-audit 100&nbsp;% gratuit
              <Icon name="arrowDown" size={14} />
            </a>
          </div>
          <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-secondaire">
            {r.promises.map((p) => (
              <li key={p} className="flex items-center gap-2">
                <Icon name="check" size={14} className="text-accent" />
                {p}
              </li>
            ))}
          </ul>
        </div>

        <Section id="pieces" eyebrow="Les pièces" title="Ce que votre IA sait saisir">
          <ul className={`${card} divide-y divide-bordure`}>
            {r.pieces.map((p) => (
              <li key={p.title} className="flex gap-4 px-5 py-4 sm:px-6">
                <span className={`${tile} mt-0.5`}><Icon name="receipt" size={14} /></span>
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold leading-snug">{p.title}</p>
                  <p className="mt-1 text-[13.5px] leading-relaxed text-secondaire">{p.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </Section>

        <section id="avant" aria-labelledby="avant-titre" className="mt-16 scroll-mt-8">
          <h2 id="avant-titre" className={`${label} text-discret`}>Avant de commencer</h2>
          <ul className={`${card} mt-4 divide-y divide-bordure`}>
            {r.before.map((b) => (
              <li key={b.title} className="flex gap-4 px-5 py-4 sm:px-6">
                <span className={`${tile} mt-0.5`}><Icon name={b.icon} size={14} /></span>
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold leading-snug">{b.title}</p>
                  <p className="mt-1 text-[13.5px] leading-relaxed text-secondaire">{b.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <Section id="skill" eyebrow="Avec Claude" title="Le skill : déposez les pièces, recevez les écritures">
          <div className="rounded-[18px] border border-accent/25 bg-accent/[0.06] p-6">
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-[17px] font-semibold leading-snug tracking-[-0.02em]">Installer le skill</h3>
              <a href={r.zip.href} download={r.zip.file} className={primary}>
                <Icon name="download" size={15} />
                Télécharger le skill
              </a>
            </div>
            <ol className="mt-4 space-y-3">
              {r.install.steps.map((step, i) => (
                <li key={step} className="flex gap-3 text-[14px] leading-relaxed">
                  <span className="w-5 shrink-0 pt-px text-[12px] font-medium tabular-nums text-discret">0{i + 1}</span>
                  <span className="min-w-0 flex-1">{step}</span>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-[13px] leading-relaxed text-secondaire">{r.install.safari}</p>
            <div className="mt-3 flex flex-col items-start gap-3 rounded-xl border border-bordure bg-fond p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[13px] leading-relaxed">{r.install.phrase}</p>
              <CopyPillButton text={r.install.phrase} label="Copier la phrase" done="Copiée" />
            </div>
          </div>

          <div className={`${card} mt-6 px-5 py-5 sm:px-6`}>
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between sm:gap-6">
              <div className="min-w-0">
                <h3 className="text-[15px] font-semibold leading-snug">{r.skill.title}</h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-secondaire">{r.skill.description}</p>
              </div>
              <CopyPillButton text={file} label="Copier le skill" done="Copié" />
            </div>
            <details className="group mt-3">
              <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-md text-[12.5px] text-secondaire transition-colors duration-150 hover:text-texte [&::-webkit-details-marker]:hidden">
                Voir le fichier
                <Icon name="chevronDown" size={14} className="transition-transform duration-300 group-open:rotate-180" />
              </summary>
              <div className="mt-3"><TextBlock text={file} /></div>
            </details>
          </div>
        </Section>

        <Section id="prompts" eyebrow="Avec n'importe quelle IA" title="Les 10 prompts, de la pièce à l'import">
          <p className="text-[13.5px] leading-relaxed text-secondaire">{r.promptsNote}</p>
          <ol className={`${card} mt-5 divide-y divide-bordure`}>
            {r.prompts.map((p) => (
              <li key={p.number} id={`prompt-${p.number}`} className="flex scroll-mt-8 gap-4 px-5 py-5 sm:px-6">
                <span className="w-5 shrink-0 pt-px text-[12px] font-medium tabular-nums text-discret">{p.number}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between sm:gap-6">
                    <div className="min-w-0">
                      <h3 className="text-[15px] font-semibold leading-snug">{p.title}</h3>
                      <p className="mt-1.5 text-[13.5px] leading-relaxed text-secondaire">{p.result}</p>
                    </div>
                    <CopyPillButton text={p.prompt} label="Copier le prompt" done="Copié" />
                  </div>
                  <details className="group mt-3">
                    <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-md text-[12.5px] text-secondaire transition-colors duration-150 hover:text-texte [&::-webkit-details-marker]:hidden">
                      Voir le prompt
                      <Icon name="chevronDown" size={14} className="transition-transform duration-300 group-open:rotate-180" />
                    </summary>
                    <div className="mt-3"><TextBlock text={p.prompt} /></div>
                  </details>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-8 flex items-start gap-2.5 text-[15px] font-medium leading-relaxed">
            <Icon name="shieldCheck" size={16} className="mt-[3px] shrink-0 text-accent" />
            {r.guarantee}
          </p>
        </Section>

        <section id="creneaux" aria-labelledby="creneaux-titre" className="mt-20 scroll-mt-6 rounded-[18px] border border-accent/25 bg-accent/5 p-5 sm:p-8">
          <div className="text-center">
            <p className={`${label} text-accent`}>Pré-audit · 100&nbsp;% gratuit</p>
            <h2 id="creneaux-titre" className="mt-3 text-[24px] font-semibold leading-[1.15] tracking-[-0.03em] text-balance sm:text-[28px]">
              Plus de ressaisie dans votre cabinet&nbsp;?
            </h2>
            <p className="mx-auto mt-3 max-w-md text-[14px] leading-relaxed text-secondaire">
              30 minutes pour regarder vos pièces, votre saisie et votre lettrage, et voir ce que l&apos;IA peut prendre en charge dans votre logiciel. Sans engagement.
            </p>
            <div className="mt-5 flex items-center justify-center gap-3">
              <Image src={ESPOIR.photo} alt="" width={36} height={36} className="size-9 rounded-full object-cover" />
              <p className="text-left text-[12.5px] leading-tight text-secondaire">
                Avec <span className="font-medium text-texte">{ESPOIR.name}</span>
                <br />
                30 min · Google Meet · 100&nbsp;% gratuit
              </p>
            </div>
          </div>
          <div className="mt-6">
            <BookingCalendar embedUrl={PRE_AUDIT_BOOKING_EMBED} url={PRE_AUDIT_BOOKING_URL} title="Pré-audit IA offert" slug="pre-audit-saisie-pieces-comptables" />
          </div>
        </section>

        <footer className="mt-16 border-t border-bordure pt-6">
          <p className="text-[12px] leading-relaxed text-discret">
            Sources vérifiées le {r.verifiedOn} :{" "}
            {r.sources.map((s, i) => (
              <span key={s.href}>
                {i > 0 && " · "}
                <a href={s.href} target="_blank" rel="noopener noreferrer" className="underline decoration-bordure-forte underline-offset-4 hover:text-texte">{s.label}</a>
              </span>
            ))}
            .
          </p>
          <p className="mt-3 text-[12px] leading-relaxed text-discret">Ressource rédigée par {r.author} · Althoce, cabinet de conseil &amp; intégration IA, le partenaire IA des professions réglementées.</p>
        </footer>
      </div>
    </main>
  );
}
