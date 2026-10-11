"use client";

import { useEffect, useState } from "react";
import { LEAD_REF_KEY } from "@/components/CaptureForm";

type State = "checking" | "accepted" | "pending" | "delayed" | "failed" | "unknown";

/** Relectures espacées (ms) : l'envoi part juste après la réponse du formulaire. */
const CHECKS = [1500, 4000, 8000, 15000];

const MESSAGES: Record<State, string> = {
  checking: "Envoi de l’email contenant le lien en cours de vérification…",
  pending: "L’envoi de l’email contenant le lien est en cours. Le bouton ci‑dessous vous donne accès au guide sans attendre.",
  delayed: "L’envoi de l’email n’a pas encore abouti. Le bouton ci‑dessous reste votre accès direct au guide.",
  accepted: "L’email contenant le lien a été accepté par notre service d’envoi. Selon votre messagerie, il peut arriver avec un léger délai ou dans les courriers indésirables.",
  failed: "L’email n’a pas pu être envoyé. Utilisez le bouton ci‑dessous pour accéder au guide.",
  unknown: "Le lien vous est également transmis par email afin que vous puissiez le retrouver ; s’il n’apparaît pas, pensez à vérifier vos courriers indésirables.",
};

/**
 * État RÉEL de l'envoi (page merci) : n'affiche une acceptation que si le
 * serveur l'a enregistrée ; jamais de délai garanti. Sans jeton (page rouverte
 * dans un autre onglet), message neutre.
 */
export default function DeliveryStatus({ slug }: { slug: string }) {
  const [state, setState] = useState<State>("checking");
  useEffect(() => {
    let leadRef: string | null = null;
    try {
      leadRef = sessionStorage.getItem(LEAD_REF_KEY + slug); // lu avant que le clic sur le guide ne l'efface
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
    </p>
  );
}
