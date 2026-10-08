/**
 * Garde-fou : un déploiement de PRODUCTION Vercel échoue au build si une
 * variable indispensable manque (la version en ligne reste alors inchangée).
 * Preview et local : non bloquant (Turnstile désactivé si ses clés manquent).
 */
const REQUIRED_IN_PRODUCTION = [
  "BREVO_API_KEY",
  "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
  "TURNSTILE_SECRET_KEY",
  "SIGNING_SECRET",
];
if (process.env.VERCEL_ENV === "production") {
  const missing = REQUIRED_IN_PRODUCTION.filter((k) => !process.env[k]?.trim());
  if (missing.length) {
    throw new Error(`Variables manquantes pour la Production : ${missing.join(", ")} (voir docs/BREVO_SETUP.md)`);
  }
  if (process.env.BREVO_API_BASE_URL) {
    throw new Error("BREVO_API_BASE_URL est réservée aux tests et ne doit pas être définie en Production");
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
