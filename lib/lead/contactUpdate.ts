/**
 * Calcul PUR des attributs Brevo à écrire pour une capture, à partir du
 * contact existant (ou null). Aucune entrée/sortie : entièrement testé dans
 * tests/contactUpdate.test.ts.
 *
 * Règles :
 *  - identité (PRENOM, NOM, SMS) et intention (BESOIN, HORIZON) : dernière saisie
 *  - RESSOURCE : dernière ressource demandée (l'historique est dans les listes)
 *  - SOURCE_INSCRIPTION, DATE_OPTIN : renseignés seulement s'ils sont vides
 *  - VERTICAL / SUBSECTOR : renseignés si vides (ou si VERTICAL = GENERAL)
 *  - UTM_* + SOURCE_CONTENT_URL : first touch, écrits UNIQUEMENT si aucun
 *    UTM n'existe déjà sur le contact (bloc indivisible)
 *  - LEAD_SCORE = max(existant, score formulaire) ; jamais à la baisse
 *  - LIFECYCLE_STAGE : jamais rétrogradé (lib/scoring)
 *  - EMAIL_STATUS : VERIFIED et BOUNCED sont conservés, sinon PENDING
 *    (VERIFIED n'est posé que par un clic réel : app/api/webhooks/brevo)
 *  - PHONE_STATUS : décrit le numéro réellement stocké dans SMS ; jamais
 *    écrit sans numéro. VERIFIED conservé si le numéro n'a pas changé
 *  - OPT_IN : case newsletter cochée → true ; non cochée → false, SAUF si le
 *    contact avait déjà OPT_IN = true (ne pas cocher n'est pas se désinscrire :
 *    le retrait passe par le lien de désinscription Brevo)
 *  - EMAIL_CONFIRM_TOKEN : écrit s'il est vide (lien de confirmation stable)
 */

import type { AttributeValue, BrevoContact } from "@/lib/brevo/api";
import { isEmptyValue } from "@/lib/brevo/api";
import { FIRST_TOUCH_ATTRIBUTES } from "@/config/brevoAttributes";
import type { LeadMagnetConfig } from "@/config/leadMagnets";
import { getSourceContent } from "@/config/sourceRegistry";
import type { Besoin, EmailStatus, Horizon, PhoneStatus } from "@/config/taxonomy";
import { formIntentScore, mergeScore, nextLifecycleStage } from "@/lib/scoring";
import type { Touch } from "@/lib/tracking/utm";
import { checkPhone, type PhoneCheck } from "@/lib/data-quality/phone";

/** Ce qu'il faut savoir d'une source de capture (lead magnet ou webinar) */
export type CaptureSource = Pick<
  LeadMagnetConfig,
  "slug" | "resource" | "brevoListId" | "vertical" | "subsector"
>;

export interface CaptureData {
  kind?: "guide" | "webinar";
  prenom: string;
  nom: string;
  besoin: Besoin;
  horizon: Horizon;
  /** Case newsletter cochée */
  optIn: boolean;
  /** Jeton chiffré du lien de confirmation (lib/security/emailConfirm.ts) */
  confirmToken?: string;
  phone: PhoneCheck;
  attribution: Touch;
  source: CaptureSource;
  now: Date;
}

export interface ContactUpdate {
  attributes: Record<string, AttributeValue>;
  isNew: boolean;
  formScore: number;
  leadScore: number;
  emailStatus: EmailStatus | string;
  /** undefined = aucun numéro écrit par cette soumission */
  phoneStatus?: PhoneStatus;
  lifecycleStage: string;
  /** true si les UTM de cette soumission ont été enregistrés comme first touch */
  firstTouchWritten: boolean;
}

const digitsOnly = (v: unknown) => String(v ?? "").replace(/\D/g, "");

