'use client';
import { useEffect, useState } from 'react';
import GoogleAnalytics from './GoogleAnalytics';
import { ANALYTICS_CONSENT_KEY, GA_ID, revokeAnalytics } from '@/lib/analytics';
import styles from './AnalyticsConsent.module.css';
export default function AnalyticsConsent() {
  const [choice, setChoice] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(ANALYTICS_CONSENT_KEY);
      setChoice(saved); setOpen(saved !== 'yes' && saved !== 'no');
    } catch { setOpen(true); }
  }, []);
  function save(value: 'yes' | 'no') {
    try { localStorage.setItem(ANALYTICS_CONSENT_KEY, value); } catch { /* Tracking stays disabled. */ }
    if (value === 'no' && choice === 'yes') { revokeAnalytics(); window.location.reload(); }
    setChoice(value); setOpen(false);
  }
  if (!GA_ID) return null;
  return <>
    {choice === 'yes' && <GoogleAnalytics />}
    <button type="button" className={styles.settings} onClick={() => setOpen(true)}>Gérer les cookies de mesure d’audience</button>
    {open && <section className={styles.panel} aria-label="Cookies de mesure d’audience">
      <div className={styles.content}>
        <div className={styles.heading}><h2>Les cookies, à votre façon.</h2></div>
        <p>Avec votre accord, Google Analytics nous aide à mesurer les visites et les demandes de guides. Vos coordonnées et le contenu des formulaires ne lui sont pas transmis.</p>
        <a className={styles.link} href="https://althoce.com/confidentialite/" target="_blank" rel="noopener noreferrer">En savoir plus sur les cookies</a>
      </div>
      <div className={styles.footer}>
        <div className={styles.actions}><button type="button" onClick={() => save('no')}>Refuser</button><button type="button" onClick={() => save('yes')}>Accepter</button></div>
        <p className={styles.note}>Votre choix reste modifiable à tout moment.</p>
      </div>
    </section>}
  </>;
}
