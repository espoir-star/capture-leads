import type { ReactNode } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import BrandLogo from "@/components/BrandLogo";
import BookingCalendar from "@/components/BookingCalendar";
import { Icon } from "@/components/icons/lucide";
import { getRdvPage, getRdvSlugs, type RdvBlock, type RdvDetail, type RdvNote, type RdvPage, type RdvPoint } from "@/config/rdvPages";
import { getWebinar } from "@/config/webinars";
import { registrationOpen } from "@/lib/webinar/access";
import { webinarDay, webinarHour } from "@/lib/webinar/format";

/**
 * Page de rendez-vous : le visiteur réserve directement son créneau, sans
 * formulaire. Tous les textes et l'ordre des blocs viennent de config/rdvPages.ts.
 * Régénérée toutes les 10 minutes : le webinar proposé à ceux qui ne réservent pas
 * disparaît à la clôture des inscriptions.
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

function Cartes({ items, className }: { items: RdvPoint[]; className: string }) {
  return (
    <ul className={className}>
      {items.map((d) => (
        <li key={d.title} className={`${card} flex gap-4 p-5 sm:p-6`}>
          <span className={tile}><Icon name={d.icon} size={14} /></span>
          <div>
            <p className="text-[15px] font-semibold leading-tight">{d.title}</p>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-secondaire">{d.text}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Encadré mis en avant ; `className` s'ajoute sans changer les classes de base */
function Highlight({ point, className }: { point: RdvPoint; className?: string }) {
  return (
    <div className={`flex gap-4 rounded-[18px] border border-accent/25 bg-accent/[0.06] p-6 sm:items-center sm:gap-5 sm:p-7${className ? ` ${className}` : ""}`}>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent"><Icon name={point.icon} size={18} strokeWidth={1.75} /></span>
      <div>
        <p className="text-[18px] font-semibold leading-snug tracking-[-0.02em] sm:text-[20px]">{point.title}</p>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-secondaire">{point.text}</p>
      </div>
    </div>
  );
}

function Note({ note }: { note: RdvNote }) {
  return (
    <p className="mt-5 flex items-start gap-2.5 text-[13.5px] leading-relaxed text-secondaire">
      <Icon name={note.icon} size={14} className="mt-[3px] shrink-0 text-accent" />
      {note.text}
    </p>
  );
}

function DetailText({ item }: { item: RdvDetail }) {
  return (
    <div className="min-w-0">
      <p className="text-[15px] font-semibold leading-snug">{item.title}</p>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-secondaire">
        {item.text}
        {item.source && (
          <>
            {" "}
            <a href={item.source.url} target="_blank" rel="noopener noreferrer" className="whitespace-nowrap text-discret underline decoration-bordure-forte underline-offset-4 hover:text-texte">
              Source&nbsp;: {item.source.label}
            </a>
          </>
        )}
      </p>
    </div>
  );
}

