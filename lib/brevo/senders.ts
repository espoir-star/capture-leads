/**
 * Expéditeurs et domaines d'envoi Brevo (lecture + authentification).
 * Utilisé par les scripts CLI uniquement (scripts/brevo/domain.ts,
 * scripts/newsletter/campaign.ts).
 */

import { brevoRequest } from "@/lib/brevo/api";

export interface BrevoSender {
  id: number;
  name: string;
  email: string;
  active: boolean;
}

export interface DnsRecord {
  type: string;
  host_name: string;
  value: string;
  status: boolean;
}

export interface BrevoDomain {
  domain: string;
  verified: boolean;
  authenticated: boolean;
  dns_records: Record<string, DnsRecord | null>;
}

export async function listSenders(): Promise<BrevoSender[]> {
  const res = await brevoRequest<{ senders?: BrevoSender[] }>("/senders");
  if (!res.ok) throw new Error(`Lecture des expéditeurs refusée : ${res.status} ${res.message ?? ""}`);
  return res.data?.senders ?? [];
}

/** Expéditeur existant ET actif (validé) pour cet email, sinon null */
export function findActiveSender(senders: BrevoSender[], email: string): BrevoSender | null {
  return senders.find((s) => s.email.toLowerCase() === email.toLowerCase() && s.active) ?? null;
}

/** Domaine et état de ses enregistrements DNS (null si absent du compte) */
export async function getSendingDomain(domain: string): Promise<BrevoDomain | null> {
  const res = await brevoRequest<BrevoDomain>(`/senders/domains/${encodeURIComponent(domain)}`);
  if (res.status === 404) return null;
  if (!res.ok || !res.data) throw new Error(`Lecture du domaine refusée : ${res.status} ${res.message ?? ""}`);
  return res.data;
}
