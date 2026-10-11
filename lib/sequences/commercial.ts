/**
 * État commercial d'un contact, déduit des attributs Brevo écrits par l'équipe
 * ou le CRM (logique PURE, tests/commercial-state.test.ts). Une valeur inconnue
 * donne UNKNOWN : jamais interprétée comme RDV confirmé ni comme feu vert.
 */
import {
  COMMERCIAL_PRECEDENCE,
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
  return { state, signals };
}
