import { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import CaptureForm from "@/components/CaptureForm";
import { getWebinar, getWebinarPageSlugs } from "@/config/webinars";
import { registrationOpen } from "@/lib/webinar/access";
import { webinarDay, webinarHours } from "@/lib/webinar/format";

/**
 * Landing d'inscription webinar : formulaire court (prénom, nom, email,
 * entreprise facultative), mêmes protections et même suivi de source que les
 * guides. Pages générées pour les webinars ouverts ; la démonstration (statut
 * « draft ») n'existe que hors Production, formulaire fermé. Régénérée toutes
 * les 10 minutes : après le direct, la page annonce la clôture des inscriptions.
 */

interface Props {
  params: Promise<{ slug: string }>;
}

export const dynamicParams = false;
export const revalidate = 600;

export function generateStaticParams() {
  return getWebinarPageSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const w = getWebinar((await params).slug);
  if (!w) return {};
  return {
    title: `${w.title} — Webinar Althoce`,
    description: w.description,
    openGraph: { title: w.title, description: w.description, type: "website", locale: "fr_FR" },
    ...((w.status === "draft" || w.internalTest) && { robots: { index: false, follow: false } }),
  };
}

function Icone({ d }: { d: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

const ICONES = {
  agenda: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z",
  heure: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  video: "M15 10l5-3v10l-5-3M4 6h11v12H4z",
};

export default async function PageWebinar({ params }: Props) {
  const { slug } = await params;
  const w = getWebinar(slug);
  if (!w || (w.status !== "open" && w.status !== "draft")) notFound();
  const preview = w.status === "draft";
  const closed = !preview && !registrationOpen(w, new Date());

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 sm:py-14">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[720px] -translate-x-1/2 rounded-full bg-accent/10 blur-3xl"
      />
      <div className="relative grid w-full max-w-5xl items-start gap-8 lg:grid-cols-[1.15fr_1fr] lg:gap-12">
        <section>
          <div className="flex flex-wrap items-center gap-3">
            <p className="font-display text-lg font-semibold tracking-tight">
              Althoce<span className="text-accent">.</span>
            </p>
            <span className="rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold tracking-wide text-accent">
              {w.internalTest ? "RECETTE INTERNE · RÉSERVÉ À L’ÉQUIPE ALTHOCE" : "WEBINAR GRATUIT · EN DIRECT"}
            </span>
          </div>
          {w.audience && <p className="mt-6 text-sm font-medium text-accent-clair">{w.audience}</p>}
          <h1 className="mt-2 font-display text-[28px] font-bold leading-tight text-balance sm:text-[40px]">{w.title}</h1>
          <p className="mt-4 text-base leading-relaxed text-secondaire sm:text-lg">{w.description}</p>

          <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-3 rounded-xl border border-bordure bg-carte px-4 py-3.5">
            <li className="flex items-center gap-2 whitespace-nowrap text-sm font-medium">
              <Icone d={ICONES.agenda} />
              <span>{webinarDay(new Date(w.startsAt))}</span>
            </li>
            <li className="flex items-center gap-2 whitespace-nowrap text-sm font-medium">
              <Icone d={ICONES.heure} />
              <span>
                {webinarHours(w)} <span className="font-normal text-secondaire">(Paris)</span>
              </span>
            </li>
            <li className="flex items-center gap-2 whitespace-nowrap text-sm font-medium">
              <Icone d={ICONES.video} />
              <span>Google Meet</span>
            </li>
          </ul>
          {!preview && !closed && (
            <a
              href="#inscription"
              className="mt-5 flex w-full items-center justify-center rounded-lg bg-accent px-6 py-3.5 font-semibold text-white transition hover:bg-accent-clair lg:hidden"
            >
              Je réserve ma place
            </a>
          )}

          {w.agenda && w.agenda.length > 0 && (
            <div className="mt-8">
              <h2 className="text-xs font-bold tracking-widest text-accent">AU PROGRAMME</h2>
              <ul className="mt-3 space-y-2.5">
                {w.agenda.map((item) => (
                  <li key={item} className="flex gap-3 text-[15px] leading-relaxed">
                    <span aria-hidden className="mt-0.5 font-bold text-accent">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {w.speaker && (
            <div className="mt-8 flex flex-wrap items-center gap-4 border-t border-bordure pt-6">
              {w.speaker.photo && (
                <Image src={w.speaker.photo} alt={w.speaker.name} width={56} height={56} className="h-14 w-14 rounded-full object-cover" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs text-secondaire">Animé par</p>
                <p className="font-semibold">{w.speaker.name}</p>
                <p className="text-sm text-secondaire">{w.speaker.role}</p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href="https://www.francenum.gouv.fr/activateurs/althoce-conseil"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Althoce, Activateur France Num (programme du gouvernement)"
                  className="rounded-lg bg-white p-1.5 transition-opacity hover:opacity-80"
                >
                  <Image src="/webinar/activateur-france-num.png" alt="Activateur France Num" width={52} height={47} />
                </a>
                <span className="rounded-lg bg-white p-1">
                  <Image src="/webinar/french-tech-bordeaux.png" alt="La French Tech Bordeaux" width={51} height={51} />
                </span>
              </div>
            </div>
          )}
        </section>

        <section id="inscription" className="scroll-mt-6 rounded-2xl border border-bordure bg-carte p-6 shadow-2xl sm:p-8">
          <h2 className="font-display text-xl font-bold">Réserver ma place</h2>
          <p className="mt-2 text-sm leading-relaxed text-secondaire">
            Gratuit. Votre lien de connexion arrive par email. Le webinar est enregistré&nbsp;: le replay est envoyé aux inscrits.
          </p>
          <div className="mt-5">
            {preview ? (
              <>
                <p role="status" className="mb-4 rounded-xl border border-accent/40 bg-accent/10 p-4 text-sm leading-relaxed">
                  Aperçu de démonstration&nbsp;: inscriptions fermées. Le formulaire ci-dessous est désactivé.
                </p>
                {/* Formulaire réel, inactif : la capture refuse de toute façon un webinar « draft ». */}
                <fieldset disabled aria-disabled className="opacity-70">
                  <CaptureForm slug={w.slug} kind="webinar" cta="Je réserve ma place" redirectTo={`/w/${w.slug}/confirmation`} />
                </fieldset>
              </>
            ) : closed ? (
              <p role="status" className="rounded-xl border border-bordure bg-fond p-4 text-sm leading-relaxed">
                Ce webinar a eu lieu&nbsp;: les inscriptions sont closes. Les inscrits reçoivent le replay par email.
              </p>
            ) : (
              <CaptureForm slug={w.slug} kind="webinar" cta="Je réserve ma place" redirectTo={`/w/${w.slug}/confirmation`} />
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
