/**
 * Logo d'althoce.com (monogramme AL + « althoce. »), repris à l'identique du site
 * (components/ui/brand/Logo.tsx du dépôt du site) en version claire sur fond sombre.
 */
export function BrandMark({ size = 28 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="Althoce">
    <rect x="10" y="15" width="20" height="70" fill="#fff" rx="3" />
    <path d="M45 15 L65 15 L65 50 L80 50 L62.5 85 L45 50 L45 15 Z" fill="#fff" />
    <circle cx="42" cy="50" r="7" fill="#2563eb" />
  </svg>;
}

export default function BrandLogo({ size = 28, href = "https://althoce.com" }: { size?: number; href?: string | null }) {
  const inner = <><BrandMark size={size}/><span className="font-semibold tracking-[-0.05em]" style={{ fontSize: Math.round(size * 0.78) }}>althoce<span className="text-accent">.</span></span></>;
  return href
    ? <a href={href} aria-label="Althoce, accueil du site" className="inline-flex items-center gap-2 text-texte">{inner}</a>
    : <span className="inline-flex items-center gap-2 text-texte">{inner}</span>;
}
