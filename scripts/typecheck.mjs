/** Verificação sem emissão: não aceita argumentos capazes de reativar escrita. */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
const repo = fileURLToPath(new URL("..", import.meta.url)),
  mode = process.argv[2];
if (process.argv.length !== 3 || !["backend", "frontend"].includes(mode)) {
  console.error(
    "TYPECHECK BLOQUEADO: use o comando oficial sem opções de emissão.",
  );
  process.exitCode = 1;
} else {
  const client = mode === "frontend",
    compiler = path.join(
      repo,
      client
        ? "client/node_modules/typescript/bin/tsc"
        : "node_modules/typescript/bin/tsc",
    );
  const result = spawnSync(
    process.execPath,
    [compiler, "--noEmit", "--incremental", "false", "--composite", "false"],
    { cwd: client ? path.join(repo, "client") : repo, stdio: "inherit" },
  );
  if (result.error) console.error(result.error.message);
  process.exitCode = result.status ?? 1;
}
