import { Metadata } from "next";
import ConfirmEmail from "@/components/ConfirmEmail";
import { maskEmail } from "@/lib/lead/log";
import { readEmailConfirmToken } from "@/lib/security/emailConfirm";

export const metadata: Metadata = {
  title: "Confirmer votre adresse — Althoce",
  robots: { index: false },
};
export const dynamic = "force-dynamic";

/**
 * Lien « Confirmer mon adresse » de l'email de bienvenue. L'ouverture de la
 * page ne modifie rien : seule l'action sur le bouton confirme.
 */
export default async function PageConfirmerEmail({
  searchParams,
}: {
  searchParams: Promise<{ t?: string | string[] }>;
}) {
  const raw = (await searchParams).t;
  const token = typeof raw === "string" ? raw : undefined;
  const email = readEmailConfirmToken(token);

  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-12 overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[720px] -translate-x-1/2 rounded-full bg-accent/10 blur-3xl"
      />
      <div className="relative w-full max-w-lg rounded-2xl border border-bordure bg-carte p-6 sm:p-10 shadow-2xl">
        <p className="font-display text-lg font-semibold tracking-tight">
          Althoce<span className="text-accent">.</span>
        </p>
        {email && token ? (
          <ConfirmEmail token={token} maskedEmail={maskEmail(email)} />
        ) : (
          <>
            <h1 className="mt-6 font-display text-2xl font-bold leading-snug">Lien non valide</h1>
            <p className="mt-3 text-secondaire leading-relaxed">
              Ce lien de confirmation est incomplet ou n&apos;est plus valable. Votre guide reste
              accessible depuis l&apos;email que vous avez reçu.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
