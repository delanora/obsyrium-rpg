/** Orientação do rolamento em contato com o plano da bandeja. */
export type Quaternion = [number, number, number, number];
export interface PontoRolamento { x: number; y: number }
const IDENTIDADE: Quaternion = [0, 0, 0, 1];

export function multiplicarRotacoes(a: Quaternion, b: Quaternion): Quaternion {
  const [x,y,z,w]=a, [u,v,s,t]=b;
  const q: Quaternion=[w*u+x*t+y*s-z*v,w*v-x*s+y*t+z*u,w*s+x*v-y*u+z*t,w*t-x*u-y*v-z*s];
  const norma=Math.hypot(...q);
  return q.map(n=>n/norma) as Quaternion;
}
export const inversaRotacao = ([x,y,z,w]: Quaternion): Quaternion => [-x,-y,-z,w];

/** Sem deslizamento: ângulo = distância / raio; eixo = normal × percurso. */
export function rotacaoDoPercurso(de: PontoRolamento, para: PontoRolamento, raio: number): Quaternion {
  const dx=para.x-de.x,dy=para.y-de.y;
  const distancia=Math.hypot(dx,dy);
  if(distancia<1e-12)return [...IDENTIDADE];
  const metade=distancia/raio/2;
  return [-dy/distancia*Math.sin(metade),dx/distancia*Math.sin(metade),0,Math.cos(metade)];
}

/** A pose de largada é calculada ao contrário a partir da face final.
 * Cada incremento continua sendo o rolamento exato do percurso; a chegada
 * não precisa acrescentar giro, trocar a face ou arredondar voltas. */
export function prepararRolamento(quadros: PontoRolamento[][], raio: number): Quaternion[][] {
  const rotacoes=quadros.map(quadro=>quadro.map(()=>[...IDENTIDADE] as Quaternion));
  for(let i=0;i<(quadros[0]?.length??0);i++){
    for(let k=1;k<quadros.length;k++)rotacoes[k][i]=multiplicarRotacoes(rotacaoDoPercurso(quadros[k-1][i],quadros[k][i],raio),rotacoes[k-1][i]);
    const inversaFinal=inversaRotacao(rotacoes[rotacoes.length-1][i]);
    for(let k=0;k<quadros.length;k++)rotacoes[k][i]=multiplicarRotacoes(rotacoes[k][i],inversaFinal);
    rotacoes[rotacoes.length-1][i]=[...IDENTIDADE];
  }
  return rotacoes;
}

export function matrizDoRolamento([x,y,z,w]: Quaternion): string {
  return `matrix3d(${[
    1-2*(y*y+z*z),2*(x*y+z*w),2*(x*z-y*w),0,
    2*(x*y-z*w),1-2*(x*x+z*z),2*(y*z+x*w),0,
    2*(x*z+y*w),2*(y*z-x*w),1-2*(x*x+y*y),0,
    0,0,0,1,
  ].map(n=>Number(n.toFixed(10))).join(',')})`;
}
