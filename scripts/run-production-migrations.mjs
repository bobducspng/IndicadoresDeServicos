import { config } from "dotenv";
import { spawn } from "node:child_process";

config({ path: process.env.APP_ENV_FILE ?? ".env" });

const child = spawn("pnpm", ["drizzle-kit", "migrate"], {
  stdio: "inherit",
  env: process.env,
});

child.on("error", error => {
  console.error("Falha ao iniciar o Drizzle:", error.message);
  process.exitCode = 1;
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`Drizzle encerrado pelo sinal ${signal}`);
    process.exitCode = 1;
    return;
  }
  process.exitCode = code ?? 1;
});
