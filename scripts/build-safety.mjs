/** Política versionada. Não há variável de ambiente que desative a proteção. */
import fs from "node:fs";
import path from "node:path";
export const ACTIVE_INSTALLATIONS = Object.freeze(["/opt/rpg"]);
const fail = (reason) => {
  throw new Error(
    `BUILD BLOQUEADO: ${reason}. Execute em um checkout isolado. A publicação exige autorização separada.`,
  );
};

/** Resolve cada segmento, inclusive .. após symlink. Destinos inexistentes usam
 * o ancestral físico existente; symlinks pendentes/cíclicos falham fechados. */
export function canonicalPath(input, base = process.cwd()) {
  if (
    typeof input !== "string" ||
    !input ||
    input.trim() !== input ||
    /[\0\r\n\\]/.test(input) ||
    /^[a-z][a-z0-9+.-]*:/i.test(input)
  )
    fail("caminho inválido ou ambíguo");
  const full = path.isAbsolute(input)
    ? input
    : `${canonicalPath(base)}/${input}`;
  let current = path.parse(full).root;
  for (const part of full.slice(current.length).split("/")) {
    if (!part || part === ".") continue;
    try {
      if (!fs.statSync(current).isDirectory())
        fail(`ancestral não é diretório: ${current}`);
    } catch (e) {
      if (e.code !== "ENOENT")
        fail(`não foi possível estabelecer o ancestral: ${current}`);
    }
    if (part === "..") {
      current = path.dirname(current);
      continue;
    }
    const next = path.join(current, part);
    try {
      const stat = fs.lstatSync(next);
      current = stat.isSymbolicLink() ? fs.realpathSync.native(next) : next;
    } catch (e) {
      if (e.code !== "ENOENT") fail(`não foi possível resolver: ${next}`);
      // ENOENT também pode significar link pendente, que não é um destino seguro.
      try {
        if (fs.lstatSync(next).isSymbolicLink())
          fail(`link simbólico sem destino: ${next}`);
      } catch (probe) {
        if (probe.code !== "ENOENT") throw probe;
      }
      current = next;
    }
  }
  return current;
}
export function inside(candidate, parent) {
  const relative = path.relative(parent, candidate);
  return (
    relative === "" ||
    (!path.isAbsolute(relative) &&
      relative !== ".." &&
      !relative.startsWith(`..${path.sep}`))
  );
}
export function assertSafeBuild({ sources, outputs = [] }) {
  if (
    !Array.isArray(sources) ||
    !sources.length ||
    !Array.isArray(outputs) ||
    !ACTIVE_INSTALLATIONS.length
  )
    fail("política de caminhos incompleta");
  const roots = ACTIVE_INSTALLATIONS.map((root) => canonicalPath(root));
  for (const source of sources) {
    const resolved = canonicalPath(source);
    try {
      if (!fs.statSync(resolved).isDirectory())
        fail(`origem não é diretório: ${resolved}`);
    } catch {
      fail(`origem não é diretório existente e acessível: ${resolved}`);
    }
    const protectedRoot = roots.find((root) => inside(resolved, root));
    if (protectedRoot)
      fail(`origem ${resolved} pertence à instalação ativa ${protectedRoot}`);
  }
  for (const output of outputs) {
    const resolved = canonicalPath(output);
    const protectedRoot = roots.find(
      (root) => inside(resolved, root) || inside(root, resolved),
    );
    if (protectedRoot)
      fail(
        `destino ${resolved} pertence ou contém a instalação ativa ${protectedRoot}`,
      );
  }
}

function directoryPath(value, root) {
  const resolved = canonicalPath(value, root);
  if (fs.existsSync(resolved) && !fs.statSync(resolved).isDirectory())
    fail(`destino não é diretório: ${resolved}`);
  return resolved;
}
function outputPaths(build, root) {
  if (!build || typeof build !== "object" || typeof build.outDir !== "string")
    fail("outDir efetivo não estabelecido");
  const outputs = [directoryPath(build.outDir, root)];
  for (const options of [build.rolldownOptions, build.rollupOptions]) {
    if (!options || options.output === undefined) continue;
    const entries = Array.isArray(options.output)
      ? options.output
      : [options.output];
    for (const entry of entries) {
      if (!entry || typeof entry !== "object")
        fail("output do empacotador inválido");
      if (entry.file !== undefined)
        fail("output.file não é suportado pelo fluxo oficial do Vite");
      if (entry.dir !== undefined) outputs.push(directoryPath(entry.dir, root));
      for (const name of [
        "entryFileNames",
        "chunkFileNames",
        "assetFileNames",
        "sourcemapFile",
      ]) {
        const value = entry[name];
        if (value === undefined) continue;
        if (
          typeof value !== "string" ||
          path.isAbsolute(value) ||
          value.split(/[\\/]/).includes("..") ||
          value.includes("\\")
        )
          fail(`nome de saída ambíguo: ${name}`);
      }
    }
  }
  return outputs;
}
/** Recebe configuração já resolvida pelo Vite, inclusive overrides CLI. */
export function assertSafeViteConfig(config, origins = []) {
  if (!config || typeof config.root !== "string" || !config.build)
    fail("configuração Vite não resolvida");
  const root = canonicalPath(config.root);
  const sources = [...origins, root];
  if (typeof config.publicDir === "string") {
    const publicDir = canonicalPath(config.publicDir, root);
    // Vite permite projetos sem pasta public; só existe fonte de cópia se ela existir.
    if (fs.existsSync(publicDir)) sources.push(publicDir);
  }
  if (typeof config.configFile === "string")
    sources.push(path.dirname(config.configFile));
  const outputs = outputPaths(config.build, root);
  if (config.cacheDir !== undefined)
    outputs.push(directoryPath(config.cacheDir, root));
  for (const environment of Object.values(config.environments ?? {})) {
    if (environment?.build)
      outputs.push(
        ...outputPaths({ ...config.build, ...environment.build }, root),
      );
  }
  assertSafeBuild({ sources, outputs });
}
