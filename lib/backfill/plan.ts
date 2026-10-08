/**
 * Plan de backfill d'UN contact historique. Logique PURE (tests/backfill.test.ts).
 *
 * Principe : n'écrire que ce qui est PROUVÉ par les données existantes.
 *  - VERTICAL / SUBSECTOR : déduits des listes LM non ambiguës (provenance)
 *  - LIFECYCLE_STAGE = LEAD : contact présent dans une liste LM (il a demandé
 *    un guide) ET aucun statut commercial au-delà de « À appeler »
 *  - EMAIL_STATUS : uniquement des PREUVES NÉGATIVES
 *      BOUNCED    → hard bounce constaté par Brevo
 *      DISPOSABLE → domaine présent dans la liste jetable
 *      INVALID    → syntaxe impossible, valeur factice, domaine inexistant
 *                   ou sans aucun serveur de réception
 *  - PHONE_STATUS : uniquement pour un SMS réellement stocké, et seulement
 *    INVALID ou SUSPECT (preuve dans le numéro lui-même)
 *
 * Jamais : EMAIL_STATUS = VERIFIED ou PENDING, PHONE_STATUS = VALID_FORMAT ou
 * VERIFIED, OPT_IN, LEAD_SCORE, UTM. Seuls des attributs VIDES sont remplis
 * (exception : BOUNCED, constat Brevo plus fort que tout autre statut).
 */

import type { BrevoContact } from "@/lib/brevo/api";
import { isEmptyValue } from "@/lib/brevo/api";
import { getLeadMagnetByListId } from "@/config/leadMagnets";
import type { LifecycleStage } from "@/config/taxonomy";
import { classifyEmailOffline, type DnsVerdict } from "@/lib/data-quality/email";
import { checkPhone } from "@/lib/data-quality/phone";
import { emailDomain } from "@/lib/validation/email";

/**
 * Proposition commerciale → LIFECYCLE_STAGE, appliquée seulement avec
 * --with-commercial-mapping. null = ambigu : aucune modification.
 * ETAPE_COMMERCIALE (pipeline deal) prime sur STATUT_APPEL.
 */
export const COMMERCIAL_MAPPING: Record<string, LifecycleStage | null> = {
  "Négociation": "OPPORTUNITY",
  "Devis envoyé": "OPPORTUNITY",
  "R2 — rendez-vous de closing": "OPPORTUNITY",
  "Projet reporté — à suivre": null,
  "RDV planifié": "MEETING_BOOKED",
  "RDV booke": "MEETING_BOOKED",
  "Contacté": "CONTACTED",
  "À rappeler": "CONTACTED",
  "A rappeler": "CONTACTED",
  "À relancer": "CONTACTED",
  "Non qualifie": "LOST",
  "Ne plus appeler": null,
  "À appeler": null,
};

export interface BackfillContext {
  /** emails en hard bounce selon Brevo */
  hardBounces: ReadonlySet<string>;
  /** verdict DNS par domaine (vide = pas de vérification réseau) */
  dnsVerdict: ReadonlyMap<string, DnsVerdict>;
  withCommercialMapping?: boolean;
}

export interface ContactBackfillPlan {
  set: Record<string, string>;
  conflicts: string[];
  /** clé commerciale rencontrée et sa proposition (pour le rapport) */
  commercial?: { key: string; proposal: LifecycleStage | null };
  ambiguousLists: string[];
}

export function planContactBackfill(c: BrevoContact, ctx: BackfillContext): ContactBackfillPlan {
  const ex = c.attributes ?? {};
  const set: Record<string, string> = {};
  const conflicts: string[] = [];
  const lms = c.listIds.map(getLeadMagnetByListId).filter((x) => !!x);
  const ambiguousLists = lms.filter((l) => !l.vertical).map((l) => l.brevoListName);

  /* Provenance : verticale / sous-secteur */
  if (isEmptyValue(ex.VERTICAL)) {
    const verticals = [...new Set(lms.map((l) => l.vertical).filter(Boolean))] as string[];
    const precise = verticals.filter((v) => v !== "GENERAL");
    const vertical = precise.length === 1 ? precise[0] : precise.length === 0 && verticals.length ? "GENERAL" : null;
    if (precise.length > 1) conflicts.push(`verticales ${precise.join(" + ")}`);
    if (vertical) {
      set.VERTICAL = vertical;
      if (isEmptyValue(ex.SUBSECTOR)) {
        const subs = [...new Set(lms.filter((l) => l.vertical === vertical).map((l) => l.subsector).filter(Boolean))];
        if (subs.length === 1) set.SUBSECTOR = subs[0] as string;
        else if (subs.length > 1) conflicts.push(`sous-secteurs ${subs.join(" + ")}`);
      }
    }
  }

  /* Cycle de vie */
  let commercial: ContactBackfillPlan["commercial"];
  if (isEmptyValue(ex.LIFECYCLE_STAGE)) {
    const key = String(ex.ETAPE_COMMERCIALE || ex.STATUT_APPEL || "").trim();
    const proposal = key ? COMMERCIAL_MAPPING[key] ?? null : null;
    if (key) commercial = { key, proposal };
    if (ctx.withCommercialMapping && proposal) set.LIFECYCLE_STAGE = proposal;
    else if (lms.length && (!key || key === "À appeler")) set.LIFECYCLE_STAGE = "LEAD";
  }

  /* Email : preuves négatives uniquement */
  const email = (c.email ?? "").toLowerCase();
  if (email) {
    if (ctx.hardBounces.has(email)) {
      if (ex.EMAIL_STATUS !== "BOUNCED") set.EMAIL_STATUS = "BOUNCED";
    } else if (isEmptyValue(ex.EMAIL_STATUS)) {
      const offline = classifyEmailOffline(email);
      const dns = ctx.dnsVerdict.get(emailDomain(email));
      if (offline) set.EMAIL_STATUS = offline.status;
      else if (dns === "domain_not_found" || dns === "no_mail_server") set.EMAIL_STATUS = "INVALID";
    }
  }

  /* Téléphone : SMS réellement stocké, preuves négatives uniquement */
  if (isEmptyValue(ex.PHONE_STATUS) && !isEmptyValue(ex.SMS)) {
    const status = checkPhone(`+${String(ex.SMS).replace(/\D/g, "")}`, "FR").status;
    if (status === "INVALID" || status === "SUSPECT") set.PHONE_STATUS = status;
  }

  return { set, conflicts, commercial, ambiguousLists };
}
