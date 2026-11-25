/** Instalações simuladas descartáveis. Nenhum build negativo aponta para produção. */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { canonicalPath } from "./build-safety.mjs";
const repo = fileURLToPath(new URL("..", import.meta.url)),
  temp = fs.mkdtempSync(path.join(os.tmpdir(), "obsyrium-build-guard-")),
  active = path.join(temp, "ativo"),
  safe = path.join(temp, "isolado");
let checks = 0;
const hash = (p) =>
  createHash("sha256").update(fs.readFileSync(p)).digest("hex");
function dependencies(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from)) {
    if ([".vite", ".vite-temp", ".cache"].includes(entry)) continue;
    fs.symlinkSync(path.join(from, entry), path.join(to, entry));
  }
  fs.mkdirSync(path.join(to, ".vite-temp"), { recursive: true });
}
function fixture(dir) {
  fs.mkdirSync(path.join(dir, "scripts"), { recursive: true });
  fs.mkdirSync(path.join(dir, "client"), { recursive: true });
  fs.mkdirSync(path.join(dir, "src"), { recursive: true });
  for (const f of [
    "build-safety.mjs",
    "build-safety.d.mts",
    "build-client.mjs",
    "build-backend.mjs",
    "typecheck.mjs",
  ])
    fs.copyFileSync(
      path.join(repo, "scripts", f),
      path.join(dir, "scripts", f),
    );
  const policy = path.join(dir, "scripts/build-safety.mjs");
  const text = fs.readFileSync(policy, "utf8");
  assert.ok(text.includes("['/opt/rpg']") || text.includes('["/opt/rpg"]'));
  // Apenas a cópia descartável recebe uma instalação protegida extra. Sem env/bypass no produto.
  fs.writeFileSync(
    policy,
    text.replace(
      /\[['"]\/opt\/rpg['"]\]/,
      JSON.stringify(["/opt/rpg", active]),
    ),
  );
  for (const file of ["package.json", "tsconfig.json"])
    fs.copyFileSync(path.join(repo, file), path.join(dir, file));
  for (const file of ["package.json", "vite.config.ts"])
    fs.copyFileSync(
      path.join(repo, "client", file),
      path.join(dir, "client", file),
    );
  fs.writeFileSync(
    path.join(dir, "src/index.ts"),
    "export const exemplo = 42;\n",
  );
  fs.writeFileSync(
    path.join(dir, "client/tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "ESNext",
        moduleResolution: "bundler",
        skipLibCheck: true,
        noEmit: true,
        types: ["node"],
      },
      include: ["main.ts", "vite.config.ts"],
    }),
  );
  fs.writeFileSync(
    path.join(dir, "client/main.ts"),
    'document.body.dataset.exemplo="isolado";\n',
  );
  fs.writeFileSync(
    path.join(dir, "client/index.html"),
    '<script type="module" src="/main.ts"></script>',
  );
  dependencies(path.join(repo, "node_modules"), path.join(dir, "node_modules"));
  dependencies(
    path.join(repo, "client/node_modules"),
    path.join(dir, "client/node_modules"),
  );
}
fixture(active);
fixture(safe);
const { assertSafeBuild: fixtureGuard } = await import(
  pathToFileURL(path.join(safe, "scripts/build-safety.mjs")).href
);
for (const file of ["client/dist/index.html", "dist/index.js"]) {
  const p = path.join(active, file);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, "SENTINELA: NÃO ALTERAR\n");
}
function manifest(dir) {
  const out = {};
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name),
        key = path.relative(dir, p);
      if (e.isSymbolicLink()) out[key] = "link:" + fs.readlinkSync(p);
      else if (e.isDirectory()) {
        out[key] = "dir";
        walk(p);
      } else out[key] = hash(p);
    }
  };
  walk(dir);
  return out;
}
const protectedBefore = manifest(active);
function intact() {
  assert.deepEqual(
    manifest(active),
    protectedBefore,
    "Instalação simulada mudou",
  );
}
function blocked(label, command, args, cwd = safe) {
  const r = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    timeout: 90000,
    env: { ...process.env, CI: "1" },
  });
  assert.ifError(r.error);
  assert.notEqual(r.status, 0, label);
  assert.match(r.stdout + r.stderr, /BUILD BLOQUEADO/, label);
  assert.ok(!(r.stdout + r.stderr).includes("modules transformed"), label);
  intact();
  checks++;
  console.log("Bloqueado:", label);
}
function unit(label, source, output) {
  assert.throws(
    () => fixtureGuard({ sources: [source], outputs: [output] }),
    /BUILD BLOQUEADO/,
  );
  intact();
  checks++;
}
const frontend = path.join(active, "client/dist"),
  backend = path.join(active, "dist");
unit(
  "origem ausente",
  path.join(temp, "origem-ausente"),
  path.join(safe, "out"),
);
unit("origem raiz", active, path.join(safe, "out"));
unit("origem client", path.join(active, "client"), path.join(safe, "out"));
for (const output of [
  frontend,
  backend,
  active,
  path.dirname(active),
  path.join(frontend, "filho"),
  `${safe}/../ativo/client/dist`,
  `${active}//client///dist`,
  path.join(frontend, "inexistente/a"),
])
  unit("destino protegido", safe, output);
fs.symlinkSync(active, path.join(temp, "alias"));
fs.symlinkSync(frontend, path.join(safe, "out-link"));
fs.symlinkSync(path.join(active, "client"), path.join(safe, "intermediario"));
unit("alias origem", path.join(temp, "alias"), path.join(safe, "out"));
unit("alias destino", safe, path.join(safe, "out-link"));
unit("segmento intermediário", safe, path.join(safe, "intermediario/dist"));
// .. precisa ser aplicado depois da resolução do link, não antes.
unit("link seguido de ..", safe, `${safe}/intermediario/../dist`);
for (const invalid of ["", " ", "file:///tmp/saida", "C:\\saida", "a\0b"])
  unit("caminho ambíguo", safe, invalid);
