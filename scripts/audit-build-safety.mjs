/** Auditoria somente de leitura. Não invoca compilador, Vite ou scripts de deploy. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import {
  ACTIVE_INSTALLATIONS,
  canonicalPath,
  inside,
  assertSafeBuild,
} from "./build-safety.mjs";
const repo = canonicalPath(fileURLToPath(new URL("..", import.meta.url)));
try {
  const root = JSON.parse(
    fs.readFileSync(path.join(repo, "package.json"), "utf8"),
  );
  const client = JSON.parse(
    fs.readFileSync(path.join(repo, "client/package.json"), "utf8"),
  );
  if (
    root.scripts.build !== "node scripts/build-backend.mjs" ||
    root.scripts["build:client"] !== "node scripts/build-client.mjs" ||
    client.scripts.build !== "node ../scripts/build-client.mjs" ||
    root.scripts.typecheck !== "node scripts/typecheck.mjs backend" ||
    client.scripts.typecheck !== "node ../scripts/typecheck.mjs frontend"
  )
    throw Error("Scripts oficiais não estão protegidos.");
  const config = fs.readFileSync(
    path.join(repo, "client/vite.config.ts"),
    "utf8",
  );
  if (
    !config.includes("protecaoDoBuild()") ||
    !config.includes("configResolved") ||
    !config.includes("buildStart") ||
    !config.includes("assertSafeViteConfig")
  )
    throw Error("Configuração oficial sem proteção esperada.");
  const active = ACTIVE_INSTALLATIONS.map((p) => canonicalPath(p)).find((p) =>
    inside(repo, p),
  );
  let policyBlocks = false;
  if (active) {
    try {
      assertSafeBuild({
        sources: [repo],
        outputs: [path.join(repo, "client/dist"), path.join(repo, "dist")],
      });
    } catch (e) {
      if (!e.message.startsWith("BUILD BLOQUEADO:")) throw e;
      policyBlocks = true;
    }
    if (!policyBlocks)
      throw Error("Política não reconheceu a instalação ativa.");
  }
  const files = [
    "scripts/build-safety.mjs",
    "scripts/build-client.mjs",
    "scripts/build-backend.mjs",
    "scripts/typecheck.mjs",
    "client/vite.config.ts",
    "package.json",
    "client/package.json",
  ];
  const hashes = Object.fromEntries(
    files.map((p) => [
      p,
      createHash("sha256")
        .update(fs.readFileSync(path.join(repo, p)))
        .digest("hex"),
    ]),
  );
  console.log(
    JSON.stringify(
      {
        repo,
        active: active ?? null,
        officialGuardsInstalled: true,
        policyBlocksActiveSource: policyBlocks,
        buildExecuted: false,
        osIsolationEnforced: false,
        hashes,
      },
      null,
      2,
    ),
  );
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
