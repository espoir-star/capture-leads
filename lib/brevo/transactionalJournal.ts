/**
 * Contrat de GET /v3/smtp/emails : count et transactionalEmails sont optionnels.
 * Un résultat HTTP 200 JSON {} ou { count: 0 } peut donc représenter une
 * recherche vide. Ne pas confondre ce cas avec un échec HTTP, un JSON illisible,
 * une réponse d'erreur, ou une page annonçant des lignes absentes.
 * Source : https://developers.brevo.com/reference/get-transac-emails-list
 * Cette fonction ne décide ni d'envoyer ni d'ignorer l'idempotence.
 */
export interface JournalEmail {
  messageId?: string;
  tags?: string[];
  date?: string;
}
export interface JournalPage { emails: JournalEmail[]; count?: number }

export function parseTransactionalJournalPage(data: unknown, offset = 0): JournalPage {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Journal Brevo incomplet");
  const body = data as Record<string, unknown>;
  if (["error", "errors", "code", "message"].some((key) => Object.hasOwn(body, key))) {
    throw new Error("Journal Brevo : réponse d'erreur");
  }
  const count = body.count;
  if (count !== undefined && (typeof count !== "number" || !Number.isSafeInteger(count) || count < 0)) {
    throw new Error("Journal Brevo : compteur invalide");
  }
  const raw = body.transactionalEmails;
  if (raw === undefined) {
    // Uniquement les formes vides précises du contrat, jamais un objet arbitraire.
    if (offset === 0 && (Object.keys(body).length === 0 || (count === 0 && Object.keys(body).every((key) => key === "count")))) {
      return { emails: [], count: 0 };
    }
    throw new Error("Pagination journal Brevo incomplète");
  }
  if (!Array.isArray(raw)) throw new Error("Journal Brevo : liste invalide");
  const emails: JournalEmail[] = raw.map((row: unknown) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) throw new Error("Journal Brevo : ligne invalide");
    const e = row as Record<string, unknown>;
    if (typeof e.messageId !== "string" || !e.messageId) throw new Error("Journal Brevo : référence d'envoi absente");
    if (e.tags !== undefined && (!Array.isArray(e.tags) || e.tags.some((tag: unknown) => typeof tag !== "string"))) {
      throw new Error("Journal Brevo : étiquettes invalides");
    }
    return row as JournalEmail;
  });
  if (typeof count === "number" && emails.length > 0 && count < offset + emails.length) {
    throw new Error("Journal Brevo : compteur incohérent");
  }
  return { emails, ...(typeof count === "number" && { count }) };
}
