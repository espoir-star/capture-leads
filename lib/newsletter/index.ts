/**
 * Newsletter-as-code : lecture d'un fichier content/newsletters/*.md
 * (frontmatter + Markdown) et rendu HTML email (template Althoce, styles
 * inline, UTM ajoutés sans doublon).
 *
 * Blocs spéciaux dans le Markdown :
 *   :::usecase Titre du cas d'usage      :::insight Titre de l'insight
 *   texte Markdown…                      texte Markdown…
 *   :::                                  :::
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import matter from "gray-matter";
import { Marked, type Tokens } from "marked";
import { z } from "zod";
import { AUDIENCES, CAMPAIGN_TAGS } from "@/config/newsletter";
import { addUtmToUrl, type Utm } from "@/lib/tracking/utm";

/* ── Frontmatter ─────────────────────────────────────────────────────── */

const ISO_WITH_TZ = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

export const frontmatterSchema = z.object({
  title: z.string().min(3).max(160),
  subject: z.string().min(3).max(200),
  previewText: z.string().max(200).default(""),
  scheduledAt: z
    .union([z.string(), z.date()])
    .transform((v) => (v instanceof Date ? v.toISOString() : v))
    .pipe(z.string().regex(ISO_WITH_TZ, "date ISO avec fuseau, ex. 2026-11-03T08:30:00+01:00"))
    .optional(),
  audience: z.string().refine((a) => a in AUDIENCES, "audience inconnue (config/newsletter.ts)"),
  tag: z.enum(CAMPAIGN_TAGS),
  utmCampaign: z.string().regex(/^[a-z0-9_]{3,80}$/, "minuscules, chiffres et _ uniquement"),
  utmContent: z.string().regex(/^[\w.-]{1,60}$/).optional(),
  status: z.enum(["draft", "ready", "created", "scheduled"]),
  cta: z.object({ label: z.string().min(2).max(60), url: z.string().url() }).optional(),
  signature: z.string().max(300).optional(),
  brevoCampaignId: z.number().int().positive().optional(),
});

export type NewsletterFrontmatter = z.infer<typeof frontmatterSchema>;

export interface Newsletter {
  file: string;
  /** Nom de campagne Brevo : identifiant unique dérivé du nom de fichier */
  name: string;
  meta: NewsletterFrontmatter;
  body: string;
}

export function loadNewsletter(path: string): Newsletter {
  const file = resolve(process.cwd(), path);
  const { data, content } = matter(readFileSync(file, "utf8"));
  const parsed = frontmatterSchema.safeParse(data);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")} : ${i.message}`).join("\n");
    throw new Error(`Frontmatter invalide dans ${path} :\n${issues}`);
  }
  const base = file.split("/").pop()!.replace(/\.md$/, "");
  return { file, name: `NL ${base}`, meta: parsed.data, body: content };
}

/* ── Rendu ───────────────────────────────────────────────────────────── */

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const P = "margin:16px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:26px;color:#2B2F2B;";
const H2 = "margin:28px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:19px;line-height:26px;font-weight:bold;color:#0A0A0A;";
const H3 = "margin:22px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:24px;font-weight:bold;color:#0A0A0A;";
const LINK = "color:#157A5B;text-decoration:underline;";

function createMarked(utm: Utm) {
  const m = new Marked({ gfm: true, breaks: false });
  m.use({
    renderer: {
      heading({ tokens, depth }: Tokens.Heading) {
        const text = this.parser.parseInline(tokens);
        return depth <= 2 ? `<h2 style="${H2}">${text}</h2>` : `<h3 style="${H3}">${text}</h3>`;
      },
      paragraph({ tokens }: Tokens.Paragraph) {
        return `<p style="${P}">${this.parser.parseInline(tokens)}</p>`;
      },
      link({ href, title, tokens }: Tokens.Link) {
        const url = esc(addUtmToUrl(href, utm));
        const t = title ? ` title="${esc(title)}"` : "";
        return `<a href="${url}"${t} target="_blank" style="${LINK}">${this.parser.parseInline(tokens)}</a>`;
      },
      list(token: Tokens.List) {
        const tag = token.ordered ? "ol" : "ul";
        const items = token.items
          .map(
            (it) =>
              `<li style="margin:8px 0 0;padding-left:4px;">${this.parser.parse(it.tokens).replace(/^<p style="[^"]*">|<\/p>$/g, "")}</li>`
          )
          .join("");
        return `<${tag} style="margin:14px 0 0;padding-left:22px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:25px;color:#2B2F2B;">${items}</${tag}>`;
      },
      strong({ tokens }: Tokens.Strong) {
        return `<strong style="color:#0A0A0A;">${this.parser.parseInline(tokens)}</strong>`;
      },
      blockquote({ tokens }: Tokens.Blockquote) {
        return `<div style="margin:18px 0 0;padding:2px 0 2px 16px;border-left:3px solid #1D9E75;">${this.parser.parse(tokens)}</div>`;
      },
      hr() {
        return `<hr style="margin:28px 0 0;border:0;border-top:1px solid #E3E6E2;" />`;
      },
      image({ href, text }: Tokens.Image) {
        return `<img src="${esc(href)}" alt="${esc(text)}" width="520" style="display:block;width:100%;max-width:520px;height:auto;margin:18px 0 0;border:0;border-radius:8px;" />`;
      },
      codespan({ text }: Tokens.Codespan) {
        return `<code style="font-family:Menlo,Consolas,monospace;font-size:14px;background:#F3F4F2;padding:1px 5px;border-radius:4px;">${text}</code>`;
      },
      html() {
        return ""; // pas de HTML brut dans le Markdown : le template reste maîtrisé
      },
    },
  });
  return m;
}

