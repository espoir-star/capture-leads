'use client';
import { useEffect, useState } from 'react';
import GoogleAnalytics from './GoogleAnalytics';
import { ANALYTICS_CONSENT_KEY, GA_ID, revokeAnalytics } from '@/lib/analytics';

const CHOICE_EVENT = 'althoce:analytics-consent';
function useAnalyticsChoice() {
  const [accepted, setAccepted] = useState(false);
  useEffect(() => {
    const sync = () => {
      try { setAccepted(localStorage.getItem(ANALYTICS_CONSENT_KEY) === 'yes'); }
      catch { setAccepted(false); }
    };
    sync();
    window.addEventListener(CHOICE_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(CHOICE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  function save(value: boolean) {
    try { localStorage.setItem(ANALYTICS_CONSENT_KEY, value ? 'yes' : 'no'); }
    catch { return; }
    if (!value) revokeAnalytics();
    window.dispatchEvent(new Event(CHOICE_EVENT));
  }
  return { accepted, save };
}

/** Optional, unchecked for new visitors; never required to request a guide. */
export function AnalyticsChoice() {
  const { accepted, save } = useAnalyticsChoice();
  if (!GA_ID) return null;
  return <div className="text-xs leading-relaxed text-secondaire">
    <label className="flex cursor-pointer items-start gap-2.5 py-1">
      <input type="checkbox" checked={accepted} onChange={event => save(event.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-blue-500" />
      <span>J’accepte les cookies Google Analytics pour mesurer les visites et les demandes de guides. <span className="whitespace-nowrap">(Facultatif)</span></span>
    </label>
    <a href="https://althoce.com/confidentialite/" target="_blank" rel="noopener noreferrer"
      className="ml-6 underline underline-offset-2 hover:text-white">En savoir plus</a>
  </div>;
}

/** No banner or overlay; a discreet footer control remains available on thank-you pages. */
export default function AnalyticsConsent() {
  const { accepted } = useAnalyticsChoice();
  if (!GA_ID) return null;
  return <>
    {accepted && <GoogleAnalytics />}
    <details className="mx-auto my-6 max-w-md px-5 text-xs text-secondaire">
      <summary className="cursor-pointer text-center underline underline-offset-2">Cookies de mesure d’audience</summary>
      <div className="mt-3"><AnalyticsChoice /></div>
    </details>
  </>;
}
