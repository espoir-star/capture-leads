"use client";

import { useEffect, useState } from "react";
import { LEAD_REF_KEY } from "@/components/CaptureForm";

type State = "checking" | "accepted" | "pending" | "delayed" | "failed" | "unknown";

/** Relectures espacées (ms) : l'envoi part juste après la réponse du formulaire. */
const CHECKS = [1500, 4000, 8000, 15000];

/**
 * Page merci : le guide part par email ; un lien de secours sous l'agenda l'ouvre
 * directement (choix d'Espoir du 27/11/2026). `fallbackHref`, facultatif, ajoute un lien
 * en cas d'échec d'envoi confirmé ; la page merci ne le passe plus, son lien suffit.
 */
const MESSAGES: Record<State, string> = {
  checking: "Envoi de l’email en cours de vérification…",
  pending: "L’email est en cours d’envoi. Il arrive dans quelques instants.",
  delayed: "L’envoi de l’email prend un peu plus de temps que prévu. Il arrive dans quelques instants.",
  accepted: "L’email a bien été envoyé. Selon votre messagerie, il peut arriver avec un léger délai ou dans les courriers indésirables.",
  failed: "L’email n’a pas pu être envoyé.",
  unknown: "S’il n’apparaît pas dans quelques minutes, pensez à vérifier vos courriers indésirables.",
};

/**
 * État RÉEL de l'envoi (page merci) : n'affiche une acceptation que si le
 * serveur l'a enregistrée ; jamais de délai garanti. Sans jeton (page rouverte
 * dans un autre onglet), message neutre.
 */
export default function DeliveryStatus({ slug, fallbackHref }: { slug: string; fallbackHref?: string }) {
  const [state, setState] = useState<State>("checking");
  useEffect(() => {
    let leadRef: string | null = null;
    try {
      leadRef = sessionStorage.getItem(LEAD_REF_KEY + slug); // jeton de la capture qui vient d'aboutir
    } catch {
      leadRef = null;
    }
    if (!leadRef) {
      setState("unknown");
      return;
    }
    let stopped = false;
    const timers = CHECKS.map((delay, i) =>
      setTimeout(async () => {
        if (stopped) return;
        try {
          const res = await fetch("/api/lead/status", { method: "POST", body: JSON.stringify({ leadRef }), cache: "no-store" });
          const { state: next } = (await res.json()) as { state?: State };
          if (stopped || !next) return;
          setState(next);
          if (next === "accepted" || next === "failed" || next === "unknown") stopped = true;
        } catch {
          if (i === CHECKS.length - 1) setState((s) => (s === "checking" ? "unknown" : s));
        }
      }, delay)
    );
    return () => {
      stopped = true;
      timers.forEach(clearTimeout);
    };
  }, [slug]);
  return (
    <p role="status" aria-live="polite" className="mt-3 text-sm text-secondaire leading-relaxed">
      {MESSAGES[state]}
      {state === "failed" && fallbackHref && (
        <>
          {" "}
          <a href={fallbackHref} className="text-accent underline underline-offset-4">
            Accéder au guide
          </a>
        </>
      )}
    </p>
  );
}
