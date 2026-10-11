/**
 * Un HTTP 2xx n'est pas une preuve de capture : le honeypot renvoie
 * volontairement { ok: true } sans écrire dans Brevo. Exiger la référence
 * produite après une écriture de contact réussie avant toute confirmation UI.
 * Ceci valide le contrat de réponse, pas la signature cryptographique :
 * la vérification de la signature reste exclusivement côté serveur.
 */
export interface CaptureAcknowledgement {
  ok: true;
  leadRef: string;
  marketing?: "opposed";
}

export function parseCaptureAcknowledgement(httpOk: boolean, body: unknown): CaptureAcknowledgement | null {
  if (!httpOk || !body || typeof body !== "object" || Array.isArray(body)) return null;
  const data = body as Record<string, unknown>;
  if (data.ok !== true || typeof data.leadRef !== "string") return null;
  if (data.leadRef.length > 600 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(data.leadRef)) return null;
  if (data.marketing !== undefined && data.marketing !== "opposed") return null;
  return {
    ok: true,
    leadRef: data.leadRef,
    ...(data.marketing === "opposed" && { marketing: "opposed" as const }),
  };
}
