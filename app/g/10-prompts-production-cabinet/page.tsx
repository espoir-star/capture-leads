import type { ReactNode } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import BrandLogo from "@/components/BrandLogo";
import CopyPillButton from "@/components/CopyPillButton";
import SourceLink from "@/components/SourceLink";
import { Icon } from "@/components/icons/lucide";
import { PROMPTS_PRODUCTION as r } from "@/content/guides/prompts-production-cabinet";
import { getRdvPage, type RdvPage } from "@/config/rdvPages";
import { getWebinar, type WebinarConfig } from "@/config/webinars";
import { registrationOpen } from "@/lib/webinar/access";
import { webinarDay, webinarHours } from "@/lib/webinar/format";
import type { Utm } from "@/lib/tracking/utm";

/**
 * Ressource en accès libre : les 10 prompts se lisent et se copient sans formulaire.
 * Les appels à l'action mènent à l'inscription au webinar tant qu'elle est ouverte,
 * puis à l'audit d'installation. Régénérée toutes les 10 minutes, comme les pages
 * webinar et rendez-vous.
 */

export const revalidate = 600;

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

/** Appel à l'action de la page : webinar tant que les inscriptions sont ouvertes, sinon audit */
type Cta = {
  href: string;
  utm: Utm;
  button: string;
  hero: string;
  title: string;
  detail: string;
  software: string;
} & ({ kind: "webinar"; webinar: WebinarConfig } | { kind: "rdv"; rdv: RdvPage });

function pageCta(now: Date): Cta {
  const w = getWebinar(r.webinarSlug);
  if (w?.status === "open" && registrationOpen(w, now)) {
    const start = new Date(w.startsAt);
    const day = webinarDay(start);
    return {
      kind: "webinar",
      webinar: w,
      href: `/w/${w.slug}`,
      utm: { ...r.fallbackUtm, utm_campaign: r.campaigns.webinar },
      button: "Je réserve ma place",
      hero: `Webinar ${day.toLowerCase()}`,
      title: "On vous montre comment le brancher, en direct",
      detail: `${day} · ${webinarHours(w)} (Paris) · Google Meet · gratuit`,
      software: `Comment le brancher sur le vôtre : on vous l'explique ${day.split(" ")[0].toLowerCase()}, avec une démo en direct.`,
    };
  }
  const rdv = getRdvPage(r.rdvSlug)!;
  return {
    kind: "rdv",
    rdv,
    href: `/rdv/${rdv.slug}`,
    utm: { ...r.fallbackUtm, utm_campaign: r.campaigns.rdv },
    button: "Choisir mon créneau",
    hero: "Audit d'installation gratuit",
    title: "Voyons comment le brancher sur votre logiciel",
    detail: `Audit d'installation gratuit · ${rdv.booking.durationMin} min · Google Meet`,
    software: "Comment le brancher sur le vôtre : c'est l'objet de l'audit.",
  };
}

