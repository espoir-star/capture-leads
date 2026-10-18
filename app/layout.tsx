import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import CookieConsent from "@/components/CookieConsent";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const space = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space",
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
    <html lang="fr" className={`${inter.variable} ${space.variable}`}>
      <body>
        {/* GA4, Meta Pixel, tracker Brevo : chargés seulement après « Tout accepter » (components/CookieConsent.tsx) */}
        {children}
        <CookieConsent />
      </body>
    </html>
  );
}
