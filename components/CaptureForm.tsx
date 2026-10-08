"use client";

import { useRef, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Turnstile, { type TurnstileHandle } from "@/components/Turnstile";
import {
  BESOINS,
  HORIZONS,
  LABEL_BESOIN,
  LABEL_HORIZON,
  PHONE_COUNTRIES,
  type PhoneCountry,
} from "@/config/taxonomy";
import { trackLead } from "@/lib/analytics";
import { identifyBrevoContact } from "@/lib/tracking/brevoTracker";
import { currentTouch, readFirstTouch } from "@/lib/tracking/firstTouch";
import { suggestionEmail } from "@/lib/validation/emailSuggestion";

interface Props {
  slug: string;
  cta: string;
  /** Page affichée après une inscription réussie (défaut : merci du guide) */
  redirectTo?: string;
  /** "webinar" pour une inscription webinar (config/webinars.ts) */
  kind?: "guide" | "webinar";
}

type Field = "prenom" | "nom" | "email" | "tel" | "besoin" | "horizon";

/** Clé sessionStorage du jeton signé, lu par la page merci (lead_magnet_downloaded) */
export const LEAD_REF_KEY = "althoce_lead_ref:";

const FIELD =
  "w-full rounded-lg border bg-fond px-4 py-3.5 placeholder:text-secondaire focus:border-accent transition-colors";
const INPUT = `${FIELD} text-white`;
/** Menu déroulant : gris tant que la question (placeholder) est affichée, blanc une fois choisi */
const selectClass = (value: string, err?: string) =>
  `${FIELD} ${borderFor(err)} appearance-none pr-10 ${value ? "text-white" : "text-secondaire"}`;

function borderFor(err?: string) {
  return err ? "border-red-400/70" : "border-bordure";
}

function ErrorText({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1.5 text-sm text-red-400">
      {message}
    </p>
  );
}

function Chevron() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-secondaire"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M5 7.5l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function newSessionId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

export default function CaptureForm({ slug, cta, redirectTo, kind = "guide" }: Props) {
  const router = useRouter();
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [pays, setPays] = useState<PhoneCountry>("FR");
  const [besoin, setBesoin] = useState("");
  const [horizon, setHorizon] = useState("");
  const [optIn, setOptIn] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const turnstile = useRef<TurnstileHandle>(null);
  const enCours = useRef(false);
  // Identifiant de session côté client, pour recouper dans les logs serveur
  // une tentative rejetée avec la soumission réussie qui a suivi.
  const [sessionId] = useState<string>(newSessionId);

  const clearError = (f: Field) => setErrors((e) => (e[f] ? { ...e, [f]: undefined } : e));

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (enCours.current) return; // protection double clic
    enCours.current = true;
    setErreur(null);
    setErrors({});
    setEnvoi(true);

    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();

    try {
      const turnstileToken = await turnstile.current?.getToken();
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          slug,
          prenom: String(form.get("prenom") ?? "").trim(),
          nom: String(form.get("nom") ?? "").trim(),
          email,
          tel: String(form.get("tel") ?? "").trim(),
          pays,
          besoin,
          horizon,
          optIn,
          website: String(form.get("website") ?? ""),
          turnstileToken,
          firstTouch: readFirstTouch(),
          currentTouch: currentTouch(),
          sessionId,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const field = data?.field as Field | undefined;
        const message = data?.message ?? "Une erreur est survenue. Réessayez.";
        if (field && ["prenom", "nom", "email", "tel", "besoin", "horizon"].includes(field)) {
          setErrors({ [field]: message });
          document.getElementById(field)?.focus();
        } else {
          setErreur(message);
        }
        turnstile.current?.reset(); // un jeton Turnstile ne sert qu'une fois
        enCours.current = false;
        setEnvoi(false);
        return;
      }

      if (data?.leadRef) {
        try {
          sessionStorage.setItem(LEAD_REF_KEY + slug, data.leadRef);
        } catch {
          /* stockage indisponible : l'événement « guide ouvert » ne sera pas mesuré */
        }
      }
      identifyBrevoContact(email.toLowerCase());
      trackLead("guide", slug);
      router.push(redirectTo ?? `/r/${slug}/merci`);
    } catch {
      setErreur("Connexion impossible. Vérifiez votre réseau et réessayez.");
      turnstile.current?.reset();
      enCours.current = false;
      setEnvoi(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate={false}>
      {/* Honeypot anti-bot : caché aux humains, rempli par les bots */}
      <div className="absolute -left-[9999px]" aria-hidden="true">
        <label htmlFor="website">Ne pas remplir</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid grid-cols-2 gap-3">
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
            maxLength={60}
            placeholder="Prénom"
            autoComplete="given-name"
            aria-invalid={!!errors.prenom}
            aria-describedby={errors.prenom ? "prenom-error" : undefined}
            onChange={() => clearError("prenom")}
            className={`${INPUT} ${borderFor(errors.prenom)}`}
          />
          <ErrorText id="prenom-error" message={errors.prenom} />
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
            maxLength={60}
            placeholder="Nom"
            autoComplete="family-name"
            aria-invalid={!!errors.nom}
            aria-describedby={errors.nom ? "nom-error" : undefined}
            onChange={() => clearError("nom")}
            className={`${INPUT} ${borderFor(errors.nom)}`}
          />
          <ErrorText id="nom-error" message={errors.nom} />
        </div>
      </div>

      <div>
        <label htmlFor="email" className="sr-only">
          Email
        </label>
        <input
          ref={emailRef}
          id="email"
          name="email"
          type="email"
          required
          maxLength={254}
          placeholder="Email professionnel"
          autoComplete="email"
          inputMode="email"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? "email-error" : undefined}
          onBlur={(e) => setSuggestion(suggestionEmail(e.target.value.trim()))}
          onChange={() => {
            setSuggestion(null);
            clearError("email");
          }}
          className={`${INPUT} ${borderFor(errors.email)}`}
        />
        <ErrorText id="email-error" message={errors.email} />
        {suggestion && (
          <p className="mt-1.5 text-sm text-secondaire">
            Vouliez-vous dire{" "}
            <button
              type="button"
              onClick={() => {
                if (emailRef.current) emailRef.current.value = suggestion;
                setSuggestion(null);
                clearError("email");
              }}
              className="font-medium text-accent underline underline-offset-2"
            >
              {suggestion}
            </button>{" "}
            ?
          </p>
        )}
      </div>

      <div>
        <label htmlFor="tel" className="sr-only">
          Numéro de mobile
        </label>
        <div
          className={`flex items-stretch rounded-lg border bg-fond focus-within:border-accent transition-colors ${borderFor(errors.tel)}`}
        >
          <label htmlFor="pays" className="sr-only">
            Pays
          </label>
          <select
            id="pays"
            name="pays"
            value={pays}
            onChange={(e) => {
              setPays(e.target.value as PhoneCountry);
              clearError("tel");
            }}
            className="shrink-0 whitespace-nowrap border-r border-bordure bg-transparent px-3 text-sm font-medium text-white outline-none focus-visible:outline-none"
          >
            {PHONE_COUNTRIES.map((c) => (
              <option key={c.iso} value={c.iso} className="bg-fond text-white">
                {c.flag} +{c.dial}
              </option>
            ))}
          </select>
          <input
            id="tel"
            name="tel"
            type="tel"
            required
            maxLength={30}
            placeholder="06 12 34 56 78"
            autoComplete="tel-national"
            inputMode="tel"
            aria-invalid={!!errors.tel}
            aria-describedby={errors.tel ? "tel-error" : "tel-aide"}
            onChange={() => clearError("tel")}
            className="w-full min-w-0 bg-transparent py-3.5 pl-3.5 pr-4 text-white placeholder:text-secondaire outline-none focus-visible:outline-none"
          />
        </div>
        {errors.tel ? (
          <ErrorText id="tel-error" message={errors.tel} />
        ) : (
          <p id="tel-aide" className="mt-1.5 text-xs text-secondaire">
            Pour vous envoyer le lien par SMS si l&apos;email n&apos;arrive pas.
          </p>
        )}
      </div>

      <div>
        <label htmlFor="besoin" className="sr-only">
          {LABEL_BESOIN}
        </label>
        <div className="relative">
          <select
            id="besoin"
            name="besoin"
            required
            value={besoin}
            aria-invalid={!!errors.besoin}
            aria-describedby={errors.besoin ? "besoin-error" : undefined}
            onChange={(e) => {
              setBesoin(e.target.value);
              clearError("besoin");
            }}
            className={selectClass(besoin, errors.besoin)}
          >
            <option value="" disabled>
              {LABEL_BESOIN}
            </option>
            {BESOINS.map((b) => (
              <option key={b.code} value={b.code} className="bg-fond text-white">
                {b.label}
              </option>
            ))}
          </select>
          <Chevron />
        </div>
        <ErrorText id="besoin-error" message={errors.besoin} />
      </div>

      <div>
        <label htmlFor="horizon" className="sr-only">
          {LABEL_HORIZON}
        </label>
        <div className="relative">
          <select
            id="horizon"
            name="horizon"
            required
            value={horizon}
            aria-invalid={!!errors.horizon}
            aria-describedby={errors.horizon ? "horizon-error" : undefined}
            onChange={(e) => {
              setHorizon(e.target.value);
              clearError("horizon");
            }}
            className={selectClass(horizon, errors.horizon)}
          >
            <option value="" disabled>
              {LABEL_HORIZON}
            </option>
            {HORIZONS.map((h) => (
              <option key={h.code} value={h.code} className="bg-fond text-white">
                {h.label}
              </option>
            ))}
          </select>
          <Chevron />
        </div>
        <ErrorText id="horizon-error" message={errors.horizon} />
      </div>

      <Turnstile ref={turnstile} />

      {/* Newsletter : facultative, non précochée, contrôle UNIQUEMENT OPT_IN (aucun lien avec les cookies) */}
      <label className="flex cursor-pointer items-start gap-2.5 py-1 text-xs leading-relaxed text-secondaire">
        <input
          type="checkbox"
          name="optIn"
          checked={optIn}
          onChange={(e) => setOptIn(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-blue-500"
        />
        <span>
          Je souhaite recevoir les actualités, conseils, ressources et invitations aux webinaires
          d&apos;Althoce par email. Je peux me désinscrire à tout moment.
        </span>
      </label>

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
        {kind === "webinar"
          ? "Vous recevrez les informations du webinar par email."
          : "Vous recevrez le guide par email."}{" "}
        Althoce peut vous recontacter au sujet de votre demande. Vos données ne sont jamais
        revendues.{" "}
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
