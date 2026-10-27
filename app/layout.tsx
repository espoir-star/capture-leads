import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import CookieConsent from "@/components/CookieConsent";

/* Police commune (standard davinci) : Geist, nombres en chiffres tabulaires. */
const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  weight: ["400", "500"],
  display: "swap",
});

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
  return (
    <html lang="fr" className={`${geist.variable} ${geistMono.variable}`}>
      <body>
        {/* GA4, Meta Pixel, tracker Brevo : chargés seulement après « Tout accepter » (components/CookieConsent.tsx) */}
        {children}
        <CookieConsent />
      </body>
    </html>
  );
}
