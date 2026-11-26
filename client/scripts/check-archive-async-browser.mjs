/**
 * Chromium real: responsividade do planejamento relacional (8.5.4.2.2).
 *
 * Fixtures sintéticas (sem API, banco ou campanha) e Worker REAL servido como
 * módulo. Mede long tasks, latência de interação durante o planejamento, custo
 * de envio/recepção/worker, descarte de resultados obsoletos (troca de quadro),
 * ciclos de expansão/recolhimento e falha controlada do worker.
 *
 * Uso: PLAYWRIGHT_MODULE=/caminho/playwright/index.mjs node client/scripts/check-archive-async-browser.mjs
 */
import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import http from "node:http";
import { createRequire } from "node:module";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const root = process.cwd();
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "arquivo-async-"));
const only = process.argv.find((argument) => argument.startsWith("--only="));
const scenarios = only
  ? [only.slice("--only=".length)]
  : ["50", "100", "200", "500", "distantes", "falha"];

const worker = await build({
  entryPoints: [
    path.join(root, "client/src/components/archive/archiveRoute.worker.ts"),
  ],
  bundle: true,
  format: "esm",
  target: "es2022",
  write: false,
  logLevel: "silent",
});
fs.writeFileSync(path.join(dir, "worker.js"), worker.outputFiles[0].text);

