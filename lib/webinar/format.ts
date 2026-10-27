/**
 * Date et horaire d'un webinar en heure de Paris, au format affiché sur la
 * page d'inscription et dans les emails : « Jeudi 5 novembre », « 11 h – 12 h ».
 * Espaces insécables : « 11 h » ne se coupe jamais en fin de ligne.
 */

const PARIS = "Europe/Paris";

/** « Jeudi 5 novembre » */
export function webinarDay(d: Date): string {
  const s = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: PARIS }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** « 11 h », « 11 h 30 » */
export function webinarHour(d: Date): string {
  const parts = new Intl.DateTimeFormat("fr-FR", { hour: "numeric", minute: "2-digit", timeZone: PARIS }).formatToParts(d);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const m = parts.find((p) => p.type === "minute")?.value ?? "00";
  return m === "00" ? `${h} h` : `${h} h ${m}`;
}

/** « 11 h – 12 h » : début et fin du direct */
export function webinarHours(w: { startsAt: string; durationMin: number }): string {
  const start = new Date(w.startsAt);
  const end = new Date(start.getTime() + w.durationMin * 60_000);
  return `${webinarHour(start)} – ${webinarHour(end)}`;
}
