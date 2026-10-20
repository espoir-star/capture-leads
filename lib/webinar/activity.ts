/**
 * Suivi webinar lu par le CRM : attribut Brevo WEBINAR_ACTIVITY (texte JSON,
 * dernier webinar du contact). Cinq états distincts, jamais confondus :
 *
 *   inscrit            registeredAt
 *   lien ouvert        joinOpenedAt  — clic sur le lien personnel : présence NON certifiée
 *   présence confirmée attendance = CONFIRMED (+ preuve : sondage, Q&R, constat manuel)
 *   replay consulté    replayViewedAt — distinct d'une présence au direct
 *   présence inconnue  attendance = UNKNOWN : aucune conclusion d'absence
 *
 * Fusion monotone : une date déjà connue n'est jamais repoussée, une présence
 * confirmée ne redevient jamais inconnue. Écriture « au mieux » : une erreur
 * Brevo (attribut absent, API indisponible) n'empêche ni l'inscription, ni
 * l'accès à la salle, ni le replay.
 */
import type { AttributeValue } from "@/lib/brevo/api";
import { brevoRequest, getContactById } from "@/lib/brevo/api";
import type { WebinarConfig } from "@/config/webinars";

export const WEBINAR_ACTIVITY_ATTRIBUTE = "WEBINAR_ACTIVITY";

export type AttendanceProof = "poll" | "qa" | "manual";

export interface WebinarActivity {
  v: 1;
  slug: string;
  title: string;
  startsAt: string;
  registeredAt?: string;
  source?: { utm_source?: string; utm_medium?: string; utm_campaign?: string; utm_content?: string };
  joinOpenedAt?: string;
  attendance: "UNKNOWN" | "CONFIRMED";
  attendedAt?: string;
  attendanceProof?: AttendanceProof;
  replayViewedAt?: string;
}

export interface ActivityPatch {
  registeredAt?: Date;
  source?: { utm_source?: string; utm_medium?: string; utm_campaign?: string; utm_content?: string };
  joinOpenedAt?: Date;
  attended?: { at: Date; proof: AttendanceProof };
  replayViewedAt?: Date;
}

export function readWebinarActivity(attributes: Record<string, AttributeValue | undefined> | undefined): WebinarActivity | null {
  const raw = attributes?.[WEBINAR_ACTIVITY_ATTRIBUTE];
  if (typeof raw !== "string" || !raw.startsWith("{")) return null;
  try {
    const v = JSON.parse(raw);
    return v && v.v === 1 && typeof v.slug === "string" ? (v as WebinarActivity) : null;
  } catch {
    return null;
  }
}

const earliest = (a: string | undefined, b: Date | undefined) => {
  const iso = b?.toISOString();
  return !a ? iso : !iso ? a : a < iso ? a : iso;
};

const PROVENANCE = ["utm_source", "utm_medium", "utm_campaign", "utm_content"] as const;

/** Fusion PURE : même webinar → dates les plus anciennes conservées ; autre webinar → nouveau suivi. */
export function mergeWebinarActivity(
  previous: WebinarActivity | null,
  w: Pick<WebinarConfig, "slug" | "title" | "startsAt">,
  patch: ActivityPatch
): WebinarActivity {
  const base: WebinarActivity = previous && previous.slug === w.slug
    ? { ...previous }
    : { v: 1, slug: w.slug, title: w.title, startsAt: w.startsAt, attendance: "UNKNOWN" };
  base.title = w.title;
  base.startsAt = w.startsAt;
  base.registeredAt = earliest(base.registeredAt, patch.registeredAt);
  if (!base.source && patch.source) {
    const src = Object.fromEntries(PROVENANCE.filter((k) => patch.source?.[k]).map((k) => [k, String(patch.source![k]).slice(0, 120)]));
    if (Object.keys(src).length) base.source = src;
  }
  base.joinOpenedAt = earliest(base.joinOpenedAt, patch.joinOpenedAt);
  if (patch.attended) {
    if (base.attendance !== "CONFIRMED") base.attendanceProof = patch.attended.proof;
    base.attendance = "CONFIRMED";
    base.attendedAt = earliest(base.attendedAt, patch.attended.at);
  }
  base.replayViewedAt = earliest(base.replayViewedAt, patch.replayViewedAt);
  for (const k of Object.keys(base) as (keyof WebinarActivity)[]) if (base[k] === undefined) delete base[k];
  return base;
}

/** Libellé lisible de l'état de participation (CRM, rapports). */
export function attendanceLabel(a: WebinarActivity): string {
  if (a.attendance === "CONFIRMED") return "Présence confirmée";
  if (a.joinOpenedAt) return "Lien de connexion ouvert (présence non certifiée)";
  return "Présence inconnue";
}

/**
 * Lit la fiche (sauf si ses attributs sont fournis), fusionne et écrit. Renvoie
 * false si l'écriture n'a pas abouti (journalisé par l'appelant, sans effet sur le parcours).
 */
export async function writeWebinarActivity(
  contactId: number,
  w: Pick<WebinarConfig, "slug" | "title" | "startsAt">,
  patch: ActivityPatch,
  _now: Date,
  knownAttributes?: Record<string, AttributeValue | undefined>
): Promise<boolean> {
  try {
    const attributes = knownAttributes ?? (await getContactById(contactId))?.attributes;
    const next = mergeWebinarActivity(readWebinarActivity(attributes), w, patch);
    const res = await brevoRequest(`/contacts/${contactId}?identifierType=contact_id`, {
      method: "PUT",
      body: { attributes: { [WEBINAR_ACTIVITY_ATTRIBUTE]: JSON.stringify(next) } },
      retries: 1,
    });
    return res.ok;
  } catch {
    return false;
  }
}
