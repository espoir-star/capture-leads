/**
 * État commercial d'un contact, déduit des attributs Brevo écrits par l'équipe
 * ou le CRM (logique PURE, tests/commercial-state.test.ts). Une valeur inconnue
 * donne UNKNOWN : jamais interprétée comme RDV confirmé ni comme feu vert.
 */
import {
  COMMERCIAL_PRECEDENCE,
  CRM_SALES_STATES,
  COMMERCIAL_VALUE_MAP,
  normalizeCommercialValue,
  type CommercialState,
} from "@/config/commercialStates";

export interface CommercialReading {
  state: CommercialState;
  /** Attributs ayant contribué (pour l'explication et le journal) */
  signals: { attribute: string; value: string; state: CommercialState }[];
}

export function readCommercialState(attributes: Record<string, unknown>): CommercialReading {
  const signals: CommercialReading["signals"] = [];
  for (const [attribute, map] of Object.entries(COMMERCIAL_VALUE_MAP)) {
    const raw = attributes[attribute];
    const key = normalizeCommercialValue(raw);
    if (!key) continue;
    signals.push({ attribute, value: String(raw).trim(), state: map[key] ?? "UNKNOWN" });
  }
  // Un type de RDV renseigné seul (ex. « R2 ») signale un RDV évoqué, sans confirmation.
  const typeRdv = normalizeCommercialValue(attributes.TYPE_RDV);
  if (typeRdv) signals.push({ attribute: "TYPE_RDV", value: String(attributes.TYPE_RDV).trim(), state: "MEETING_TBD" });
  const rank = (s: CommercialState) => COMMERCIAL_PRECEDENCE.indexOf(s);
  const state = signals.reduce<CommercialState>((best, s) => (rank(s.state) < rank(best) ? s.state : best), "NONE");
  // Monotone restrictions always win, including a legacy telephone refusal.
  const refused = ["CRM_DO_NOT_CALL", "CRM_EMAIL_OPPOSED", "CRM_GLOBAL_OPPOSED"]
    .filter((key) => [true, 1, "true", "TRUE", "1"].includes(attributes[key] as string | number | boolean));
  if (refused.length || state === "DO_NOT_CALL") return { state: "DO_NOT_CALL", signals };
  const hasProjection = ["CRM_SALES_STATUS", "CRM_SALES_VERSION", "CRM_SALES_UPDATED_AT", "CRM_SALES_EVENT_ID"]
    .some((key) => attributes[key] !== undefined && attributes[key] !== "");
  if (!hasProjection) return { state, signals };
  const status = String(attributes.CRM_SALES_STATUS ?? "");
  const version = Number(attributes.CRM_SALES_VERSION);
  const at = String(attributes.CRM_SALES_UPDATED_AT ?? "");
  const valid = Number.isSafeInteger(version) && version > 0 &&
    /^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/.test(at) && Number.isFinite(Date.parse(at)) &&
    typeof attributes.CRM_SALES_EVENT_ID === "string" && !!attributes.CRM_SALES_EVENT_ID.trim();
  const canonical = valid ? CRM_SALES_STATES[status] ?? "UNKNOWN" : "UNKNOWN";
  signals.push({ attribute: "CRM_SALES_STATUS", value: status, state: canonical });
  // An initial/partial replay never clears an existing commercial restriction.
  if (canonical === "IMPORTED" && !["NONE", "IMPORTED"].includes(state)) return { state, signals };
  return { state: canonical, signals };
}
