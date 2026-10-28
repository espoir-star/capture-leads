import type { ReactNode } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import BrandLogo from "@/components/BrandLogo";
import BookingCalendar from "@/components/BookingCalendar";
import { Icon } from "@/components/icons/lucide";
import { getRdvPage, getRdvSlugs } from "@/config/rdvPages";
import { getWebinar } from "@/config/webinars";
import { registrationOpen } from "@/lib/webinar/access";
import { webinarDay, webinarHour } from "@/lib/webinar/format";

/**
 * Page de rendez-vous : le visiteur réserve directement son créneau, sans
 * formulaire (config/rdvPages.ts). Régénérée toutes les 10 minutes : le webinar
 * proposé à ceux qui ne réservent pas disparaît à la clôture des inscriptions.
 */

interface Props {
  params: Promise<{ slug: string }>;
}

export const dynamicParams = false;
export const revalidate = 600;

export function generateStaticParams() {
  return getRdvSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = getRdvPage((await params).slug);
  if (!p) return {};
  return {
    title: `${p.metaTitle} — Althoce`,
    description: p.metaDescription,
    openGraph: { title: p.metaTitle, description: p.metaDescription, type: "website", locale: "fr_FR" },
    robots: { index: false, follow: false },
  };
}

const label = "text-[11px] font-semibold uppercase tracking-[0.16em]";
const card = "rounded-[18px] border border-bordure bg-carte";
const tile = "flex size-7 shrink-0 items-center justify-center rounded-lg bg-carte-2 text-secondaire";
const pill = "inline-flex items-center justify-center gap-2 rounded-full px-[22px] py-3 text-[14px] font-medium transition-colors duration-150 active:scale-[0.985]";

/** Mot composé (« peut-elle ») jamais coupé au trait d'union en fin de ligne */
function SansCoupure({ texte }: { texte: string }) {
  return <>{texte.split(/(\S+-\S+)/).map((s, i) => (i % 2 === 1 ? <span key={i} className="whitespace-nowrap">{s}</span> : s))}</>;
}

