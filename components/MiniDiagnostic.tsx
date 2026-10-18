"use client";
/**
 * Mini-diagnostic IA interactif. Tout reste dans l'état local du navigateur :
 * aucun envoi (Brevo, CRM, analytics), aucun stockage. La feuille de route se conserve
 * en la copiant, en l'imprimant (PDF) ou en l'ouvrant dans la messagerie du visiteur.
 */
import { useState, type KeyboardEvent, type ReactNode } from "react";
import CopyDashboardPrompt from "@/components/CopyDashboardPrompt";
import {
  MINI_DIAGNOSTIC as d, MAX_SCORE, band, caseFor, ranking, roadmapSummary, score,
  type CriterionId, type DiagnosticCase, type Ratings,
} from "@/content/guides/mini-diagnostic-ia-finance";

type Task = { name: string; ratings: Ratings };
const EMPTY: Task[] = [{ name: "", ratings: {} }, { name: "", ratings: {} }, { name: "", ratings: {} }];
const ROADMAP_FIELDS = ["data", "validator", "indicator"] as const;

function goTo(id: string) {
  const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.getElementById(id)?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
}

function Step({ n, title, children, id }: { n: number; title: string; children: ReactNode; id: string }) {
  return (
    <section id={id} className="mt-14 scroll-mt-20 print:hidden">
      <p className="text-xs font-bold tracking-widest text-[#51D9AA]">ÉTAPE {n}</p>
      <h2 className="mt-2 text-2xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function NextButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="mt-5 inline-flex rounded-lg border border-[#2D7A55] bg-[#11251A] px-4 py-2.5 text-sm font-semibold text-[#BFF0D6] hover:border-[#51D9AA] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#51D9AA]">
      {children}
    </button>
  );
}

export default function MiniDiagnostic() {
  const [tasks, setTasks] = useState<Task[]>(EMPTY);
  const [roadmap, setRoadmap] = useState<Record<string, string>>({});
  const [active, setActive] = useState(0);

  const named = tasks.map((t, index) => ({ ...t, index })).filter((t) => t.name.trim());
  const ranked = ranking(named);
  const best = ranked[0] ?? null;
  const current = named.find((t) => t.index === active) ?? named[0] ?? null;

  const answer = (id: string) => roadmap[id] ?? (id === "process" ? best?.name.trim() ?? "" : "");
  const answers = Object.fromEntries(d.roadmap.map((q) => [q.id, answer(q.id)]));
  const filled = d.roadmap.filter((q) => answer(q.id).trim()).length;
  const summary = roadmapSummary(named, answers);
  const suggestion = caseFor(answer("process"));
  const missingSuggestions = suggestion ? ROADMAP_FIELDS.filter((f) => !answer(f).trim()) : [];
  // Champs pré-remplis par un autre cas et jamais retouchés : on peut les remplacer sans écraser une saisie.
  const otherCaseSuggestions = !!suggestion && !missingSuggestions.length &&
    ROADMAP_FIELDS.every((f) => d.cases.some((c) => c.suggestions[f] === answer(f))) &&
    ROADMAP_FIELDS.some((f) => answer(f) !== suggestion.suggestions[f]);

  // Effacer entièrement un nom remet ses notes à zéro ; corriger une faute de frappe les garde.
  const setName = (i: number, name: string) =>
    setTasks((all) => all.map((t, k) => (k === i ? { name, ratings: name.trim() ? t.ratings : {} } : t)));
  const toggleExample = (example: string) =>
    setTasks((all) => {
      const used = all.findIndex((t) => t.name.trim() === example);
      if (used >= 0) return all.map((t, k) => (k === used ? { name: "", ratings: {} } : t));
      const free = all.findIndex((t) => !t.name.trim());
      return free < 0 ? all : all.map((t, k) => (k === free ? { ...t, name: example } : t));
    });
  const rate = (i: number, id: CriterionId, value: 1 | 2 | 3) =>
    setTasks((all) => all.map((t, k) => (k === i ? { ...t, ratings: { ...t.ratings, [id]: value } } : t)));
  const applyCase = (c: DiagnosticCase) => {
    const own = named.find((t) => t.name.trim() === c.example);
    setRoadmap((r) => ({ ...r, process: own?.name.trim() ?? c.example, ...c.suggestions }));
    goTo("feuille-de-route");
  };
  const fillSuggestions = () => {
    if (!suggestion) return;
    const fields = otherCaseSuggestions ? ROADMAP_FIELDS : missingSuggestions;
    setRoadmap((r) => ({ ...r, ...Object.fromEntries(fields.map((f) => [f, suggestion.suggestions[f]])) }));
  };
  const reset = () => {
    if (!window.confirm("Effacer toutes vos réponses et recommencer ?")) return;
    setTasks(EMPTY);
    setRoadmap({});
    setActive(0);
    goTo("taches");
  };
  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const pos = named.findIndex((t) => t.index === current?.index);
    const next = named[(pos + (e.key === "ArrowRight" ? 1 : named.length - 1)) % named.length];
    setActive(next.index);
    document.getElementById(`onglet-${next.index}`)?.focus();
  };

  const nextToRate = current ? named.find((t) => t.index !== current.index && score(t.ratings) === null) : undefined;
  const mailto = `mailto:?subject=${encodeURIComponent("Ma feuille de route IA (mini-diagnostic Althoce)")}&body=${encodeURIComponent(summary.replace(/\n/g, "\r\n"))}`;
  const progress = [
    { id: "taches", label: "Tâches", status: `${named.length}/3`, done: named.length > 0 },
    { id: "potentiel", label: "Notes", status: named.length ? `${ranked.length}/${named.length}` : "", done: named.length > 0 && ranked.length === named.length },
    { id: "cas", label: "Cas", status: "", done: false },
    { id: "feuille-de-route", label: "Feuille de route", status: `${filled}/4`, done: filled === d.roadmap.length },
  ];

  return (
    <div>
      {/* Impression : seule la feuille de route sort, en noir sur blanc (bandeau cookies masqué). */}
      <style>{"@media print{html,body{background:#fff!important}body>:not(main){display:none!important}}"}</style>

      <nav aria-label="Progression" className="sticky top-0 z-20 -mx-5 mt-6 border-b border-[#1F2D23] bg-[#0A0A0A]/95 px-5 py-2.5 backdrop-blur sm:-mx-8 sm:px-8 print:hidden">
        <ol className="flex gap-1 overflow-x-auto text-[11px] [scrollbar-width:none] sm:gap-2 sm:text-xs">
          {progress.map((s, i) => (
            <li key={s.id} className="shrink-0">
              <a href={`#${s.id}`} className={`flex items-center gap-1 rounded-full border px-2 py-1 sm:px-2.5 ${s.done ? "border-[#2D7A55] bg-[#11251A] text-[#BFF0D6]" : "border-[#2B4233] text-[#A9BBAE] hover:border-[#51D9AA] hover:text-white"}`}>
                <span aria-hidden="true" className={s.done ? "" : "hidden sm:inline"}>{s.done ? "✓" : `${i + 1}.`}</span> {s.label}
                {s.status && <span className={s.done ? "hidden text-[#7FA08B] sm:inline" : "text-[#7FA08B]"}>{s.status}</span>}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <p className="mt-6 rounded-lg border border-[#2D4335] bg-[#0E150F] px-4 py-3 text-xs leading-5 text-[#B6CDBB] print:hidden">
        Vos réponses restent dans votre navigateur : rien n’est enregistré ni transmis. À l’étape 4, copiez, imprimez ou envoyez-vous votre feuille de route pour la conserver.
      </p>

      <Step n={1} id="taches" title="Identifiez trois tâches chronophages">
        <p className="mt-3 text-sm leading-7 text-[#C5D1C9]">Pensez à votre dernier mois : quelles tâches reviennent souvent, prennent du temps et suivent à peu près les mêmes étapes ?</p>
        <p className="mt-4 text-xs font-semibold text-[#96B09E]">Ajoutez un exemple en un clic, ou décrivez vos propres tâches :</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {d.examples.map((example) => {
            const used = tasks.some((t) => t.name.trim() === example);
            return (
              <button key={example} type="button" aria-pressed={used} onClick={() => toggleExample(example)} className={`rounded-full border px-3 py-1.5 text-left text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#51D9AA] ${used ? "border-[#51D9AA] bg-[#173322] text-white" : "border-[#2D5A41] text-[#C7E8D6] hover:border-[#51D9AA] hover:text-white"}`}>
                <span aria-hidden="true">{used ? "✓" : "+"}</span> {example}
              </button>
            );
          })}
        </div>
        <div className="mt-5 space-y-3">
          {tasks.map((t, i) => (
            <div key={i}>
              <label htmlFor={`tache-${i}`} className="text-xs font-semibold text-[#96B09E]">Tâche {i + 1}</label>
              <div className="relative mt-1">
                <input id={`tache-${i}`} value={t.name} onChange={(e) => setName(i, e.target.value)} maxLength={120} placeholder="Ex. : relances clients, rapprochements bancaires…" className="w-full rounded-lg border border-[#2B4233] bg-[#111711] py-3 pl-4 pr-11 text-sm text-white placeholder:text-[#5F7566] focus:border-[#51D9AA] focus:outline-none" />
                {t.name && (
                  <button type="button" onClick={() => setName(i, "")} aria-label={`Effacer la tâche ${i + 1}`} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-lg leading-none text-[#8FA597] hover:bg-[#1A261D] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#51D9AA]">×</button>
                )}
              </div>
            </div>
          ))}
        </div>
        {named.length > 0 && <NextButton onClick={() => goTo("potentiel")}>Noter {named.length > 1 ? `mes ${named.length} tâches` : "ma tâche"} →</NextButton>}
      </Step>

      <Step n={2} id="potentiel" title="Évaluez leur potentiel IA">
        <p className="mt-3 text-sm leading-7 text-[#C5D1C9]">Notez chaque tâche de 1 à 3 sur quatre critères. Le score sur {MAX_SCORE} est la somme des quatre notes : plus il est élevé, plus la tâche se prête à un premier test simple.</p>
        <p className="mt-2 text-xs leading-5 text-[#96B09E]">Ce score aide à choisir par où commencer. Ce n’est ni une estimation de gains, ni un diagnostic professionnel. À égalité, la tâche la plus facile à contrôler passe en premier.</p>
        {!current ? (
          <p className="mt-6 rounded-xl border border-dashed border-[#2B4233] p-5 text-sm text-[#96B09E]">
            Nommez au moins une tâche à l’étape 1 pour l’évaluer.{" "}
            <button type="button" onClick={() => goTo("taches")} className="font-semibold text-[#51D9AA] underline underline-offset-4">Revenir à l’étape 1</button>
          </p>
        ) : (
          <div className="mt-6 overflow-hidden rounded-xl border border-[#2B4233] bg-[#111711]">
            <div role="tablist" aria-label="Tâches à noter" className="flex border-b border-[#2B4233]">
              {named.map((t) => {
                const total = score(t.ratings);
                const selected = t.index === current.index;
                return (
                  <button key={t.index} type="button" role="tab" id={`onglet-${t.index}`} aria-selected={selected} aria-controls="panneau-notes" tabIndex={selected ? 0 : -1} onClick={() => setActive(t.index)} onKeyDown={onTabKey} className={`min-w-0 flex-1 border-b-2 px-3 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#51D9AA] sm:px-4 ${selected ? "border-[#51D9AA] bg-[#142219]" : "border-transparent hover:bg-[#141C16]"}`}>
                    <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#7FA08B]">Tâche {t.index + 1}</span>
                    <span className="mt-0.5 line-clamp-2 break-words text-[13px] font-semibold leading-snug text-white sm:line-clamp-1 sm:text-sm" title={t.name}>{t.name}</span>
                    <span className={`mt-0.5 block text-xs ${total !== null ? "text-[#51D9AA]" : "text-[#8FA597]"}`}>{total !== null ? `✓ ${total}/${MAX_SCORE}` : `${Object.keys(t.ratings).length}/4 critères`}</span>
                  </button>
                );
              })}
            </div>
            <div role="tabpanel" id="panneau-notes" aria-labelledby={`onglet-${current.index}`} className="p-4 sm:p-5">
              <div className="space-y-5">
                {d.criteria.map((c) => (
                  <fieldset key={c.id}>
                    <legend className="text-sm text-[#DAE6DC]"><strong>{c.label}</strong> <span className="text-[#96B09E]">— {c.question}</span></legend>
                    <div className="mt-2 grid gap-2 sm:grid-cols-3">
                      {c.levels.map((level, k) => {
                        const value = (k + 1) as 1 | 2 | 3;
                        const checked = current.ratings[c.id] === value;
                        return (
                          <label key={level} className={`relative flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 text-xs leading-5 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[#51D9AA] ${checked ? "border-[#51D9AA] bg-[#173322] text-white" : "border-[#2B4233] text-[#B6C6BA] hover:border-[#3E6B52]"}`}>
                            <input type="radio" name={`t${current.index}-${c.id}`} checked={checked} onChange={() => rate(current.index, c.id, value)} className="sr-only" />
                            <span aria-hidden="true" className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold ${checked ? "border-[#51D9AA] bg-[#51D9AA] text-[#081D12]" : "border-[#3E5A47] text-[#A9BBAE]"}`}>{value}</span>
                            <span><span className="sr-only">Note {value} : </span>{level}</span>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                ))}
              </div>
              {score(current.ratings) !== null && (
                <div className="mt-5 rounded-lg border border-[#2D5A41] bg-[#0F1F16] p-4" aria-live="polite">
                  <p className="text-sm"><strong className="text-white">{score(current.ratings)} / {MAX_SCORE}</strong> · {band(score(current.ratings)!).label}</p>
                  <p className="mt-1 text-xs leading-5 text-[#A9B9AB]">{band(score(current.ratings)!).detail}</p>
                  {nextToRate ? (
                    <NextButton onClick={() => setActive(nextToRate.index)}>Noter la tâche {nextToRate.index + 1} →</NextButton>
                  ) : (
                    <NextButton onClick={() => goTo("cas")}>Voir les cas concrets →</NextButton>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
        {ranked.length > 0 && (
          <div className="mt-6 rounded-xl border border-[#346B4E] bg-[#0F1F16] p-5">
            <p className="text-xs font-bold tracking-widest text-[#51D9AA]">CLASSEMENT</p>
            <ol className="mt-3 space-y-4">
              {ranked.map((t, i) => {
                const total = score(t.ratings)!;
                return (
                  <li key={t.index}>
                    <div className="flex items-start justify-between gap-3 text-sm">
                      <p className="min-w-0 break-words">
                        <strong className="text-white">{i + 1}. {t.name}</strong>
                        {i === 0 && <span className="ml-2 inline-block rounded-full bg-[#1D9E75] px-2 py-0.5 align-middle text-[10px] font-bold tracking-wide text-[#081D12]">PREMIER CANDIDAT</span>}
                      </p>
                      <span className="shrink-0 font-semibold text-white">{total}/{MAX_SCORE}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-[#1E2E23]"><div className="h-1.5 rounded-full bg-[#51D9AA]" style={{ width: `${(total / MAX_SCORE) * 100}%` }} /></div>
                    <p className="mt-1 text-xs text-[#A9B9AB]">{band(total).label}</p>
                  </li>
                );
              })}
            </ol>
            {named.length > ranked.length && (
              <p className="mt-4 text-xs text-[#8FA597]">{named.length - ranked.length === 1 ? "Une tâche reste" : `${named.length - ranked.length} tâches restent`} à noter.</p>
            )}
          </div>
        )}
      </Step>

      <Step n={3} id="cas" title="Trois cas concrets">
        <p className="mt-3 text-sm leading-7 text-[#C5D1C9]">Aucune connexion n’est automatique : chaque cas suppose des outils compatibles, des accès autorisés et des données de qualité. Un cas vous parle ? Il pré-remplit votre feuille de route.</p>
        <div className="mt-6 grid gap-4">
          {d.cases.map((c, i) => {
            const own = named.find((t) => t.name.trim() === c.example);
            const isBest = !!best && best.name.trim() === c.example;
            return (
              <article key={c.title} className={`rounded-xl border p-5 ${isBest ? "border-[#51D9AA] bg-[#11251A]" : "border-[#2B4233] bg-[#111711]"}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-[#51D9AA]">0{i + 1}</span>
                  {own && <span className="rounded-full border border-[#2D7A55] px-2 py-0.5 text-[10px] font-semibold text-[#BFF0D6]">{isBest ? "Votre premier candidat" : `Votre tâche ${own.index + 1}`}</span>}
                </div>
                <h3 className="mt-1 text-lg font-semibold">{c.title}</h3>
                <dl className="mt-3 space-y-2 text-sm leading-6">
                  <div><dt className="inline font-semibold text-white">Ce que l’IA peut préparer : </dt><dd className="inline text-[#B6C6BA]">{c.ai}</dd></div>
                  <div><dt className="inline font-semibold text-white">Prérequis : </dt><dd className="inline text-[#B6C6BA]">{c.prerequisites}</dd></div>
                  <div><dt className="inline font-semibold text-white">Ce qui reste humain : </dt><dd className="inline text-[#B6C6BA]">{c.human}</dd></div>
                </dl>
                <button type="button" onClick={() => applyCase(c)} className="mt-4 text-sm font-semibold text-[#51D9AA] underline underline-offset-4 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#51D9AA]">
                  Pré-remplir ma feuille de route avec ce cas →
                </button>
              </article>
            );
          })}
        </div>
      </Step>

      <section id="feuille-de-route" className="mt-14 scroll-mt-20 print:mt-0">
        <div className="print:hidden">
          <p className="text-xs font-bold tracking-widest text-[#51D9AA]">ÉTAPE 4</p>
          <h2 className="mt-2 text-2xl font-semibold">Votre première feuille de route</h2>
          <p className="mt-3 text-sm leading-7 text-[#C5D1C9]">Répondez à ces quatre questions : vous repartez avec un pilote clair.</p>
          <div className="mt-5 space-y-4">
            {d.roadmap.map((q) => (
              <div key={q.id}>
                <label htmlFor={`fr-${q.id}`} className="text-sm font-semibold text-white">{q.question}</label>
                {q.id === "process" && ranked.length > 1 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {ranked.map((t, i) => {
                      const chosen = answer("process").trim() === t.name.trim();
                      return (
                        <button key={t.index} type="button" aria-pressed={chosen} onClick={() => setRoadmap((r) => ({ ...r, process: t.name.trim() }))} className={`rounded-full border px-3 py-1 text-left text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#51D9AA] ${chosen ? "border-[#51D9AA] bg-[#173322] text-white" : "border-[#2B4233] text-[#B6C6BA] hover:border-[#51D9AA]"}`}>
                          {i + 1}. {t.name.trim()} · {score(t.ratings)}/{MAX_SCORE}
                        </button>
                      );
                    })}
                  </div>
                )}
                {q.id === "process" ? (
                  <input id={`fr-${q.id}`} value={answer(q.id)} onChange={(e) => setRoadmap((r) => ({ ...r, [q.id]: e.target.value }))} maxLength={200} placeholder={q.hint} className="mt-2 w-full rounded-lg border border-[#2B4233] bg-[#111711] px-4 py-3 text-sm text-white placeholder:text-[#5F7566] focus:border-[#51D9AA] focus:outline-none" />
                ) : (
                  // Plusieurs lignes : les suggestions restent lisibles en entier sur mobile.
                  <textarea id={`fr-${q.id}`} value={answer(q.id)} onChange={(e) => setRoadmap((r) => ({ ...r, [q.id]: e.target.value }))} maxLength={200} rows={2} placeholder={q.hint} className="mt-2 block max-h-40 w-full resize-none rounded-lg border border-[#2B4233] bg-[#111711] px-4 py-3 text-sm leading-6 text-white [field-sizing:content] placeholder:text-[#5F7566] focus:border-[#51D9AA] focus:outline-none" />
                )}
                {q.id === "process" && suggestion && (missingSuggestions.length > 0 || otherCaseSuggestions) && (
                  <div className="mt-3 flex flex-col gap-3 rounded-lg border border-[#2D5A41] bg-[#0F1F16] p-3 text-xs leading-5 text-[#C5D8CB] sm:flex-row sm:items-center sm:justify-between">
                    <p>Suggestions disponibles pour ce processus (cas « {suggestion.title} ») : données, validation et indicateur.</p>
                    <button type="button" onClick={fillSuggestions} className="shrink-0 rounded-lg border border-[#2D7A55] px-3 py-1.5 font-semibold text-[#BFF0D6] hover:border-[#51D9AA] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#51D9AA]">
                      {otherCaseSuggestions ? "Utiliser ces suggestions" : "Pré-remplir les champs vides"}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        <div id="feuille-de-route-imprimable" className="mt-5 rounded-lg border border-[#2D4335] bg-[#090E0A] p-4 print:mt-0 print:border-0 print:bg-white print:p-0">
          <p className="mb-4 hidden text-[10pt] text-black print:block">Althoce · Cabinet de conseil &amp; intégration IA · Le partenaire IA des professions réglementées</p>
          <p className="whitespace-pre-wrap break-words text-[13px] leading-6 text-[#DAE6DC] print:text-[12pt] print:text-black">{summary}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#1F2D23] pt-4 print:hidden">
            <CopyDashboardPrompt text={summary} label="Copier ma feuille de route" />
            <a href={mailto} className="rounded-lg border border-[#2D7A55] px-4 py-2.5 text-sm font-semibold text-[#BFF0D6] hover:border-[#51D9AA] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#51D9AA]">M’envoyer par email</a>
            <button type="button" onClick={() => window.print()} className="rounded-lg border border-[#2D7A55] px-4 py-2.5 text-sm font-semibold text-[#BFF0D6] hover:border-[#51D9AA] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#51D9AA]">Imprimer ou PDF</button>
            <button type="button" onClick={reset} className="ml-auto px-2 py-2.5 text-xs text-[#8FA597] underline underline-offset-4 hover:text-white">Tout recommencer</button>
          </div>
        </div>
      </section>
    </div>
  );
}
