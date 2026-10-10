/**
 * Lecture BORNÉE du corps d'une requête : la taille est vérifiée avant toute
 * lecture complète (en-tête Content-Length, puis flux coupé au-delà de la
 * limite). Une requête trop volumineuse est refusée (413) sans être chargée
 * en mémoire ni traitée.
 */

export type BodyResult = { ok: true; text: string } | { ok: false; status: 413 };

export async function readBodyLimited(req: Request, maxBytes: number): Promise<BodyResult> {
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) return { ok: false, status: 413 };
  if (!req.body) return { ok: true, text: "" };

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return { ok: false, status: 413 };
    }
    chunks.push(value);
  }
  return { ok: true, text: Buffer.concat(chunks).toString("utf8") };
}