const BLOCK = /^:::(usecase|insight)[ \t]*(.*)\n([\s\S]*?)\n:::[ \t]*$/gm;

function renderBlock(kind: "usecase" | "insight", title: string, innerHtml: string): string {
  const label = kind === "usecase" ? "CAS D’USAGE" : "INSIGHT";
  const bg = kind === "usecase" ? "#F1F8F5" : "#F6F6F4";
  const border = kind === "usecase" ? "#BFE3D5" : "#E3E6E2";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 0;background-color:${bg};border:1px solid ${border};border-radius:10px;">
<tr><td style="padding:18px 20px 20px;">
<p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:16px;font-weight:bold;letter-spacing:1px;color:#157A5B;">${label}</p>
${title ? `<p style="margin:6px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:17px;line-height:24px;font-weight:bold;color:#0A0A0A;">${esc(title)}</p>` : ""}
${innerHtml.replace("margin:16px 0 0", "margin:8px 0 0")}
</td></tr></table>`;
}

export function renderMarkdown(body: string, utm: Utm): string {
  const marked = createMarked(utm);
  const parts: string[] = [];
  let last = 0;
  for (const m of body.matchAll(BLOCK)) {
    parts.push(marked.parse(body.slice(last, m.index), { async: false }) as string);
    const inner = marked.parse(m[3], { async: false }) as string;
    parts.push(renderBlock(m[1] as "usecase" | "insight", m[2].trim(), inner));
    last = m.index! + m[0].length;
  }
  parts.push(marked.parse(body.slice(last), { async: false }) as string);
  return parts.join("\n").replace(/^\s*<p style="margin:16px 0 0;/, '<p style="margin:12px 0 0;');
}

export function campaignUtm(meta: NewsletterFrontmatter): Utm {
  return {
    utm_source: "brevo",
    utm_medium: "email",
    utm_campaign: meta.utmCampaign,
    ...(meta.utmContent && { utm_content: meta.utmContent }),
  };
}

const TEMPLATE_PATH = "emails/templates/newsletter.html";

export function renderNewsletterHtml(nl: Newsletter, templatePath = TEMPLATE_PATH): string {
  const template = readFileSync(resolve(process.cwd(), templatePath), "utf8");
  const utm = campaignUtm(nl.meta);
  const cta = nl.meta.cta
    ? `<tr><td class="px" style="padding:30px 40px 0;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="background-color:#1D9E75;border-radius:8px;">
<a href="${esc(addUtmToUrl(nl.meta.cta.url, { ...utm, utm_content: utm.utm_content ?? "cta" }))}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;color:#FFFFFF;text-decoration:none;">${esc(nl.meta.cta.label)}</a>
</td></tr></table></td></tr>`
    : "";
  const signature = esc(nl.meta.signature ?? "Espoir Mwami\nAlthoce").replace(/\n/g, "<br />");

  return template
    .replace(/<!--[\s\S]*?-->\n?/, "") // commentaire d'en-tête du template
    .replaceAll("%%TITLE%%", esc(nl.meta.title))
    .replaceAll("%%PREVIEW_TEXT%%", esc(nl.meta.previewText))
    .replace("%%CONTENT%%", renderMarkdown(nl.body, utm))
    .replace("%%CTA%%", cta)
    .replace("%%SIGNATURE%%", signature);
}