fs.symlinkSync("loop-b", path.join(safe, "loop-a"));
fs.symlinkSync("loop-a", path.join(safe, "loop-b"));
unit("ciclo simbólico", safe, path.join(safe, "loop-a"));
fs.symlinkSync("ausente", path.join(safe, "pendente"));
unit("link pendente", safe, path.join(safe, "pendente/sub"));
const similar = path.join(temp, "ativo-teste");
fs.mkdirSync(similar);
fixtureGuard({ sources: [similar], outputs: [path.join(similar, "dist")] });
checks++;
assert.equal(canonicalPath(`${safe}/intermediario/../dist`), backend);
checks++;
blocked("npm raiz frontend", "npm", ["run", "build:client"], active);
blocked(
  "npm prefix frontend",
  "npm",
  ["--prefix", "client", "run", "build"],
  active,
);
blocked(
  "npm dentro do client",
  "npm",
  ["run", "build"],
  path.join(active, "client"),
);
blocked("npm backend ativo", "npm", ["run", "build"], active);
const extraCheck = spawnSync(
  "npm",
  ["run", "typecheck", "--", "--noEmit", "false"],
  { cwd: active, encoding: "utf8", timeout: 30000 },
);
assert.notEqual(extraCheck.status, 0);
assert.match(extraCheck.stdout + extraCheck.stderr, /TYPECHECK BLOQUEADO/);
intact();
checks++;
const vite = path.join(safe, "client/node_modules/vite/bin/vite.js"),
  config = path.join(safe, "client/vite.config.ts");
const direct = (label, args) =>
  blocked(
    label,
    process.execPath,
    [vite, "build", "--config", config, ...args],
    path.join(safe, "client"),
  );
blocked(
  "Vite direto origem ativa",
  process.execPath,
  [vite, "build", "--config", path.join(active, "client/vite.config.ts")],
  path.join(active, "client"),
);
for (const [label, out] of [
  ["outDir absoluto", frontend],
  ["outDir relativo", "../../ativo/client/dist"],
  ["outDir pai", active],
  ["outDir descendente", frontend + "/novo"],
  ["outDir simbólico", path.join(safe, "out-link")],
  ["outDir inexistente", frontend + "/novo/mais"],
  ["outDir vazio", ""],
])
  direct(label, ["--outDir", out]);
direct("root ativo por CLI", [
  path.join(active, "client"),
  "--outDir",
  path.join(safe, "fora"),
]);
blocked(
  "npm frontend override",
  "npm",
  ["run", "build:client", "--", "--outDir", frontend],
  safe,
);
blocked(
  "npm backend override",
  "npm",
  ["run", "build", "--", "--outDir", backend],
  safe,
);
blocked(
  "backend declaração redirecionada",
  "npm",
  ["run", "build", "--", "--declaration", "--declarationDir", frontend],
  safe,
);
const apiRunner = path.join(safe, "client/api-vite.mjs");
for (const output of [
  { dir: frontend },
  [{ dir: path.join(safe, "permitido") }, { dir: backend }],
]) {
  fs.writeFileSync(
    apiRunner,
    `import{build}from'vite';await build({configFile:${JSON.stringify(config)},build:{rolldownOptions:{output:${JSON.stringify(output)}}}});`,
  );
  blocked("Vite output efetivo", process.execPath, [apiRunner]);
}
fs.unlinkSync(apiRunner);
// O modo serve só resolve a configuração: não abre servidor nem roda código de aplicação.
fs.writeFileSync(
  apiRunner,
  `import{resolveConfig}from'vite';await resolveConfig({configFile:${JSON.stringify(config)}},'serve');console.log('Desenvolvimento permitido');`,
);
let result = spawnSync(process.execPath, [apiRunner], {
  cwd: safe,
  encoding: "utf8",
  timeout: 60000,
});
assert.equal(result.status, 0, result.stderr);
checks++;
fs.unlinkSync(apiRunner);
intact();
for (const args of [
  ["run", "typecheck"],
  ["run", "typecheck:client"],
  ["run", "build"],
  ["run", "build:client", "--", "--outDir", "fora-permitido"],
]) {
  result = spawnSync("npm", args, {
    cwd: safe,
    encoding: "utf8",
    timeout: 90000,
    env: { ...process.env, CI: "1" },
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  intact();
  checks++;
  console.log("Permitido:", args.join(" "));
}
assert.ok(
  fs.readFileSync(path.join(safe, "dist/index.js"), "utf8").includes("42"),
);
assert.ok(fs.existsSync(path.join(safe, "client/fora-permitido/index.html")));
checks += 2;
// Prova explícita da fronteira: tsc arbitrário NÃO usa o wrapper. Só fixture.
result = spawnSync(
  process.execPath,
  [
    path.join(safe, "node_modules/typescript/bin/tsc"),
    "-p",
    path.join(safe, "tsconfig.json"),
    "--outDir",
    backend,
  ],
  { cwd: safe, encoding: "utf8", timeout: 90000 },
);
assert.equal(result.status, 0, result.stderr);
assert.notEqual(
  hash(path.join(backend, "index.js")),
  protectedBefore["dist/index.js"],
);
checks++;
console.log(
  `Proteção de build: ${checks} verificações; sentinelas intactas em todos os bloqueios; builds reais permitidos. tsc direto demonstrado como fronteira não protegida, somente em fixture.`,
);
console.log("Evidências descartáveis:", temp);
