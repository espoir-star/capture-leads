import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getOpenWebinarSlugs, getWebinar } from "@/config/webinars";

interface Props {
  params: Promise<{ slug: string }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return getOpenWebinarSlugs().map((slug) => ({ slug }));
}

export const metadata: Metadata = {
  title: "Inscription confirmée — Althoce",
  robots: { index: false },
};

export default async function ConfirmationWebinar({ params }: Props) {
  const w = getWebinar((await params).slug);
  if (!w) notFound();
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl text-center">
        <span className="inline-block rounded-full border border-accent/40 bg-accent/10 px-4 py-1.5 text-xs font-semibold tracking-widest text-accent">
          ✓ INSCRIPTION CONFIRMÉE
        </span>
        <h1 className="mt-6 font-display text-2xl sm:text-4xl font-bold leading-snug text-balance">
          {w.title}
        </h1>
        <p className="mt-4 text-secondaire leading-relaxed">
          Le lien de connexion arrive par email dans quelques instants (vérifiez vos spams si besoin).
          Un rappel vous sera envoyé la veille et une heure avant.
        </p>
      </div>
    </main>
  );
}
