/** Instrumentação só no bundle descartável, sem relógios no código de produção. */
import { build } from "esbuild";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
const root = process.cwd(),
  source = process.env.ARCHIVE_BASELINE_ROOT ?? root,
  temp = fs.mkdtempSync(path.join(os.tmpdir(), "arquivo-etapas-"));
await build({
  stdin: {
    loader: "ts",
    resolveDir: path.join(root, "client"),
    contents: `
import {archiveBenchmarkFixture}from'${root}/client/scripts/archive-multilevel-fixtures';
import{projectArchive}from'${source}/client/src/components/archive/archiveProjection';
import{layoutArchive}from'${source}/client/src/components/archive/archiveLayout';
for(const count of [50,100,200,500])for(const kind of ['esparso','denso','multinivel','independente','interdependente']){
 const graph=archiveBenchmarkFixture(count,kind),expanded=new Set(graph.placements.filter(p=>graph.placements.some(c=>c.parentPlacementId===p.id)).map(p=>p.id));const samples=[];
 for(let i=0;i<9;i++){layoutArchive(projectArchive(graph,expanded));if(i>1)samples.push(globalThis.__archiveStages);}
 const stages=Object.fromEntries(Object.keys(samples[0]).map(k=>[k,samples.map(s=>s[k]).sort((a,b)=>a-b)[3]]));
 console.log(JSON.stringify({count,kind,stages}));
}`,
  },
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: path.join(temp, "run.mjs"),
  plugins: [
    {
      name: "etapas-isoladas",
      setup(b) {
        b.onLoad({ filter: /archiveLayout\.ts$/ }, (args) => {
          let code = fs.readFileSync(args.path, "utf8");
          code = code.replace(
            "  const config = { ...ARCHIVE_LAYOUT_CONFIG, ...options.config };",
            `  let previousStamp=performance.now();const stamps={};const mark=(name)=>{const now=performance.now();stamps[name]=now-previousStamp;previousStamp=now;};\n  const config = { ...ARCHIVE_LAYOUT_CONFIG, ...options.config };`,
          );
          code = code.replace(
            "  if (!groups.length)",
            '  mark("hierarquia_indice");\n  if (!groups.length)',
          );
          code = code.replace(
            "  // União localizada:",
            '  mark("distribuicao_radial");\n  // União localizada:',
          );
          code = code.replace(
            "  // Uma intenção manual não participa",
            '  mark("construcao_reservas");\n  // Uma intenção manual não participa',
          );
          code = code.replace(
            "  if (physical) {",
            '  mark("obstaculos_propagacao");\n  if (physical) {',
          );
          code = code.replace(
            "  for (const reserve of reserves)\n    for (const card of cards)",
            '  mark("seguranca_componentes");\n  for (const reserve of reserves)\n    for (const card of cards)',
          );
          code = code.replace(
            "  return {\n    reserves,",
            '  mark("diagnostico_saida");globalThis.__archiveStages=stamps;\n  return {\n    reserves,',
          );
          return { loader: "ts", contents: code };
        });
      },
    },
  ],
});
await import(pathToFileURL(path.join(temp, "run.mjs")).href);
