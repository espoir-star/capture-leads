import type { Metadata } from "next";
import MarketingUnsubscribe from "@/components/MarketingUnsubscribe";
import { readMarketingOptoutToken } from "@/lib/marketing/token";
export const metadata: Metadata = { title: "Se désinscrire — Althoce", robots: { index: false } };
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<{ t?: string | string[] }> }) {
  const raw = (await searchParams).t;
  const token = typeof raw === "string" && readMarketingOptoutToken(raw) ? raw : null;
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg rounded-2xl border border-bordure bg-carte p-6 sm:p-10">
        <p className="font-display text-lg font-semibold">Althoce<span className="text-accent">.</span></p>
        <h1 className="mt-6 text-2xl font-bold">Gérer mes emails</h1>
        {token ? <MarketingUnsubscribe token={token} /> :
          <p className="mt-4 text-secondaire">Ce lien n&apos;est pas valide. Contactez Althoce pour exercer votre opposition.</p>}
      </div>
    </main>
  );
}