export function buildContactUpdate(existing: BrevoContact | null, data: CaptureData): ContactUpdate {
  const ex = existing?.attributes ?? {};
  const a: Record<string, AttributeValue> = {};
  const setIfEmpty = (name: string, value: AttributeValue | undefined | null) => {
    if (value !== undefined && value !== null && value !== "" && isEmptyValue(ex[name])) a[name] = value;
  };

  /* Identité */
  a.PRENOM = data.prenom;
  a.NOM = data.nom;
  if (data.phone.e164) a.SMS = data.phone.e164;

  /* Ressource (guides uniquement) et provenance d'inscription */
  if (data.kind !== "webinar") a.RESSOURCE = data.source.resource;
  setIfEmpty("SOURCE_INSCRIPTION", "page-capture");
  setIfEmpty("DATE_OPTIN", data.now.toISOString());

  /* Verticale : on complète, on n'écrase pas une verticale précise */
  const exVertical = String(ex.VERTICAL ?? "").trim();
  if (data.source.vertical && (!exVertical || (exVertical === "GENERAL" && data.source.vertical !== "GENERAL"))) {
    a.VERTICAL = data.source.vertical;
    if (data.source.subsector) a.SUBSECTOR = data.source.subsector;
  } else if (data.source.subsector && exVertical === data.source.vertical) {
    setIfEmpty("SUBSECTOR", data.source.subsector);
  }

  /* Consentement newsletter : uniquement la case du formulaire */
  if (data.optIn) a.OPT_IN = true;
  else if (ex.OPT_IN !== true) a.OPT_IN = false;

  /* Lien de confirmation d'adresse (inséré dans l'email de bienvenue Brevo) */
  setIfEmpty("EMAIL_CONFIRM_TOKEN", data.confirmToken);

  /* Intention déclarée */
  a.BESOIN_PRIORITAIRE = data.besoin;
  a.HORIZON_PROJET = data.horizon;

  /* First touch : bloc UTM écrit seulement si le contact n'en a aucun */
  const hasExistingUtm = FIRST_TOUCH_ATTRIBUTES.some((k) => !isEmptyValue(ex[k]));
  let firstTouchWritten = false;
  if (!hasExistingUtm) {
    const t = data.attribution;
    if (t.utm_source) a.UTM_SOURCE = t.utm_source;
    if (t.utm_medium) a.UTM_MEDIUM = t.utm_medium;
    if (t.utm_campaign) a.UTM_CAMPAIGN = t.utm_campaign;
    if (t.utm_content) a.UTM_CONTENT = t.utm_content;
    firstTouchWritten = !!(t.utm_source || t.utm_medium || t.utm_campaign || t.utm_content);
    if (firstTouchWritten) setIfEmpty("SOURCE_CONTENT_URL", getSourceContent(t.utm_content)?.url);
  }

  /* Qualité email */
  const exEmail = String(ex.EMAIL_STATUS ?? "");
  const emailStatus: EmailStatus = exEmail === "VERIFIED" || exEmail === "BOUNCED" ? exEmail : "PENDING";
  if (exEmail !== emailStatus) a.EMAIL_STATUS = emailStatus;

  /* Qualité téléphone : uniquement si un numéro est effectivement écrit dans SMS */
  let phoneStatus: PhoneStatus | undefined;
  if (data.phone.e164) {
    const samePhone = digitsOnly(ex.SMS) === digitsOnly(data.phone.e164);
    phoneStatus = ex.PHONE_STATUS === "VERIFIED" && samePhone ? "VERIFIED" : data.phone.status;
    a.PHONE_STATUS = phoneStatus;
  }

  /* Score et cycle de vie */
  const formScore = formIntentScore(data.besoin, data.horizon);
  const leadScore = mergeScore(ex.LEAD_SCORE, formScore);
  a.LEAD_SCORE = leadScore;
  const lifecycleStage = nextLifecycleStage(
    isEmptyValue(ex.LIFECYCLE_STAGE) ? undefined : String(ex.LIFECYCLE_STAGE),
    { score: leadScore, emailStatus }
  );
  if (String(ex.LIFECYCLE_STAGE ?? "") !== lifecycleStage) a.LIFECYCLE_STAGE = lifecycleStage;

  return {
    attributes: a,
    isNew: !existing,
    formScore,
    leadScore,
    emailStatus,
    phoneStatus,
    lifecycleStage,
    firstTouchWritten,
  };
}

/**
 * Brevo a refusé le SMS (numéro déjà porté par un autre contact, ou tranche
 * refusée) : le lead est gardé, le numéro tenté part dans TEL_DOUBLON, et
 * PHONE_STATUS est recalculé pour décrire le SMS RÉELLEMENT stocké :
 *   - le contact a déjà un SMS  → statut de ce SMS (VERIFIED conservé)
 *   - aucun SMS stocké          → PHONE_STATUS vide (effacé s'il existait)
 */
export function withoutRejectedSms(
  attributes: Record<string, AttributeValue>,
  existing: BrevoContact | null
): Record<string, AttributeValue> {
  const { SMS, PHONE_STATUS: _rejected, ...rest } = attributes;
  void _rejected;
  const out: Record<string, AttributeValue> = { ...rest };
  if (SMS) out.TEL_DOUBLON = SMS;

  const storedSms = existing?.attributes.SMS;
  const storedStatus = String(existing?.attributes.PHONE_STATUS ?? "");
  if (isEmptyValue(storedSms)) {
    if (storedStatus) out.PHONE_STATUS = ""; // pas de numéro → pas de statut
  } else {
    out.PHONE_STATUS =
      storedStatus === "VERIFIED" ? "VERIFIED" : checkPhone(`+${digitsOnly(storedSms)}`, "FR").status;
  }
  return out;
}
