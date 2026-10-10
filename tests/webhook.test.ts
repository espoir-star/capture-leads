import { test } from "node:test";
import assert from "node:assert/strict";
import { emailStatusAfterBounce, parseWebhookEvent } from "@/lib/brevo/webhook";
import {
  createEmailConfirmToken,
  emailStatusAfterConfirmation,
  readEmailConfirmToken,
} from "@/lib/security/emailConfirm";

process.env.SIGNING_SECRET = "secret-de-test";

/** Applique une suite de bounces comme la route (écriture seulement si changement) */
function replayBounces(start: string, n: number) {
  let status = start;
  let writes = 0;
  for (let i = 0; i < n; i++) {
    const next = emailStatusAfterBounce(status);
    if (next) {
      status = next;
      writes++;
    }
  }
  return { status, writes };
}

test("EMAIL_STATUS : nouveau contact valide → PENDING (voir contactUpdate), clic générique → aucun effet", () => {
  const click = parseWebhookEvent({ event: "click", email: "a@cabinet.fr", URL: "https://althoce.com/blog" });
  assert.equal(click.kind, "click");
  // la route n'applique d'effet qu'aux hard bounces : un clic de newsletter ne vérifie rien
  assert.notEqual(click.kind, "hard_bounce");
  assert.equal(parseWebhookEvent({ event: "opened", email: "a@b.fr" }).kind, "opened");
});

test("confirmation dédiée → VERIFIED ; idempotente ; jamais sur BOUNCED / DISPOSABLE", () => {
  assert.equal(emailStatusAfterConfirmation("PENDING"), "VERIFIED");
  assert.equal(emailStatusAfterConfirmation(""), "VERIFIED");
  assert.equal(emailStatusAfterConfirmation("VERIFIED"), null, "2e confirmation : rien à écrire");
  assert.equal(emailStatusAfterConfirmation("BOUNCED"), null);
  assert.equal(emailStatusAfterConfirmation("DISPOSABLE"), null);
});

test("hard bounce → BOUNCED ; reçu deux fois → une seule écriture", () => {
  assert.equal(emailStatusAfterBounce("PENDING"), "BOUNCED");
  assert.equal(emailStatusAfterBounce("VERIFIED"), "BOUNCED");
  assert.deepEqual(replayBounces("PENDING", 2), { status: "BOUNCED", writes: 1 });
  assert.deepEqual(replayBounces("BOUNCED", 3), { status: "BOUNCED", writes: 0 });
});

test("parsing défensif : formats campagne / transactionnel, payloads absurdes", () => {
  assert.deepEqual(
    parseWebhookEvent({ event: "hard_bounce", email: " Jean@Cabinet.FR ", ts_sent: 100, ts_event: 400 }),
    { kind: "hard_bounce", email: "jean@cabinet.fr", url: undefined, sentAt: 100, eventAt: 400 }
  );
  assert.equal(parseWebhookEvent({ event: "hardBounce", email: "a@b.fr" }).kind, "hard_bounce");
  assert.equal(parseWebhookEvent({ event: "click", email: "a@b.fr", link: "https://x.fr" }).url, "https://x.fr");
  assert.equal(parseWebhookEvent(null).kind, "other");
  assert.equal(parseWebhookEvent([1, 2]).email, "");
  assert.equal(parseWebhookEvent({ event: { $ne: 1 }, email: 42 }).kind, "other");
});

test("webhook unsubscribe est reconnu sans confirmer une adresse", () => {
  const evt = parseWebhookEvent({ event: "unsubscribe", email: "Jean@Cabinet.FR" });
  assert.equal(evt.kind, "unsubscribed");
  assert.equal(evt.email, "jean@cabinet.fr");
});

test("jeton de confirmation : chiffré, sans email lisible, infalsifiable", () => {
  const t = createEmailConfirmToken("jean.dupont@cabinet.fr")!;
  assert.match(t, /^v1\.[\w-]+$/);
  assert.equal(t.includes("jean"), false);
  assert.equal(Buffer.from(t.slice(3), "base64url").toString("latin1").includes("cabinet"), false);
  assert.equal(readEmailConfirmToken(t), "jean.dupont@cabinet.fr");
  const tampered = t.slice(0, -2) + (t.endsWith("A") ? "BB" : "AA");
  assert.equal(readEmailConfirmToken(tampered), null);
  assert.equal(readEmailConfirmToken("v1.abc"), null);
  assert.equal(readEmailConfirmToken(undefined), null);
  process.env.SIGNING_SECRET = "autre-secret";
  assert.equal(readEmailConfirmToken(t), null, "un autre secret ne peut pas le lire");
  process.env.SIGNING_SECRET = "secret-de-test";
});
