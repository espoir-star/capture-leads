/**
 * GA4: audience, parcours vers l'agenda et demandes réussies ; jamais de valeur de formulaire.
 * Seuls les UTM (identifiant du post, campagne) sont transmis avec l'adresse : jamais les
 * autres paramètres (jetons des liens d'email, adresses) ni le fragment.
 */
import { hasMarketingConsent } from '@/lib/tracking/consent';

export const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? 'G-W5TVSFJ2YX';
type AnalyticsWindow = Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void; [key: `ga-disable-${string}`]: boolean };
let initialized = false;
let lastPage = '';

function allowed() {
  if (typeof window === 'undefined' || !/^G-[A-Z0-9]+$/.test(GA_ID)) return false;
  return hasMarketingConsent(); // bannière cookies : choix « Tout accepter » uniquement
}
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'];
/** « ?utm_… » réduit aux UTM au format attendu (une adresse email ou un jeton est écarté). */
function utmQuery(search: string) {
  const params = new URLSearchParams(search);
  const kept = new URLSearchParams();
  for (const key of UTM_KEYS) {
    const value = params.get(key)?.trim();
    if (value && /^[\w.:-]{1,100}$/.test(value)) kept.set(key, value);
  }
  const query = kept.toString();
  return query ? `?${query}` : '';
}
function cleanUrl(value: string, keepUtm = false) {
  try { const url = new URL(value); return url.origin + url.pathname + (keepUtm ? utmQuery(url.search) : ''); } catch { return ''; }
}
const SLUG = /^[a-z0-9-]{1,80}$/;
export function initializeAnalytics() {
  if (!allowed()) return false;
  if (initialized) return true;
  const w = window as unknown as AnalyticsWindow;
  w[`ga-disable-${GA_ID}`] = false;
  w.dataLayer = w.dataLayer || [];
  // gtag exige l'objet `arguments` (snippet officiel Google), pas un tableau
  // eslint-disable-next-line prefer-rest-params
  w.gtag = function () { w.dataLayer!.push(arguments); };
  w.gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
  w.gtag('js', new Date());
  w.gtag('config', GA_ID, {
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    page_location: cleanUrl(location.href, true),
    page_referrer: cleanUrl(document.referrer),
  });
  if (!document.getElementById('althoce-ga4')) {
    const script = document.createElement('script');
    script.id = 'althoce-ga4';
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
    document.head.appendChild(script);
  }
  initialized = true;
  return true;
}
export function trackPageView(pathname: string) {
  if (!initializeAnalytics() || pathname === lastPage) return;
  const previous = lastPage ? location.origin + lastPage : cleanUrl(document.referrer);
  lastPage = pathname;
  const pageLocation = location.origin + pathname + utmQuery(location.search);
  (window as unknown as AnalyticsWindow).gtag?.('set', { page_location: pageLocation, page_referrer: previous, page_title: document.title });
  (window as unknown as AnalyticsWindow).gtag?.('event', 'page_view', {
    send_to: GA_ID, page_location: pageLocation,
    page_referrer: previous, page_title: document.title,
  });
}
export function trackLead(leadType: 'contact' | 'roi' | 'guide', resourceSlug?: string) {
  if (!initializeAnalytics()) return;
  (window as unknown as AnalyticsWindow).gtag?.('event', 'generate_lead', {
    send_to: GA_ID, lead_type: leadType,
    ...(leadType === 'guide' && resourceSlug && /^[a-z0-9-]+$/.test(resourceSlug) ? { resource_slug: resourceSlug } : {}),
    page_location: cleanUrl(location.href, true),
  });
}
/**
 * Étapes du parcours vers un rendez-vous (pages /rdv et boutons qui y mènent) :
 *   clic_rdv          bouton « réserver » d'une ressource (destination : slug de la page)
 *   agenda_vu         l'agenda est apparu à l'écran
 *   agenda_clic       clic dans l'agenda (date ou créneau) ; la réservation elle-même reste chez Google
 *   agenda_onglet     ouverture de l'agenda dans un nouvel onglet
 * rdv_slug = slug de la page /rdv ; « pre-audit-merci » pour l'agenda des pages merci des guides.
 */
export type JourneyStep = 'clic_rdv' | 'agenda_vu' | 'agenda_clic' | 'agenda_onglet';
export function trackJourney(step: JourneyStep, slug: string) {
  if (!SLUG.test(slug) || !initializeAnalytics()) return;
  (window as unknown as AnalyticsWindow).gtag?.('event', step, {
    send_to: GA_ID, rdv_slug: slug, page_location: cleanUrl(location.href, true),
  });
}
export function revokeAnalytics() {
  if (typeof window === 'undefined') return;
  const w = window as unknown as AnalyticsWindow;
  w[`ga-disable-${GA_ID}`] = true;
  w.gtag?.('consent', 'update', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
  for (const name of document.cookie.split(';').map(cookie => cookie.trim().split('=')[0]).filter(name => /^_ga(?:_|$)/.test(name))) {
    const parts = location.hostname.split('.');
    const domains = ['', ...parts.map((_, i) => '.' + parts.slice(i).join('.'))];
    for (const domain of domains) document.cookie = `${name}=; Max-Age=0; path=/;${domain ? ` domain=${domain};` : ''} SameSite=Lax`;
  }
  initialized = false;
  lastPage = '';
}
