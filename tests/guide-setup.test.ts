import { test } from "node:test";
import assert from "node:assert/strict";
import { brevoRequest, type BrevoAttributeDef } from "@/lib/brevo/api";
import { parseGuideSetupArgs, setupGuide } from "@/scripts/brevo/setup-guide";

const name = "LM - Guide de recette locale";
function fake(existing = false, attrs: BrevoAttributeDef[] = []) {
  const lists: { id: number; name: string; folderId: number }[] = existing ? [{ id: 73, name, folderId: 5 }] : [];
  const calls: { path: string; method: string; body: unknown; retries: number | undefined }[] = [];
  const request = (async (path, opts = {}) => {
    const method = opts.method ?? "GET";
    calls.push({ path, method, body: opts.body, retries: opts.retries });
    let data: unknown;
    if (method === "GET" && path.startsWith("/contacts/folders?")) data = { folders: [{ id: 5, name: "Lead Magnets" }] };
    else if (method === "GET" && path.startsWith("/contacts/lists?")) data = { lists };
    else if (method === "GET" && path.startsWith("/contacts/lists/")) data = lists.find((l) => l.id === Number(path.split("/").at(-1)));
    else if (method === "GET" && path === "/contacts/attributes") data = { attributes: attrs };
    else if (method === "POST" && path === "/contacts/lists") {
      const body = opts.body as { name: string; folderId: number };
      lists.push({ id: 137, ...body });
      data = { id: 137 };
    } else if (method === "POST" && path.startsWith("/contacts/attributes/normal/")) {
      attrs.push({ name: path.split("/").at(-1)!, type: "text", category: "normal" });
      data = null;
    } else throw new Error(`Appel inattendu : ${method} ${path}`);
    return { ok: true, status: method === "GET" ? 200 : 201, data };
  }) as typeof brevoRequest;
  return { request, calls, lists, attrs };
}

test("configuration guide : dry-run par défaut, options ambiguës refusées", () => {
  assert.deepEqual(parseGuideSetupArgs(["--name", name]), { name, apply: false });
  assert.deepEqual(parseGuideSetupArgs(["--apply", "--name", name]), { name, apply: true });
  for (const args of [[], ["--apply"], ["--name", ""], ["--name", "Sans préfixe"], ["--name", name, "--send"], ["--name", name, "--apply", "--apply"], ["--name", name, "--name", name]]) {
    assert.throws(() => parseGuideSetupArgs(args));
  }
});

test("configuration guide : dry-run sans aucune écriture ni ID inventé", async () => {
  const f = fake();
  const reports: string[] = [];
  await setupGuide({ name, apply: false }, f.request, (s) => reports.push(s));
  assert.ok(f.calls.every((c) => c.method === "GET"));
  assert.equal(f.lists.length, 0);
  assert.match(reports[0], /attribué par Brevo/);
});

test("configuration guide : ID réel utilisé, trois champs seulement, reprise idempotente", async () => {
  const f = fake();
  await setupGuide({ name, apply: true }, f.request, () => {});
  assert.deepEqual(f.attrs.map((a) => a.name), ["MG_REQ_137", "MG_SENT_137", "MG_ENROLLED_137"]);
  const writes = f.calls.filter((c) => c.method !== "GET");
  assert.equal(writes.length, 4);
  assert.ok(writes.every((c) => c.retries === 0));
  f.calls.length = 0;
  await setupGuide({ name, apply: true }, f.request, () => {});
  assert.ok(f.calls.every((c) => c.method === "GET"));
  assert.equal(f.lists.length, 1);
});

test("configuration guide : liste existante réutilisée, seuls les champs manquants sont ajoutés", async () => {
  const f = fake(true, [{ name: "MG_REQ_73", type: "text", category: "normal" }]);
  await setupGuide({ name, apply: true }, f.request, () => {});
  assert.deepEqual(f.calls.filter((c) => c.method !== "GET").map((c) => c.path), [
    "/contacts/attributes/normal/MG_SENT_73", "/contacts/attributes/normal/MG_ENROLLED_73",
  ]);
});

test("configuration guide : ambiguïté, mauvais dossier, type incompatible ou capacité bloquent avant écriture", async () => {
  const duplicate = fake(true);
  duplicate.lists.push({ id: 74, name, folderId: 5 });
  const wrongFolder = fake(true);
  wrongFolder.lists[0].folderId = 9;
  const wrongType = fake(true, [{ name: "MG_REQ_73", type: "float", category: "normal" }]);
  const full = fake(false, Array.from({ length: 198 }, (_, i) => ({ name: `OLD_${i}`, type: "text", category: "normal" })));
  for (const f of [duplicate, wrongFolder, wrongType, full]) {
    await assert.rejects(setupGuide({ name, apply: true }, f.request, () => {}));
    assert.ok(f.calls.every((c) => c.method === "GET"));
  }
});
