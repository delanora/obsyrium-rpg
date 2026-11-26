/**
 * Chromium real com fixture sintética: identidade, encaixes e continuidade das
 * relações do Fichário. Não acessa API, campanha ou banco.
 *
 * Uso: PLAYWRIGHT_MODULE=/caminho/playwright/index.mjs node client/scripts/check-archive-relations-browser.mjs
 * Comparação: ARCHIVE_BASELINE_ROOT=/caminho/checkout node ... --perf
 */
import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import http from "node:http";
import { createRequire } from "node:module";

const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ?? "playwright"
);
const root = process.cwd(),
  source = process.env.ARCHIVE_BASELINE_ROOT ?? root,
  advance = !process.env.ARCHIVE_BASELINE_ROOT,
  perfOnly = process.argv.includes("--perf"),
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "arquivo-relacoes-"));

await build({
  stdin: {
    loader: "tsx",
    resolveDir: path.join(root, "client"),
    contents: `
import React,{useMemo,useState}from'react';
import{createRoot}from'react-dom/client';
import{ArchiveCanvas}from'${source}/client/src/components/archive/ArchiveCanvas';
import{layoutArchive,ARCHIVE_LAYOUT_CONFIG}from'${source}/client/src/components/archive/archiveLayout';
import{projectArchive}from'${source}/client/src/components/archive/archiveProjection';
import{filterArchive,EMPTY_ARCHIVE_FILTER}from'${source}/client/src/components/archive/archiveFilters';
import{fitArchive}from'${source}/client/src/components/archive/archiveCamera';
import{NARRATIVE_RELATIONS,NARRATIVE_RELATION_LABELS}from'${source}/src/modules/shared/narrative';
${advance ? `import{ARCHIVE_RELATION_VISUALS}from'${source}/client/src/components/archive/archiveRelationStyle';` : ""}
import'${source}/client/src/components/archive/archive.css';

const stress=new URLSearchParams(location.search).has('stress');
const routing=new URLSearchParams(location.search).has('routing');
const group=(id,name,color)=>({id,name,color,version:0,description:'',cardCount:0,createdById:'fixture',createdAt:'',updatedAt:''});
const groups=[group('g-a','Núcleo','#b89a5a'),group('g-b','Vestígios','#7f9a83')];
const place=(id,parent,x,y,w,h,category,extra)=>({id,cardId:id,boardId:'test',parentPlacementId:parent??null,x,y,width:w??300,height:h??200,zIndex:0,branchOffsetX:null,branchOffsetY:null,card:{id,title:id,category:category??'note',summary:'Fixture de relações',content:'',version:0,createdAt:'',updatedAt:'',groups:extra??[]}});
const link=(id,source,target,relation,label,directed)=>({id,sourceId:source,targetId:target,relation,label:label??'',directed:directed!==false,description:'',version:0});

function graph(){
  const board={id:'test',name:'Relações',description:'',version:0,createdAt:'',updatedAt:''};
  const placements=[],links=[];
  const push=p=>{placements.push(p);return p};
  if(stress){
    push(place('hub',null,0,0,320,220,'region',[groups[0]]));
    for(let i=0;i<180;i++){
      const angle=(i/180)*Math.PI*2,ring=Math.floor(i/40);
      const id='card-'+i;
      push(place(id,'hub',Math.round(Math.cos(angle)*(900+ring*520)),Math.round(Math.sin(angle)*(900+ring*520)),300,200,i%2?'npc':'locality',i%3?[]:[groups[i%2]]));
      links.push(link('l-'+i,'hub',id,NARRATIVE_RELATIONS[i%NARRATIVE_RELATIONS.length],'',i%2===0));
    }
    return{board,groups,placements,links};
  }
  if(routing){
    const board={id:'rota',name:'Roteamento',description:'',version:0,createdAt:'',updatedAt:''};
    const placements=[
      place('origem',null,0,0,320,200,'region',[groups[0]]),
      place('parede',null,520,-80,320,360,'room',[]),
      place('destino',null,1200,0,320,200,'npc',[groups[0]]),
      place('par-a',null,0,620,320,200,'clue',[]),
      place('par-b',null,940,620,320,200,'item',[]),
      place('longe',null,-760,-520,320,200,'event',[]),
    ];
    const links=[
      link('rota-1','origem','destino','triggers','Atravessa a parede',true),
      link('par-1','par-a','par-b','knows','Sussurra',false),
      link('par-2','par-a','par-b','enemy','Teme',true),
      link('par-3','par-a','par-b','protects','Protege',false),
      link('longo','origem','longe','knows','Uma inscricao longa para medir a capsula',false),
    ];
    return{board,groups,placements,links};
  }
  push(place('cidade',null,0,0,320,220,'region',[groups[0]]));
  push(place('vozes',null,40,340,300,200,'sound',[]));
  push(place('guardiao',null,460,380,300,200,'creature',[groups[0]]));
  push(place('perto-a',null,-620,300,300,200,'room',[]));
  push(place('perto-b',null,-300,330,300,200,'trap',[groups[1]]));
  const camara=push(place('camara',null,-1600,520,300,200,'dungeon',[groups[0]]));
  NARRATIVE_RELATIONS.forEach((relation,index)=>{
    const angle=-Math.PI/2+(index/NARRATIVE_RELATIONS.length)*Math.PI*2,radius=1050;
    const id='tipo-'+relation;
    push(place(id,null,Math.round(120+Math.cos(angle)*radius),Math.round(60+Math.sin(angle)*radius),300,200,index%3===0?'npc':index%3===1?'locality':'clue',index%2?[groups[0]]:[]));
    links.push(link('rel-'+relation,'cidade',id,relation,relation==='custom'?'Sela o pacto':relation==='knows'?'Reconhece a marca antiga na soleira':'',index%2===0));
  });
  links.push(link('par-1','vozes','guardiao','knows','Sussurra',false));
  links.push(link('par-2','vozes','guardiao','enemy','Teme',true));
  links.push(link('par-3','vozes','guardiao','protects','',false));
  links.push(link('curto','perto-a','perto-b','related','',true));
  for(let i=0;i<5;i++){
    push(place('filho-'+i,'camara',-1600,820,300,200,'room',[]));
    links.push(link('filho-link-'+i,'camara','filho-'+i,i%2?'contains':'triggers','',true));
  }
  return{board,groups,placements,links};
}

const initial=graph();
${advance ? "window.__visuals=ARCHIVE_RELATION_VISUALS;" : "window.__visuals=null;"}
window.__labels=NARRATIVE_RELATION_LABELS;
window.__relations=NARRATIVE_RELATIONS;
window.__writes=0;window.__paintTimes=[];window.__issues=[];window.__watch=false;window.__paints=0;
window.__parsePath=d=>{
  if(!d||d[0]!=='M')return null;
  const tokens=d.match(/[MLQ]|-?\\d+(?:\\.\\d+)?/g)||[];
  let i=0;
  if(tokens[i++]!=='M')return null;
  const num=()=>Number(tokens[i++]);
  const points=[],bad=[];
  let point={x:num(),y:num()};
  points.push(point);
  let stretch=point;
  while(i<tokens.length){
    const kind=tokens[i++];
    if(kind==='L'){
      const next={x:num(),y:num()};
      const dx=Math.abs(next.x-stretch.x),dy=Math.abs(next.y-stretch.y);
      if(dx>0.05||dy>0.05){
        const axis=dx<0.05||dy<0.05;
        const diagonal=Math.abs(dx-dy)<Math.max(0.05,Math.min(dx,dy)*0.002);
        if(!axis&&!diagonal)bad.push({dx:+dx.toFixed(2),dy:+dy.toFixed(2)});
      }
      points.push(next);stretch=next;
    }else if(kind==='Q'){
      num();num();
      const next={x:num(),y:num()};
      points.push(next);stretch=next;
    }else return null;
  }
  return {from:points[0],to:points[points.length-1],points,bad};
};
window.__distanceToPoints=(x,y,points)=>{
  let best=Infinity;
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i];
    const dx=b.x-a.x,dy=b.y-a.y,len=dx*dx+dy*dy;
    const t=len<1e-9?0:Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/len));
    const d=Math.hypot(x-(a.x+t*dx),y-(a.y+t*dy));
    if(d<best)best=d;
  }
  return best;
};
window.__checkLinks=()=>{
  const issues=[];const groupsEl=[...document.querySelectorAll('svg.archive-lines g[data-link]')];
  for(const g of groupsEl){
    const main=g.querySelector('path.archive-link:not(.is-temporary)');
    const d=main&&main.getAttribute('d');
    const parsed=window.__parsePath(d);
    if(!parsed){issues.push({kind:'bad-path',id:g.dataset.link,d});continue}
    const from=parsed.from,to=parsed.to;
    if(parsed.bad.length)issues.push({kind:'non-angular',id:g.dataset.link,segments:parsed.bad.slice(0,2)});
    const sheath=g.querySelector('.archive-link-sheath');
    if(sheath&&sheath.getAttribute('d')!==d)issues.push({kind:'sheath-desync',id:g.dataset.link});
    const marker=main.getAttribute('marker-end')||'';
    const directed=!!marker;
    if(directed&&marker!=='url(#archive-relation-'+g.dataset.relation+')')issues.push({kind:'marker-relation',id:g.dataset.link,marker});
    const sockets=[...g.querySelectorAll('circle[data-link-end]')];
    const expected=directed?2:4;
    if(sockets.length!==expected)issues.push({kind:'sockets-count',id:g.dataset.link,sockets:sockets.length,expected});
    for(const s of sockets){
      const start=s.dataset.linkEnd==='start';
      if(!start&&directed)issues.push({kind:'unexpected-end-socket',id:g.dataset.link});
      const p=start?from:to;
      if(Math.abs(+s.getAttribute('cx')-p.x)>0.02||Math.abs(+s.getAttribute('cy')-p.y)>0.02)issues.push({kind:start?'socket-start-offset':'socket-end-offset',id:g.dataset.link,cx:+s.getAttribute('cx'),cy:+s.getAttribute('cy'),p});
    }
    const hit=g.querySelector('path.archive-link-hit');
    if(!hit||hit.getAttribute('d')!==d)issues.push({kind:'hit-desync',id:g.dataset.link});
    const label=g.querySelector('.archive-relation-label');
    if(!label)issues.push({kind:'label-missing',id:g.dataset.link});
    else{
      const t=label.getAttribute('transform')||'';
      const shift=(t.match(/-?\\d+(?:\\.\\d+)?/g)||[0,0]).map(Number);
      const px=+label.dataset.originX+(shift[0]||0),py=+label.dataset.originY+(shift[1]||0);
      // O rótulo precisa estar sobre o próprio trajeto e fora dos cards.
      // Distância ao path real (linhas e arcos), não à corda do canto.
      const total=main.getTotalLength();
      const steps=Math.min(1400,Math.max(24,Math.ceil(total/2)));
      let distance=Infinity;
      for(let s=0;s<=steps;s++){
        const q=main.getPointAtLength((total*s)/steps);
        const dd=Math.hypot(q.x-px,q.y-py);
        if(dd<distance)distance=dd;
      }
      if(distance>1.6)issues.push({kind:'label-off-route',id:g.dataset.link,distance:+distance.toFixed(2)});
      const animating=[...document.querySelectorAll('article[data-motion]')].some(card=>card.dataset.motion!=='rest');
      const ctm=main.getScreenCTM();
      if(ctm&&!animating){
        const screen=new DOMPoint(px,py).matrixTransform(ctm);
        const over=[...document.querySelectorAll('article.archive-card')].find(card=>{
          const motion=card.dataset.motion;
          if(motion==='move'||motion==='entry'||motion==='exit')return false;
          const r=card.getBoundingClientRect();
          return screen.x>r.left+3&&screen.x<r.right-3&&screen.y>r.top+3&&screen.y<r.bottom-3;
        });
        if(over)issues.push({kind:'label-on-card',id:g.dataset.link,card:over.dataset.placement});
      }
      const plates=label.querySelectorAll('rect.archive-relation-plate');
      if(plates.length!==1)issues.push({kind:'label-plates',id:g.dataset.link,count:plates.length});
      else{
        const plate=plates[0];
        if(plate.getAttribute('height')!=='26')issues.push({kind:'label-height',id:g.dataset.link});
        if(+plate.getAttribute('width')<88)issues.push({kind:'label-width',id:g.dataset.link});
      }
      if(label.querySelector('foreignObject'))issues.push({kind:'label-foreign',id:g.dataset.link});
      if(label.querySelectorAll('.archive-relation-gem').length!==2)issues.push({kind:'label-gems',id:g.dataset.link});
    }
    if(g.style.pointerEvents==='none'&&hit&&hit.getAttribute('tabindex')!=='-1')issues.push({kind:'inactive-focusable',id:g.dataset.link});
  }
  const all=document.querySelectorAll('svg.archive-lines circle[data-link-end]').length;
  const inside=groupsEl.reduce((n,g)=>n+g.querySelectorAll('circle[data-link-end]').length,0);
  if(all!==inside)issues.push({kind:'orphan-sockets',all,inside});
  return issues;
};
window.__paintProbe=ms=>{
  window.__paints++;window.__paintTimes.push(ms);
  if(window.__watch){const issues=window.__checkLinks();if(issues.length)window.__issues.push({at:Math.round(performance.now()),issues:issues.slice(0,4)})}
};

function App(){
  const[graph,setGraph]=useState(initial);
  const[expanded,setExpanded]=useState(new Set());
  const[visual,setVisual]=useState({});
  const[selected,setSelected]=useState(null);
  const[filterState,setFilterState]=useState(EMPTY_ARCHIVE_FILTER);
  const[camera,setCamera]=useState({x:0,y:0,zoom:1});
  const[busy,setBusy]=useState(false);
  const projection=useMemo(()=>projectArchive(graph,expanded),[graph,expanded]);
  const layout=useMemo(()=>layoutArchive(projection,{config:{reserveMargin:ARCHIVE_LAYOUT_CONFIG.reserveMargin}}),[projection]);
  const filter=useMemo(()=>filterArchive(layout.graph,projection,filterState),[layout,projection,filterState]);
  window.__layout=layout;window.__graph=graph;window.__filterState=filterState;window.__selected=selected;window.__cameraValue=camera;
  window.__toggle=id=>setExpanded(v=>{const n=new Set(v);n.has(id)?n.delete(id):n.add(id);return n});
  window.__select=id=>setSelected(id?{kind:'link',id}:null);
  window.__setFilter=s=>setFilterState({...EMPTY_ARCHIVE_FILTER,...s});
  window.__fit=()=>{const vp=document.querySelector('.archive-viewport').getBoundingClientRect();setCamera(fitArchive(layout.graph.placements,vp))};
  window.__move=(id,dx,dy)=>{setBusy(true);setTimeout(()=>{setGraph(v=>({...v,placements:v.placements.map(p=>p.id===id?{...p,x:p.x+dx,y:p.y+dy}:p)}));setVisual({});setBusy(false);window.__writes++},120)};
  return <ArchiveCanvas graph={layout.graph} layout={layout} snapshot={graph} nodes={projection.nodes} filter={filter} onToggle={window.__toggle} onConsult={id=>{window.__consulted=id}} camera={camera} onCamera={setCamera} selected={selected} onSelect={s=>setSelected(s)} onMenu={()=>{}} visual={visual} onVisual={setVisual} onMove={(id,g)=>{window.__writes++;setBusy(true);setTimeout(()=>{setGraph(v=>({...v,placements:v.placements.map(p=>p.id===id?{...p,...g}:p)}));setVisual({});setBusy(false)},150)}} onConnect={()=>{}} busy={busy} onInteraction={()=>{}}/>;
}
createRoot(document.getElementById('root')).render(<App/>);
`,
  },
  bundle: true,
  jsx: "automatic",
  external: ["/archive/*", "/creation/*"],
  outfile: path.join(dir, "app.js"),
  plugins: [
    {
      // Baseline e árvore atual compartilham uma única cópia de React.
      name: "react-unico",
      setup(b) {
        const req = createRequire(path.join(root, "client/package.json"));
        b.onResolve({ filter: /^react(-dom)?(\/.*)?$/ }, (a) => ({
          path: req.resolve(a.path),
        }));
      },
    },
    {
      name: "sonda-de-rotas",
      setup(b) {
        b.onLoad({ filter: /archiveLinkRouting\.ts$/ }, (a) => ({
          loader: "ts",
          contents: fs
            .readFileSync(a.path, "utf8")
            .replace(
              /export function planArchiveLinkRoutes\(input: ArchiveRouteInput\): ArchiveRoutePlanSet \{/,
              "export function planArchiveLinkRoutes(input: ArchiveRouteInput): ArchiveRoutePlanSet { (globalThis as any).__routePlans=((globalThis as any).__routePlans??0)+1;",
            ),
        }));
      },
    },
    {
      name: "sonda-de-pintura",
      setup(b) {
        b.onLoad({ filter: /useArchiveMotion\.ts$/ }, (a) => ({
          loader: "ts",
          contents: fs
            .readFileSync(a.path, "utf8")
            .replace(
              /paintRef\.current = \(\) => \{\n/,
              "paintRef.current = () => { const __probeStart = performance.now();\n",
            )
            .replace(
              /\n    };\n    (?=const mounted|r\.retained)/,
              "\n      window.__paintProbe?.(performance.now() - __probeStart);\n    };\n    ",
            ),
        }));
      },
    },
  ],
});

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox"],
});
const context = await browser.newContext({
  viewport: { width: 1700, height: 1050 },
});
const page = await context.newPage();
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(e.message));
const server = http.createServer((request, response) => {
  const p = decodeURIComponent(new URL(request.url, "http://local").pathname);
  if (p.startsWith("/api")) {
    response.writeHead(404);
    return response.end("{}");
  }
  const candidates =
    p === "/app.js" || p === "/app.css"
      ? [path.join(dir, p)]
      : p === "/style.css"
        ? [path.join(root, "client/src/styles.css")]
        : [path.join(root, "client/public", p), path.join(root, "client/src", p)];
  const file = candidates.find(
    (f) => fs.existsSync(f) && fs.statSync(f).isFile(),
  );
  if (file) {
    const ext = path.extname(file);
    const type =
      ext === ".css"
        ? "text/css"
        : ext === ".js"
          ? "text/javascript"
          : ext === ".png"
            ? "image/png"
            : ext === ".woff2"
              ? "font/woff2"
              : ext === ".svg"
                ? "image/svg+xml"
                : "application/octet-stream";
    response.writeHead(200, { "content-type": type });
    return fs.createReadStream(file).pipe(response);
  }
  if (p !== "/") {
    response.writeHead(404);
    return response.end();
  }
  response.writeHead(200, { "content-type": "text/html" });
  response.end(
    '<html data-theme="dark"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/app.css"><style>html,body,#root{margin:0;width:100%;height:100%;overflow:hidden}.archive-viewport{position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;min-height:0!important;border:0!important}</style><div id="root"></div><script src="/app.js"></script></html>',
  );
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;

const checks = [];
const check = (condition, label) => {
  checks.push({ label, ok: !!condition });
};
const issues = () => page.evaluate(() => window.__checkLinks());
const noIssues = async (label) => {
  const found = await issues();
  check(
    found.length === 0,
    `${label} sem desencontro (${JSON.stringify(found.slice(0, 2))})`,
  );
};

if (perfOnly) {
  await page.goto(`${base}/?stress=1`);
  await page.waitForFunction(() => window.__toggle);
  await page.waitForTimeout(200);
  const metrics = await page.evaluate(async () => {
    const links = document.querySelectorAll("svg.archive-lines g[data-link]").length;
    const cardsCollapsed = document.querySelectorAll("article.archive-card").length;
    window.__toggle("hub");
    await new Promise((r) => setTimeout(r, 1600));
    const after = {
      cards: document.querySelectorAll("article.archive-card").length,
      links: document.querySelectorAll("svg.archive-lines g[data-link]").length,
      nodes: document.querySelectorAll("svg.archive-lines *").length,
    };
    window.__paintTimes.length = 0;
    for (let i = 0; i < 6; i++) {
      window.__move("hub", 18, 11);
      await new Promise((r) => setTimeout(r, 360));
    }
    const times = [...window.__paintTimes].sort((a, b) => a - b);
    const at = (q) =>
      times[Math.min(times.length - 1, Math.floor(times.length * q))] ?? 0;
    return {
      cardsCollapsed,
      linksCollapsed: links,
      ...after,
      paints: times.length,
      paintMedian: +at(0.5).toFixed(3),
      paintP95: +at(0.95).toFixed(3),
      paintMax: +(times[times.length - 1] ?? 0).toFixed(3),
    };
  });
  console.log(
    JSON.stringify({
      source: advance ? "atual" : "baseline",
      ...metrics,
      errors: pageErrors.slice(0, 2),
    }),
  );
  await browser.close();
  server.close();
  process.exit(0);
}

await page.goto(`${base}/`);
await page.waitForFunction(() => window.__toggle);
await page.waitForTimeout(400);
await page.evaluate(() => window.__fit());
await page.waitForTimeout(200);

// 1–5. Doze tipos, direção, pontas, rótulos e ausência de arte estrangeira.
const identity = await page.evaluate(() => {
  const groups = [...document.querySelectorAll("svg.archive-lines g[data-link]")];
  const byRelation = new Map();
  for (const g of groups) {
    const relation = g.dataset.relation;
    const main = g.querySelector("path.archive-link");
    const style = getComputedStyle(main);
    const plate = g.querySelector(".archive-relation-plate");
    const text = g.querySelector(".archive-relation-text");
    const visual = window.__visuals[relation];
    byRelation.set(relation, {
      stroke: style.stroke,
      width: parseFloat(style.strokeWidth),
      dash: style.strokeDasharray,
      marker: main.getAttribute("marker-end"),
      sheath: !!g.querySelector(".archive-link-sheath"),
      expected: visual,
      label: text && text.textContent,
      expectedLabel: window.__labels[relation],
      plateWidth: plate && +plate.getAttribute("width"),
      sockets: g.querySelectorAll("circle[data-link-end]").length,
    });
  }
  return { relations: [...byRelation] };
});
const hexToRgb = (hex) =>
  `rgb(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)})`;
const normDash = (value) =>
  String(value ?? "none").replaceAll("px", "").replace(/[ ,]/g, "");
check(identity.relations.length === 12, "doze tipos renderizados no quadro");
for (const [relation, info] of identity.relations) {
  check(
    info.stroke === hexToRgb(info.expected.tone),
    `${relation}: cor do tipo aplicada no traço`,
  );
  check(
    Math.abs(info.width - info.expected.width) < 0.051,
    `${relation}: espessura do tipo`,
  );
  check(
    normDash(info.dash) === normDash(info.expected.dash),
    `${relation}: tracejado do tipo (${info.dash} vs ${info.expected.dash})`,
  );
  check(
    info.sheath === info.expected.sheath,
    `${relation}: camada de profundidade coerente`,
  );
  check(info.label && info.label.length > 0, `${relation}: rótulo presente`);
  check(
    info.sockets === (info.marker ? 2 : 4),
    `${relation}: encaixes coerentes com a direção`,
  );
  check(
    info.marker == null ||
      info.marker === "" ||
      info.marker === `url(#archive-relation-${relation})`,
    `${relation}: ponta nomeada pelo tipo (${info.marker})`,
  );
}
check(
  new Set(identity.relations.map(([, i]) => i.stroke)).size === 12,
  "doze cores distintas entre os tipos",
);
check(
  identity.relations.some(([, i]) => i.dash !== "none") &&
    identity.relations.some(([, i]) => i.dash === "none"),
  "tracejado diferencia tipos sem depender só de cor",
);

// 6. Fixture personalizada preserva o texto do vínculo e do rótulo longo.
const custom = await page.evaluate(() => {
  const g = document.querySelector('g[data-link][data-relation="custom"]');
  const long = [...document.querySelectorAll('g[data-link][data-relation="knows"]')]
    .map((x) => x.querySelector(".archive-relation-text")?.textContent)
    .find((t) => t && t.length > 20);
  return {
    label: g?.querySelector(".archive-relation-text")?.textContent,
    plateWidth: +g.querySelector(".archive-relation-plate").getAttribute("width"),
    longPlate: (() => {
      const groups = [...document.querySelectorAll('g[data-link][data-relation="knows"]')];
      const best = groups
        .map((x) => x.querySelector(".archive-relation-text"))
        .sort((a, b) => b.textContent.length - a.textContent.length)[0];
      const plate = best.closest("g").querySelector(".archive-relation-plate");
      return {
        text: best.textContent.length,
        measured: +best.getComputedTextLength().toFixed(1),
        box: +best.getBBox().width.toFixed(1),
        plate: +plate.getAttribute("width"),
        font: getComputedStyle(best).fontSize,
      };
    })(),
    gems: g.querySelectorAll(".archive-relation-gem").length,
    long,
  };
});
check(custom.label === "Sela o pacto", "rótulo personalizado preservado");
check(custom.long === "Reconhece a marca antiga na soleira", "rótulo longo preservado");
check(
  custom.longPlate.plate >= custom.longPlate.measured + 20 ||
    custom.longPlate.measured < 1,
  `cápsula contém o texto longo (${JSON.stringify(custom.longPlate)})`,
);
check(custom.gems === 2, "ornamentos do rótulo preservados");
await noIssues("estado inicial");

// 7–9. Hover isolado, seleção e teclado.
const pointOf = (relation, ratio = 0.4) =>
  page.evaluate(
    ([relation, ratio]) => {
      const g = [...document.querySelectorAll("svg.archive-lines g[data-link]")].find(
        (x) => x.dataset.relation === relation,
      );
      const p = g.querySelector("path.archive-link");
      const len = p.getTotalLength();
      for (const r of [ratio, 0.5, 0.6, 0.35, 0.7, 0.25, 0.8]) {
        const pt = p.getPointAtLength(len * r);
        const s = new DOMPoint(pt.x, pt.y).matrixTransform(p.getScreenCTM());
        const hit = document.elementFromPoint(s.x, s.y);
        if (hit?.closest?.("g[data-link]") === g)
          return { x: s.x, y: s.y, id: g.dataset.link, targetInside: true };
      }
      return { x: 0, y: 0, id: g.dataset.link, targetInside: false };
    },
    [relation, ratio],
  );
const hoverPoint = await pointOf("enemy", 0.3);
if (hoverPoint.targetInside) {
  const rest = await page.evaluate(
    (id) => {
      const g = document.querySelector(`g[data-link="${id}"]`);
      return {
        width: parseFloat(getComputedStyle(g.querySelector(".archive-link")).strokeWidth),
        fill: getComputedStyle(g.querySelector(".archive-relation-plate")).fill,
      };
    },
    hoverPoint.id,
  );
  await page.mouse.move(hoverPoint.x, hoverPoint.y);
  await page.waitForTimeout(140);
  const hovered = await page.evaluate(
    (id) => {
      const g = document.querySelector(`g[data-link="${id}"]`);
      return {
        width: parseFloat(getComputedStyle(g.querySelector(".archive-link")).strokeWidth),
        fill: getComputedStyle(g.querySelector(".archive-relation-plate")).fill,
        labelHovered: g.querySelector(".archive-relation-label").matches(":hover"),
      };
    },
    hoverPoint.id,
  );
  check(hovered.width > rest.width, "hover na linha engrossa o traço");
  check(
    !hovered.labelHovered,
    `hover na linha não entra no estado de hover do rótulo (${hovered.fill} vs ${rest.fill})`,
  );

  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(80);
  const selected = await page.evaluate(() => ({
    selected: window.__selected,
    cls: document.querySelector("svg.archive-lines g.is-selected")?.dataset.link,
  }));
  check(selected.selected?.id === hoverPoint.id, "clique na linha seleciona a relação");
  check(selected.cls === hoverPoint.id, "seleção é exposta no grupo do vínculo");
  await page.mouse.move(5, 5);
} else {
  check(false, "ponto de hover livre de card disponível");
}

// Hover isolado no rótulo.
const labelPoint = await page.evaluate(() => {
  const g = [...document.querySelectorAll("svg.archive-lines g[data-link]")].find(
    (x) => x.dataset.relation === "ally",
  );
  const r = g.querySelector(".archive-relation-hit").getBoundingClientRect();
  const x = r.x + r.width / 2,
    y = r.y + r.height / 2;
  return {
    x,
    y,
    id: g.dataset.link,
    inside: !!document.elementFromPoint(x, y)?.closest?.("g[data-link]"),
  };
});
if (labelPoint.inside) {
  const before = await page.evaluate(
    (id) => ({
      fill: getComputedStyle(document.querySelector(`g[data-link="${id}"] .archive-relation-plate`)).fill,
      width: parseFloat(getComputedStyle(document.querySelector(`g[data-link="${id}"] .archive-link`)).strokeWidth),
    }),
    labelPoint.id,
  );
  await page.mouse.move(labelPoint.x, labelPoint.y);
  await page.waitForTimeout(140);
  const after = await page.evaluate(
    (id) => ({
      fill: getComputedStyle(document.querySelector(`g[data-link="${id}"] .archive-relation-plate`)).fill,
      width: parseFloat(getComputedStyle(document.querySelector(`g[data-link="${id}"] .archive-link`)).strokeWidth),
    }),
    labelPoint.id,
  );
  const under = await page.evaluate((point) => {
    const element = document.elementFromPoint(point.x, point.y);
    return {
      tag: element?.tagName,
      cls: element?.getAttribute?.("class"),
      link: element?.closest?.("g[data-link]")?.dataset.link,
      expected: point.id,
      hovered: document
        .querySelector(`g[data-link="${point.id}"] .archive-relation-label`)
        ?.matches(":hover"),
    };
  }, labelPoint);
  if (under.link !== under.expected)
    console.log("diagnóstico hover do rótulo:", under);
  check(after.fill !== before.fill, "hover no rótulo realça a cápsula");
  check(after.width > before.width, "hover no rótulo também realça a linha");
  await page.mouse.move(5, 5);
} else check(false, "rótulo livre de card para hover");

// Teclado: foco no caminho clicável e Enter.
const keyboard = await page.evaluate(() => {
  const g = [...document.querySelectorAll("svg.archive-lines g[data-link]")][2];
  const hit = g.querySelector(".archive-link-hit");
  hit.focus();
  return { id: g.dataset.link, focused: document.activeElement === hit };
});
await page.keyboard.press("Enter");
await page.waitForTimeout(100);
const afterKey = await page.evaluate(() => window.__selected);
check(keyboard.focused, "caminho da relação recebe foco");
check(afterKey?.id === keyboard.id, "Enter seleciona a relação focada");

// 10–12. Filtros: destaque, isolamento e inacessibilidade do que está oculto.
await page.evaluate(() =>
  window.__setFilter({ groupIds: ["g-a"], match: "any", mode: "highlight" }),
);
await page.waitForTimeout(420);
const highlight = await page.evaluate(() => {
  const dim = [...document.querySelectorAll('svg.archive-lines g[data-filter-dim="true"]')];
  const normal = [...document.querySelectorAll("svg.archive-lines g[data-link]:not([data-filter-dim])")];
  return {
    dim: dim.length,
    normal: normal.length,
    opacity: dim[0] && getComputedStyle(dim[0].querySelector(".archive-link")).opacity,
    plateOpacity:
      dim[0] && getComputedStyle(dim[0].querySelector(".archive-relation-plate")).opacity,
    kind: dim[0]?.dataset.link,
  };
});
check(highlight.dim > 0 && highlight.normal > 0, "destaque separa vínculos atenuados");
check(
  Math.abs(parseFloat(highlight.opacity) - 0.3) < 0.01 &&
    Math.abs(parseFloat(highlight.plateOpacity) - 0.3) < 0.01,
  `atenuação alcança traço e rótulo (${highlight.opacity}/${highlight.plateOpacity})`,
);

await page.evaluate(() =>
  window.__setFilter({ groupIds: ["g-a"], match: "any", mode: "isolate" }),
);
await page.waitForTimeout(160);
const isolate = await page.evaluate(() => {
  const hidden = [...document.querySelectorAll('svg.archive-lines g[data-filter-hidden="true"]')];
  const visible = [...document.querySelectorAll("svg.archive-lines g[data-link]")].filter(
    (g) => !g.hasAttribute("data-filter-hidden"),
  );
  return {
    hidden: hidden.length,
    visible: visible.length,
    hiddenDisplay: hidden[0] && getComputedStyle(hidden[0]).display,
    visibleClickable: visible.every(
      (g) => g.style.pointerEvents !== "none" || g.querySelector(".archive-link-hit").tabIndex === -1,
    ),
    hiddenFocusable: hidden.some((g) =>
      [...g.querySelectorAll("[tabindex]")].some((e) => e.getClientRects().length > 0),
    ),
  };
});
check(isolate.hidden > 0, "isolamento oculta vínculos fora do grupo");
check(isolate.visible > 0, "isolamento mantém os vínculos do grupo");
check(isolate.hiddenDisplay === "none", "vínculo oculto não é pintado");
check(!isolate.hiddenFocusable, "vínculo oculto não recebe foco");
check(isolate.visibleClickable, "vínculos visíveis continuam interativos");
await noIssues("estado isolado");
await page.evaluate(() => window.__setFilter({ groupIds: [] }));
await page.waitForTimeout(160);

// 13–15. Expansão, recolhimento e reversão rápida com sonda por pintura.
const countLinks = () =>
  page.evaluate(() => ({
    links: document.querySelectorAll("svg.archive-lines g[data-link]").length,
    sockets: document.querySelectorAll("svg.archive-lines circle[data-link-end]").length,
    cards: document.querySelectorAll("article.archive-card").length,
  }));
const beforeExpand = await countLinks();
await page.evaluate(() => {
  window.__issues.length = 0;
  window.__watch = true;
  window.__toggle("camara");
});
await page.waitForTimeout(1500);
const expanded = await countLinks();
const expansionIssues = await page.evaluate(() => window.__issues.slice(0, 3));
check(expanded.links > beforeExpand.links, "expansão acrescenta vínculos dos filhos");
check(expanded.cards > beforeExpand.cards, "expansão acrescenta cards dos filhos");
check(
  expansionIssues.length === 0,
  `expansão sem desencontro por pintura (${JSON.stringify(expansionIssues)})`,
);
await noIssues("após expansão");

await page.evaluate(() => window.__toggle("camara"));
await page.waitForTimeout(1500);
const collapsed = await countLinks();
const collapseIssues = await page.evaluate(() => {
  window.__watch = false;
  return window.__issues.slice(0, 3);
});
check(collapsed.links === beforeExpand.links, "recolhimento remove vínculos dos filhos");
check(
  collapseIssues.length === 0,
  `recolhimento sem vínculo órfão (${JSON.stringify(collapseIssues)})`,
);
await noIssues("após recolhimento");

await page.evaluate(() => {
  window.__issues.length = 0;
  window.__watch = true;
  window.__toggle("camara");
  setTimeout(() => window.__toggle("camara"), 140);
  setTimeout(() => window.__toggle("camara"), 330);
});
await page.waitForTimeout(1800);
const reversal = await countLinks();
const reversalIssues = await page.evaluate(() => {
  window.__watch = false;
  return window.__issues.slice(0, 3);
});
const unique = await page.evaluate(
  () =>
    new Set(
      [...document.querySelectorAll("svg.archive-lines g[data-link]")].map(
        (g) => g.dataset.link,
      ),
    ).size,
);
check(reversal.links === expanded.links, "reversão rápida termina no estado esperado");
check(unique === reversal.links, "reversão não duplica vínculos");
check(
  reversalIssues.length === 0,
  `reversão sem desencontro por pintura (${JSON.stringify(reversalIssues)})`,
);
await noIssues("após reversão");

// 16. Movimento de card: encaixes e rótulo acompanham a nova geometria.
const movedBefore = await page.evaluate(() => window.__writes);
await page.evaluate(() => window.__move("cidade", 180, 120));
await page.waitForTimeout(600);
const movedAfter = await page.evaluate(() => window.__writes);
check(movedAfter > movedBefore, "movimentação registra a nova geometria");
await noIssues("após mover card");

// 17. Redimensionamento por gesto real na alça.
await page.evaluate(() => window.__fit());
await page.waitForTimeout(250);
const handle = await page.locator("article.archive-card .archive-resize.edge-se").first().boundingBox();
if (handle) {
  const writes = await page.evaluate(() => window.__writes);
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + handle.width / 2 + 54, handle.y + handle.height / 2 + 38, {
    steps: 6,
  });
  await page.mouse.up();
  await page.waitForTimeout(600);
  check((await page.evaluate(() => window.__writes)) > writes, "redimensionamento grava geometria");
  await noIssues("após redimensionar");
} else check(false, "alça de redimensionamento disponível");

// 18–19. Pan e zoom preservam a geometria interna das relações.
const freePoint = await page.evaluate(() => {
  for (let y = 80; y < 980; y += 40)
    for (let x = 80; x < 1600; x += 40) {
      const el = document.elementFromPoint(x, y);
      if (
        el &&
        el.closest(".archive-viewport") &&
        !el.closest("article") &&
        !el.closest("g[data-link]")
      )
        return { x, y };
    }
  return null;
});
if (freePoint) {
  const cameraBefore = await page.evaluate(() => JSON.stringify(window.__cameraValue));
  await page.mouse.move(freePoint.x, freePoint.y);
  await page.mouse.down();
  await page.mouse.move(freePoint.x - 180, freePoint.y - 90, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  await page.mouse.wheel(0, -240);
  await page.waitForTimeout(300);
  const cameraAfter = await page.evaluate(() => JSON.stringify(window.__cameraValue));
  check(cameraBefore !== cameraAfter, "pan/zoom alteram somente a câmera");
  await noIssues("após pan e zoom");
} else check(false, "área livre para pan");

// 20. Reduced-motion: a expansão é imediata e continua coerente.
const reduced = await browser.newContext({
  viewport: { width: 1500, height: 950 },
  reducedMotion: "reduce",
});
const reducedPage = await reduced.newPage();
reducedPage.on("pageerror", (e) => pageErrors.push(e.message));
await reducedPage.goto(`${base}/`);
await reducedPage.waitForFunction(() => window.__toggle);
await reducedPage.evaluate(() => window.__toggle("camara"));
await reducedPage.waitForTimeout(120);
const reducedState = await reducedPage.evaluate(() => ({
  links: document.querySelectorAll("svg.archive-lines g[data-link]").length,
  issues: window.__checkLinks(),
  animating: [...document.querySelectorAll("article[data-motion]")].filter(
    (e) => e.dataset.motion !== "rest",
  ).length,
  sockets: document.querySelectorAll("svg.archive-lines circle[data-link-end]").length,
}));
check(reducedState.issues.length === 0, "reduced-motion mantém encaixes coerentes");
check(reducedState.animating === 0, "reduced-motion não deixa cards em animação");
check(reducedState.links > 12, "reduced-motion aplica a expansão");
await reduced.close();

// 21. Consulta Narrativa (duplo clique) não altera as conexões.
await page.evaluate(() => window.__fit());
await page.waitForTimeout(300);
const consultTarget = await page.evaluate(() => {
  const card = [...document.querySelectorAll("article.archive-card")].find((c) =>
    c.querySelector("header strong"),
  );
  const r = card.getBoundingClientRect();
  return {
    x: r.x + r.width / 2,
    y: r.y + r.height * 0.62,
    links: document.querySelectorAll("svg.archive-lines g[data-link]").length,
  };
});
await page.mouse.dblclick(consultTarget.x, consultTarget.y);
await page.waitForTimeout(250);
const consultState = await page.evaluate(() => ({
  consulted: window.__consulted ?? null,
  links: document.querySelectorAll("svg.archive-lines g[data-link]").length,
  issues: window.__checkLinks(),
}));
check(consultState.links === consultTarget.links, "consulta não altera o conjunto de vínculos");
check(consultState.issues.length === 0, "consulta mantém encaixes e rótulos");

// 22. Múltiplos vínculos no mesmo par: rótulos distintos e sem sobreposição.
const parallels = await page.evaluate(() => {
  const groups = [...document.querySelectorAll("svg.archive-lines g[data-link]")].filter((g) =>
    ["par-1", "par-2", "par-3"].includes(g.dataset.link),
  );
  const rects = groups.map((g) => g.querySelector(".archive-relation-plate").getBoundingClientRect());
  const texts = groups.map((g) => g.querySelector(".archive-relation-text").textContent);
  let overlaps = 0;
  for (let i = 0; i < rects.length; i++)
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i],
        b = rects[j];
      if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom)
        overlaps++;
    }
  return { count: groups.length, texts, overlaps };
});
check(parallels.count === 3, "três vínculos entre o mesmo par renderizados");
check(parallels.overlaps === 0, "rótulos paralelos não se sobrepõem");
check(new Set(parallels.texts).size === 3, "rótulos paralelos permanecem distintos");

