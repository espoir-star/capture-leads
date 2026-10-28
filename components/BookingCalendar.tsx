"use client";

/**
 * Agenda de rendez-vous Google intégré AU CLIC : rien n'est chargé depuis Google
 * avant la demande du visiteur (Google lit et dépose ses propres cookies, hors de
 * notre bannière). Le lien direct vers l'agenda reste proposé en nouvel onglet.
 */

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons/lucide";

/**
 * Hauteurs mesurées le 28/10/2026. L'iframe ne transmet pas sa hauteur (autre
 * domaine) : on la fixe d'après la largeur du bloc, assez haute pour éviter un
 * défilement interne. Sous ~600 px de large, Google empile le mois puis les
 * créneaux (jusqu'à ~1 790 px avec 14 créneaux dans la journée) ; au-delà, deux
 * colonnes (jusqu'à ~1 180 px).
 */
const STACKED_BELOW_PX = 600;
const STACKED_HEIGHT_PX = 1800;
const COLUMNS_HEIGHT_PX = 1200;

interface Props {
  embedUrl: string;
  url: string;
  title: string;
  durationMin: number;
}

export default function BookingCalendar({ embedUrl, url, title, durationMin }: Props) {
  const [open, setOpen] = useState(false);
  const [height, setHeight] = useState(COLUMNS_HEIGHT_PX);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!open || !el) return;
    const fit = () => setHeight(el.clientWidth < STACKED_BELOW_PX ? STACKED_HEIGHT_PX : COLUMNS_HEIGHT_PX);
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, [open]);

  if (open) {
    return (
      <div ref={box} className="relative overflow-hidden rounded-[18px] border border-bordure bg-white">
        <p className="absolute inset-x-0 top-10 text-center text-[13px] text-black/50" aria-hidden>
          Chargement de l&apos;agenda…
        </p>
        <iframe src={embedUrl} title={`${title} : choisir un créneau`} style={{ height }} className="relative block w-full" />
      </div>
    );
  }

  return (
    <div className="rounded-[18px] border border-bordure bg-carte p-6 sm:p-8">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-carte-2 text-accent">
          <Icon name="calendar" size={18} strokeWidth={1.75} />
        </span>
        <div>
          <p className="text-[15px] font-semibold leading-tight">{title}</p>
          <p className="mt-1 text-[12.5px] tabular-nums text-secondaire">{durationMin}&nbsp;min · Google Meet · Gratuit</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-action px-[22px] py-3.5 text-[15px] font-semibold text-white transition-colors duration-150 hover:bg-action-hover active:scale-[0.985] sm:w-auto"
      >
        Voir les créneaux disponibles
      </button>
      <p className="mt-4 text-[12px] leading-relaxed text-discret">
        Agenda fourni par Google&nbsp;: en l&apos;affichant, vous acceptez ses cookies.{" "}
        <a href={url} target="_blank" rel="noopener noreferrer" className="underline decoration-bordure-forte underline-offset-4 hover:text-texte">
          Ouvrir dans un nouvel onglet
        </a>
      </p>
    </div>
  );
}
