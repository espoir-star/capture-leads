import { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getRessource, getAllSlugs } from "@/lib/ressources";
import BookingCalendar from "@/components/BookingCalendar";
import OppositionNotice from "@/components/OppositionNotice";
import DeliveryStatus from "@/components/DeliveryStatus";
import { ESPOIR, PRE_AUDIT_BOOKING_EMBED, PRE_AUDIT_BOOKING_URL } from "@/config/rdvPages";

/**
 * Page merci de toutes les pages de capture (choix d'Espoir du 18/11/2026) :
 * le guide part par email, aucun bouton « Lire le guide » ; l'agenda du
 * pré-audit gratuit est affiché ouvert, pour réserver sans quitter la page.
 */

interface Props {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export const metadata: Metadata = {
  title: "Votre guide est dans votre boîte mail — Althoce",
  robots: { index: false },
};

export default async function PageMerci({ params }: Props) {
  const { slug } = await params;
  const r = getRessource(slug);
  if (!r) notFound();

  const ctaTitre = r.merci?.ctaTitre ?? "Souhaitez-vous l'appliquer à votre situation ?";
  const ctaTexte =
    r.merci?.ctaTexte !== undefined
      ? r.merci.ctaTexte
      : "Un échange de 30 minutes pour examiner votre organisation et identifier ce que l'IA peut concrètement prendre en charge. Sans engagement.";

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[720px] -translate-x-1/2 rounded-full bg-accent/10 blur-3xl"
      />
      <div className="relative mx-auto w-full max-w-3xl">
        <div className="mx-auto max-w-xl text-center">
          <span className="inline-block rounded-full border border-accent/40 bg-accent/10 px-4 py-1.5 text-xs font-semibold tracking-widest text-accent">
            DEMANDE ENREGISTRÉE
          </span>

          <h1 className="mt-6 font-display text-2xl sm:text-4xl font-bold leading-snug sm:leading-tight text-balance">
            {r.merci?.titre ?? (
              <>
                Votre guide est <span className="text-accent">dans votre boîte mail</span>
              </>
            )}
          </h1>

          <p className="mt-4 text-secondaire leading-relaxed">
            {r.merci?.texte ?? "Nous venons de vous l’envoyer par email, avec le lien d’accès."}
          </p>
          {/* État réel de l'envoi (jamais de délai promis) ; lien de secours seulement si l'envoi échoue. */}
          <DeliveryStatus slug={r.slug} fallbackHref={r.urlRessource} />

          <OppositionNotice slug={r.slug} />
        </div>

        {/* Conversion : le pré-audit, agenda ouvert sur la page */}
        <section id="creneaux" aria-labelledby="creneaux-titre" className="mt-12 rounded-[18px] border border-accent/25 bg-accent/5 p-5 sm:p-8">
          <div className="text-center">
            <p className="text-xs font-semibold tracking-widest text-accent">PRÉ-AUDIT · 100 % GRATUIT</p>
            <h2 id="creneaux-titre" className="mt-3 font-display text-xl sm:text-2xl font-semibold text-balance">{ctaTitre}</h2>
            {ctaTexte && (
              <p className="mx-auto mt-3 max-w-md text-sm text-secondaire leading-relaxed">{ctaTexte}</p>
            )}
            <div className="mt-5 flex items-center justify-center gap-3">
              <Image src={ESPOIR.photo} alt="" width={36} height={36} className="size-9 rounded-full object-cover" />
              <p className="text-left text-[12.5px] leading-tight text-secondaire">
                Avec <span className="font-medium text-texte">{ESPOIR.name}</span>
                <br />
                30 min · Google Meet · 100 % gratuit
              </p>
            </div>
          </div>
          <div className="mt-6">
            <BookingCalendar embedUrl={PRE_AUDIT_BOOKING_EMBED} url={PRE_AUDIT_BOOKING_URL} title="Pré-audit IA offert" />
          </div>
        </section>

        <p className="mt-8 text-center text-xs text-secondaire">
          Althoce, cabinet de conseil &amp; intégration IA, le partenaire IA des professions réglementées
        </p>
      </div>
    </main>
  );
}