await build({
  stdin: {
    loader: "tsx",
    resolveDir: path.join(root, "client"),
    contents: `
import React,{useMemo,useState}from'react';
import{createRoot}from'react-dom/client';
import{ArchiveCanvas}from'${root}/client/src/components/archive/ArchiveCanvas';
import{layoutArchive,ARCHIVE_LAYOUT_CONFIG}from'${root}/client/src/components/archive/archiveLayout';
import{projectArchive}from'${root}/client/src/components/archive/archiveProjection';
import{filterArchive,EMPTY_ARCHIVE_FILTER}from'${root}/client/src/components/archive/archiveFilters';
import'${root}/client/src/components/archive/archive.css';

const params=new URLSearchParams(location.search);
const scenario=params.get('scenario')||'100';
const failing=scenario==='falha';
window.__metrics={send:[],receive:[],worker:[]};
window.__requests=0;
window.__long=[];
window.__errors=[];
window.__mountedAt=performance.now();
window.__planAppliedAt=null;
window.__readyAt=null;
window.__burstFrom=null;
window.__burstTo=null;
// Pronto = primeira pintura assentada (SVG estável por 3 quadros), não o
// instante em que o React começa a montar centenas de vínculos.
let __lastCount=-1,__stable=0;
requestAnimationFrame(function settleProbe(){
  const count=document.querySelectorAll('svg.archive-lines g[data-link]').length;
  __stable=count>0&&count===__lastCount?__stable+1:0;
  __lastCount=count;
  if(__stable>=3&&window.__readyAt===null)window.__readyAt=performance.now();
  requestAnimationFrame(settleProbe);
});
try{new PerformanceObserver(list=>{for(const entry of list.getEntries())window.__long.push({start:entry.startTime,duration:entry.duration})}).observe({type:'longtask',buffered:true})}catch{}
window.addEventListener('error',event=>window.__errors.push(String(event.message)));
new MutationObserver(()=>{
  const viewport=document.querySelector('.archive-viewport');
  if(viewport&&viewport.dataset.routePlan==='definitive'&&window.__planAppliedAt===null)
    window.__planAppliedAt=performance.now();
}).observe(document.documentElement,{attributes:true,subtree:true,attributeFilter:['data-route-plan']});
window.__frames=[];
window.__events=[];
requestAnimationFrame(function step(frame){
  window.__frames.push(frame);
  if(window.__frames.length>6000)window.__frames.splice(0,3000);
  requestAnimationFrame(step);
});
window.addEventListener('wheel',event=>window.__events.push({kind:'wheel',at:performance.now()}),true);
window.addEventListener('pointermove',event=>window.__events.push({kind:'pointermove',at:performance.now()}),true);
window.__inputLatency=()=>{
  const out={wheel:[],pointermove:[]};
  for(const event of window.__events){
    const frame=window.__frames.find(value=>value>=event.at);
    if(frame!==undefined)out[event.kind].push(frame-event.at);
  }
  return out;
};
window.__routeWorker=()=>{
  if(failing)
    return{onmessage:null,onerror:null,postMessage(){setTimeout(()=>this.onerror&&this.onerror({message:'worker simulado falhou'}),5)},terminate(){}};
  const worker=new Worker('/worker.js',{type:'module'});
  const post=worker.postMessage.bind(worker);
  let handler=null;
  Object.defineProperty(worker,'onmessage',{get(){return handler},set(next){handler=next}});
  worker.addEventListener('message',event=>{
    window.__metrics.worker.push((event.data&&event.data.elapsed)||0);
    const start=performance.now();
    try{handler&&handler(event)}finally{window.__metrics.receive.push(performance.now()-start)}
  });
  worker.addEventListener('error',()=>window.__errors.push('worker error'));
  worker.postMessage=message=>{window.__requests++;const start=performance.now();post(message);window.__metrics.send.push(performance.now()-start)};
  return worker;
};

const card=(id,x,y,parent)=>({id,cardId:id,boardId:'fx',parentPlacementId:parent||null,x,y,width:300,height:200,zIndex:0,branchOffsetX:null,branchOffsetY:null,card:{id,title:'Card '+id,category:'note',summary:'Fixture sintética',content:'',version:0,createdAt:'',updatedAt:'',groups:[]}});
const link=(id,sourceId,targetId)=>({id,sourceId,targetId,relation:'knows',label:'',directed:true,description:'',version:0});
function board(key){
  const placements=[],links=[];
  const boardInfo={id:key,name:key,description:'',version:0,createdAt:'',updatedAt:''};
  if(key==='distantes'){
    for(let i=0;i<500;i++)placements.push(card('d'+i,(i%20)*2600,Math.floor(i/20)*1600));
    for(let i=0;i<499;i++)links.push(link('dl'+i,'d'+(i%250),'d'+(250+i%249)));
    for(let i=0;i<496;i++)links.push(link('dx'+i,'d'+(i%200),'d'+(300+i%200)));
    return{board:boardInfo,placements,links};
  }
  const total=Number(key)||100;
  for(let i=0;i<total;i++)placements.push(card('n'+i,(i%25)*360,Math.floor(i/25)*260,i>=total-10?'n0':null));
  for(let i=1;i<total;i++)links.push(link('l'+i,'n'+Math.max(0,i-1),'n'+i));
  for(let i=0;i<Math.floor(total/4);i++)links.push(link('p'+i,'n'+(i%total),'n'+((i*7+3)%total)));
  return{board:boardInfo,placements,links};
}
const initial=board(scenario);
const second=board('100');
function App(){
  const[graph,setGraph]=useState(initial);
  const[expanded,setExpanded]=useState(new Set());
  const[visual,setVisual]=useState({});
  const[selected,setSelected]=useState(null);
  const[camera,setCamera]=useState({x:0,y:0,zoom:1});
  const[busy,setBusy]=useState(false);
  const projection=useMemo(()=>projectArchive(graph,expanded),[graph,expanded]);
  const layout=useMemo(()=>layoutArchive(projection,{config:{reserveMargin:ARCHIVE_LAYOUT_CONFIG.reserveMargin}}),[projection]);
  const filter=useMemo(()=>filterArchive(layout.graph,projection,EMPTY_ARCHIVE_FILTER),[layout,projection]);
  window.__graph=graph;
  window.__toggleExpand=id=>setExpanded(current=>{const next=new Set(current);next.has(id)?next.delete(id):next.add(id);return next});
  window.__switchBoard=()=>{setGraph(second);setSelected(null);setVisual({});setExpanded(new Set())};
  window.__latency=async(kind,count)=>{
    const viewport=document.querySelector('.archive-viewport');
    const box=viewport.getBoundingClientRect();
    const out=[];
    for(let i=0;i<count;i++){
      const start=performance.now();
      if(kind==='wheel'){
        viewport.dispatchEvent(new WheelEvent('wheel',{deltaY:i%2?140:-140,clientX:box.left+box.width/2,clientY:box.top+box.height/2,bubbles:true,cancelable:true}));
      }else if(kind==='pan'){
        viewport.dispatchEvent(new PointerEvent('pointerdown',{pointerId:7,button:0,clientX:box.left+200,clientY:box.top+200,bubbles:true}));
        for(let step=1;step<=4;step++)viewport.dispatchEvent(new PointerEvent('pointermove',{pointerId:7,clientX:box.left+200+step*12,clientY:box.top+200+step*7,bubbles:true}));
        viewport.dispatchEvent(new PointerEvent('pointerup',{pointerId:7,clientX:box.left+248,clientY:box.top+228,bubbles:true}));
      }else{
        const hit=document.querySelector('path.archive-link-hit');
        if(hit)hit.dispatchEvent(new PointerEvent('pointerdown',{pointerId:9,button:0,bubbles:true,clientX:box.left+box.width/2,clientY:box.top+box.height/2}));
      }
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      out.push(performance.now()-start);
    }
    return out;
  };
  window.__states=()=>{const counts={};for(const node of document.querySelectorAll('[data-route-state]'))counts[node.dataset.routeState]=(counts[node.dataset.routeState]||0)+1;return counts};
  window.__svgCounts=()=>({groups:document.querySelectorAll('svg.archive-lines g[data-link]').length,sockets:document.querySelectorAll('svg.archive-lines circle[data-link-end]').length,paths:document.querySelectorAll('svg.archive-lines path.archive-link').length});
  window.__linkIds=()=>[...document.querySelectorAll('svg.archive-lines g[data-link]')].map(node=>node.dataset.link).sort();
  return <ArchiveCanvas routeWorker={window.__routeWorker} graph={layout.graph} layout={layout} snapshot={graph} nodes={projection.nodes} filter={filter} camera={camera} onCamera={setCamera} selected={selected} onSelect={setSelected} onMenu={()=>{}} visual={visual} onVisual={setVisual} onMove={()=>{}} onConnect={()=>{}} busy={busy} onInteraction={()=>{}}/>;
}
createRoot(document.getElementById('root')).render(<App/>);
`,
  },
  bundle: true,
  format: "esm",
  jsx: "automatic",
  external: ["/archive/*", "/creation/*"],
  outfile: path.join(dir, "app.js"),
  plugins: [
    {
      name: "react-unico",
      setup(b) {
        const require = createRequire(path.join(root, "client/package.json"));
        b.onResolve({ filter: /^react(-dom)?(\/.*)?$/ }, (a) => ({
          path: require.resolve(a.path),
        }));
      },
    },
  ],
});

