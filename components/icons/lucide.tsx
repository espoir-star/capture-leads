/**
 * Icônes Lucide (https://lucide.dev, licence ISC, tracés repris de lucide-react 0.563).
 * Copie locale pour ne pas ajouter de dépendance : node_modules est partagé entre
 * plusieurs checkouts. Trait plus épais quand l'icône est petite (standard davinci).
 */
type Node = ["path", { d: string }] | ["rect", Record<string, string>] | ["circle", Record<string, string>] | ["line", Record<string, string>];

const ICONS = {
  landmark: [["path", { d: "M10 18v-7" }], ["path", { d: "M11.12 2.198a2 2 0 0 1 1.76.006l7.866 3.847c.476.233.31.949-.22.949H3.474c-.53 0-.695-.716-.22-.949z" }], ["path", { d: "M14 18v-7" }], ["path", { d: "M18 18v-7" }], ["path", { d: "M3 22h18" }], ["path", { d: "M6 18v-7" }]],
  building: [["path", { d: "M10 12h4" }], ["path", { d: "M10 8h4" }], ["path", { d: "M14 21v-3a2 2 0 0 0-4 0v3" }], ["path", { d: "M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2" }], ["path", { d: "M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" }]],
  newspaper: [["path", { d: "M15 18h-5" }], ["path", { d: "M18 14h-8" }], ["path", { d: "M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-4 0v-9a2 2 0 0 1 2-2h2" }], ["rect", { width: "8", height: "4", x: "10", y: "6", rx: "1" }]],
  receipt: [["path", { d: "M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" }], ["path", { d: "M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" }], ["path", { d: "M12 17.5v-11" }]],
  lock: [["rect", { width: "18", height: "11", x: "3", y: "11", rx: "2", ry: "2" }], ["path", { d: "M7 11V7a5 5 0 0 1 10 0v4" }]],
  shieldCheck: [["path", { d: "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" }], ["path", { d: "m9 12 2 2 4-4" }]],
  server: [["rect", { width: "20", height: "8", x: "2", y: "2", rx: "2", ry: "2" }], ["rect", { width: "20", height: "8", x: "2", y: "14", rx: "2", ry: "2" }], ["line", { x1: "6", x2: "6.01", y1: "6", y2: "6" }], ["line", { x1: "6", x2: "6.01", y1: "18", y2: "18" }]],
  arrowUpRight: [["path", { d: "M7 7h10v10" }], ["path", { d: "M7 17 17 7" }]],
  arrowDown: [["path", { d: "M12 5v14" }], ["path", { d: "m19 12-7 7-7-7" }]],
  check: [["path", { d: "M20 6 9 17l-5-5" }]],
} satisfies Record<string, Node[]>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 16, strokeWidth = 2, className }: { name: IconName; size?: number; strokeWidth?: number; className?: string }) {
  return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
    {(ICONS[name] as Node[]).map(([tag, attrs], i) => tag === "path" ? <path key={i} {...attrs}/> : tag === "rect" ? <rect key={i} {...attrs}/> : tag === "circle" ? <circle key={i} {...attrs}/> : <line key={i} {...attrs}/>)}
  </svg>;
}
