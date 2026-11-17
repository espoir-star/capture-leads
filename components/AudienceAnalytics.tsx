"use client";
import { Analytics } from "@vercel/analytics/next";
import { audienceUrl } from "@/lib/tracking/audience";

/**
 * Vercel Web Analytics : visites par page et par post (lib/tracking/audience.ts).
 * Sans cookie ni donnée personnelle, donc hors bannière (GA4, Meta et Brevo
 * restent soumis au consentement, components/CookieConsent.tsx).
 */
export default function AudienceAnalytics() {
  return <Analytics beforeSend={(event) => ({ ...event, url: audienceUrl(event.url) })} />;
}
