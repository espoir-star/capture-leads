import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTransactionalJournalPage } from "@/lib/brevo/transactionalJournal";

test("journal : count et transactionalEmails optionnels, formes vides reconnues", () => {
  assert.deepEqual(parseTransactionalJournalPage({}), { emails: [], count: 0 });
  assert.deepEqual(parseTransactionalJournalPage({ count: 0 }), { emails: [], count: 0 });
  assert.deepEqual(parseTransactionalJournalPage({ transactionalEmails: [] }), { emails: [] });
  assert.deepEqual(parseTransactionalJournalPage({ count: 0, transactionalEmails: [] }), { emails: [], count: 0 });
});
test("journal : transport vide ou JSON non objet n'est pas une recherche vide", () => {
  for (const input of [undefined, null, [], "", "{}", true, 0]) assert.throws(() => parseTransactionalJournalPage(input));
});
test("journal : réponses d'erreur ou inconnues refusées même avec count=0", () => {
  for (const input of [{ unexpected: true }, { count: 0, error: "unauthorized" }, { code: "x" }, { message: "error" }, { count: 0, status: "failed" }]) assert.throws(() => parseTransactionalJournalPage(input));
});
test("journal : une réponse annonçant des lignes sans les fournir est refusée", () => {
  for (const input of [{ count: 3 }, { count: 0, transactionalEmails: null }, { count: 1, transactionalEmails: {} }]) assert.throws(() => parseTransactionalJournalPage(input));
});
test("journal : vide implicite refusé après la première page", () => {
  assert.throws(() => parseTransactionalJournalPage({}, 500));
  assert.throws(() => parseTransactionalJournalPage({ count: 0 }, 500));
});
test("journal : données d'envoi et tags préservés", () => {
  const row = { messageId: "proof", tags: ["k:abc"], date: "2026-10-11T00:00:00Z" };
  assert.deepEqual(parseTransactionalJournalPage({ count: 1, transactionalEmails: [row] }), { count: 1, emails: [row] });
});
test("journal : compteurs et lignes incohérents refusés", () => {
  for (const count of [-1, 0.1, "0", null, NaN]) assert.throws(() => parseTransactionalJournalPage({ count, transactionalEmails: [] }));
  for (const row of [null, [], {}, { messageId: 1 }, { messageId: "x", tags: "bad" }]) assert.throws(() => parseTransactionalJournalPage({ transactionalEmails: [row] }));
  assert.throws(() => parseTransactionalJournalPage({ count: 0, transactionalEmails: [{ messageId: "x" }] }));
});
