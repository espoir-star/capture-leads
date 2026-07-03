import { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getRessource, getAllSlugs } from "@/lib/ressources";
import CaptureForm from "@/components/CaptureForm";

interface Props {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const r = getRessource(slug);
  if (!r) return {};

  const titrePlat = r.titre.replace(/<\/?accent>/g, "");
  return {
    title: `${titrePlat} — Althoce`,
    description: r.sousTitre,
    openGraph: {
      title: titrePlat,
      description: r.sousTitre,
      type: "website",
      locale: "fr_FR",
      ...(r.cover && { images: [{ url: r.cover, width: 1200, height: 630 }] }),
    },
    twitter: {
      card: "summary_large_image",
      title: titrePlat,
      description: r.sousTitre,
    },
  };
}

/** Rend le titre en remplaçant <accent>...</accent> par un span vert */
function Titre({ brut, className }: { brut: string; className?: string }) {
  const parts = brut.split(/<accent>|<\/accent>/);
  return (
    <h1 className={className}>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <span key={i} className="text-accent">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </h1>
  );
}

function Pills({ pills }: { pills: string[] }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {pills.map((p) => (
        <li
          key={p}
          className="rounded-full border border-bordure bg-carte px-3.5 py-1.5 text-sm text-secondaire"
        >
          <span className="mr-1.5 text-accent" aria-hidden>
            ✓
          </span>
          {p}
        </li>
      ))}
    </ul>
  );
}

function Logo() {
  return (
    <p className="font-display text-lg font-semibold tracking-tight">
      Althoce<span className="text-accent">.</span>
    </p>
  );
}

export default async function PageCapture({ params }: Props) {
  const { slug } = await params;
  const r = getRessource(slug);
  if (!r) notFound();

  const form = (
    <Suspense>
      <CaptureForm slug={r.slug} cta={r.cta ?? "Recevoir la ressource"} />
    </Suspense>
  );

  /* ── Style MODAL : carte centrée sur fond texturé ───────────── */
  if (r.style === "modal") {
    return (
      <main className="relative flex min-h-screen items-center justify-center px-4 py-10 overflow-hidden">
        {/* halo vert d'ambiance */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[720px] -translate-x-1/2 rounded-full bg-accent/10 blur-3xl"
        />
        <div className="relative w-full max-w-lg rounded-2xl border border-bordure bg-carte p-8 sm:p-10 shadow-2xl">
          <div className="mb-6 flex items-center justify-between">
            <Logo />
            <span className="rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold tracking-wide text-accent">
              {r.badge}
            </span>
          </div>
          <Titre
            brut={r.titre}
            className="font-display text-2xl sm:text-3xl font-bold leading-tight"
          />
          <p className="mt-4 text-secondaire leading-relaxed">{r.sousTitre}</p>
          <div className="mt-5">
            <Pills pills={r.pills} />
          </div>
          <div className="mt-8">{form}</div>
        </div>
      </main>
    );
  }

  /* ── Style PAGE : landing 2 colonnes ────────────────────────── */
  return (
    <main className="min-h-screen">
      <header className="mx-auto max-w-6xl px-6 py-6">
        <Logo />
      </header>
      <section className="mx-auto grid max-w-6xl gap-12 px-6 pb-20 pt-6 lg:grid-cols-2 lg:gap-16 lg:pt-14">
        <div>
          <span className="rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold tracking-wide text-accent">
            {r.badge}
          </span>
          <Titre
            brut={r.titre}
            className="mt-5 font-display text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight"
          />
          <p className="mt-5 max-w-xl text-lg text-secondaire leading-relaxed">
            {r.sousTitre}
          </p>
          <div className="mt-7">
            <Pills pills={r.pills} />
          </div>
        </div>
        <div className="lg:pt-2">
          <div className="rounded-2xl border border-bordure bg-carte p-8 shadow-2xl">
            <p className="mb-6 font-display text-lg font-semibold">
              Recevez le guide par email
            </p>
            {form}
          </div>
        </div>
      </section>
    </main>
  );
}
