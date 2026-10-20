import { Metadata } from "next";
import { notFound } from "next/navigation";
import CaptureForm from "@/components/CaptureForm";
import { getWebinar, getWebinarPageSlugs } from "@/config/webinars";
import { registrationOpen } from "@/lib/webinar/access";

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
    ...(w.status === "draft" && { robots: { index: false, follow: false } }),
  };
}

function dateLongue(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  }).format(new Date(iso));
}

export default async function PageWebinar({ params }: Props) {
  const { slug } = await params;
  const w = getWebinar(slug);
  if (!w || (w.status !== "open" && w.status !== "draft")) notFound();
  const preview = w.status === "draft";
  const closed = !preview && !registrationOpen(w, new Date());

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[720px] -translate-x-1/2 rounded-full bg-accent/10 blur-3xl"
      />
      <div className="relative grid w-full max-w-5xl items-start gap-6 lg:grid-cols-[1.1fr_1fr] lg:gap-10">
        <section>
          <div className="flex flex-wrap items-center gap-3">
            <p className="font-display text-lg font-semibold tracking-tight">
              Althoce<span className="text-accent">.</span>
            </p>
            <span className="rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold tracking-wide text-accent">
              WEBINAR GRATUIT · EN LIGNE
            </span>
          </div>
          <h1 className="mt-5 font-display text-[26px] font-bold leading-snug text-balance sm:text-4xl sm:leading-tight">
            {w.title}
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-secondaire sm:text-base">{w.description}</p>
          <ul className="mt-5 flex flex-wrap gap-2 text-sm">
            <li className="rounded-lg border border-bordure bg-carte px-3 py-1.5 font-medium first-letter:uppercase">
              {dateLongue(w.startsAt)} (heure de Paris)
            </li>
            <li className="rounded-lg border border-bordure bg-carte px-3 py-1.5">{w.durationMin} min</li>
            <li className="rounded-lg border border-bordure bg-carte px-3 py-1.5">Google Meet</li>
          </ul>
          {w.audience && (
            <p className="mt-4 text-sm text-secondaire">
              <span className="font-semibold text-white">Pour : </span>
              {w.audience}
            </p>
          )}
          {w.agenda && w.agenda.length > 0 && (
            <div className="mt-6">
              <h2 className="text-xs font-bold tracking-widest text-accent">AU PROGRAMME</h2>
              <ul className="mt-3 space-y-2">
                {w.agenda.map((item) => (
                  <li key={item} className="flex gap-2 text-[15px] leading-relaxed">
                    <span aria-hidden className="text-accent">→</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {w.speaker && (
            <p className="mt-6 text-sm text-secondaire">
              Animé par <span className="font-semibold text-white">{w.speaker.name}</span>, {w.speaker.role}
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-bordure bg-carte p-6 shadow-2xl sm:p-8">
          <h2 className="font-display text-xl font-bold">Réserver ma place</h2>
          <p className="mt-2 text-sm leading-relaxed text-secondaire">
            Votre lien de connexion personnel arrive par email, avec un rappel la veille et une heure avant.
          </p>
          <div className="mt-5">
            {preview ? (
              <>
                <p role="status" className="mb-4 rounded-xl border border-accent/40 bg-accent/10 p-4 text-sm leading-relaxed">
                  Aperçu de démonstration : inscriptions fermées. Le formulaire ci-dessous est désactivé.
                </p>
                {/* Formulaire réel, inactif : la capture refuse de toute façon un webinar « draft ». */}
                <fieldset disabled aria-disabled className="opacity-70">
                  <CaptureForm slug={w.slug} kind="webinar" cta="Je réserve ma place" redirectTo={`/w/${w.slug}/confirmation`} />
                </fieldset>
              </>
            ) : closed ? (
              <p role="status" className="rounded-xl border border-bordure bg-fond p-4 text-sm leading-relaxed">
                Ce webinar a eu lieu : les inscriptions sont closes. Les inscrits reçoivent le replay par email.
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
