"use client";
import { useEffect, useState, type ReactNode } from "react";
import { pathWithUtm, utmFromSearchParams, type Utm } from "@/lib/tracking/utm";
import { trackJourney } from "@/lib/analytics";

/**
 * Lien vers une page qui enregistre la provenance (inscription webinar, rendez-vous) :
 * il reprend les UTM de la visite en cours (post LinkedIn, email), sinon ceux de la
 * page. Sans eux, une inscription faite depuis une ressource compterait en « direct ».
 */
export default function SourceLink({ href, fallback, className, children }: { href: string; fallback: Utm; className?: string; children: ReactNode }) {
  const [target, setTarget] = useState(() => pathWithUtm(href, fallback));
  useEffect(() => {
    const visit = utmFromSearchParams(new URLSearchParams(window.location.search));
    if (visit.utm_source) setTarget(pathWithUtm(href, visit));
  }, [href]);
  // GA4 (après consentement) : clic vers une page de rendez-vous, avec son slug
  const rdv = /^\/rdv\/([a-z0-9-]+)/.exec(href)?.[1];
  return <a href={target} className={className} onClick={rdv ? () => trackJourney("clic_rdv", rdv) : undefined}>{children}</a>;
}
