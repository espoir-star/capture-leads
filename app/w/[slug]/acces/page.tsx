import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getWebinar } from "@/config/webinars";
import { siteUrl } from "@/lib/sequences/links";
import { googleCalendarUrl } from "@/lib/webinar/access";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ etat?: string }>;
}

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Webinar Althoce", robots: { index: false, follow: false } };

const MESSAGES: Record<string, { titre: string; texte: string; agenda?: boolean }> = {
  bientot: {
    titre: "Le webinar n’a pas encore commencé",
    texte: "Votre lien personnel s’ouvrira 15 minutes avant le début. Gardez l’email de confirmation : le même lien vous fera entrer.",
    agenda: true,
  },
  "salle-fermee": {
    titre: "La salle ouvre dans quelques instants",
    texte: "Réessayez avec le même lien dans une minute. Si le problème persiste, répondez à l’email de confirmation.",
  },
  termine: {
    titre: "Ce webinar est terminé",
    texte: "Merci de votre intérêt. Si un replay est publié, vous le recevrez par email.",
  },
  "replay-bientot": {
    titre: "Le replay arrive bientôt",
    texte: "L’enregistrement est en préparation : vous recevrez le lien par email dès qu’il est disponible.",
  },
  "lien-invalide": {
    titre: "Lien incomplet ou invalide",
    texte: "Utilisez le bouton reçu par email : il est personnel. Copié à la main, le lien peut être tronqué.",
  },
};

export default async function AccesWebinar({ params, searchParams }: Props) {
  const w = getWebinar((await params).slug);
  if (!w) notFound();
  const m = MESSAGES[(await searchParams).etat ?? ""] ?? MESSAGES["lien-invalide"];
  const date = new Intl.DateTimeFormat("fr-FR", { dateStyle: "full", timeStyle: "short", timeZone: "Europe/Paris" }).format(new Date(w.startsAt));
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg rounded-2xl border border-bordure bg-carte p-6 text-center sm:p-8">
        <p className="font-display text-lg font-semibold">
          Althoce<span className="text-accent">.</span>
        </p>
        <h1 className="mt-4 font-display text-2xl font-bold text-balance">{m.titre}</h1>
        <p className="mt-2 text-sm text-accent first-letter:uppercase">{w.title} · {date}</p>
        <p className="mt-4 leading-relaxed text-secondaire">{m.texte}</p>
        {m.agenda && (
          <a
            href={googleCalendarUrl(w, siteUrl())}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-block rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-black hover:opacity-90"
          >
            Ajouter à Google Agenda
          </a>
        )}
      </div>
    </main>
  );
}
