"use client";

/**
 * Agenda de rendez-vous Google, affiché ouvert dès l'arrivée sur la page (choix
 * d'Espoir du 28/10/2026) : le visiteur voit les créneaux sans cliquer. Le lien
 * direct vers l'agenda reste proposé en nouvel onglet.
 */

import { useEffect, useRef, useState } from "react";

/**
 * Hauteurs mesurées le 28/10/2026. L'iframe ne transmet pas sa hauteur (autre
 * domaine) : on la fixe d'après la largeur du bloc, assez haute pour éviter un
 * défilement interne. Sous ~600 px de large, Google empile le mois puis les
 * créneaux (jusqu'à ~1 790 px avec 14 créneaux dans la journée) ; au-delà, deux
 * colonnes (jusqu'à ~1 180 px). Avant le chargement du script, la largeur d'écran
 * sert d'approximation (classes h-[1800px] sm:h-[1200px]).
 */
const STACKED_BELOW_PX = 600;
const STACKED_HEIGHT_PX = 1800;
const COLUMNS_HEIGHT_PX = 1200;

interface Props {
  embedUrl: string;
  url: string;
  title: string;
}

export default function BookingCalendar({ embedUrl, url, title }: Props) {
  const [height, setHeight] = useState<number>();
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => setHeight(el.clientWidth < STACKED_BELOW_PX ? STACKED_HEIGHT_PX : COLUMNS_HEIGHT_PX);
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div ref={box} className="relative overflow-hidden rounded-[18px] border border-bordure bg-white">
        <p className="absolute inset-x-0 top-10 text-center text-[13px] text-black/50" aria-hidden>
          Chargement de l&apos;agenda…
        </p>
        <iframe
          src={embedUrl}
          title={`${title} : choisir un créneau`}
          style={height ? { height } : undefined}
          className="relative block h-[1800px] w-full sm:h-[1200px]"
        />
      </div>
      <p className="mt-3 text-[12px] text-discret">
        Agenda Google.{" "}
        <a href={url} target="_blank" rel="noopener noreferrer" className="underline decoration-bordure-forte underline-offset-4 hover:text-texte">
          Ouvrir dans un nouvel onglet
        </a>
      </p>
    </>
  );
}
