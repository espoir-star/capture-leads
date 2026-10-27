import type { Config } from "tailwindcss";

/* Couleurs = rôles définis dans app/globals.css (palette d'althoce.com, version sombre). */
const role = (name: string) => `rgb(var(--${name}-rgb) / <alpha-value>)`;

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        fond: role("bg"),
        carte: role("surface"),
        "carte-2": role("surface-2"),
        texte: role("fg"),
        secondaire: role("fg-muted"),
        discret: role("fg-subtle"),
        bordure: "rgb(var(--fg-rgb) / 0.08)",
        "bordure-forte": "rgb(var(--fg-rgb) / 0.15)",
        accent: role("accent"),
        action: role("action"),
        "action-hover": role("action-hover"),
        alerte: role("warn"),
      },
      fontFamily: {
        sans: ["var(--font-geist)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-geist)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
