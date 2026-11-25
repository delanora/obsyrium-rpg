/** Build não publica: nega a origem antes de chamar TypeScript ou Vite. */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { assertSafeBuild } from "./build-safety.mjs";
const repo = fileURLToPath(new URL("..", import.meta.url));
try {
  assertSafeBuild({ sources: [process.cwd(), repo] });
  const args = process.argv.slice(2);
  if (
    args.some(
      (arg) =>
        arg === "--config" || arg.startsWith("--config=") || arg === "-c",
    )
  )
    throw Error(
      "BUILD BLOQUEADO: o fluxo oficial não aceita substituir sua configuração de segurança.",
    );
  const run = (script, extra) => {
    const result = spawnSync(
      process.execPath,
      [path.join(repo, script), ...extra],
      { cwd: path.join(repo, "client"), stdio: "inherit" },
    );
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status ?? 1);
  };
  run("scripts/typecheck.mjs", ["frontend"]);
  run("client/node_modules/vite/bin/vite.js", [
    "build",
    ...args,
    "--config",
    path.join(repo, "client/vite.config.ts"),
  ]);
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