/** Mot composé (« peut-elle ») jamais coupé au trait d'union en fin de ligne */
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
  const c = pageCta(new Date());

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
            <SourceLink href={c.href} fallback={c.utm} className={ghost}>
              {c.hero}
              <Icon name="arrowUpRight" size={14} />
            </SourceLink>
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

        <Section id="prompts" eyebrow="Les 10 prompts" title="Un mois de production, du contrôle à la relance client">
          <nav aria-label="Familles de prompts" className="flex flex-wrap gap-2">
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
              {"note" in f && (
                <p className="mt-3 text-[13.5px] leading-relaxed text-secondaire">
                  {f.note}{" "}
                  <a href="#connecteur" className="whitespace-nowrap text-accent underline decoration-accent/40 underline-offset-4 hover:decoration-accent">Comment ça marche</a>
                </p>
              )}
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
        </Section>

        <Section id="connecteur" eyebrow="Le connecteur qui écrit" title={r.halfWork.title}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className={`${card} p-6`}>
              <p className={`${label} text-discret`}>{r.halfWork.alone.label}</p>
              <h3 className="mt-3 text-[17px] font-semibold leading-tight tracking-[-0.02em]">{r.halfWork.alone.title}</h3>
              <p className="mt-2 text-[13.5px] leading-relaxed text-secondaire">{r.halfWork.alone.text}</p>
            </div>
            <div className="rounded-[18px] border border-accent/25 bg-accent/[0.06] p-6">
              <p className={`${label} text-accent`}>{r.halfWork.writer.label}</p>
              <h3 className="mt-3 text-[17px] font-semibold leading-tight tracking-[-0.02em]">{r.halfWork.writer.title}</h3>
              <ul className="mt-4 space-y-2">
                {r.halfWork.writer.done.map((d) => (
                  <li key={d} className="flex items-center gap-2.5 text-[13.5px]">
                    <Icon name="check" size={14} className="shrink-0 text-accent" />
                    {d}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-[13.5px] leading-relaxed text-secondaire">{r.halfWork.writer.text}</p>
            </div>
          </div>
          <p className="mt-6 flex items-start gap-2.5 text-[15px] font-medium leading-relaxed">
            <Icon name="shieldCheck" size={16} className="mt-[3px] shrink-0 text-accent" />
            {r.halfWork.promise}
          </p>

          <div className={`${card} mt-8 p-6`}>
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between sm:gap-6">
              <div className="min-w-0">
                <h3 className="text-[15px] font-semibold leading-snug">{r.applyPrompt.title}</h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-secondaire">{r.applyPrompt.text}</p>
              </div>
              <CopyPillButton text={r.applyPrompt.prompt} label="Copier le prompt" done="Copié" />
            </div>
            <div className="mt-4"><PromptBlock text={r.applyPrompt.prompt} /></div>
          </div>

          <div className="mt-8 flex flex-col gap-5 rounded-[18px] border border-bordure-forte bg-carte-2 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7">
            <div>
              <p className="text-[17px] font-semibold leading-snug tracking-[-0.02em]">{c.title}</p>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-secondaire">{c.detail}</p>
            </div>
            <SourceLink href={c.href} fallback={c.utm} className={`${primary} shrink-0`}>
              {c.button}
              <Icon name="arrowUpRight" size={14} />
            </SourceLink>
          </div>
        </Section>

        <Section id="methode" eyebrow="La méthode" title={r.method.title}>
          <ol className="grid gap-4 sm:grid-cols-2">
            {r.method.steps.map((s, i) => (
              <li key={s.title} className={`${card} p-6`}>
                <span className="text-[12px] font-medium tabular-nums text-discret">0{i + 1}</span>
                <h3 className="mt-3 text-[15px] font-semibold leading-tight">{s.title}</h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-secondaire">{s.text}</p>
              </li>
            ))}
          </ol>

          <div id="logiciels" className="mt-12 scroll-mt-8">
            <h3 className="text-[17px] font-semibold leading-tight tracking-[-0.02em]">{r.software.title}</h3>
            <p className="mt-2 text-[13.5px] leading-relaxed text-secondaire">{r.method.coverage}</p>
            <div className={`${card} mt-5 p-6`}>
              <div className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between sm:gap-6">
                <p className="text-[15px] font-semibold leading-snug">{r.software.custom}</p>
                <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-accent/25 bg-accent/10 px-2.5 py-1 text-[11px] font-medium text-accent">
                  <span className="size-1.5 rounded-full bg-current" />
                  Sur mesure
                </span>
              </div>
              <ul className="mt-5 flex flex-wrap gap-2">
                {r.software.names.map((n) => (
                  <li key={n} className="rounded-full border border-bordure px-3 py-1.5 text-[12.5px] text-secondaire">{n}</li>
                ))}
              </ul>
            </div>
            <div className="mt-6 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[13.5px] text-secondaire">{c.software}</p>
              <SourceLink href={c.href} fallback={c.utm} className={`${ghost} shrink-0`}>
                {c.button}
                <Icon name="arrowUpRight" size={14} />
              </SourceLink>
            </div>
          </div>
        </Section>

        {c.kind === "webinar" ? (
          <section id="webinar" aria-labelledby="webinar-titre" className={`${card} mt-20 scroll-mt-8 p-6 sm:p-8`}>
            <p className={`${label} text-accent`}>Webinar gratuit · en direct</p>
            <h2 id="webinar-titre" className="mt-3 text-[26px] font-semibold leading-[1.15] tracking-[-0.03em] text-balance sm:text-[28px]">{c.webinar.title}</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-secondaire">{c.webinar.description}</p>
            <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-[14px] font-medium">
              <li className="flex items-center gap-2 whitespace-nowrap"><Icon name="calendar" size={16} strokeWidth={1.75} className="text-accent" />{webinarDay(new Date(c.webinar.startsAt))}</li>
              <li className="flex items-center gap-2 whitespace-nowrap tabular-nums"><Icon name="clock" size={16} strokeWidth={1.75} className="text-accent" />{webinarHours(c.webinar)} <span className="font-normal text-secondaire">(Paris)</span></li>
              <li className="flex items-center gap-2 whitespace-nowrap"><Icon name="video" size={16} strokeWidth={1.75} className="text-accent" />Google Meet</li>
            </ul>
            {c.webinar.agenda && (
              <ul className="mt-6 space-y-2.5 border-t border-bordure pt-6">
                {c.webinar.agenda.map((a) => (
                  <li key={a} className="flex gap-2.5 text-[14px] leading-snug">
                    <Icon name="check" size={14} className="mt-[3px] shrink-0 text-accent" />
                    {a}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-8 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              {c.webinar.speaker && (
                <div className="flex items-center gap-3">
                  {c.webinar.speaker.photo && <Image src={c.webinar.speaker.photo} alt="" width={44} height={44} className="size-11 shrink-0 rounded-full object-cover" />}
                  <p className="text-[12.5px] leading-snug text-secondaire">
                    Animé par <span className="font-medium text-texte">{c.webinar.speaker.name}</span>
                    <br />
                    {c.webinar.speaker.role}
                  </p>
                </div>
              )}
              <SourceLink href={c.href} fallback={c.utm} className={`${primary} shrink-0`}>
                {c.button}
                <Icon name="arrowUpRight" size={14} />
              </SourceLink>
            </div>
          </section>
        ) : (
          <section id="rendez-vous" aria-labelledby="rendez-vous-titre" className={`${card} mt-20 scroll-mt-8 p-6 sm:p-8`}>
            <p className={`${label} text-accent`}>{c.rdv.eyebrow}</p>
            <h2 id="rendez-vous-titre" className="mt-3 text-[26px] font-semibold leading-[1.15] tracking-[-0.03em] text-balance sm:text-[28px]"><Accent brut={c.rdv.title} plain /></h2>
            <p className="mt-3 text-[15px] leading-relaxed text-secondaire">{c.rdv.subtitle}</p>
            <div className="mt-7 flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:justify-between">
              <ul className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-secondaire">
                <li className="flex items-center gap-2 tabular-nums"><Icon name="clock" size={14} className="text-accent" />{c.rdv.booking.durationMin}&nbsp;min</li>
                <li className="flex items-center gap-2"><Icon name="video" size={14} className="text-accent" />Google Meet</li>
                <li className="flex items-center gap-2"><Icon name="check" size={14} className="text-accent" />Gratuit</li>
              </ul>
              <SourceLink href={c.href} fallback={c.utm} className={`${primary} shrink-0`}>
                {c.button}
                <Icon name="arrowUpRight" size={14} />
              </SourceLink>
            </div>
          </section>
        )}

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
