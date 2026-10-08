/**
 * Résolution des segments Brevo (lecture seule : l'API ne crée pas de segments).
 * Un segment est trouvé par son ID configuré, sinon par son NOM EXACT.
 */

import { brevoRequest } from "@/lib/brevo/api";
import type { SegmentRef } from "@/config/newsletter";

export interface BrevoSegment {
  id: number;
  segmentName: string;
  categoryName?: string;
  updatedAt?: string;
}

export async function listSegments(): Promise<BrevoSegment[]> {
  const out: BrevoSegment[] = [];
  for (let offset = 0; offset < 5000; offset += 50) {
    const res = await brevoRequest<{ segments?: BrevoSegment[] }>(`/contacts/segments?limit=50&offset=${offset}`, {
      retries: 2,
    });
    if (!res.ok) throw new Error(`Lecture des segments impossible (${res.status})`);
    const page = res.data?.segments ?? [];
    out.push(...page);
    if (page.length < 50) break;
  }
  return out;
}

/** ID réel du segment, ou null s'il n'existe pas (jamais d'ID inventé). */
export function resolveSegmentId(ref: SegmentRef, segments: BrevoSegment[]): number | null {
  if (ref.id && segments.some((s) => s.id === ref.id)) return ref.id;
  const byName = segments.filter((s) => s.segmentName.trim() === ref.name);
  return byName.length === 1 ? byName[0].id : null;
}