const paintStats = await page.evaluate(() => {
  const times = [...window.__paintTimes].sort((a, b) => a - b);
  const at = (q) => times[Math.min(times.length - 1, Math.floor(times.length * q))] ?? 0;
  return {
    paints: times.length,
    median: at(0.5),
    p95: at(0.95),
    nodes: document.querySelectorAll("svg.archive-lines *").length,
  };
});

// 23. Roteamento angular: quadro sintético dedicado, com card intermediário.
await page.goto(`${base}/?routing=1`);
await page.waitForFunction(() => window.__toggle);
await page.waitForTimeout(400);
await page.evaluate(() => window.__fit());
await page.waitForTimeout(300);
const routingState = await page.evaluate(() => {
  const g = document.querySelector('g[data-link="rota-1"]');
  const main = g.querySelector("path.archive-link");
  const parsed = window.__parsePath(main.getAttribute("d"));
  const wall = document.querySelector('[data-placement="parede"]').getBoundingClientRect();
  const ctm = main.getScreenCTM();
  const length = main.getTotalLength();
  let insideCard = 0;
  for (let i = 0; i <= 240; i++) {
    const point = main.getPointAtLength((length * i) / 240);
    const screen = new DOMPoint(point.x, point.y).matrixTransform(ctm);
    if (
      screen.x > wall.left + 3 &&
      screen.x < wall.right - 3 &&
      screen.y > wall.top + 3 &&
      screen.y < wall.bottom - 3
    )
      insideCard++;
  }
  const plates = [...document.querySelectorAll('g[data-link^="par-"] .archive-relation-plate')].map(
    (plate) => plate.getBoundingClientRect(),
  );
  let overlaps = 0;
  for (let i = 0; i < plates.length; i++)
    for (let j = i + 1; j < plates.length; j++) {
      const a = plates[i], b = plates[j];
      if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom)
        overlaps++;
    }
  return {
    strategy: g.dataset.route,
    fallback: g.dataset.routeFallback ?? null,
    angular: parsed.bad.length,
    insideCard,
    issues: window.__checkLinks(),
    overlaps,
    plans: window.__routePlans ?? 0,
    paths: [...document.querySelectorAll("svg.archive-lines g[data-link] path.archive-link")].map(
      (path) => path.getAttribute("d"),
    ),
  };
});
check(routingState.strategy && routingState.strategy !== "direct", `desvio usa estratégia angular (${routingState.strategy})`);
check(routingState.fallback === null, "desvio não é fallback de obstáculo");
check(routingState.angular === 0, `trajeto só com eixos e 45 graus (${routingState.angular})`);
check(routingState.insideCard === 0, `trajeto não atravessa o card intermediário (${routingState.insideCard})`);
check(
  routingState.issues.length === 0,
  `encaixes, rótulos e trajetos coerentes no quadro de roteamento (${JSON.stringify(routingState.issues.slice(0, 2))})`,
);
check(routingState.overlaps === 0, "rótulos paralelos separados no quadro de roteamento");
check(routingState.plans > 0, `planejador executado e instrumentado (${routingState.plans})`);
await page.screenshot({ path: path.join(dir, "roteamento.png") });
await page.mouse.move(420, 300);
await page.mouse.wheel(0, -260);
await page.waitForTimeout(300);
const routedAfterZoom = await page.evaluate(() => ({
  plans: window.__routePlans ?? 0,
  camera: JSON.stringify(window.__cameraValue),
  paths: [...document.querySelectorAll("svg.archive-lines g[data-link] path.archive-link")].map(
    (path) => path.getAttribute("d"),
  ),
}));
check(
  routedAfterZoom.plans === routingState.plans,
  `zoom não recalcula rotas (${routingState.plans} -> ${routedAfterZoom.plans})`,
);
check(
  JSON.stringify(routedAfterZoom.paths) === JSON.stringify(routingState.paths),
  "zoom preserva exatamente os trajetos",
);
await page.screenshot({ path: path.join(dir, "roteamento-zoom.png") });

const routingPaintStats = await page.evaluate(() => ({
  paints: window.__paints,
  nodes: document.querySelectorAll("svg.archive-lines *").length,
}));

check(pageErrors.length === 0, `sem erros de página (${pageErrors.slice(0, 2).join(" | ")})`);

const failed = checks.filter((c) => !c.ok);
console.log(
  `Relações Chromium: ${checks.length} verificações; ${failed.length} falhas; ${paintStats.paints} pinturas; ${paintStats.nodes} nós SVG; pintura mediana ${paintStats.median.toFixed(2)} ms / p95 ${paintStats.p95.toFixed(2)} ms. Evidências: ${dir}`,
);
if (routingPaintStats) console.log(`Quadro de roteamento: ${routingPaintStats.nodes} nós SVG.`);
for (const f of failed) console.log(" -", f.label);
await browser.close();
server.close();
if (failed.length) process.exitCode = 1;
