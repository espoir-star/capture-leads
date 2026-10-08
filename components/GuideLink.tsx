"use client";

import { LEAD_REF_KEY } from "@/components/CaptureForm";

/**
 * Bouton d'accès au guide (page merci). Au clic, signale
 * `lead_magnet_downloaded` via sendBeacon (n'entrave pas l'ouverture du lien).
 * Sans jeton (page rechargée dans un autre onglet…), rien n'est envoyé.
 */
export default function GuideLink({
  href,
  slug,
  className,
  children,
}: {
  href: string;
  slug: string;
  className?: string;
  children: React.ReactNode;
}) {
  function onClick() {
    try {
      const leadRef = sessionStorage.getItem(LEAD_REF_KEY + slug);
      if (!leadRef) return;
      const body = JSON.stringify({ name: "lead_magnet_downloaded", leadRef });
      if (!navigator.sendBeacon?.("/api/events", body)) {
        void fetch("/api/events", { method: "POST", body, keepalive: true });
      }
      sessionStorage.removeItem(LEAD_REF_KEY + slug); // un seul événement par capture
    } catch {
      /* mesure secondaire : jamais bloquante */
    }
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" onClick={onClick} className={className}>
      {children}
    </a>
  );
}
