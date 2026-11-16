/** Regressão de inert/portais: navegador real, callbacks simulados e nenhuma API. */
import { build } from 'esbuild';
// Permite usar a instalação de Playwright do ambiente sem acoplar o teste ao host.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
import { createServer } from 'node:http';
import assert from 'node:assert/strict';
const { outputFiles } = await build({ stdin: { contents: `
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {MasterDetailModal} from './src/components/master/MasterDetailModal';
import {DeleteCharacterDialog} from './src/components/master/DeleteCharacterDialog';
import {LevelDownDialog} from './src/components/master/LevelDownDialog';
const character={name:'Personagem descartável',ownerUsername:'fixture',classes:[{classKey:'fighter',name:'Guerreiro',level:2,hitDie:10}],levelHistory:[],derived:{modifiers:{constitution:0}},features:[]};
function App(){const[mode,setMode]=useState('');return <MasterDetailModal kind="Ficha" title="Fixture" suspended={!!mode} onClose={()=>{}} actions={<><button onClick={()=>setMode('delete')}>Excluir</button><button onClick={()=>setMode('level')}>Reduzir</button></>}>
{mode==='delete'&&<DeleteCharacterDialog character={character} onCancel={()=>setMode('')} onConfirm={async()=>{window.calls.push('delete');throw Error('Falha simulada da exclusão');}}/>}
{mode==='level'&&<LevelDownDialog character={character} onClose={()=>setMode('')} apply={async()=>{window.calls.push('level');throw Error('Falha simulada da redução');}}/>}
</MasterDetailModal>};window.calls=[];window.fetch=()=>{throw Error('HTTP proibido no teste')};createRoot(document.getElementById('root')).render(<App/>);
`, resolveDir: new URL('../', import.meta.url).pathname, loader: 'tsx' },bundle:true,write:false,format:'esm',jsx:'automatic' });
const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/fixture.js'?'text/javascript':'text/html');res.end(req.url==='/fixture.js'?outputFiles[0].text:'<meta charset="utf-8"><style>.modal-backdrop{position:fixed;inset:0;z-index:60;background:#ddd}.is-confirm{z-index:62}#root{position:relative;z-index:1}</style><div id="root"></div><script type="module" src="/fixture.js"></script>')});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{browser=await chromium.launch({headless:true,args:['--no-sandbox']});const page=await browser.newPage();page.on('dialog',()=>{throw Error('Popup nativo não deve ser aberto');});await page.goto(`http://127.0.0.1:${server.address().port}`);
for(let [open,label,confirm,error,call] of [['Excluir','Excluir Personagem descartável','excluir personagem e conta','Falha simulada da exclusão','delete'],['Reduzir','Reduzir nível','reduzir nível','Falha simulada da redução','level']]){
 await page.getByRole('button',{name:open,exact:true}).click();const dialog=page.getByRole('dialog',{name:label,exact:true});await dialog.waitFor();assert.equal(await dialog.evaluate(el=>!!el.closest('[inert]')),false);assert.equal(await page.locator('[inert]').count(),1);if(call==='delete'){
 await dialog.getByRole('button',{name:confirm,exact:true}).click();
 await dialog.getByText('Você tem certeza?',{exact:false}).waitFor();
 assert.equal(await page.evaluate(()=>window.calls.length),0);
 await dialog.getByRole('button',{name:'cancelar',exact:true}).click();
 await page.getByRole('button',{name:open,exact:true}).click();
 await dialog.getByRole('button',{name:confirm,exact:true}).click();
 confirm='sim, excluir definitivamente';
}
await dialog.getByRole('button',{name:confirm,exact:true}).click();await dialog.getByText(error,{exact:true}).waitFor();assert.equal(await page.evaluate(c=>window.calls.filter(x=>x===c).length,call),1);await dialog.getByRole('button',{name:'cancelar',exact:true}).click();assert.equal(await page.locator('[inert]').count(),0);
}console.log('Exclusão e redução: confirmação clicável fora de inert, callback único, erro visível e cancelamento verificados sem API/banco.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