function Titre({ brut }: { brut: string }) {
  return (
    <h1 className="mt-4 text-[34px] font-semibold leading-[1.08] tracking-[-0.03em] text-balance sm:text-[52px] sm:leading-[1.05]">
      {brut.split(/<accent>|<\/accent>/).map((part, i) =>
        i % 2 === 1 ? <span key={i} className="text-accent"><SansCoupure texte={part} /></span> : <SansCoupure key={i} texte={part} />
      )}
    </h1>
  );
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

export default async function PageRdv({ params }: Props) {
  const { slug } = await params;
  const p = getRdvPage(slug);
  if (!p) notFound();
  const w = p.webinarSlug ? getWebinar(p.webinarSlug) : undefined;
  const webinar = w?.status === "open" && registrationOpen(w, new Date()) ? w : undefined;

  return (
    <main className="min-h-screen bg-fond text-texte antialiased">
      <div className="mx-auto max-w-[960px] px-5 pb-16 pt-8 sm:px-8">
        <header className="flex items-center justify-between gap-3 border-b border-bordure pb-6">
          <BrandLogo />
          <span className={`${label} text-right text-discret`}>Conseil &amp; intégration IA</span>
        </header>

        <div className="max-w-[760px] pt-14">
          <p className={`${label} text-accent`}>{p.eyebrow}</p>
          <Titre brut={p.title} />
          <p className="mt-6 max-w-[600px] text-[16px] leading-relaxed text-secondaire sm:text-[17px]">{p.subtitle}</p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
            <a href="#creneaux" className={`${pill} bg-action text-white hover:bg-action-hover`}>
              Choisir mon créneau
              <Icon name="arrowDown" size={14} />
            </a>
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-secondaire">
              <li className="flex items-center gap-2 tabular-nums"><Icon name="clock" size={14} className="text-accent" />{p.booking.durationMin}&nbsp;min</li>
              <li className="flex items-center gap-2"><Icon name="video" size={14} className="text-accent" />Google Meet</li>
              <li className="flex items-center gap-2"><Icon name="check" size={14} className="text-accent" />Gratuit</li>
            </ul>
          </div>
        </div>

        <section aria-labelledby="apports" className="mt-16">
          <h2 id="apports" className={`${label} text-discret`}>Ce que l&apos;audit vous apporte</h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {p.deliverables.map((d) => (
              <li key={d.title} className={`${card} flex gap-4 p-5 sm:p-6`}>
                <span className={tile}><Icon name={d.icon} size={14} /></span>
                <div>
                  <p className="text-[15px] font-semibold leading-tight">{d.title}</p>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-secondaire">{d.text}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-5 flex items-start gap-2.5 text-[13.5px] leading-relaxed text-secondaire">
            <Icon name="shieldCheck" size={14} className="mt-[3px] shrink-0 text-accent" />
            {p.honesty}
          </p>
        </section>

        <section id="creneaux" aria-labelledby="creneaux-titre" className="mt-20 scroll-mt-6">
          <p className={`${label} text-accent`}>Réserver</p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <h2 id="creneaux-titre" className="text-[26px] font-semibold leading-[1.15] tracking-[-0.03em] sm:text-[28px]">Choisissez votre créneau</h2>
            <div className="flex items-center gap-3">
              <Image src={p.host.photo} alt="" width={36} height={36} className="size-9 rounded-full object-cover" />
              <p className="text-[12.5px] leading-tight text-secondaire">
                Avec <span className="font-medium text-texte">{p.host.name}</span>
                <br />
                {p.host.role}
              </p>
            </div>
          </div>
          <div className="mt-7">
            <BookingCalendar embedUrl={p.booking.embedUrl} url={p.booking.url} title={p.booking.title} durationMin={p.booking.durationMin} />
          </div>
        </section>

        <Section id="ia" eyebrow="Ce que votre IA prépare à votre place" title="Vous ne saisissez plus, vous validez">
          <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
            <ul className={`${card} divide-y divide-bordure`}>
              {p.tasks.map((t) => (
                <li key={t} className="flex items-center gap-3 px-5 py-3.5 text-[14px] sm:px-6">
                  <Icon name="check" size={14} className="shrink-0 text-accent" />
                  {t}
                </li>
              ))}
            </ul>
            <div className={`${card} p-6`}>
              <span className={tile}><Icon name="shieldCheck" size={14} /></span>
              <p className="mt-4 text-[15px] font-semibold leading-tight">{p.validation.title}</p>
              <p className="mt-2 text-[13.5px] leading-relaxed text-secondaire">{p.validation.text}</p>
            </div>
          </div>
        </Section>

        <Section id="logiciels" eyebrow="Votre logiciel" title="Lecture, écriture ou fichier FEC">
          <ul className={`${card} divide-y divide-bordure`}>
            {p.software.map((s) => (
              <li key={s.names} className="flex flex-col gap-3 px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:gap-6 sm:px-6">
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold leading-snug">{s.names}</p>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-secondaire">
                    {s.text}
                    {s.source && (
                      <>
                        {" "}
                        <a href={s.source.url} target="_blank" rel="noopener noreferrer" className="whitespace-nowrap text-discret underline decoration-bordure-forte underline-offset-4 hover:text-texte">
                          Source&nbsp;: {s.source.label}
                        </a>
                      </>
                    )}
                  </p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1.5 self-start whitespace-nowrap rounded-full border border-accent/25 bg-accent/10 px-2.5 py-1 text-[11px] font-medium text-accent">
                  <span className="size-1.5 rounded-full bg-current" />
                  {s.status}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[13.5px] text-secondaire">Votre logiciel n&apos;est pas dans la liste&nbsp;? C&apos;est l&apos;objet de l&apos;audit.</p>
            <a href="#creneaux" className={`${pill} border border-bordure-forte text-texte hover:bg-carte-2`}>
              Choisir mon créneau
              <Icon name="arrowDown" size={14} />
            </a>
          </div>
        </Section>

        {webinar && (
          <aside className={`${card} mt-20 flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7`}>
            <div>
              <p className={`${label} text-discret`}>Pas prêt pour un rendez-vous&nbsp;?</p>
              <p className="mt-2 text-[15px] font-semibold leading-snug">
                Webinar gratuit, {webinarDay(new Date(webinar.startsAt)).toLowerCase()} à {webinarHour(new Date(webinar.startsAt))}
              </p>
              <p className="mt-1 text-[13.5px] leading-relaxed text-secondaire">{webinar.title}</p>
            </div>
            <a href={`/w/${webinar.slug}`} className={`${pill} shrink-0 border border-bordure-forte text-texte hover:bg-carte-2`}>
              Je réserve ma place
              <Icon name="arrowUpRight" size={14} />
            </a>
          </aside>
        )}

        <footer className="mt-16 flex flex-col gap-5 border-t border-bordure pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[12px] leading-relaxed text-discret">Althoce, cabinet de conseil &amp; intégration IA · Le partenaire IA des professions réglementées.</p>
          <div className="flex items-center gap-2">
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
