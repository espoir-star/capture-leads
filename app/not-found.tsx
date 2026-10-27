export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <p className="font-display text-6xl font-bold text-accent">404</p>
      <p className="mt-4 text-lg text-secondaire">
        Cette ressource n&apos;existe pas (ou plus).
      </p>
      <a
        href="https://althoce.com"
        className="mt-8 rounded-full bg-action px-8 py-3.5 font-semibold text-white hover:bg-action-hover transition"
      >
        Retour au site Althoce
      </a>
    </main>
  );
}
