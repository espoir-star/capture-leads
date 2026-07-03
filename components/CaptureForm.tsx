"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface Props {
  slug: string;
  cta: string;
}

/** Normalise un numéro FR : "06 12 34 56 78" → "+33612345678" */
function normaliserTel(brut: string): string | null {
  const chiffres = brut.replace(/[\s.\-()]/g, "");
  if (/^\+33[67]\d{8}$/.test(chiffres)) return chiffres;
  if (/^0[67]\d{8}$/.test(chiffres)) return "+33" + chiffres.slice(1);
  if (/^33[67]\d{8}$/.test(chiffres)) return "+" + chiffres;
  return null;
}

export default function CaptureForm({ slug, cta }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [utm, setUtm] = useState({ source: "", medium: "", campaign: "" });

  useEffect(() => {
    setUtm({
      source: searchParams.get("utm_source") ?? "",
      medium: searchParams.get("utm_medium") ?? "",
      campaign: searchParams.get("utm_campaign") ?? "",
    });
  }, [searchParams]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErreur(null);

    const form = new FormData(e.currentTarget);
    const prenom = String(form.get("prenom") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const telBrut = String(form.get("tel") ?? "").trim();
    const honeypot = String(form.get("website") ?? "");

    const tel = normaliserTel(telBrut);
    if (!tel) {
      setErreur(
        "Le numéro doit être un mobile français (06 ou 07)."
      );
      return;
    }

    setEnvoi(true);
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          prenom,
          email,
          tel,
          website: honeypot,
          utm,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message ?? "Une erreur est survenue.");
      }

      router.push(`/r/${slug}/merci`);
    } catch (err) {
      setErreur(
        err instanceof Error
          ? err.message
          : "Une erreur est survenue. Réessayez."
      );
      setEnvoi(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate={false}>
      {/* Honeypot anti-bot : caché aux humains, rempli par les bots */}
      <div className="absolute -left-[9999px]" aria-hidden="true">
        <label htmlFor="website">Ne pas remplir</label>
        <input
          id="website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <div>
        <label htmlFor="prenom" className="sr-only">
          Prénom
        </label>
        <input
          id="prenom"
          name="prenom"
          type="text"
          required
          minLength={2}
          placeholder="Prénom"
          autoComplete="given-name"
          className="w-full rounded-lg border border-bordure bg-fond px-4 py-3.5 text-white placeholder:text-secondaire focus:border-accent transition-colors"
        />
      </div>

      <div>
        <label htmlFor="email" className="sr-only">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          placeholder="Email professionnel"
          autoComplete="email"
          className="w-full rounded-lg border border-bordure bg-fond px-4 py-3.5 text-white placeholder:text-secondaire focus:border-accent transition-colors"
        />
      </div>

      <div>
        <label htmlFor="tel" className="sr-only">
          Numéro de mobile
        </label>
        <div className="flex items-center rounded-lg border border-bordure bg-fond focus-within:border-accent transition-colors">
          <span className="pl-4 pr-2 text-secondaire select-none" aria-hidden>
            🇫🇷 +33
          </span>
          <input
            id="tel"
            name="tel"
            type="tel"
            required
            placeholder="6 12 34 56 78"
            autoComplete="tel-national"
            inputMode="tel"
            className="w-full bg-transparent py-3.5 pr-4 text-white placeholder:text-secondaire outline-none"
          />
        </div>
      </div>

      {erreur && (
        <p role="alert" className="text-sm text-red-400">
          {erreur}
        </p>
      )}

      <button
        type="submit"
        disabled={envoi}
        className="w-full rounded-lg bg-accent px-6 py-4 font-semibold text-white hover:bg-accent-clair active:scale-[0.99] transition disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {envoi ? "Envoi en cours..." : cta}
      </button>

      <p className="text-xs leading-relaxed text-secondaire">
        En téléchargeant ce guide, vous acceptez de recevoir des conseils
        d&apos;Althoce par email et d&apos;être éventuellement recontacté.
        Vos données ne sont jamais revendues. Désinscription en 1 clic.{" "}
        <a
          href="https://althoce.fr/politique-de-confidentialite"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-white transition-colors"
        >
          Politique de confidentialité
        </a>
      </p>
    </form>
  );
}
