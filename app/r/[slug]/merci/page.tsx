import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRessource, getAllSlugs } from "@/lib/ressources";

const CAL_URL = "https://cal.com/althoce-conseil-4ncbuz/30min";

interface Props {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export const metadata: Metadata = {
  title: "Votre guide est prêt — Althoce",
  robots: { index: false },
};

export default async function PageMerci({ params }: Props) {
  const { slug } = await params;
  const r = getRessource(slug);
  if (!r) notFound();

  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-12 overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[720px] -translate-x-1/2 rounded-full bg-accent/10 blur-3xl"
      />
      <div className="relative w-full max-w-xl text-center">
        <span className="inline-block rounded-full border border-accent/40 bg-accent/10 px-4 py-1.5 text-xs font-semibold tracking-widest text-accent">
          ✓ INSCRIPTION CONFIRMÉE
        </span>

        <h1 className="mt-6 font-display text-3xl sm:text-4xl font-bold leading-tight">
          Votre guide est <span className="text-accent">prêt</span> 🎉
        </h1>

        <p className="mt-4 text-secondaire leading-relaxed">
          Vous le recevez aussi par email dans quelques instants
          (vérifiez vos spams si besoin).
        </p>

        {/* Accès direct à la ressource */}
        <div className="mt-9 rounded-2xl border border-bordure bg-carte p-8">
          <p className="font-display text-xl font-semibold">
            Accédez au guide maintenant
          </p>
          <a
            href={r.urlRessource}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-block w-full rounded-lg bg-accent px-6 py-4 font-semibold text-white hover:bg-accent-clair transition sm:w-auto sm:px-10"
          >
            Lire le guide gratuitement ↗
          </a>
        </div>

        {/* Deuxième conversion : le call */}
        <div className="mt-5 rounded-2xl border border-accent/25 bg-accent/5 p-8">
          <p className="font-display text-xl font-semibold">
            On l&apos;applique ensemble à votre cas ?
          </p>
          <p className="mx-auto mt-3 max-w-md text-sm text-secondaire leading-relaxed">
            30 minutes pour regarder votre situation et voir ce que
            l&apos;IA peut automatiser chez vous. Sans engagement.
          </p>
          <a
            href={CAL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-block rounded-lg border border-accent px-8 py-3.5 font-semibold text-accent hover:bg-accent hover:text-white transition"
          >
            Réserver 30 min
          </a>
        </div>

        <p className="mt-8 text-xs text-secondaire">
          Althoce — Agence d&apos;automatisation IA, Bordeaux
        </p>
      </div>
    </main>
  );
}
