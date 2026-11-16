/** Carrossel real no navegador, estado local descartável e nenhuma API. */
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const { outputFiles } = await build({ stdin: { contents: `
import React,{useState} from 'react';import{createRoot}from'react-dom/client';
import{ChoiceGallery}from'./src/components/creation/ChoiceGallery';
function App(){const[selected,setSelected]=useState(null),[preview,setPreview]=useState(-1);window.selected=selected;window.preview=preview;
return <ChoiceGallery onPreviewIndex={setPreview}>{['Um','Dois','Três','Quatro','Cinco'].map((name,i)=><button key={name} aria-pressed={i===selected} onClick={()=>setSelected(i)}>{name}</button>)}</ChoiceGallery>};createRoot(document.getElementById('root')).render(<App/>);
`,resolveDir:new URL('../',import.meta.url).pathname,loader:'tsx'},bundle:true,write:false,format:'esm',jsx:'automatic',loader:{'.css':'empty'} });
const css=readFileSync(new URL('../src/components/creation/choice-gallery.css',import.meta.url),'utf8');
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/fixture.js'?'text/javascript':'text/html');res.end(req.url==='/fixture.js'?outputFiles[0].text:`<meta charset="utf-8"><style>body{margin:0}.choice-gallery-shell{width:700px;max-width:100%}.choice-gallery{gap:18px}button{width:130px;height:130px;flex:0 0 130px}</style><style>${css}</style><div id="root" class="wizard-overlay"></div><script type="module" src="/fixture.js"></script>`)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});const page=await browser.newPage();await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>window.selected===0);await page.waitForTimeout(400);
 const gallery=page.locator('.choice-gallery');
 for(const delta of [-185,190,850,-990]){
  const box=await gallery.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+delta,box.y+box.height/2,{steps:15});await page.mouse.up();await page.waitForTimeout(950);
  const nearest=await gallery.evaluate(el=>{const center=el.getBoundingClientRect().left+el.clientWidth/2;const cards=[...el.querySelectorAll('button')];const nearest=cards.sort((a,b)=>Math.abs(a.getBoundingClientRect().left+a.getBoundingClientRect().width/2-center)-Math.abs(b.getBoundingClientRect().left+b.getBoundingClientRect().width/2-center))[0];return{gap:Math.abs(nearest.getBoundingClientRect().left+nearest.getBoundingClientRect().width/2-center),index:Number(nearest.dataset.galleryIndex)}});
  assert.ok(nearest.gap<2,`Encaixe central: ${nearest.gap}`);assert.equal(await page.evaluate(()=>window.preview),nearest.index);assert.equal(await page.evaluate(()=>window.selected),0);
 }
 console.log('Carrossel: primeira seleção, prévia independente, encaixe e loop nos dois sentidos passaram, sem API/banco.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
