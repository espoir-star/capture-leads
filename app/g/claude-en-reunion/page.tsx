import type { ReactNode } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import BrandLogo from "@/components/BrandLogo";
import CopyPillButton from "@/components/CopyPillButton";
import BookingCalendar from "@/components/BookingCalendar";
import { Icon } from "@/components/icons/lucide";
import { CLAUDE_REUNION as r, skillFile } from "@/content/guides/claude-en-reunion";
import { ESPOIR, PRE_AUDIT_BOOKING_EMBED, PRE_AUDIT_BOOKING_URL } from "@/config/rdvPages";

/**
 * Fiche « Claude en réunion » (post du 19/11/2026, dirigeants et commerciaux), envoyée par
 * email après la page de capture /r/claude-en-reunion. Même présentation que les lecteurs
 * 10 prompts ; 5 skills à installer (demande d'Espoir du 18/11 : des skills plutôt que des
 * prompts), même méthode d'installation que /g/12-skills-claude-finance ; le pré-audit
 * gratuit se réserve sur la page même (agenda ouvert).
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
            <a href="#reglages" className={primary}>
              Voir les réglages
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

        <Section id="ce-quil-fait" eyebrow="Pendant et après l'appel" title="Ce que Claude fait en réunion">
          <ul className={`${card} divide-y divide-bordure`}>
            {r.does.map((d) => (
              <li key={d.title} className="flex gap-4 px-5 py-4 sm:px-6">
                <span className={`${tile} mt-0.5`}><Icon name={d.icon} size={14} /></span>
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold leading-snug">{d.title}</p>
                  <p className="mt-1 text-[13.5px] leading-relaxed text-secondaire">{d.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </Section>

        <section id="avant" aria-labelledby="avant-titre" className="mt-16 scroll-mt-8">
          <h2 id="avant-titre" className={`${label} text-discret`}>Avant de commencer</h2>
          <ul className={`${card} mt-4 space-y-3 p-5 sm:p-6`}>
            {r.before.map((b) => (
              <li key={b} className="flex gap-2.5 text-[13.5px] leading-relaxed text-secondaire">
                <Icon name="check" size={14} className="mt-[3px] shrink-0 text-accent" />
                {b}
              </li>
            ))}
          </ul>
        </section>

        <Section id="reglages" eyebrow="Les réglages" title="Mettre Claude dans vos réunions, en 4 étapes">
          <ol className="grid gap-4 sm:grid-cols-2">
            {r.steps.map((s, i) => (
              <li key={s.title} className={`${card} p-6`}>
                <span className="text-[12px] font-medium tabular-nums text-discret">0{i + 1}</span>
                <h3 className="mt-3 text-[15px] font-semibold leading-tight">{s.title}</h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-secondaire">{s.text}</p>
              </li>
            ))}
          </ol>
        </Section>

        <Section id="accord" eyebrow="À faire avant chaque réunion" title={r.consent.title}>
          <p className="text-[15px] leading-relaxed text-secondaire">{r.consent.text}</p>
          {[
            { t: "Dans l'invitation", v: r.consent.invitation },
            { t: "En ouvrant la réunion", v: r.consent.opening },
          ].map((b) => (
            <div key={b.t} className={`${card} mt-5 p-6`}>
              <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-[15px] font-semibold leading-snug">{b.t}</h3>
                <CopyPillButton text={b.v} label="Copier le texte" done="Copié" />
              </div>
              <div className="mt-4"><TextBlock text={b.v} /></div>
            </div>
          ))}
        </Section>

        <Section id="client" eyebrow="Commerciaux" title={r.external.title}>
          <ul className="space-y-3 rounded-[18px] border border-accent/25 bg-accent/[0.06] p-6">
            {r.external.points.map((p) => (
              <li key={p} className="flex gap-2.5 text-[14px] leading-relaxed">
                <Icon name="userCheck" size={15} className="mt-[3px] shrink-0 text-accent" />
                {p}
              </li>
            ))}
          </ul>
        </Section>

        <Section id="skills" eyebrow="Après la réunion" title="5 skills pour transformer la réunion en actions">
          <p className="text-[15px] leading-relaxed text-secondaire">
            Un skill s&apos;installe une fois dans Claude. Ensuite, il s&apos;applique tout seul dès que votre demande correspond&nbsp;: plus de prompt à recopier après chaque réunion.
          </p>

          <div className="mt-6 rounded-[18px] border border-accent/25 bg-accent/[0.06] p-6">
            <h3 className="text-[15px] font-semibold leading-snug">Installer un skill en 3 étapes</h3>
            <p className="mt-2 text-[13.5px] leading-relaxed text-secondaire">{r.install.prerequisite}</p>
            <ol className="mt-4 space-y-3">
              {r.install.steps.map((step, i) => (
                <li key={step} className="flex gap-3 text-[14px] leading-relaxed">
                  <span className="w-5 shrink-0 pt-px text-[12px] font-medium tabular-nums text-discret">0{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    {step}
                    {i === 1 && (
                      <div className="mt-3 flex flex-col items-start gap-3 rounded-xl border border-bordure bg-fond p-4 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-[13px] leading-relaxed">{r.install.phrase}</p>
                        <CopyPillButton text={r.install.phrase} label="Copier la phrase" done="Copiée" />
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-[13px] leading-relaxed text-secondaire">{r.install.use}</p>
          </div>

          <ol className={`${card} mt-6 divide-y divide-bordure`}>
            {r.skills.map((k) => (
              <li key={k.number} id={k.name} className="flex scroll-mt-8 gap-4 px-5 py-5 sm:px-6">
                <span className="w-5 shrink-0 pt-px text-[12px] font-medium tabular-nums text-discret">{k.number}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between sm:gap-6">
                    <div className="min-w-0">
                      <h3 className="text-[15px] font-semibold leading-snug">{k.title}</h3>
                      <p className="mt-1.5 text-[13.5px] leading-relaxed text-secondaire">{k.result}</p>
                    </div>
                    <CopyPillButton text={skillFile(k)} label="Copier le skill" done="Copié" />
                  </div>
                  <details className="group mt-3">
                    <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-md text-[12.5px] text-secondaire transition-colors duration-150 hover:text-texte [&::-webkit-details-marker]:hidden">
                      Voir le fichier
                      <Icon name="chevronDown" size={14} className="transition-transform duration-300 group-open:rotate-180" />
                    </summary>
                    <div className="mt-3"><TextBlock text={skillFile(k)} /></div>
                  </details>
                </div>
              </li>
            ))}
          </ol>
        </Section>

        <section id="creneaux" aria-labelledby="creneaux-titre" className="mt-20 scroll-mt-6 rounded-[18px] border border-accent/25 bg-accent/5 p-5 sm:p-8">
          <div className="text-center">
            <p className={`${label} text-accent`}>Pré-audit · 100&nbsp;% gratuit</p>
            <h2 id="creneaux-titre" className="mt-3 text-[24px] font-semibold leading-[1.15] tracking-[-0.03em] text-balance sm:text-[28px]">
              Mettre l&apos;IA au travail dans votre entreprise ?
            </h2>
            <p className="mx-auto mt-3 max-w-md text-[14px] leading-relaxed text-secondaire">
              30 minutes pour regarder vos réunions, vos relances et vos tâches répétitives, et voir ce que l&apos;IA peut prendre en charge. Sans engagement.
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
            <BookingCalendar embedUrl={PRE_AUDIT_BOOKING_EMBED} url={PRE_AUDIT_BOOKING_URL} title="Pré-audit IA offert" slug="pre-audit-claude-en-reunion" />
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
            . Fonction en bêta : les réglages peuvent évoluer.
          </p>
          <p className="mt-3 text-[12px] leading-relaxed text-discret">Fiche rédigée par {r.author} · Althoce, cabinet de conseil &amp; intégration IA, le partenaire IA des professions réglementées.</p>
        </footer>
      </div>
    </main>
  );
}
