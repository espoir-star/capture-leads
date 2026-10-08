import { test } from "node:test";
import assert from "node:assert/strict";
import { checkEmail, checkDomainDns, emailErrorMessage, type DnsLike } from "@/lib/data-quality/email";
import { DISPOSABLE_LIST, isDisposableDomain } from "@/lib/data-quality/disposableDomains";
import { isValidEmailSyntax, normalizeEmail } from "@/lib/validation/email";
import { suggestionEmail } from "@/lib/validation/emailSuggestion";

const err = (code: string) => Object.assign(new Error(code), { code });

/** Faux DNS déclaratif : MX, A, AAAA par nom ; "nx" = domaine inexistant, "fail" = panne */
type Zone = { mx?: string[] | "nx" | "fail"; a?: string[] | "nx"; aaaa?: string[] };
function fakeDns(zones: Record<string, Zone>): DnsLike {
  const z = (d: string) => zones[d];
  return {
    async resolveMx(d) {
      const mx = z(d)?.mx;
      if (mx === "nx" || !z(d)) throw err("ENOTFOUND");
      if (mx === "fail") throw err("ESERVFAIL");
      if (!mx || mx.length === 0) throw err("ENODATA");
      return mx.map((exchange, i) => ({ exchange, priority: 10 * (i + 1) }));
    },
    async resolve4(d) {
      const a = z(d)?.a;
      if (!z(d) || a === "nx") throw err("ENOTFOUND");
      if (!a?.length) throw err("ENODATA");
      return a;
    },
    async resolve6(d) {
      if (!z(d)) throw err("ENOTFOUND");
      if (!z(d)?.aaaa?.length) throw err("ENODATA");
      return z(d)!.aaaa!;
    },
  };
}

test("normalisation : trim + minuscules", () => {
  assert.equal(normalizeEmail("  Jean.Dupont@Cabinet.FR "), "jean.dupont@cabinet.fr");
});

test("syntaxe", () => {
  for (const ok of ["a.b@c.fr", "jean+guide@cabinet-dupont.fr", "x_y@sub.domaine.co.uk"]) {
    assert.ok(isValidEmailSyntax(ok), ok);
  }
  for (const ko of ["abc", "a@b", "a@@b.fr", "a..b@c.fr", ".a@c.fr", "a@-c.fr", "a@c.f", "a b@c.fr", "a@c.123"]) {
    assert.ok(!isValidEmailSyntax(ko), ko);
  }
});

test("valeurs manifestement factices → INVALID", async () => {
  for (const e of ["test@test.com", "fake@fake.com", "abc@abc.com", "email@email.com", "jean@example.com", "test@gmail.com"]) {
    const r = await checkEmail(e, { skipDns: true });
    assert.equal(r.accepted, false, e);
    assert.equal(r.status, "INVALID", e);
  }
});

test("pas de rejet sur le seul nom d'une vraie boîte", async () => {
  const r = await checkEmail("azerty123@gmail.com", { skipDns: true });
  assert.equal(r.accepted, true);
  assert.equal(r.status, "PENDING");
});

test("jetables → DISPOSABLE, message dédié, sans détail technique", async () => {
  for (const e of ["x@yopmail.com", "x@mailinator.com", "x@sub.yopmail.fr"]) {
    const r = await checkEmail(e, { skipDns: true });
    assert.equal(r.status, "DISPOSABLE", e);
    assert.equal(emailErrorMessage(r), "Merci d’utiliser une adresse email personnelle ou professionnelle valide.");
  }
});

test("capacité de réception : MX joignable, MX implicite, NXDOMAIN, MX nul, MX cassés, panne", async () => {
  const dns = fakeDns({
    "cabinet.fr": { mx: ["mx1.cabinet.fr"] },
    "mx1.cabinet.fr": { a: ["203.0.113.10"] },
    // pas de MX mais une adresse : MX implicite RFC 5321 → accepté (pas de règle « sans MX = invalide »)
    "siteweb-sans-mx.fr": { a: ["203.0.113.20"] },
    // pas de MX ni d'adresse
    "parking.fr": {},
    // MX nul RFC 7505
    "refuse.fr": { mx: ["."] },
    // MX vers des noms inexistants
    "mx-casse.fr": { mx: ["mail.inexistant-xyz.fr"] },
    // MX vers la boucle locale
    "mx-local.fr": { mx: ["localhost.mx-local.fr"] },
    "localhost.mx-local.fr": { a: ["127.0.0.1"] },
    // un MX cassé + un MX joignable → accepté
    "mixte.fr": { mx: ["mort.mixte.fr", "vivant.mixte.fr"] },
    "mort.mixte.fr": { a: "nx" },
    "vivant.mixte.fr": { aaaa: ["2001:db8::25"] },
    "panne.fr": { mx: "fail" },
  });
  assert.equal(await checkDomainDns("cabinet.fr", dns), "ok");
  assert.equal(await checkDomainDns("siteweb-sans-mx.fr", dns), "ok_implicit_mx");
  assert.equal(await checkDomainDns("mixte.fr", dns), "ok");

  const inexistant = await checkEmail("abc@domainetotalementinexistant-althoce-test.fr", { dns });
  assert.equal(inexistant.accepted, false);
  assert.equal(inexistant.reason, "domain_not_found");
  assert.equal(emailErrorMessage(inexistant), "Veuillez vérifier votre adresse email.");

  for (const d of ["parking.fr", "refuse.fr", "mx-casse.fr", "mx-local.fr"]) {
    assert.equal((await checkEmail(`a@${d}`, { dns })).reason, "no_mail_server", d);
  }

  // panne DNS : on ne peut pas conclure → accepté en PENDING (fail-open documenté)
  const panne = await checkEmail("a@panne.fr", { dns });
  assert.equal(panne.accepted, true);
  assert.equal(panne.status, "PENDING");
});

test("DNS trop lent : budget de 4 s, puis fail-open", async () => {
  const slow: DnsLike = {
    resolveMx: () => new Promise(() => {}),
    resolve4: () => new Promise(() => {}),
    resolve6: () => new Promise(() => {}),
  };
  const t0 = Date.now();
  assert.equal(await checkDomainDns("lent-unique.fr", slow), "dns_unavailable");
  assert.ok(Date.now() - t0 < 4500);
});

test("domaine accentué converti en punycode, pas rejeté", () => {
  assert.equal(normalizeEmail("Jean@Société.fr"), "jean@xn--socit-esab.fr");
  assert.ok(isValidEmailSyntax(normalizeEmail("jean@société.fr")));
});

test("liste jetable : module dédié chargé depuis le fichier", () => {
  assert.equal(DISPOSABLE_LIST.source, "fichier");
  assert.ok(DISPOSABLE_LIST.domains.size > 9000);
  assert.equal(isDisposableDomain("gmail.com"), false);
  assert.equal(isDisposableDomain("althoce.com"), false);
});

test("suggestion de typo conservée (aide de saisie, non bloquante)", () => {
  assert.equal(suggestionEmail("jean@gmial.com"), "jean@gmail.com");
  assert.equal(suggestionEmail("jean@gpail.com"), "jean@gmail.com");
  assert.equal(suggestionEmail("jean@gmail.com"), null);
});
