/**
 * Lance l'application (build existant) branchée sur le faux Brevo, pour
 * tester le formulaire à la main dans un navigateur : http://localhost:3100
 * État du faux Brevo : http://127.0.0.1:4010/__state
 *
 *   NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA npm run build
 *   npx tsx tests/e2e/serve.ts
 */

import { spawn } from "node:child_process";
import { MOCK_API_KEY, startMockBrevo } from "./mock-brevo";

startMockBrevo(4010).then(() => {
  console.log("Faux Brevo : http://127.0.0.1:4010/__state");
  const app = spawn("npx", ["next", "start", "-p", "3100"], {
    env: {
      ...process.env,
      BREVO_API_KEY: MOCK_API_KEY,
      BREVO_API_BASE_URL: "http://127.0.0.1:4010/v3",
      TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY ?? "1x0000000000000000000000000000000AA",
      SIGNING_SECRET: "e2e",
    },
    stdio: "inherit",
  });
  const stop = () => {
    app.kill();
    process.exit(0);
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
  process.on("SIGHUP", stop);
  app.on("exit", () => process.exit(0));
});
