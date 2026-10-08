import { Metadata } from "next";
import { notFound } from "next/navigation";
import CaptureForm from "@/components/CaptureForm";
import { getOpenWebinarSlugs, getWebinar } from "@/config/webinars";

/**
 * Landing d'inscription webinar (fondation). Aucune page n'est générée tant
 * que config/webinars.ts ne contient pas de webinar au statut "open".
 */

interface Props {
  params: Promise<{ slug: string }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return getOpenWebinarSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const w = getWebinar((await params).slug);
  return w ? { title: `${w.title} — Webinar Althoce`, description: w.description } : {};
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
  if (!w || w.status !== "open") notFound();

  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-10 overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[720px] -translate-x-1/2 rounded-full bg-accent/10 blur-3xl"
      />
      <div className="relative w-full max-w-lg rounded-2xl border border-bordure bg-carte p-6 sm:p-10 shadow-2xl">
        <div className="mb-5 sm:mb-6 flex items-center justify-between">
          <p className="font-display text-lg font-semibold tracking-tight">
            Althoce<span className="text-accent">.</span>
          </p>
          <span className="rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold tracking-wide text-accent">
            WEBINAR GRATUIT
          </span>
        </div>
        <h1 className="font-display text-[22px] sm:text-3xl font-bold leading-snug sm:leading-tight text-balance">
          {w.title}
        </h1>
        <p className="mt-3 text-[15px] sm:text-base text-secondaire leading-relaxed">{w.description}</p>
        <p className="mt-4 text-sm font-medium text-accent first-letter:uppercase">
          {dateLongue(w.startsAt)} · {w.durationMin} min
        </p>
        <div className="mt-6 sm:mt-8">
          <CaptureForm
            slug={w.slug}
            kind="webinar"
            cta="Je m’inscris"
            redirectTo={`/w/${w.slug}/confirmation`}
          />
        </div>
      </div>
    </main>
  );
}
