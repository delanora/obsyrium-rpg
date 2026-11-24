/** Benchmark Chromium inteiramente sintético; não usa API, serviço ou banco. */
import { build } from "esbuild";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ?? "playwright"
);
const root = process.cwd(),
  source = process.env.ARCHIVE_BASELINE_ROOT ?? root,
  temp = fs.mkdtempSync(path.join(os.tmpdir(), "arquivo-ondas-perf-"));
await build({
  stdin: {
    resolveDir: path.join(root, "client"),
    loader: "tsx",
    contents: `
import React,{useMemo,useState,Profiler}from'react';import{createRoot}from'react-dom/client';
import{ArchiveCanvas}from'${source}/client/src/components/archive/ArchiveCanvas';
import{projectArchive}from'${source}/client/src/components/archive/archiveProjection';
import{layoutArchive}from'${source}/client/src/components/archive/archiveLayout';
import'${source}/client/src/components/archive/archive.css';
function App(){const[count,setCount]=useState(50),[open,setOpen]=useState(false),[dense,setDense]=useState(false),[camera,onCamera]=useState({x:500,y:350,zoom:.6});
const graph=useMemo(()=>({board:{id:'test',name:'Teste',description:'',version:0,createdAt:'',updatedAt:''},placements:Array.from({length:count},(_,i)=>({id:'p'+i,cardId:'c'+i,boardId:'test',parentPlacementId:i>0&&i<7?'p0':null,x:i<7?0:dense?(i%20)*45:(i%20)*400,y:i<7?0:dense?Math.floor(i/20)*45:Math.floor(i/20)*300,width:280,height:200,zIndex:0,card:{id:'c'+i,title:'Card '+i,category:'note',summary:'Resumo sintético para medição',content:'',version:0,createdAt:'',updatedAt:''}})),links:Array.from({length:count-1},(_,i)=>({id:'l'+i,sourceId:'c0',targetId:'c'+(i+1),relation:'related',label:'Relacionado',description:'',directed:true,version:0}))}),[count,dense]);
const projection=useMemo(()=>projectArchive(graph,new Set(open?['p0']:[])),[graph,open]);const layout=useMemo(()=>{const t=performance.now(),l=layoutArchive(projection);(window.__layouts??=[]).push(performance.now()-t);window.__affected=l.affected.length;return l;},[projection]);
window.__configure=(n,d)=>{setOpen(false);setCount(n);setDense(d)};window.__toggle=()=>setOpen(v=>!v);
return <Profiler id="canvas" onRender={(_id,_phase,actual)=>{(window.__reactTimes??=[]).push(actual)}}><ArchiveCanvas graph={layout.graph} layout={layout} snapshot={graph} nodes={projection.nodes} onToggle={()=>setOpen(v=>!v)} camera={camera} onCamera={onCamera} selected={null} onSelect={()=>{}} onMenu={()=>{}} visual={{}} onVisual={()=>{}} onMove={()=>{}} onConnect={()=>{}} busy={false} onInteraction={()=>{}}/></Profiler>;}
createRoot(document.getElementById('root')).render(<App/>);`,
  },
  bundle: true,
  external: ["/archive/*", "/creation/*"],
  jsx: "automatic",
  outfile: path.join(temp, "app.js"),
  plugins: [
    {
      name: "contadores",
      setup(b) {
        b.onLoad({ filter: /useArchiveMotion\.ts$/ }, (a) => ({
          loader: "ts",
          contents: fs
            .readFileSync(a.path, "utf8")
            .replace(
              "paintRef.current = () => {",
              "paintRef.current = () => { const paintStart=performance.now(); try {",
            )
            .replace(
              "\n    };\n    r.retained = rendering;",
              "\n    } finally { (window.__paintTimes??=[]).push(performance.now()-paintStart); } };\n    r.retained = rendering;",
            ),
        }));
        b.onLoad({ filter: /ArchiveCanvas\.tsx$/ }, (a) => ({
          loader: "tsx",
          contents: fs
            .readFileSync(a.path, "utf8")
            .replace(
              "  const places = useMemo(",
              "  window.__renders=(window.__renders??0)+1;\n  const places = useMemo(",
            ),
        }));
      },
    },
  ],
});
const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox"],
  }),
  page = await browser.newPage({
    viewport: { width: 1600, height: 1000 },
    reducedMotion: "no-preference",
  });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route("http://perf.test/**", async (route) => {
  const p = new URL(route.request().url()).pathname;
  const file =
    p === "/app.js" || p === "/app.css"
      ? path.join(temp, p)
      : p === "/style.css"
        ? path.join(root, "client/src/styles.css")
        : path.join(root, "client/public", p);
  if (fs.existsSync(file) && fs.statSync(file).isFile())
    return route.fulfill({ path: file });
  return route.fulfill({
    contentType: "text/html",
    body: '<html data-theme="dark"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/app.css"><style>html,body,#root{margin:0;width:100%;height:100%}.archive-viewport{position:fixed;inset:0}</style><div id="root"></div><script src="/app.js"></script></html>',
  });
});
await page.goto("http://perf.test/");
await page.waitForFunction(() => window.__configure);
const metrics = [];
for (const dense of [false, true])
  for (const count of [50, 100, 200, 500]) {
    await page.evaluate(([n, d]) => window.__configure(n, d), [count, dense]);
    await page.waitForTimeout(700);
    const samples = [];
    for (let cycle = 0; cycle < 3; cycle++)
      for (const direction of ["expandir", "recolher"]) {
        const m = await page.evaluate(async () => {
          const before = window.__renders,
            layouts = window.__layouts.length,
            reactBefore = (window.__reactTimes ?? []).length,
            paintBefore = (window.__paintTimes ?? []).length;
          let frames = [],
            long = [];
          const observer = new PerformanceObserver((list) =>
            long.push(...list.getEntries().map((e) => e.duration)),
          );
          observer.observe({ type: "longtask", buffered: false });
          let last = performance.now(),
            start = last;
          window.__toggle();
          await new Promise((resolve) => {
            const frame = (t) => {
              frames.push(t - last);
              last = t;
              if (t - start < 720) requestAnimationFrame(frame);
              else resolve();
            };
            requestAnimationFrame(frame);
          });
          observer.disconnect();
          const reactMs = (window.__reactTimes ?? []).slice(reactBefore);
          const render = window.__renders - before,
            layoutMs = window.__layouts.slice(layouts),
            affected = window.__affected;
          frames = frames.filter((n) => n > 0).sort((a, b) => a - b);
          return {
            layoutMs,
            reactMs,
            paintMs: (window.__paintTimes ?? []).slice(paintBefore),
            affected,
            render,
            frameMedian: frames[Math.floor(frames.length / 2)],
            frameP95: frames[Math.floor(frames.length * 0.95)],
            frameMax: frames.at(-1),
            longTasks: long.length,
            longMax: Math.max(0, ...long),
          };
        });
        samples.push({ direction, ...m });
        assert.equal(m.layoutMs.length, 1, "Um layout por toggle");
        assert.ok(m.render <= 3, "Sem render React por frame");
      }
    metrics.push({ count, dense, samples });
    console.log(JSON.stringify(metrics.at(-1)));
  }
assert.deepEqual(errors, []);
fs.writeFileSync(
  path.join(temp, "metrics.json"),
  JSON.stringify(metrics, null, 2),
);
console.log("Benchmark:", temp);
await browser.close();
