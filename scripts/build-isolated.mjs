/** Pipeline de validação de um checkout já isolado; nunca copia/publica artefatos. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { assertSafeBuild } from "./build-safety.mjs";
const repo = fileURLToPath(new URL("..", import.meta.url));
try {
  const mode = process.argv[2] ?? "--frontend";
  if (
    process.argv.length > 3 ||
    !["--frontend", "--backend", "--all"].includes(mode)
  )
    throw Error("BUILD BLOQUEADO: escolha --frontend, --backend ou --all.");
  const dirs = [
    ...(mode !== "--backend" ? ["client/dist"] : []),
    ...(mode !== "--frontend" ? ["dist"] : []),
  ];
  assertSafeBuild({
    sources: [repo, process.cwd()],
    outputs: dirs.map((p) => path.join(repo, p)),
  });
  const run = (args) => {
    const r = spawnSync("npm", args, { cwd: repo, stdio: "inherit" });
    if (r.error) throw r.error;
    if (r.status !== 0) throw Error(`Validação falhou: npm ${args.join(" ")}`);
  };
  if (mode !== "--backend") {
    run(["run", "typecheck:client"]);
    run(["run", "build:client"]);
  }
  if (mode !== "--frontend") {
    run(["run", "typecheck"]);
    run(["run", "build"]);
  }
  run(["run", "test:build-safety"]);
  const files = {};
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isSymbolicLink())
        throw Error("Manifest recusou artefato simbólico.");
      if (entry.isDirectory()) walk(p);
      else
        files[path.relative(repo, p)] = createHash("sha256")
          .update(fs.readFileSync(p))
          .digest("hex");
    }
  };
  for (const dir of dirs) walk(path.join(repo, dir));
  const manifest = path.join(repo, "build-manifest.json");
  assertSafeBuild({ sources: [repo], outputs: [manifest] });
  fs.writeFileSync(
    manifest,
    JSON.stringify({ published: false, mode, files }, null, 2) + "\n",
  );
  console.log(
    `Validação isolada concluída: ${Object.keys(files).length} hashes em build-manifest.json. Publicação NÃO executada.`,
  );
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
