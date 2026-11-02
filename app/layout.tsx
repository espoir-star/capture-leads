import type { Metadata } from "next";
import { preload } from "react-dom";
import "./globals.css";
import CookieConsent from "@/components/CookieConsent";

/*
 * Police commune (standard davinci) : Geist, nombres en chiffres tabulaires.
 * Auto-hébergée (règles @font-face dans app/globals.css) : la compilation ne
 * télécharge plus rien chez Google Fonts. Sous-ensembles latins préchargés,
 * comme le faisait next/font.
 */
const FONT_PRELOADS = ["/fonts/geist-v1/geist-latin.woff2", "/fonts/geist-v1/geist-mono-latin.woff2"];

export const metadata: Metadata = {
  title: "Ressources Althoce",
  description:
    "Althoce, cabinet de conseil & intégration IA : le partenaire IA des professions réglementées. Guides pratiques pour former vos équipes, sécuriser vos usages et automatiser vos processus métier.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  for (const href of FONT_PRELOADS) preload(href, { as: "font", type: "font/woff2", crossOrigin: "anonymous" });
  return (
    <html lang="fr">
      <body>
        {/* GA4, Meta Pixel, tracker Brevo : chargés seulement après « Tout accepter » (components/CookieConsent.tsx) */}
        {children}
        <CookieConsent />
      </body>
    </html>
  );
}
