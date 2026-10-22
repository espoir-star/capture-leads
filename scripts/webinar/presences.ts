/**
 * Présences CONFIRMÉES après le direct. Google Workspace Business Standard n'a
 * pas de rapport de présence ; le modérateur reçoit en revanche par email le
 * rapport des sondages et des questions-réponses (noms des participants).
 *
 *   npm run webinar:presences -- --slug <slug> --file rapport.csv --proof poll
 *   … --apply   (après relecture de la simulation)
 *
 * Fichier : une personne par ligne, email OU « Prénom Nom » (copie du rapport
 * de sondage). Les noms sont rapprochés des INSCRITS de la liste Brevo du
 * webinar : correspondance unique seulement, sinon la ligne est signalée.
 * Un non-inscrit n'est jamais créé ni compté. Idempotent : relancer ne rajoute
 * aucun point (clé du journal = contact + webinar).
 *
 * --proof : poll (rapport de sondage), qa (rapport de questions), manual (constat de l'organisateur).
 */
import { readFileSync } from "node:fs";
import { getWebinar } from "@/config/webinars";
import { brevoRequest, getApiKey } from "@/lib/brevo/api";
import { confirmWebinarAttendance } from "@/lib/webinar/events";
import type { AttendanceProof } from "@/lib/webinar/activity";

const arg = (name: string) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : undefined; };
const APPLY = process.argv.includes("--apply");
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z@.+-]+/g, " ").trim();
const mask = (e: string) => e.replace(/^(.).*(@.*)$/, "$1***$2");

interface Member { id: number; email: string; name: string }

async function registrants(listId: number): Promise<Member[]> {
  const out: Member[] = [];
  for (let offset = 0; ; offset += 500) {
    const res = await brevoRequest<{ contacts?: { id: number; email: string; attributes?: Record<string, unknown> }[]; count?: number }>(
      `/contacts/lists/${listId}/contacts?limit=500&offset=${offset}`);
    if (!res.ok) throw new Error(`Liste #${listId} illisible (${res.status})`);
    for (const c of res.data?.contacts ?? []) out.push({ id: c.id, email: c.email.toLowerCase(), name: norm(`${c.attributes?.PRENOM ?? ""} ${c.attributes?.NOM ?? ""}`) });
    if (offset + 500 >= (res.data?.count ?? 0)) return out;
  }
}

async function main() {
  const slug = arg("slug"), file = arg("file");
  const proof = (arg("proof") ?? "manual") as AttendanceProof;
  if (!slug || !file || !["poll", "qa", "manual"].includes(proof)) throw new Error("Usage : npm run webinar:presences -- --slug <slug> --file <fichier> --proof poll|qa|manual [--apply]");
  if (!getApiKey()) throw new Error("BREVO_API_KEY absente");
  const w = getWebinar(slug);
  if (!w || w.brevoListId <= 0) throw new Error(`Webinar « ${slug} » inconnu ou sans liste Brevo`);
  if (Date.now() < Date.parse(w.startsAt)) throw new Error("Le webinar n'a pas encore eu lieu : aucune présence à confirmer.");

  const members = await registrants(w.brevoListId);
  const byEmail = new Map(members.map((m) => [m.email, m]));
  const lines = readFileSync(file, "utf8").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const confirmed = new Map<number, Member>();
  const issues: string[] = [];
  for (const line of lines) {
    const email = line.match(/[^\s,;<>"]+@[^\s,;<>"]+\.[a-z]{2,}/i)?.[0]?.toLowerCase();
    if (email) {
      const m = byEmail.get(email);
      if (m) confirmed.set(m.id, m); else issues.push(`non inscrit : ${mask(email)}`);
      continue;
    }
    const name = norm(line.split(/[,;\t]/)[0]);
    if (name.split(" ").length < 2) { issues.push(`ligne ignorée (ni email, ni prénom + nom) : « ${line.slice(0, 40)} »`); continue; }
    const hits = members.filter((m) => m.name === name || m.name === name.split(" ").reverse().join(" "));
    if (hits.length === 1) confirmed.set(hits[0].id, hits[0]);
    else issues.push(hits.length ? `homonymes, à trancher par email : « ${line.slice(0, 40)} »` : `aucun inscrit à ce nom : « ${line.slice(0, 40)} »`);
  }

  console.log(`\n${APPLY ? "APPLY" : "DRY RUN"} — présences confirmées · ${w.title} · preuve « ${proof} »`);
  console.log(`  Inscrits : ${members.length} · lignes lues : ${lines.length} · présences retenues : ${confirmed.size}`);
  for (const m of confirmed.values()) console.log(`  ✓ ${mask(m.email)}`);
  for (const i of issues) console.log(`  · ${i}`);
  if (!APPLY) { console.log("\nRien n'a été écrit. Relancer avec --apply après relecture.\n"); return; }

  let ok = 0, failed = 0;
  for (const m of confirmed.values()) {
    const r = await confirmWebinarAttendance(m.id, w, proof, new Date());
    if (r.ok) ok++; else { failed++; console.log(`  ✗ ${mask(m.email)} : ${r.reason}`); }
  }
  console.log(`\n${ok} présence(s) confirmée(s)${failed ? `, ${failed} échec(s) à relancer (idempotent)` : ""}.\n`);
  process.exitCode = failed ? 1 : 0;
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
