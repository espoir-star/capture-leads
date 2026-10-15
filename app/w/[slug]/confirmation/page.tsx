import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getWebinar, getWebinarPageSlugs } from "@/config/webinars";
import { siteUrl } from "@/lib/sequences/links";
import { googleCalendarUrl } from "@/lib/webinar/access";

interface Props {
  params: Promise<{ slug: string }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return getWebinarPageSlugs().map((slug) => ({ slug }));
}

export const metadata: Metadata = {
  title: "Inscription confirmée — Althoce",
  robots: { index: false },
};

/** Ajouter l'événement à l'agenda est le premier levier du taux de présence. */
export default async function ConfirmationWebinar({ params }: Props) {
  const w = getWebinar((await params).slug);
  if (!w) notFound();
  const base = siteUrl();
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl text-center">
        <span className="inline-block rounded-full border border-accent/40 bg-accent/10 px-4 py-1.5 text-xs font-semibold tracking-widest text-accent">
          ✓ INSCRIPTION CONFIRMÉE
        </span>
        <h1 className="mt-6 font-display text-2xl font-bold leading-snug text-balance sm:text-4xl">{w.title}</h1>
        <p className="mt-4 leading-relaxed text-secondaire">
          Votre lien de connexion personnel arrive par email dans quelques instants (vérifiez vos spams si besoin).
          Un rappel vous sera envoyé la veille et une heure avant.
        </p>
        <div className="mt-8 rounded-2xl border border-bordure bg-carte p-5 sm:p-6">
          <h2 className="font-semibold">Bloquez le créneau dès maintenant</h2>
          <div className="mt-4 flex flex-col justify-center gap-3 sm:flex-row">
            <a
              href={googleCalendarUrl(w, base)}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-black hover:opacity-90"
            >
              Ajouter à Google Agenda
            </a>
            <a
              href={`/w/${w.slug}/agenda.ics`}
              className="rounded-lg border border-bordure px-4 py-2.5 text-sm font-semibold hover:border-accent"
            >
              Outlook, Apple (.ics)
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
