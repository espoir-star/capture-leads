"use client";

import { useState } from "react";

/** Confirmation d'adresse uniquement : les préférences marketing sont indépendantes. */
export default function ConfirmEmail({ token, maskedEmail }: { token: string; maskedEmail: string }) {
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function confirm() {
    if (state === "sending") return;
    setState("sending");
    setMessage(null);
    try {
      const res = await fetch("/api/email/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ t: token }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message ?? "Confirmation impossible. Réessayez.");
      setState("done");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Confirmation impossible. Réessayez.");
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <>
        <h1 className="mt-6 font-display text-2xl font-bold leading-snug">
          Adresse <span className="text-accent">confirmée</span>
        </h1>
        <p className="mt-3 text-secondaire leading-relaxed">
          Merci, votre adresse {maskedEmail} est confirmée.

        </p>
      </>
    );
  }

  return (
    <>
      <h1 className="mt-6 font-display text-2xl font-bold leading-snug">Confirmer votre adresse</h1>
      <p className="mt-3 text-secondaire leading-relaxed">
        Confirmez que l&apos;adresse {maskedEmail} vous appartient.
      </p>
      {message && (
        <p role="alert" className="mt-3 text-sm text-red-400">
          {message}
        </p>
      )}
      <button
        type="button"
        onClick={confirm}
        disabled={state === "sending"}
        className="mt-5 w-full rounded-lg bg-accent px-6 py-4 font-semibold text-white hover:bg-accent-clair active:scale-[0.99] transition disabled:opacity-60"
      >
        {state === "sending" ? "Confirmation…" : "Confirmer mon adresse"}
      </button>
    </>
  );
}
