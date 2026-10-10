/**
 * Transport HTTP minimal vers l'API Brevo v3.
 *
 * Utilisé par le serveur Next (via lib/brevo/server.ts, protégé par
 * `server-only`) et par les scripts CLI (scripts/brevo/*). Ne JAMAIS importer
 * ce module depuis un composant client : la clé API est lue dans
 * process.env.BREVO_API_KEY, variable non exposée au navigateur.
 *
 * BREVO_API_BASE_URL permet de pointer vers un faux Brevo local pour les
 * tests (tests/e2e/mock-brevo.ts). En production : laisser vide.
 */

export const BREVO_API_BASE_URL =
  process.env.BREVO_API_BASE_URL?.replace(/\/$/, "") || "https://api.brevo.com/v3";

export type AttributeValue = string | number | boolean;

export interface BrevoContact {
  id: number;
  email: string;
  emailBlacklisted: boolean;
  smsBlacklisted?: boolean;
  listIds: number[];
  attributes: Record<string, AttributeValue | undefined>;
  createdAt?: string;
  modifiedAt?: string;
}

export interface BrevoResponse<T> {
  ok: boolean;
  status: number;
  data: T | null;
  /** code d'erreur Brevo (duplicate_parameter, invalid_parameter…) */
  code?: string;
  message?: string;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  apiKey?: string;
  /** Nombre de nouvelles tentatives sur erreur réseau / 429 / 5xx */
  retries?: number;
  timeoutMs?: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function getApiKey(): string | undefined {
  return process.env.BREVO_API_KEY?.trim() || undefined;
}

export async function brevoRequest<T = unknown>(
  path: string,
  { method = "GET", body, apiKey = getApiKey(), retries = 1, timeoutMs = 8000 }: RequestOptions = {}
): Promise<BrevoResponse<T>> {
  if (!apiKey) throw new Error("BREVO_API_KEY manquante");

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(400 * attempt);
    try {
      const res = await fetch(`${BREVO_API_BASE_URL}${path}`, {
        method,
        headers: {
          "api-key": apiKey,
          Accept: "application/json",
          ...(body !== undefined && { "Content-Type": "application/json" }),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(timeoutMs),
        cache: "no-store",
      });
      const text = await res.text();
      let data: unknown = null;
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = null;
        }
      }
      const retryable = res.status === 429 || res.status >= 500;
      if (retryable && attempt < retries) continue;
      const err = !res.ok ? (data as { code?: string; message?: string } | null) : null;
      return {
        ok: res.ok,
        status: res.status,
        data: res.ok ? (data as T) : null,
        code: err?.code,
        message: err?.message,
      };
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Erreur réseau Brevo");
}

/** Contact par identifiant Brevo, ou null s'il n'existe plus. */
export async function getContactById(id: number): Promise<BrevoContact | null> {
  const res = await brevoRequest<BrevoContact>(`/contacts/${id}?identifierType=contact_id`);
  if (res.status === 404) return null;
  if (!res.ok || !res.data) {
    throw new Error(`Lecture contact Brevo impossible (${res.status} ${res.code ?? ""})`);
  }
  return res.data;
}

/** Contact par email, ou null s'il n'existe pas. */
export async function getContactByEmail(email: string): Promise<BrevoContact | null> {
  const res = await brevoRequest<BrevoContact>(
    `/contacts/${encodeURIComponent(email)}?identifierType=email_id`
  );
  if (res.status === 404) return null;
  if (!res.ok || !res.data) {
    throw new Error(`Lecture contact Brevo impossible (${res.status} ${res.code ?? ""})`);
  }
  return res.data;
}

/** Itère sur tous les contacts du compte (pagination 1000). */
export async function* iterateContacts(pageSize = 1000): AsyncGenerator<BrevoContact> {
  for (let offset = 0; ; offset += pageSize) {
    const res = await brevoRequest<{ contacts: BrevoContact[]; count: number }>(
      `/contacts?limit=${pageSize}&offset=${offset}&sort=asc`,
      { retries: 3 }
    );
    if (!res.ok || !res.data) throw new Error(`Lecture contacts impossible (${res.status})`);
    for (const c of res.data.contacts ?? []) yield c;
    if ((res.data.contacts ?? []).length < pageSize) return;
  }
}

export interface BrevoAttributeDef {
  name: string;
  category: string;
  type?: string;
}

export async function listAttributes(): Promise<BrevoAttributeDef[]> {
  const res = await brevoRequest<{ attributes: BrevoAttributeDef[] }>("/contacts/attributes");
  if (!res.ok || !res.data) throw new Error(`Lecture attributs impossible (${res.status})`);
  return res.data.attributes;
}

export function isEmptyValue(v: AttributeValue | undefined | null): boolean {
  return v === undefined || v === null || (typeof v === "string" && v.trim() === "");
}