fs.writeFileSync(
  path.join(dir, "index.html"),
  `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>async</title>
<link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/app.css">
<style>html,body,#root{height:100%;margin:0}.archive-viewport{height:100%}</style>
</head><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>`,
);

const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, "http://local").pathname);
  const candidates =
    pathname === "/app.js" || pathname === "/app.css" || pathname === "/worker.js"
      ? [path.join(dir, pathname)]
      : pathname === "/style.css"
        ? [path.join(root, "client/src/styles.css")]
        : [path.join(dir, "index.html")];
  const file = candidates.find(
    (candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile(),
  );
  if (!file) {
    response.writeHead(404);
    return response.end("nao encontrado");
  }
  const extension = path.extname(file);
  response.writeHead(200, {
    "Content-Type":
      extension === ".css"
        ? "text/css"
        : extension === ".js"
          ? "text/javascript"
          : "text/html",
    "Cache-Control": "no-store",
  });
  fs.createReadStream(file).pipe(response);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });

let checks = 0;
let failures = 0;
const ok = (message) => {
  checks++;
  console.log(`ok ${checks} — ${message}`);
};
const fail = (message, detail) => {
  checks++;
  failures++;
  console.log(
    `FALHA ${checks} — ${message}${detail === undefined ? "" : ` ${JSON.stringify(detail)}`}`,
  );
};
const percentile = (values, ratio) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))];
};
const round = (value) => Math.round(value * 10) / 10;
const max = (values) => (values.length ? Math.max(...values) : 0);
const summary = [];

