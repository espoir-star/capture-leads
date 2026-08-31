"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface Props {
  slug: string;
  cta: string;
}

/** Indicatifs proposés : France + pays où Althoce a déjà des leads (francophonie, Europe proche, Amérique du Nord) */
const INDICATIFS = [
  { code: "33", pays: "France", drapeau: "🇫🇷" },
  { code: "32", pays: "Belgique", drapeau: "🇧🇪" },
  { code: "41", pays: "Suisse", drapeau: "🇨🇭" },
  { code: "352", pays: "Luxembourg", drapeau: "🇱🇺" },
  { code: "1", pays: "Canada / États-Unis", drapeau: "🇨🇦" },
  { code: "212", pays: "Maroc", drapeau: "🇲🇦" },
  { code: "213", pays: "Algérie", drapeau: "🇩🇿" },
  { code: "216", pays: "Tunisie", drapeau: "🇹🇳" },
  { code: "225", pays: "Côte d'Ivoire", drapeau: "🇨🇮" },
  { code: "221", pays: "Sénégal", drapeau: "🇸🇳" },
  { code: "237", pays: "Cameroun", drapeau: "🇨🇲" },
  { code: "44", pays: "Royaume-Uni", drapeau: "🇬🇧" },
  { code: "49", pays: "Allemagne", drapeau: "🇩🇪" },
  { code: "34", pays: "Espagne", drapeau: "🇪🇸" },
  { code: "39", pays: "Italie", drapeau: "🇮🇹" },
  { code: "351", pays: "Portugal", drapeau: "🇵🇹" },
] as const;

/** Normalise un numéro international : indicatif choisi + saisie locale → format E.164 ("+33612345678") */
function normaliserTel(indicatif: string, brut: string): string | null {
  let chiffres = brut.replace(/\D/g, "");
  if (!chiffres) return null;

  // L'utilisateur a peut-être déjà saisi l'indicatif (avec ou sans 0 initial)
  if (chiffres.startsWith(indicatif)) {
    chiffres = chiffres.slice(indicatif.length);
  } else if (chiffres.startsWith("0")) {
    chiffres = chiffres.slice(1);
  }

  const complet = indicatif + chiffres;
  // E.164 : 8 à 15 chiffres au total après le "+"
  if (!/^[1-9]\d{7,14}$/.test(complet)) return null;
  return "+" + complet;
}

export default function CaptureForm({ slug, cta }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [utm, setUtm] = useState({ source: "", medium: "", campaign: "" });
  const [indicatif, setIndicatif] = useState<string>(INDICATIFS[0].code);

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
    const nom = String(form.get("nom") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const telBrut = String(form.get("tel") ?? "").trim();
    const honeypot = String(form.get("website") ?? "");

    const tel = normaliserTel(indicatif, telBrut);
    if (!tel) {
      setErreur("Numéro de mobile invalide pour l'indicatif choisi.");
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
          nom,
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
        <label htmlFor="nom" className="sr-only">
          Nom
        </label>
        <input
          id="nom"
          name="nom"
          type="text"
          required
          minLength={2}
          placeholder="Nom"
          autoComplete="family-name"
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
        <div className="flex items-stretch rounded-lg border border-bordure bg-fond focus-within:border-accent transition-colors">
          <label htmlFor="indicatif" className="sr-only">
            Pays
          </label>
          <select
            id="indicatif"
            name="indicatif"
            value={indicatif}
            onChange={(e) => setIndicatif(e.target.value)}
            className="shrink-0 whitespace-nowrap border-r border-bordure bg-transparent px-3 text-sm font-medium text-white outline-none"
          >
            {INDICATIFS.map((i) => (
              <option key={i.code} value={i.code} className="bg-fond text-white">
                {i.drapeau} +{i.code}
              </option>
            ))}
          </select>
          <input
            id="tel"
            name="tel"
            type="tel"
            required
            placeholder="6 12 34 56 78"
            autoComplete="tel-national"
            inputMode="tel"
            className="w-full bg-transparent py-3.5 pl-3.5 pr-4 text-white placeholder:text-secondaire outline-none"
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
          href="https://althoce.com/confidentialite/"
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
