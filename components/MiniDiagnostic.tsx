"use client";
/**
 * Mini-diagnostic IA interactif. Tout reste dans l'état local du navigateur :
 * aucun envoi (Brevo, CRM, analytics), aucun stockage. Copier sa feuille de route
 * est le seul moyen de la conserver.
 */
import { useState } from "react";
import CopyDashboardPrompt from "@/components/CopyDashboardPrompt";
import { MINI_DIAGNOSTIC as d, MAX_SCORE, band, bestCandidate, score, type CriterionId, type Ratings } from "@/content/guides/mini-diagnostic-ia-finance";

type Task = { name: string; ratings: Ratings };

function Step({ n, title, children, id }: { n: number; title: string; children: React.ReactNode; id: string }) {
  return (
    <section id={id} className="mt-14 scroll-mt-6">
      <p className="text-xs font-bold tracking-widest text-[#51D9AA]">ÉTAPE {n}</p>
      <h2 className="mt-2 text-2xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export default function MiniDiagnostic() {
  const [tasks, setTasks] = useState<Task[]>([{ name: "", ratings: {} }, { name: "", ratings: {} }, { name: "", ratings: {} }]);
  const [roadmap, setRoadmap] = useState<Record<string, string>>({});
  const best = bestCandidate(tasks);
  const named = tasks.map((t, i) => ({ ...t, index: i })).filter((t) => t.name.trim());

  const setName = (i: number, name: string) => setTasks((all) => all.map((t, k) => (k === i ? { ...t, name } : t)));
  const addExample = (example: string) =>
    setTasks((all) => {
      if (all.some((t) => t.name === example)) return all;
      const free = all.findIndex((t) => !t.name.trim());
      return free < 0 ? all : all.map((t, k) => (k === free ? { ...t, name: example } : t));
    });
  const rate = (i: number, id: CriterionId, value: 1 | 2 | 3) =>
    setTasks((all) => all.map((t, k) => (k === i ? { ...t, ratings: { ...t.ratings, [id]: value } } : t)));

  const answer = (id: string) => roadmap[id] ?? (id === "process" ? best?.name ?? "" : "");
  const summary = [
    "Mini-diagnostic IA — ma première feuille de route",
    ...d.roadmap.map((q) => `${q.short} : ${answer(q.id).trim() || "à compléter"}`),
    best ? `Score du processus retenu : ${score(best.ratings)}/${MAX_SCORE} (aide à la priorisation, pas une estimation).` : "",
  ].filter(Boolean).join("\n");

  return (
    <div>
      <p className="mt-8 rounded-lg border border-[#2D4335] bg-[#0E150F] px-4 py-3 text-xs leading-5 text-[#B6CDBB]">
        Vos réponses restent dans votre navigateur : rien n’est enregistré ni transmis. Copiez votre feuille de route à l’étape 4 pour la conserver.
      </p>

      <Step n={1} id="taches" title="Identifiez trois tâches chronophages">
        <p className="mt-3 text-sm leading-7 text-[#C5D1C9]">Pensez à votre dernier mois : quelles tâches reviennent souvent, prennent du temps et suivent à peu près les mêmes étapes ?</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {d.examples.map((example) => (
            <button key={example} type="button" onClick={() => addExample(example)} className="rounded-full border border-[#2D5A41] px-3 py-1.5 text-left text-xs text-[#C7E8D6] hover:border-[#51D9AA] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#51D9AA]">
              + {example}
            </button>
          ))}
        </div>
        <div className="mt-5 space-y-3">
          {tasks.map((t, i) => (
            <label key={i} className="block">
              <span className="text-xs font-semibold text-[#96B09E]">Tâche {i + 1}</span>
              <input value={t.name} onChange={(e) => setName(i, e.target.value)} maxLength={120} placeholder={d.examples[i]} className="mt-1 w-full rounded-lg border border-[#2B4233] bg-[#111711] px-4 py-3 text-sm text-white placeholder:text-[#5F7566] focus:border-[#51D9AA] focus:outline-none" />
            </label>
          ))}
        </div>
      </Step>

      <Step n={2} id="potentiel" title="Évaluez leur potentiel IA">
        <p className="mt-3 text-sm leading-7 text-[#C5D1C9]">Notez chaque tâche de 1 à 3 sur quatre critères. Le score sur {MAX_SCORE} est la somme des quatre notes : plus il est élevé, plus la tâche se prête à un premier test simple.</p>
        <p className="mt-2 text-xs leading-5 text-[#96B09E]">Ce score aide à choisir par où commencer. Ce n’est ni une estimation de gains, ni un diagnostic professionnel. À égalité, la tâche la plus facile à contrôler passe en premier.</p>
        {named.length === 0 ? (
          <p className="mt-6 rounded-xl border border-dashed border-[#2B4233] p-5 text-sm text-[#96B09E]">Nommez au moins une tâche à l’étape 1 pour l’évaluer.</p>
        ) : (
          <div className="mt-6 space-y-5">
            {named.map((t) => {
              const total = score(t.ratings);
              return (
                <article key={t.index} className={`rounded-xl border p-5 ${best && best.name === t.name && total !== null ? "border-[#51D9AA] bg-[#11251A]" : "border-[#2B4233] bg-[#111711]"}`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="font-semibold">{t.name}</h3>
                    <p className="text-sm text-[#C5D8CB]">{total === null ? "Score à compléter" : <><strong className="text-white">{total} / {MAX_SCORE}</strong> · {band(total).label}</>}</p>
                  </div>
                  <div className="mt-4 space-y-4">
                    {d.criteria.map((c) => (
                      <fieldset key={c.id}>
                        <legend className="text-sm text-[#DAE6DC]"><strong>{c.label}</strong> <span className="text-[#96B09E]">— {c.question}</span></legend>
                        <div className="mt-2 grid gap-2 sm:grid-cols-3">
                          {c.levels.map((level, k) => {
                            const value = (k + 1) as 1 | 2 | 3;
                            const checked = t.ratings[c.id] === value;
                            return (
                              <label key={level} className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-xs leading-5 ${checked ? "border-[#51D9AA] bg-[#173322] text-white" : "border-[#2B4233] text-[#B6C6BA] hover:border-[#3E6B52]"}`}>
                                <input type="radio" name={`t${t.index}-${c.id}`} checked={checked} onChange={() => rate(t.index, c.id, value)} className="mt-0.5 accent-[#1D9E75]" />
                                <span><strong>{value}</strong> · {level}</span>
                              </label>
                            );
                          })}
                        </div>
                      </fieldset>
                    ))}
                  </div>
                  {total !== null && <p className="mt-4 text-xs leading-5 text-[#A9B9AB]">{band(total).detail}</p>}
                </article>
              );
            })}
          </div>
        )}
        {best && (
          <p className="mt-6 rounded-xl border border-[#346B4E] bg-[#11251A] p-5 text-sm leading-7">
            <span className="text-xs font-bold tracking-widest text-[#51D9AA]">VOTRE PREMIER CANDIDAT</span><br />
            <strong className="text-lg">{best.name}</strong> · {score(best.ratings)} / {MAX_SCORE}
          </p>
        )}
      </Step>

      <Step n={3} id="cas" title="Trois cas concrets">
        <p className="mt-3 text-sm leading-7 text-[#C5D1C9]">Aucune connexion n’est automatique : chaque cas suppose des outils compatibles, des accès autorisés et des données de qualité.</p>
        <div className="mt-6 grid gap-4">
          {d.cases.map((c, i) => (
            <article key={c.title} className="rounded-xl border border-[#2B4233] bg-[#111711] p-5">
              <span className="text-xs font-bold text-[#51D9AA]">0{i + 1}</span>
              <h3 className="mt-1 text-lg font-semibold">{c.title}</h3>
              <dl className="mt-3 space-y-2 text-sm leading-6">
                <div><dt className="inline font-semibold text-white">Ce que l’IA peut préparer : </dt><dd className="inline text-[#B6C6BA]">{c.ai}</dd></div>
                <div><dt className="inline font-semibold text-white">Prérequis : </dt><dd className="inline text-[#B6C6BA]">{c.prerequisites}</dd></div>
                <div><dt className="inline font-semibold text-white">Ce qui reste humain : </dt><dd className="inline text-[#B6C6BA]">{c.human}</dd></div>
              </dl>
            </article>
          ))}
        </div>
      </Step>

      <Step n={4} id="feuille-de-route" title="Votre première feuille de route">
        <p className="mt-3 text-sm leading-7 text-[#C5D1C9]">Répondez à ces quatre questions : vous repartez avec un pilote clair.</p>
        <div className="mt-5 space-y-4">
          {d.roadmap.map((q) => (
            <label key={q.id} className="block">
              <span className="text-sm font-semibold text-white">{q.question}</span>
              <input value={answer(q.id)} onChange={(e) => setRoadmap((r) => ({ ...r, [q.id]: e.target.value }))} maxLength={200} placeholder={q.hint} className="mt-1 w-full rounded-lg border border-[#2B4233] bg-[#111711] px-4 py-3 text-sm text-white placeholder:text-[#5F7566] focus:border-[#51D9AA] focus:outline-none" />
            </label>
          ))}
        </div>
        <div className="mt-5 flex flex-col gap-3 rounded-lg border border-[#2D4335] bg-[#090E0A] p-4 sm:flex-row sm:items-start sm:justify-between">
          <p className="whitespace-pre-wrap text-[13px] leading-6 text-[#DAE6DC]">{summary}</p>
          <CopyDashboardPrompt text={summary} label="Copier ma feuille de route" />
        </div>
      </Step>
    </div>
  );
}
