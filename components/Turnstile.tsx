"use client";

/**
 * Widget Cloudflare Turnstile en mode « interaction-only » : invisible pour
 * la grande majorité des visiteurs, il n'apparaît que si Cloudflare a besoin
 * d'une interaction. Désactivé (rien n'est chargé) si
 * NEXT_PUBLIC_TURNSTILE_SITE_KEY n'est pas défini.
 *
 * Un jeton n'est valable qu'une fois : après toute réponse d'erreur du
 * serveur, appeler reset() pour en obtenir un nouveau.
 */

import { useEffect, useImperativeHandle, useRef, type Ref } from "react";

export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? "";
const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

interface TurnstileApi {
  render(el: HTMLElement, options: Record<string, unknown>): string;
  reset(id: string): void;
  remove(id: string): void;
  getResponse(id: string): string | undefined;
}
type TurnstileWindow = Window & { turnstile?: TurnstileApi };

export interface TurnstileHandle {
  /** Attend le jeton (8 s max). undefined si Turnstile est désactivé ou indisponible. */
  getToken(): Promise<string | undefined>;
  reset(): void;
}

let scriptPromise: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if ((window as TurnstileWindow).turnstile) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = SCRIPT_URL;
      s.async = true;
      s.defer = true;
      s.onload = () => resolve();
      s.onerror = () => {
        scriptPromise = null;
        reject(new Error("turnstile_script"));
      };
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
}

export default function Turnstile({ ref }: { ref?: Ref<TurnstileHandle> }) {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const token = useRef<string | undefined>(undefined);
  const waiters = useRef<((t: string | undefined) => void)[]>([]);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    let cancelled = false;
    loadScript()
      .then(() => {
        const api = (window as TurnstileWindow).turnstile;
        if (cancelled || !api || !container.current || widgetId.current) return;
        widgetId.current = api.render(container.current, {
          sitekey: TURNSTILE_SITE_KEY,
          action: "lead",
          appearance: "interaction-only",
          theme: "dark",
          language: "fr",
          size: "flexible",
          callback: (t: string) => {
            token.current = t;
            waiters.current.splice(0).forEach((w) => w(t));
          },
          "expired-callback": () => {
            token.current = undefined;
          },
          "error-callback": () => {
            token.current = undefined;
          },
        });
      })
      .catch(() => {
        /* script bloqué : le serveur tranchera (fail-safe documenté) */
      });
    return () => {
      cancelled = true;
      const api = (window as TurnstileWindow).turnstile;
      if (api && widgetId.current) api.remove(widgetId.current);
      widgetId.current = null;
    };
  }, []);

  useImperativeHandle(ref, () => ({
    getToken() {
      if (!TURNSTILE_SITE_KEY) return Promise.resolve(undefined);
      if (token.current) return Promise.resolve(token.current);
      return new Promise((resolve) => {
        const timer = setTimeout(() => resolve(undefined), 8000);
        waiters.current.push((t) => {
          clearTimeout(timer);
          resolve(t);
        });
      });
    },
    reset() {
      token.current = undefined;
      const api = (window as TurnstileWindow).turnstile;
      if (api && widgetId.current) api.reset(widgetId.current);
    },
  }));

  if (!TURNSTILE_SITE_KEY) return null;
  return <div ref={container} className="empty:hidden" />;
}
