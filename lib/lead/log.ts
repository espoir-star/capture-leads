/**
 * Journal structuré des captures (stdout → logs Vercel). Repris de l'ancien
 * `journaliser()` de /api/lead : un rejet et la réussite qui suit se
 * recoupent par sessionId.
 *
 * Changement : les valeurs saisies ne sont plus journalisées en clair
 * (email masqué, téléphone réduit à ses 2 derniers chiffres, IP tronquée).
 */

export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 1) return "***";
  return `${email[0]}***@${email.slice(at + 1)}`;
}

export function maskPhone(phone: string): string {
  const d = phone.replace(/\D/g, "");
  return d.length > 2 ? `***${d.slice(-2)}` : "***";
}

/** IP tronquée (IPv4 : dernier octet ; IPv6 : 3 premiers groupes) — assez pour recouper un abus, pas pour identifier */
export function maskIp(ip: string): string {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return ip.replace(/\.\d{1,3}$/, ".0");
  if (ip.includes(":")) return `${ip.split(":").slice(0, 3).join(":")}::`;
  return "inconnue";
}

export function logLead(
  evenement: "rejet" | "succes" | "erreur",
  data: Record<string, string | number | boolean | undefined>
) {
  const line = JSON.stringify({ type: "lead", evenement, horodatage: new Date().toISOString(), ...data });
  if (evenement === "erreur") console.error(line);
  else console.log(line);
}
