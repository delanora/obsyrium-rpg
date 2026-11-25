/** Emite primeiro em memória; valida todos os destinos antes da primeira escrita. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { assertSafeBuild, canonicalPath } from "./build-safety.mjs";
const repo = fileURLToPath(new URL("..", import.meta.url));
try {
  const sources = [process.cwd(), repo];
  assertSafeBuild({ sources });
  const cli = ts.parseCommandLine(process.argv.slice(2));
  if (
    cli.errors.length ||
    cli.fileNames.length ||
    cli.options.watch ||
    cli.options.build
  )
    throw Error(
      "BUILD BLOQUEADO: opções de compilação inválidas; use --project e opções TypeScript de saída explícitas.",
    );
  let configPath = canonicalPath(
    cli.options.project ?? path.join(repo, "tsconfig.json"),
  );
  if (fs.statSync(configPath).isDirectory())
    configPath = path.join(configPath, "tsconfig.json");
  sources.push(path.dirname(configPath));
  const loaded = ts.readConfigFile(configPath, ts.sys.readFile);
  if (loaded.error) throw Error("BUILD BLOQUEADO: tsconfig não pôde ser lido.");
  const overrides = { ...cli.options };
  delete overrides.project;
  for (const key of [
    "outDir",
    "outFile",
    "declarationDir",
    "tsBuildInfoFile",
    "rootDir",
  ])
    if (overrides[key] !== undefined)
      overrides[key] = canonicalPath(overrides[key]);
  const config = ts.parseJsonConfigFileContent(
    loaded.config,
    ts.sys,
    path.dirname(configPath),
    overrides,
    configPath,
  );
  const options = config.options;
  if (
    config.errors.length ||
    config.projectReferences?.length ||
    options.incremental ||
    options.composite ||
    !options.outDir
  )
    throw Error(
      "BUILD BLOQUEADO: configuração ambígua (referências/incremental/ausência de outDir).",
    );
  const outputs = [
    options.outDir,
    options.outFile,
    options.declarationDir,
    options.tsBuildInfoFile,
  ].filter((v) => v !== undefined);
  assertSafeBuild({ sources, outputs });
  const program = ts.createProgram(config.fileNames, options);
  const errors = ts.getPreEmitDiagnostics(program);
  if (errors.length) {
    console.error(
      ts.formatDiagnosticsWithColorAndContext(errors, {
        getCanonicalFileName: (p) => p,
        getCurrentDirectory: () => repo,
        getNewLine: () => "\n",
      }),
    );
    process.exitCode = 1;
  } else {
    const pending = new Map();
    const result = program.emit(undefined, (file, content) =>
      pending.set(file, content),
    );
    if (result.emitSkipped || result.diagnostics.length)
      throw Error("BUILD BLOQUEADO: emissão TypeScript incompleta.");
    assertSafeBuild({ sources, outputs: [...pending.keys()] });
    for (const [file, content] of pending) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, content);
    }
    console.log(
      `Build backend isolado: ${pending.size} arquivos; nenhuma publicação executada.`,
    );
  }
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
