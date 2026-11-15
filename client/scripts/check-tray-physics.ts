import assert from 'node:assert/strict';
import { avancarCorpos, prepararBandeja, simularBandeja } from '../src/dice/trayPhysics.ts';
import { prepararRolamento, rotacaoDoPercurso, multiplicarRotacoes, inversaRotacao, type Quaternion } from '../src/dice/trayRolling.ts';
const mesmaRotacao=(a:Quaternion,b:Quaternion)=>Math.abs(a.reduce((s,n,i)=>s+n*b[i],0))>1-1e-9;
for (const n of [1,2,3,8,20,50,100]) {
 const {raio,poses}=prepararBandeja(n);
 const inicio=performance.now();const plano=simularBandeja(poses,raio,2250);
 const rotacoes=prepararRolamento(plano.quadros,raio*.88);
 let menor=Infinity,excesso=0;
 for (let k=0;k<plano.quadros.length;k++)for(let i=0;i<n;i++){
  const p=plano.quadros[k][i];
  excesso=Math.max(excesso,Math.hypot(p.x,p.y)+raio-1);
  for(let j=i+1;j<n;j++)menor=Math.min(menor,Math.hypot(p.x-plano.quadros[k][j].x,p.y-plano.quadros[k][j].y)-2*raio);
  if(k){
   const incremento=multiplicarRotacoes(rotacoes[k][i],inversaRotacao(rotacoes[k-1][i]));
   const esperado=rotacaoDoPercurso(plano.quadros[k-1][i],p,raio*.88);
   assert.ok(mesmaRotacao(incremento,esperado),'O giro precisa acompanhar direção e distância do percurso, inclusive após impactos.');
  }
 }
 assert.ok(menor> -0.000005,`sobreposição ${n}: ${menor}`);assert.ok(excesso<1e-7);
 assert.ok(plano.impactos>0);assert.ok(rotacoes.at(-1)!.every(q=>mesmaRotacao(q,[0,0,0,1])));
 console.log(n,'peças:',plano.impactos,'impactos; rolamento sem deslizamento;',Math.round(performance.now()-inicio),'ms');
 if(n===8)assert.deepEqual(simularBandeja(poses,raio,2250),plano);
}
const corpo=(x:number,vx:number)=>({x,y:0,vx,vy:0});
const corpos=[corpo(-.19,1),corpo(.19,-1)];
assert.ok(avancarCorpos(corpos,.2,.001,0)>0);assert.ok(corpos[0].vx<0&&corpos[1].vx>0);
const direita=rotacaoDoPercurso({x:0,y:0},{x:.2,y:0},.2);
assert.ok(direita[1]>0&&Math.abs(direita[0])<1e-12);
assert.ok(Math.abs(2*Math.acos(direita[3])-1)<1e-12,'Percorrer um raio exige um radiano de giro.');
console.log('✔ Eixo, sentido, distância, colisões e face final preservados.');
