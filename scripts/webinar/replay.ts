/**
 * Reprise contrôlée de l'email replay (#48) quand l'enregistrement est publié
 * APRÈS la fenêtre automatique de la séquence (le moteur réessaie jusqu'au
 * suivi J+3, puis note « replay_pending »).
 *
 *   npm run webinar:replay -- --slug <slug> [--site https://…]      simulation
 *   … --apply                                                     envoi
 *
 * Garde-fous : le site déployé doit confirmer que le replay est publié ET
 * lisible sans compte Google (/api/webinar/status) ; même clé d'envoi que
 * l'étape automatique (aucun doublon) ; adresses inutilisables exclues ;
 * uniquement les inscrits de la liste du webinar. Email de service lié à
 * l'inscription : envoyé aussi aux personnes opposées au marketing.
 */
import { getWebinar } from "@/config/webinars";
import { getSequence } from "@/config/sequences";
import { brevoRequest, getApiKey } from "@/lib/brevo/api";
import { sendReplayCatchUp } from "@/lib/sequences/run";
import { siteUrl } from "@/lib/sequences/links";

const arg = (name: string) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : undefined; };
const APPLY = process.argv.includes("--apply");

async function main() {
  const slug = arg("slug");
  if (!slug) throw new Error("Usage : npm run webinar:replay -- --slug <slug> [--apply]");
  if (!getApiKey()) throw new Error("BREVO_API_KEY absente");
  const w = getWebinar(slug);
  const seq = w?.sequence ? getSequence(w.sequence) : undefined;
  if (!w || !seq || w.brevoListId <= 0) throw new Error(`Webinar « ${slug} » inconnu, sans séquence ou sans liste`);

  const site = (arg("site") ?? siteUrl()).replace(/\/$/, "");
  const secret = process.env.SEQUENCE_API_SECRET?.trim();
  if (!secret) throw new Error("SEQUENCE_API_SECRET absent : impossible de vérifier la publication du replay");
  const status = await fetch(`${site}/api/webinar/status?slug=${slug}`, { headers: { Authorization: `Bearer ${secret}` } }).then((r) => r.json()).catch(() => null);
  if (!status?.replay?.configured) throw new Error(`Replay non publié sur ${site} (variable ${status?.replay?.variable ?? "WEBINAR_REPLAY_URL__…"})`);
  if (status.replay.access !== "public_link") throw new Error(`Replay publié mais accès « ${status.replay.access} » : vérifier le partage Drive avant tout envoi`);

  const contacts: { id: number; email: string; attributes: Record<string, unknown> }[] = [];
  for (let offset = 0; ; offset += 500) {
    const res = await brevoRequest<{ contacts?: typeof contacts; count?: number }>(`/contacts/lists/${w.brevoListId}/contacts?limit=500&offset=${offset}`);
    if (!res.ok) throw new Error(`Liste #${w.brevoListId} illisible (${res.status})`);
    contacts.push(...(res.data?.contacts ?? []));
    if (offset + 500 >= (res.data?.count ?? 0)) break;
  }
  console.log(`\n${APPLY ? "APPLY" : "DRY RUN"} — replay de « ${w.title} » · ${contacts.length} inscrit(s) · replay lisible sans compte`);
  if (!APPLY) { console.log("Chaque inscrit recevra le replay sauf s'il l'a déjà reçu (même clé que la séquence). Relancer avec --apply.\n"); return; }

  const tally: Record<string, number> = {};
  for (const c of contacts) {
    const r = await sendReplayCatchUp(seq, c, slug, new Date(w.startsAt), new Date());
    tally[r] = (tally[r] ?? 0) + 1;
    await new Promise((res) => setTimeout(res, 150));
  }
  console.log(Object.entries(tally).map(([k, v]) => `  ${k} : ${v}`).join("\n"), "\n");
  process.exitCode = tally.failed ? 1 : 0;
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
