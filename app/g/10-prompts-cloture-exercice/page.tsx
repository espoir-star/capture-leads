import type { ReactNode } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import BrandLogo from "@/components/BrandLogo";
import CopyPillButton from "@/components/CopyPillButton";
import BookingCalendar from "@/components/BookingCalendar";
import { Icon } from "@/components/icons/lucide";
import { PROMPTS_CLOTURE as r } from "@/content/guides/prompts-cloture-exercice";
import { getRdvPage } from "@/config/rdvPages";

/**
 * Ressource en accès libre : les 10 prompts de clôture se lisent et se copient sans formulaire.
 * Même présentation que /g/10-prompts-production-cabinet. L'audit d'installation gratuit
 * se réserve sur la page même : agenda Google ouvert en bas de page (demande d'Espoir
 * du 18/11/2026, pas de renvoi vers une autre page).
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

/** Titre avec <accent>…</accent> : mot mis en avant en bleu, ou texte brut si `plain` */
function Accent({ brut, plain = false }: { brut: string; plain?: boolean }) {
  return <>{brut.split(/<accent>|<\/accent>/).map((part, i) => (i % 2 === 1 && !plain ? <span key={i} className="text-accent"><SansCoupure texte={part} /></span> : <SansCoupure key={i} texte={part} />))}</>;
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

function PromptBlock({ text }: { text: string }) {
  return <pre className="whitespace-pre-wrap break-words rounded-xl border border-bordure bg-fond p-4 font-mono text-[12.5px] leading-relaxed text-texte">{text}</pre>;
}

export default function Page() {
  const rdv = getRdvPage(r.rdvSlug)!;

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
            <a href="#prompts" className={primary}>
              Lire les 10 prompts
              <Icon name="arrowDown" size={14} />
            </a>
            <a href="#creneaux" className={ghost}>
              Audit d&apos;installation gratuit
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

        <Section id="prompts" eyebrow="Les 10 prompts" title="Préparer, contrôler, conclure">
          <nav aria-label="Étapes de la clôture" className="flex flex-wrap gap-2">
            {r.families.map((f) => (
              <a key={f.id} href={`#${f.id}`} className="inline-flex items-center gap-2 rounded-full border border-bordure px-3.5 py-1.5 text-[12.5px] text-secondaire transition-colors duration-150 hover:border-bordure-forte hover:text-texte">
                {f.label}
                <span className="tabular-nums text-discret">{r.prompts.filter((p) => p.family === f.id).length}</span>
              </a>
            ))}
          </nav>
          {r.families.map((f) => (
            <div key={f.id} id={f.id} className="mt-10 scroll-mt-8">
              <div className="flex items-center gap-3">
                <span className={tile}><Icon name={f.icon} size={14} /></span>
                <h3 className="text-[17px] font-semibold leading-tight tracking-[-0.02em]">{f.label}</h3>
              </div>
              <ol className={`${card} mt-4 divide-y divide-bordure`}>
                {r.prompts.filter((p) => p.family === f.id).map((p) => (
                  <li key={p.number} id={`prompt-${p.number}`} className="flex scroll-mt-8 gap-4 px-5 py-5 sm:px-6">
                    <span className="w-5 shrink-0 pt-px text-[12px] font-medium tabular-nums text-discret">{p.number}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between sm:gap-6">
                        <div className="min-w-0">
                          <h4 className="text-[15px] font-semibold leading-snug">{p.title}</h4>
                          <p className="mt-1.5 text-[13.5px] leading-relaxed text-secondaire">{p.result}</p>
                        </div>
                        <CopyPillButton text={p.prompt} label="Copier le prompt" done="Copié" />
                      </div>
                      <details className="group mt-3">
                        <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-md text-[12.5px] text-secondaire transition-colors duration-150 hover:text-texte [&::-webkit-details-marker]:hidden">
                          Voir le prompt
                          <Icon name="chevronDown" size={14} className="transition-transform duration-300 group-open:rotate-180" />
                        </summary>
                        <div className="mt-3"><PromptBlock text={p.prompt} /></div>
                      </details>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          ))}
          <p className="mt-8 flex items-start gap-2.5 text-[15px] font-medium leading-relaxed">
            <Icon name="shieldCheck" size={16} className="mt-[3px] shrink-0 text-accent" />
            {r.guarantee}
          </p>
        </Section>

        <section id="rendez-vous" aria-labelledby="rendez-vous-titre" className={`${card} mt-20 scroll-mt-8 p-6 sm:p-8`}>
          <p className={`${label} text-accent`}>{rdv.eyebrow}</p>
          <h2 id="rendez-vous-titre" className="mt-3 text-[26px] font-semibold leading-[1.15] tracking-[-0.03em] text-balance sm:text-[28px]">{r.further.title}</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-secondaire">{r.further.text}</p>
          <p className="mt-3 text-[15px] leading-relaxed text-secondaire">{rdv.subtitle}</p>
          <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-secondaire">
            <li className="flex items-center gap-2 tabular-nums"><Icon name="clock" size={14} className="text-accent" />{rdv.booking.durationMin}&nbsp;min</li>
            <li className="flex items-center gap-2"><Icon name="video" size={14} className="text-accent" />Google Meet</li>
            <li className="flex items-center gap-2"><Icon name="check" size={14} className="text-accent" />Gratuit</li>
          </ul>
        </section>

        <section id="creneaux" aria-labelledby="creneaux-titre" className="mt-12 scroll-mt-6">
          <p className={`${label} text-accent`}>Réserver</p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <h2 id="creneaux-titre" className="text-[26px] font-semibold leading-[1.15] tracking-[-0.03em] sm:text-[28px]">Choisissez votre créneau</h2>
            <div className="flex items-center gap-3">
              <Image src={rdv.host.photo} alt="" width={36} height={36} className="size-9 rounded-full object-cover" />
              <p className="text-[12.5px] leading-tight text-secondaire">
                Avec <span className="font-medium text-texte">{rdv.host.name}</span>
                <br />
                {rdv.host.role}
              </p>
            </div>
          </div>
          <div className="mt-7">
            <BookingCalendar embedUrl={rdv.booking.embedUrl} url={rdv.booking.url} title={rdv.booking.title} />
          </div>
        </section>

        <footer className="mt-16 flex flex-col gap-5 border-t border-bordure pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[12px] leading-relaxed text-discret">Ressource rédigée par {r.author} · Althoce, cabinet de conseil &amp; intégration IA, le partenaire IA des professions réglementées.</p>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href="https://www.francenum.gouv.fr/activateurs/althoce-conseil"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Althoce, Activateur France Num (programme du gouvernement)"
              className="rounded-lg bg-white p-1.5 transition-opacity hover:opacity-80"
            >
              <Image src="/webinar/activateur-france-num.png" alt="Activateur France Num" width={42} height={38} />
            </a>
            <span className="rounded-lg bg-white p-1">
              <Image src="/webinar/french-tech-bordeaux.png" alt="La French Tech Bordeaux" width={41} height={41} />
            </span>
          </div>
        </footer>
      </div>
    </main>
  );
}
