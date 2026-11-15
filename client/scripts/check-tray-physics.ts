import assert from 'node:assert/strict';
import {avancarCorpos, prepararBandeja, simularBandeja} from '../src/dice/trayPhysics.ts';
for (const n of [1,2,3,8,20,50,100]) {
 const {raio,poses}=prepararBandeja(n);
 const inicio=performance.now();const plano=simularBandeja(poses,raio,2250);
 let menor=Infinity,excesso=0;
 for (const quadro of plano.quadros) for(let i=0;i<n;i++){
  excesso=Math.max(excesso,Math.hypot(quadro[i].x,quadro[i].y)+raio-1);
  for(let j=i+1;j<n;j++)menor=Math.min(menor,Math.hypot(quadro[i].x-quadro[j].x,quadro[i].y-quadro[j].y)-2*raio);
 }
 assert.ok(menor> -0.000005,`sobreposição ${n}: ${menor}`);assert.ok(excesso<1e-7);
 assert.ok(plano.impactos>0);assert.ok(plano.quadros.at(-1)!.every(p=>['rx','ry','rz'].every(k=>Math.abs(p[k as 'rx']%360)<1e-6)));
 // O pouso não congela nem inverte o giro para alcançar a face final.
 const inicioPouso=Math.floor((plano.quadros.length-1)*.85);
 for(let i=0;i<n;i++)for(const eixo of ['rx','ry','rz'] as const){
  const sentido=Math.sign(plano.quadros[inicioPouso][i][eixo]-plano.quadros[inicioPouso-1][i][eixo]);
  for(let k=inicioPouso+1;k<plano.quadros.length;k++)assert.ok((plano.quadros[k][i][eixo]-plano.quadros[k-1][i][eixo])*sentido>=-1e-7);
  const antes=plano.quadros[inicioPouso][i][eixo]-plano.quadros[inicioPouso-1][i][eixo];
  const depois=plano.quadros[inicioPouso+1][i][eixo]-plano.quadros[inicioPouso][i][eixo];
  assert.ok(Math.abs(depois-antes)<Math.abs(antes)*.1+.01);
  const fim=plano.quadros.at(-1)![i][eixo]-plano.quadros.at(-2)![i][eixo];
  assert.ok(Math.abs(fim)<.15);
 }
 console.log(n,'peças:',plano.impactos,'impactos;',Math.round(performance.now()-inicio),'ms; separação mínima',menor);
 if(n===8)assert.deepEqual(simularBandeja(poses,raio,2250),plano);
}
const corpo=(x:number,vx:number)=>({x,y:0,vx,vy:0,rx:0,ry:0,rz:0,wx:0,wy:0,wz:0});
const corpos=[corpo(-.19,1),corpo(.19,-1)];
assert.ok(avancarCorpos(corpos,.2,.001,0)>0);assert.ok(corpos[0].vx<0&&corpos[1].vx>0);assert.notEqual(corpos[0].wy,0);assert.notEqual(corpos[1].wy,0);
console.log('✔ Colisão frontal altera trajetória e giro das duas peças.');
