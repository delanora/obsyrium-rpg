/** Prévia de espectador: React real, relógio controlado e HTTP inteiramente mockado. */
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { JSDOM } from 'jsdom';
import type { DiceRollDto, SessionUser, TableRollActivePayload } from '../src/types';
register('data:text/javascript,'+encodeURIComponent("export async function load(url,context,next){return url.endsWith('.css')?{format:'module',source:'export default {}',shortCircuit:true}:next(url,context)}"),import.meta.url);
const dom=new JSDOM('<html><body><div id="root"></div></body></html>',{url:'http://fixture.local',pretendToBeVisual:true});
const globals=globalThis as unknown as Record<string,unknown>;
for(const name of ['window','document','HTMLElement','Element','Node','Event','MouseEvent','KeyboardEvent','localStorage','sessionStorage','MutationObserver'])globals[name]=name==='window'?dom.window:name==='document'?dom.window.document:(dom.window as unknown as Record<string,unknown>)[name];
globals.IS_REACT_ACT_ENVIRONMENT=true;
const observer=class{observe(){}disconnect(){}unobserve(){}};globals.ResizeObserver=observer;
window.matchMedia=(()=>({matches:false,addEventListener(){},removeEventListener(){}})) as unknown as typeof window.matchMedia;
HTMLElement.prototype.animate=(()=>({cancel(){},currentTime:0})) as unknown as typeof HTMLElement.prototype.animate;
let now=Date.parse('2026-11-15T03:00:00Z'),sequence=0;
const realNow=Date.now;Date.now=()=>now;
const scheduled=new Map<number,{due:number;fn:()=>void}>();
window.setTimeout=((fn:()=>void,delay=0)=>{const id=++sequence;scheduled.set(id,{due:now+delay,fn});return id;}) as typeof window.setTimeout;
window.clearTimeout=((id:unknown)=>{if(typeof id==='number')scheduled.delete(id);}) as typeof window.clearTimeout;
const {act,createElement:h}=await import('react');
const {createRoot}=await import('react-dom/client');
const {useDiceRoller}=await import('../src/dice/useDiceRoller');
const {DiceDock}=await import('../src/dice/DiceDock');
const {rollAnimationMs}=await import('../src/dice/rollAnimation');
let snapshot:TableRollActivePayload[]=[];
globals.fetch=async(path:unknown)=>{
 if(String(path).endsWith('/dice/active'))return new Response(JSON.stringify({activeRolls:snapshot.map(b=>({...b,active:undefined}))}),{status:200});
 if(String(path).includes('/dice/options/'))return new Response('{"options":[]}',{status:200});
 throw new Error(`HTTP inesperado no teste: ${String(path)}`);
};
const user:SessionUser={id:'viewer',username:'viewer',displayName:'Observador',role:'PLAYER'};
let roller!:ReturnType<typeof useDiceRoller>;
function App(){roller=useDiceRoller(user);return h(DiceDock,{roller});}
let root=createRoot(document.getElementById('root')!);
const render=async()=>act(async()=>{root.render(h(App));await Promise.resolve();});
const advance=async(ms:number)=>act(async()=>{
 now+=ms;
 for(;;){const next=[...scheduled].filter(([,v])=>v.due<=now).sort((a,b)=>a[1].due-b[1].due)[0];if(!next)break;scheduled.delete(next[0]);next[1].fn();}
 await Promise.resolve();
});
const active=(id:string,name:string,phase:'idle'|'tumbling'='tumbling'):TableRollActivePayload=>({active:true,userId:id,actorName:name,avatarUrl:'/fixture.png',kind:'free',label:'',at:new Date(now).toISOString(),board:{pool:[{sides:20,locked:false}],bonus:0,advantage:false,disadvantage:false,phase},lastRoll:null});
const roll=(id:string,total:number):DiceRollDto=>({id:`roll-${id}-${now}`,actorUserId:id,actorName:id==='a'?'Umbrae da Lua':'Guerreiro de Ferro',clientId:null,kind:'free',label:'',dice:[{sides:20,value:total}],bonus:0,total,advantage:false,disadvantage:false,isPrivate:false,crit:false,lucky:false,at:new Date(now).toISOString()});
const emitActive=async(p:TableRollActivePayload)=>act(async()=>roller.handlers.onDiceActive?.(p));
const emitRoll=async(r:DiceRollDto)=>act(async()=>roller.handlers.onDiceRoll?.({roll:r}));
const button=(text:string)=>[...document.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent?.includes(text));
const click=async(el:HTMLElement|null|undefined)=>{assert.ok(el);await act(async()=>el.dispatchEvent(new MouseEvent('click',{bubbles:true})));};
try{
 await render();await emitActive(active('a','Umbrae da Lua','idle'));assert.ok(document.querySelector('.dice-spectator-preview'),'A prévia abre enquanto o colega ainda prepara os dados.');
 await advance(60000);assert.ok(document.querySelector('.dice-spectator-preview'),'Os cinco segundos só começam depois do resultado.');
 await click(button('Expandir visualização'));assert.ok(document.querySelector('[role="dialog"]'));assert.ok(document.body.textContent?.includes('Aguardando a rolagem'));
 await click(document.querySelector('[aria-label="Fechar o tabuleiro"]'));
 await emitActive(active('a','Umbrae da Lua'));assert.ok(document.querySelector('.dice-spectator-preview'));assert.notEqual(document.body.style.overflow,'hidden');
 await emitRoll(roll('a',17));await advance(500);
 await emitActive(active('b','Guerreiro de Ferro'));await emitRoll(roll('b',12));
 assert.equal(document.querySelectorAll('.dice-spectator-actor').length,2);
 assert.equal(document.querySelector('.dice-spectator-actor[aria-pressed="true"] span:last-of-type')?.textContent,'Guerreiro');
 await click(button('Umbrae'));assert.equal(document.querySelector('.dice-spectator-actor[aria-pressed="true"] span:last-of-type')?.textContent,'Umbrae');
 await emitActive(active('viewer','Observador'));assert.equal(document.querySelectorAll('.dice-spectator-actor').length,2,'Evento próprio não apaga os colegas.');
 await emitRoll({...roll('private',5),isPrivate:true});await emitRoll({...roll('npc',9),audience:'masters'});assert.equal(document.querySelectorAll('.dice-spectator-actor').length,2);
 await emitActive({...active('a','Umbrae'),active:false});assert.equal(document.querySelectorAll('.dice-spectator-actor').length,2,'Fechar a bandeja do autor não interrompe o resultado público.');
 await advance(rollAnimationMs()-500);assert.equal(document.querySelector('.dice-spectator-preview .dice-total-value')?.textContent,'17');
 await advance(4999);assert.ok(button('Umbrae'));await advance(1);assert.equal(button('Umbrae'),undefined);assert.ok(button('Guerreiro'));
 await click(button('Expandir visualização'));assert.ok(document.querySelector('[role="dialog"][aria-modal="true"]'));assert.equal(document.querySelector('.dice-spectator-preview'),null);
 await advance(500);assert.ok(document.querySelector('[role="dialog"]'),'A visualização grande continua até o espectador fechar.');
 await click(document.querySelector('[aria-label="Fechar o tabuleiro"]'));assert.equal(document.querySelector('.dice-spectator-preview'),null);assert.notEqual(document.body.style.overflow,'hidden');
 await emitActive(active('b','Guerreiro de Ferro'));await emitRoll(roll('b',8));await click(button('Rolar meus dados'));
 assert.equal(document.querySelector('.dice-spectator-preview'),null);assert.ok(document.querySelector('[role="dialog"]'));assert.equal(roller.open,true);
 await click(document.querySelector('[aria-label="Fechar a janela de dados"]'));assert.equal(document.querySelector('.dice-spectator-preview'),null);
 await emitActive(active('empty','Preparando','idle'));await click(button('Expandir visualização'));
 await emitActive({...active('empty','Preparando','idle'),active:false});assert.equal(document.querySelector('[role="dialog"]'),null,'Bandeja fechada sem rolar encerra a espera expandida.');
 await emitActive({...active('d','Umbrae da Lua'),kind:'death-save'});await emitRoll({...roll('d',10),actorName:'Umbrae da Lua',kind:'death-save'});
 assert.ok(document.querySelector('.dice-spectator-preview .dice-stage.is-death-save'));
 assert.equal(document.querySelector('.dice-spectator-preview .dice-common-frame'),null);
 await click(button('Expandir visualização'));assert.ok(document.querySelector('.dice-overlay.is-death-save'));
 await click(document.querySelector('[aria-label="Fechar o tabuleiro"]'));
 await act(async()=>root.unmount());
 // Reconexão: duas bandejas retornam juntas; a duração restante não reinicia.
 now+=20000;const a=active('a','Umbrae da Lua'),b=active('b','Guerreiro de Ferro');a.lastRoll=roll('a',4);b.lastRoll=roll('b',6);
 now+=rollAnimationMs()+4000;snapshot=[a,b];root=createRoot(document.getElementById('root')!);await render();assert.equal(document.querySelectorAll('.dice-spectator-actor').length,2);
 await advance(999);assert.ok(document.querySelector('.dice-spectator-preview'));await advance(1);assert.equal(document.querySelector('.dice-spectator-preview'),null);
 await act(async()=>root.unmount());
 console.log('✔ Prévia automática, retratos, nomes, simultaneidade, privacidade, cinco segundos, expansão, rolagem própria e reconexão. Sem rede ou banco reais.');
}finally{Date.now=realNow;dom.window.close();}
