/**
 * Clics automatiques sur les liens d'email (antivirus, aperçus, sécurité de
 * messagerie) : la redirection est servie, mais aucun signal n'est noté.
 * Liste volontairement large : un faux positif ne coûte qu'un signal.
 */
const AUTOMATED_UA =
  /bot|crawl|spider|preview|scan|python|curl|wget|httpclient|headless|phantom|slurp|safelinks|proofpoint|mimecast|barracuda|bitdefender|urldefense|trendmicro|symantec|sophos|fortiguard|zscaler|google-safety|existence discovery|linkexpander|facebookexternalhit|linkedinbot|slackbot|whatsapp/i;

export function isAutomatedRequest(headers: Headers, method: string): boolean {
  if (method !== "GET") return true;
  const ua = headers.get("user-agent") ?? "";
  return !ua || AUTOMATED_UA.test(ua);
}
