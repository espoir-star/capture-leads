/**
 * Intérêt multi-guides : synthèse PURE des rattachements réellement connus.
 *
 * Une liste par guide existe déjà dans Brevo. On utilise uniquement les listes
 * référencées dans config/leadMagnets.ts et RESSOURCE (dernière demande).
 * Pas de fusion par téléphone, pas de date inventée à partir de modifiedAt,
 * pas de changement de métier, de score ou de permission marketing.
 * Un rattachement prouve une ressource associée, pas la lecture du guide.
 */
import { LEAD_MAGNETS } from "@/config/leadMagnets";
import { getRessource } from "@/lib/ressources";

export interface GuideInterestContact {
  listIds?: readonly number[];
  attributes: Record<string, unknown>;
}

export interface GuideInterest {
  slug: string;
  title: string;
  /** Thème du guide : ne prouve pas le métier du contact. */
  sector: string | null;
  evidence: ("guide_list" | "latest_resource")[];
}

export interface GuideInterestSummary {
  guides: GuideInterest[];
  distinctCount: number;
  multiGuide: boolean;
  sectors: string[];
  latestSlug?: string;
  /** Les listes ne donnent pas la date d'inscription à chaque guide. */
  datesKnown: false;
}

const plain = (s: string) => s.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

export function summarizeGuideInterests(contact: GuideInterestContact): GuideInterestSummary {
  const listIds = new Set((contact.listIds ?? []).filter(Number.isInteger));
  const latest = typeof contact.attributes.RESSOURCE === "string" ? contact.attributes.RESSOURCE : "";
  const guides: GuideInterest[] = [];
  for (const lm of Object.values(LEAD_MAGNETS)) {
    const evidence: GuideInterest["evidence"] = [];
    if (listIds.has(lm.brevoListId)) evidence.push("guide_list");
    if (latest === lm.slug) evidence.push("latest_resource");
    if (!evidence.length) continue;
    const resource = getRessource(lm.slug);
    const title = plain(resource?.resourceCard?.titre ?? resource?.titre ?? lm.brevoListName);
    guides.push({ slug: lm.slug, title, sector: lm.vertical, evidence });
  }
  const latestSlug = guides.some((g) => g.slug === latest) ? latest : undefined;
  const sectors = [...new Set(guides.map((g) => g.sector).filter((v): v is string => !!v && v !== "GENERAL"))].sort();
  return { guides, distinctCount: guides.length, multiGuide: guides.length >= 2, sectors, ...(latestSlug && { latestSlug }), datesKnown: false };
}

/** Texte de contexte commercial, réutilisable sans nouvelle notification. */
export function guideInterestRows(contact: GuideInterestContact): { label: string; value: string }[] {
  const summary = summarizeGuideInterests(contact);
  if (!summary.distinctCount) return [];
  return [
    { label: "Guides distincts associés", value: String(summary.distinctCount) },
    { label: "Guides connus", value: summary.guides.map((g) => g.title).join(" ; ") },
    ...(summary.sectors.length ? [{ label: "Thèmes d’intérêt (pas métier déclaré)", value: summary.sectors.join(" · ") }] : []),
    ...(summary.latestSlug ? [{ label: "Dernier guide demandé", value: summary.guides.find((g) => g.slug === summary.latestSlug)!.title }] : []),
  ];
}
