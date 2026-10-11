/** Synthèse des ressources associées : listes historiques et demandes validées.
 * Un rattachement à une liste ne prouve jamais une lecture ni sa date.
 * Les centres d'intérêt ne remplacent pas le métier déclaré.
 */
import { LEAD_MAGNETS } from "@/config/leadMagnets";
import { getRessource } from "@/lib/ressources";

export interface GuideInterestContact { listIds?: readonly number[]; attributes: Record<string, unknown> }
export interface GuideInterest {
  slug: string; title: string; sector: string | null;
  evidence: ("guide_list" | "latest_resource" | "tracked_request")[];
}
export interface GuideInterestSummary {
  guides: GuideInterest[]; distinctCount: number; multiGuide: boolean; sectors: string[]; latestSlug?: string;
  /** Les dates des anciennes listes restent inconnues même si des demandes récentes sont suivies. */
  datesKnown: false;
}
const plain = (s: string) => s.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

export function summarizeGuideInterests(contact: GuideInterestContact): GuideInterestSummary {
  const listIds = new Set((contact.listIds ?? []).filter(Number.isInteger));
  let latest = typeof contact.attributes.RESSOURCE === "string" ? contact.attributes.RESSOURCE : "";
  let latestAt = "";
  const guides: GuideInterest[] = [];
  for (const lm of Object.values(LEAD_MAGNETS)) {
    const evidence: GuideInterest["evidence"] = [];
    if (listIds.has(lm.brevoListId)) evidence.push("guide_list");
    if (latest === lm.slug) evidence.push("latest_resource");
    const raw = contact.attributes[`MG_REQ_${lm.brevoListId}`];
    if (typeof raw === "string" && raw.length < 4000) {
      try {
        const r = JSON.parse(raw) as { v?: unknown; slug?: unknown; requestedAt?: unknown };
        if (r?.v === 1 && r.slug === lm.slug && typeof r.requestedAt === "string" && Number.isFinite(Date.parse(r.requestedAt))) {
          evidence.push("tracked_request");
          const at = new Date(r.requestedAt).toISOString();
          if (at > latestAt) { latestAt = at; latest = lm.slug; }
        }
      } catch { /* Ne jamais extrapoler depuis une donnée malformée. */ }
    }
    if (!evidence.length) continue;
    const resource = getRessource(lm.slug);
    const title = plain(resource?.resourceCard?.titre ?? resource?.titre ?? lm.brevoListName);
    guides.push({ slug: lm.slug, title, sector: lm.vertical, evidence });
  }
  const latestSlug = guides.some((g) => g.slug === latest) ? latest : undefined;
  const sectors = [...new Set(guides.map((g) => g.sector).filter((v): v is string => !!v && v !== "GENERAL"))].sort();
  return { guides, distinctCount: guides.length, multiGuide: guides.length >= 2, sectors, ...(latestSlug && { latestSlug }), datesKnown: false };
}
export function guideInterestRows(contact: GuideInterestContact): { label: string; value: string }[] {
  const summary = summarizeGuideInterests(contact);
  if (!summary.distinctCount) return [];
  const recent = Number(contact.attributes.GUIDES_RECENT_30D);
  return [
    { label: "Guides distincts associés", value: String(summary.distinctCount) },
    { label: "Guides connus", value: summary.guides.map((g) => g.title).join(" ; ") },
    ...(Number.isInteger(recent) && recent > 0 ? [{ label: "Demandes distinctes sur 30 jours (dates suivies)", value: String(recent) }] : []),
    ...(summary.sectors.length ? [{ label: "Thèmes d’intérêt (pas métier déclaré)", value: summary.sectors.join(" · ") }] : []),
    ...(summary.latestSlug ? [{ label: "Dernier guide demandé", value: summary.guides.find((g) => g.slug === summary.latestSlug)!.title }] : []),
  ];
}