function Bloc({ b, p }: { b: RdvBlock; p: RdvPage }) {
  switch (b.kind) {
    case "apports":
      return (
        <section aria-labelledby="apports" className="mt-16">
          <h2 id="apports" className={`${label} text-discret`}>{b.title}</h2>
          <Cartes items={b.items} className="mt-4 grid gap-4 sm:grid-cols-2" />
          <Note note={b.note} />
        </section>
      );

    case "agenda":
      return (
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
            <BookingCalendar embedUrl={p.booking.embedUrl} url={p.booking.url} title={p.booking.title} />
          </div>
        </section>
      );

    case "cartes":
      return (
        <Section id={b.id} eyebrow={b.eyebrow} title={b.title}>
          <Cartes items={b.items} className="grid gap-4 sm:grid-cols-2" />
          {b.more && (
            <p className="mt-4 flex items-center gap-2.5 px-1 text-[13.5px] text-secondaire">
              <Icon name="plus" size={14} className="shrink-0 text-discret" />
              {b.more}
            </p>
          )}
          {b.highlight && <Highlight point={b.highlight} className="mt-6" />}
          {b.points && (
            <div className="mt-6 rounded-[18px] border border-accent/25 bg-accent/[0.06] p-6 sm:p-7">
              <p className="text-[18px] font-semibold leading-snug tracking-[-0.02em] sm:text-[20px]">{b.points.title}</p>
              <ul className="mt-4 grid gap-3 sm:grid-cols-3 sm:gap-5">
                {b.points.items.map((t) => (
                  <li key={t} className="flex items-start gap-2.5 text-[14px] leading-snug">
                    <Icon name="check" size={14} className="mt-[3px] shrink-0 text-accent" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {b.note && <Note note={b.note} />}
        </Section>
      );

    case "apercu":
      return (
        <Section id={b.id} eyebrow={b.eyebrow} title={b.title}>
          <figure>
            <a
              href={b.image.src}
              target="_blank"
              rel="noopener noreferrer"
              className="block overflow-hidden rounded-[18px] border border-bordure bg-white transition-colors duration-150 hover:border-bordure-forte"
            >
              <Image src={b.image.src} alt={b.image.alt} width={b.image.width} height={b.image.height} sizes="(min-width: 960px) 896px, 100vw" className="block h-auto w-full" />
              <span className="sr-only">Agrandir la capture (nouvel onglet)</span>
            </a>
            <figcaption className="mt-3 text-[12px] leading-relaxed text-discret">{b.image.caption}</figcaption>
          </figure>
          <ul className="mt-8 grid gap-x-8 gap-y-6 sm:grid-cols-2">
            {b.items.map((d) => (
              <li key={d.title} className="flex gap-4">
                <span className={tile}><Icon name={d.icon} size={14} /></span>
                <div>
                  <p className="text-[15px] font-semibold leading-tight">{d.title}</p>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-secondaire">{d.text}</p>
                </div>
              </li>
            ))}
          </ul>
          {b.note && <Note note={b.note} />}
        </Section>
      );

    case "travail":
      return (
        <Section id={b.id} eyebrow={b.eyebrow} title={b.title}>
          <Highlight point={b.highlight} />
          <div className="mt-4 grid items-start gap-4 lg:grid-cols-[1.1fr_1fr]">
            <ul className={`${card} divide-y divide-bordure`}>
              {b.tasks.map((t) => (
                <li key={t} className="flex items-center gap-3 px-5 py-3.5 text-[14px] sm:px-6">
                  <Icon name="check" size={14} className="shrink-0 text-accent" />
                  {t}
                </li>
              ))}
              <li className="flex items-center gap-3 px-5 py-3.5 text-[14px] text-secondaire sm:px-6">
                <Icon name="plus" size={14} className="shrink-0 text-discret" />
                {b.tasksMore}
              </li>
            </ul>
            <div className={`${card} p-6`}>
              <span className={tile}><Icon name={b.aside.icon} size={14} /></span>
              <p className="mt-4 text-[15px] font-semibold leading-tight">{b.aside.title}</p>
              <p className="mt-2 text-[13.5px] leading-relaxed text-secondaire">{b.aside.text}</p>
            </div>
          </div>
        </Section>
      );

    case "liste":
      return (
        <Section id={b.id} eyebrow={b.eyebrow} title={b.title}>
          <ul className={`${card} divide-y divide-bordure`}>
            {b.items.map((s) => (
              <li key={s.title} className="flex flex-col gap-3 px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:gap-6 sm:px-6">
                {s.icon ? (
                  <div className="flex min-w-0 gap-4">
                    <span className={tile}><Icon name={s.icon} size={14} /></span>
                    <DetailText item={s} />
                  </div>
                ) : (
                  <DetailText item={s} />
                )}
                {s.status && (
                  <span className="inline-flex shrink-0 items-center gap-1.5 self-start whitespace-nowrap rounded-full border border-accent/25 bg-accent/10 px-2.5 py-1 text-[11px] font-medium text-accent">
                    <span className="size-1.5 rounded-full bg-current" />
                    {s.status}
                  </span>
                )}
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[13.5px] text-secondaire">{b.cta}</p>
            <a href="#creneaux" className={`${pill} border border-bordure-forte text-texte hover:bg-carte-2`}>
              Choisir mon créneau
              <Icon name="arrowDown" size={14} />
            </a>
          </div>
        </Section>
      );
  }
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
              <li className="flex items-center gap-2"><Icon name="check" size={14} className="text-accent" />{p.priceLabel}</li>
            </ul>
          </div>
        </div>

        {p.blocks.map((b, i) => (
          <Bloc key={`${b.kind}-${i}`} b={b} p={p} />
        ))}

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
