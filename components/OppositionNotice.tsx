"use client";

import { useEffect, useState } from "react";
import { OPPOSITION_KEY } from "@/components/CaptureForm";

/**
 * Confirmation d'opposition marketing sur la page merci. Affichée SEULEMENT
 * si l'API a répondu que l'opposition est enregistrée dans Brevo (clé posée
 * par CaptureForm après une réponse réussie), jamais sur la simple intention.
 */
export default function OppositionNotice({ slug }: { slug: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      setShow(sessionStorage.getItem(OPPOSITION_KEY + slug) === "1");
    } catch {
      setShow(false);
    }
  }, [slug]);
  if (!show) return null;
  return (
    <p role="status" className="mt-4 text-sm text-secondaire leading-relaxed">
      Votre opposition est enregistrée : vous recevrez uniquement le guide demandé, sans newsletter
      ni relance commerciale.
    </p>
  );
}
