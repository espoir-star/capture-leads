"use client";
import { useState } from "react";
export default function MarketingUnsubscribe({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  async function unsubscribe() {
    setState("loading");
    try {
      const res = await fetch("/api/marketing/unsubscribe", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ t: token }),
      });
      setState(res.ok ? "done" : "error");
    } catch { setState("error"); }
  }
  return (
    <div className="mt-4 space-y-5">
      {state === "done" ? <p role="status" className="text-secondaire">Vous ne recevrez plus de newsletters ni de relances marketing d'Althoce.</p> :
      <>
        <p className="text-secondaire">Vous pouvez arrêter les emails marketing Althoce. Les guides demandés restent accessibles.</p>
        {state === "error" && <p role="alert" className="text-red-400">Erreur temporaire. Réessayez.</p>}
        <button type="button" onClick={unsubscribe} disabled={state === "loading"}
          className="rounded-lg bg-accent px-5 py-3 font-semibold text-white disabled:opacity-60">
          {state === "loading" ? "Traitement..." : "Confirmer ma désinscription"}
        </button>
      </>}
    </div>
  );
}