for (const scenario of scenarios) {
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const started = Date.now();
  await page.goto(`${origin}/?scenario=${scenario}`, { waitUntil: "load" });
  await page.waitForSelector(".archive-viewport", { timeout: 30_000 });
  await page.waitForFunction(() => window.__readyAt !== null, null, {
    timeout: 30_000,
  });

  // Interações ENQUANTO o planejamento roda, com entrada REAL do Chromium.
  // A latência é medida DENTRO da página (evento → próximo frame pintado),
  // sem somar o vai-e-volta do protocolo do Playwright.
  const box = await page.locator(".archive-viewport").boundingBox();
  const centerX = Math.round(box.x + box.width / 2),
    centerY = Math.round(box.y + box.height / 2);
  const settle = () =>
    page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    );
  await page.evaluate(() => {
    window.__events = [];
    window.__burstFrom = performance.now();
  });
  for (let i = 0; i < 8; i++) {
    await page.mouse.move(centerX, centerY);
    await page.mouse.wheel(0, i % 2 ? 140 : -140);
  }
  for (let i = 0; i < 6; i++) {
    await page.mouse.move(centerX, centerY);
    await page.mouse.down();
    for (let step = 1; step <= 4; step++)
      await page.mouse.move(centerX + step * 18, centerY + step * 11);
    await page.mouse.up();
  }
  await settle();
  const inputLatency = await page.evaluate(() => {
    window.__burstTo = performance.now();
    return window.__inputLatency();
  });
  const latency = {
    wheel: inputLatency.wheel ?? [],
    pan: inputLatency.pointermove ?? [],
    select: await page.evaluate(() => window.__latency("select", 4)),
  };

  const definitive = scenario !== "falha";
  let planMs = -1;
  if (definitive) {
    try {
      await page.waitForSelector('.archive-viewport[data-route-plan="definitive"]', {
        timeout: 120_000,
      });
      ok(`${scenario}: plano definitivo aplicado`);
    } catch {
      fail(`${scenario}: plano definitivo não chegou`);
    }
  } else {
    await page.waitForTimeout(800);
  }

  const metrics = await page.evaluate(() => ({
    long: window.__long,
    send: window.__metrics.send,
    receive: window.__metrics.receive,
    worker: window.__metrics.worker,
    requests: window.__requests,
    states: window.__states(),
    svg: window.__svgCounts(),
    errors: window.__errors,
    plan: document.querySelector(".archive-viewport").dataset.routePlan,
    mountedAt: window.__mountedAt,
    readyAt: window.__readyAt,
    planAppliedAt: window.__planAppliedAt,
    burstFrom: window.__burstFrom,
    burstTo: window.__burstTo,
  }));

  const planAt = metrics.planAppliedAt ?? Number.POSITIVE_INFINITY;
  if (Number.isFinite(planAt)) planMs = Math.round(planAt - metrics.mountedAt);
  // Montagem inicial não é planejamento: a janela começa depois do primeiro
  // quadro assentado e termina antes da aplicação do plano.
  const mounting = metrics.long.filter((entry) => entry.start <= metrics.readyAt);
  const inWindow = (entry) =>
    entry.start > metrics.readyAt && entry.start < planAt - 250;
  const inBurst = (entry) =>
    metrics.burstFrom !== null &&
    entry.start >= metrics.burstFrom - 60 &&
    entry.start <= (metrics.burstTo ?? Infinity) + 60;
  // Planejamento ocioso: sem gesto do teste, para não confundir repintura da
  // fixture com trabalho do planejador.
  const during = metrics.long.filter((entry) => inWindow(entry) && !inBurst(entry));
  const burst = metrics.long.filter((entry) => inWindow(entry) && inBurst(entry));
  const apply = metrics.long.filter(
    (entry) => Number.isFinite(planAt) && Math.abs(entry.start - planAt) <= 300,
  );
  const gestures = [...latency.wheel, ...latency.pan];
  const latencyAll = [...gestures, ...latency.select];
  summary.push({
    scenario,
    planMs,
    requests: metrics.requests,
    states: metrics.states,
    groups: metrics.svg.groups,
    longDuring: during.length,
    longDuringMax: round(max(during.map((entry) => entry.duration))),
    longMountMax: round(max(mounting.map((entry) => entry.duration))),
    longBurst: burst.length,
    longBurstMax: round(max(burst.map((entry) => entry.duration))),
    longApplyMax: round(max(apply.map((entry) => entry.duration))),
    sendMax: round(max(metrics.send)),
    receiveMax: round(max(metrics.receive)),
    workerMax: round(max(metrics.worker)),
    wheelP95: round(percentile(latency.wheel, 0.95)),
    panP95: round(percentile(latency.pan, 0.95)),
    selectP95: round(percentile(latency.select, 0.95)),
    latencyMax: round(max(latencyAll)),
    totalMs: Date.now() - started,
  });

  if (pageErrors.length) fail(`${scenario}: erros de página`, pageErrors.slice(0, 2));
  else ok(`${scenario}: nenhum erro de página`);

  if (during.length === 0)
    ok(`${scenario}: planejador não produziu long task na thread principal`);
  else
    console.log(
      `nota — ${scenario}: ${during.length} long task(s) durante o planejamento (máx ${round(max(during.map((entry) => entry.duration)))} ms)`,
    );

  // Limiar documentado: o gesto pode esbarrar na repintura de ~1000 caminhos
  // SVG (custo de apresentação pré-existente), nunca no planejador — que roda
  // no worker e é medido à parte.
  if (max(gestures) < 260)
    ok(
      `${scenario}: gestos durante o planejamento abaixo de 260 ms (pior ${round(max(gestures))} ms)`,
    );
  else
    fail(
      `${scenario}: gesto travou durante o planejamento`,
      round(max(gestures)),
    );
  if (max(latency.select) > 120)
    console.log(
      `nota — ${scenario}: seleção de vínculo custa até ${round(max(latency.select))} ms (re-render do SVG, não do planejador)`,
    );

  if (metrics.requests <= 3)
    ok(`${scenario}: fila sem acúmulo de pedidos (${metrics.requests})`);
  else fail(`${scenario}: pedidos demais para uma geometria`, metrics.requests);

  if (scenario === "falha") {
    if (metrics.plan === "provisional")
      ok("falha: rota provisória permanece, sem planejamento síncrono");
    else fail("falha: quadro não deveria ter plano definitivo", metrics.plan);
    if (metrics.svg.groups > 0) ok("falha: relações continuam visíveis");
    else fail("falha: relações desapareceram");
  } else if (metrics.svg.groups > 0) {
    ok(`${scenario}: todas as relações continuam desenhadas (${metrics.svg.groups})`);
  } else fail(`${scenario}: relação sumiu`);

  const before = metrics.requests;
  for (let i = 0; i < 4; i++) {
    await page.mouse.move(centerX, centerY);
    await page.mouse.wheel(0, i % 2 ? 120 : -120);
    await settle();
  }
  await page.mouse.move(centerX, centerY);
  await page.mouse.down();
  await page.mouse.move(centerX + 70, centerY + 40);
  await page.mouse.up();
  await settle();
  const after = await page.evaluate(() => window.__requests);
  if (after === before) ok(`${scenario}: pan e zoom não pedem replanejamento`);
  else fail(`${scenario}: pan/zoom disparou planejamento`, { before, after });

  if (scenario === "50" || scenario === "200") {
    const stale = await page.evaluate(async () => {
      window.__switchBoard();
      window.__switchBoard();
      window.__switchBoard();
      await new Promise((resolve) => setTimeout(resolve, 150));
      const expected = new Set(window.__graph.links.map((item) => item.id));
      return window.__linkIds().filter((id) => !expected.has(id));
    });
    if (!stale.length) ok(`${scenario}: troca de quadro não deixa vínculo obsoleto`);
    else fail(`${scenario}: vínculo do quadro anterior permaneceu`, stale.slice(0, 3));

    try {
      await page.waitForSelector('.archive-viewport[data-route-plan="definitive"]', {
        timeout: 60_000,
      });
      ok(`${scenario}: plano do quadro novo aplicado`);
    } catch {
      fail(`${scenario}: quadro novo sem plano definitivo`);
    }

    await page.waitForTimeout(700);
    const expected = await page.evaluate(() => window.__graph.links.length);
    const beforeCycles = await page.evaluate(() => window.__svgCounts());
    await page.evaluate(async () => {
      for (let i = 0; i < 6; i++) {
        window.__toggleExpand("n0");
        await new Promise((resolve) => setTimeout(resolve, 140));
      }
    });
    await page.waitForTimeout(700);
    const afterCycles = await page.evaluate(() => window.__svgCounts());
    if (
      afterCycles.groups === beforeCycles.groups &&
      afterCycles.paths === beforeCycles.paths &&
      afterCycles.sockets === afterCycles.groups * 2 &&
      afterCycles.groups > 0
    )
      ok(
        `${scenario}: ciclos de expansão/recolhimento mantêm o SVG estável (${afterCycles.groups} vínculos)`,
      );
    else
      fail(`${scenario}: SVG instável nos ciclos`, {
        beforeCycles,
        afterCycles,
        expected,
      });
  }

  const errors = await page.evaluate(() => window.__errors);
  if (!errors.length) ok(`${scenario}: console sem falha de worker`);
  else fail(`${scenario}: falha registrada no worker`, errors.slice(0, 2));

  await page.close();
}

await browser.close();
server.close();

console.log("\nResumo:");
for (const entry of summary)
  console.log(
    `  ${entry.scenario}: plano=${entry.planMs} ms | long(montagem)=${entry.longMountMax} ms | long(planejamento ocioso)=${entry.longDuring} (máx ${entry.longDuringMax} ms) | long(interação)=${entry.longBurst} (máx ${entry.longBurstMax} ms) | long(aplicação)=${entry.longApplyMax} ms | envio=${entry.sendMax} ms | recepção=${entry.receiveMax} ms | worker=${entry.workerMax} ms | latência p95 wheel=${entry.wheelP95} pan=${entry.panP95} select=${entry.selectP95} (pior ${entry.latencyMax}) | relações=${entry.groups} | estados=${JSON.stringify(entry.states)} | pedidos=${entry.requests} | total=${entry.totalMs} ms`,
  );
console.log(
  `\n${checks} verificações de responsividade assíncrona; ${failures} falha(s).`,
);
if (failures) process.exitCode = 1;
