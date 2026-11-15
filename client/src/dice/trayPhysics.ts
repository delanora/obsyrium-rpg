/** Física visual 2D da bandeja; nunca produz nem altera resultados de dados. */
export interface CorpoDado {
  x: number; y: number; vx: number; vy: number;
  rx: number; ry: number; rz: number;
  wx: number; wy: number; wz: number;
}
export interface PoseDado { x: number; y: number; rx: number; ry: number; rz: number }

/** Círculos conservadores envolvem os poliedros, inclusive durante o giro. */
export function avancarCorpos(corpos: CorpoDado[], raio: number, dt: number, amortecimento: number): number {
  let impactos = 0;
  const limite = 1 - raio;
  for (const c of corpos) {
    const atrito = Math.exp(-amortecimento * dt);
    c.vx *= atrito; c.vy *= atrito;
    c.x += c.vx * dt; c.y += c.vy * dt;
    c.rx += c.wx * dt; c.ry += c.wy * dt; c.rz += c.wz * dt;
    c.wx *= Math.exp(-.7 * dt); c.wy *= Math.exp(-.7 * dt); c.wz *= Math.exp(-.7 * dt);
  }
  // Projeção iterativa resolve também contatos simultâneos de pools grandes.
  for (let iteracao = 0; iteracao < 48; iteracao += 1) {
    let penetrou = false;
    for (let i = 0; i < corpos.length; i += 1) {
      const a = corpos[i];
      for (let j = i + 1; j < corpos.length; j += 1) {
        const b = corpos[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const distancia = Math.hypot(dx, dy);
        if (distancia >= 2 * raio) continue;
        if (2 * raio - distancia > 1e-7) penetrou = true;
        const nx = distancia > 1e-9 ? dx / distancia : 1;
        const ny = distancia > 1e-9 ? dy / distancia : 0;
        const correcao = (2 * raio - distancia + 1e-7) / 2;
        a.x -= nx * correcao; a.y -= ny * correcao;
        b.x += nx * correcao; b.y += ny * correcao;
        const aproximacao = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (aproximacao >= 0) continue;
        const impulso = -.8 * aproximacao;
        const tangente = (b.vx - a.vx) * -ny + (b.vy - a.vy) * nx;
        a.vx -= impulso * nx; a.vy -= impulso * ny;
        b.vx += impulso * nx; b.vy += impulso * ny;
        // O choque muda o rolamento das duas peças, além de separá-las.
        a.wx += impulso * ny * 160; b.wx -= impulso * ny * 160;
        a.wy -= impulso * nx * 160; b.wy += impulso * nx * 160;
        a.wz += tangente * 90; b.wz -= tangente * 90;
        impactos += 1;
      }
      const distancia = Math.hypot(a.x, a.y);
      if (distancia > limite) {
        if (distancia - limite > 1e-7) penetrou = true;
        const nx = a.x / distancia, ny = a.y / distancia;
        a.x = nx * limite; a.y = ny * limite;
        const saida = a.vx * nx + a.vy * ny;
        if (saida > 0) {
          a.vx -= 1.65 * saida * nx; a.vy -= 1.65 * saida * ny;
          a.wz += (a.vx * ny - a.vy * nx) * 110;
          impactos += 1;
        }
      }
    }
    if (!penetrou) break;
  }
  return impactos;
}

/** Empacotamento hexagonal, com margem até a borda e entre as peças. */
export function prepararBandeja(quantidade: number): { raio: number; poses: PoseDado[] } {
  let raio = Math.min(.235, .65 / Math.sqrt(Math.max(1, quantidade)));
  for (;;) {
    const pontos: PoseDado[] = [];
    const passo = raio * 2.2;
    for (let linha = -20; linha <= 20; linha += 1) {
      for (let coluna = -20; coluna <= 20; coluna += 1) {
        const x = (coluna + (Math.abs(linha) % 2) / 2) * passo;
        const y = linha * passo * Math.sqrt(3) / 2;
        if (Math.hypot(x, y) <= 1 - raio * 1.2) pontos.push({ x, y, rx: 0, ry: 0, rz: 0 });
      }
    }
    pontos.sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y) || a.y - b.y || a.x - b.x);
    if (pontos.length >= quantidade) return { raio, poses: pontos.slice(0, quantidade) };
    raio *= .9;
  }
}

/** Passo fixo e ordem estável: autor e espectadores reproduzem os mesmos choques. */
export function simularBandeja(inicio: PoseDado[], raio: number, duracaoMs: number) {
  const corpos: CorpoDado[] = inicio.map((p, i) => {
    const alvo = inicio[(i + 1) % inicio.length];
    const angulo = inicio.length > 1 ? Math.atan2(alvo.y - p.y, alvo.x - p.x) : .6;
    return { ...p, vx: Math.cos(angulo) * 3.8, vy: Math.sin(angulo) * 3.8,
      wx: 1450 * (i % 2 ? -1 : 1), wy: -1050, wz: 700 * (i % 2 ? 1 : -1) };
  });
  const quadros: PoseDado[][] = [inicio.map(p => ({ ...p }))];
  const passos = Math.ceil(duracaoMs / 1000 * 120);
  const dt = duracaoMs / 1000 / passos / 4;
  let impactos = 0;
  for (let quadro = 1; quadro <= passos; quadro += 1) {
    const progresso = quadro / passos;
    for (let subpasso = 0; subpasso < 4; subpasso += 1) {
      impactos += avancarCorpos(corpos, raio, dt, progresso < .45 ? .6 : 12);
    }
    quadros.push(corpos.map(c => ({ x: c.x, y: c.y, rx: c.rx, ry: c.ry, rz: c.rz })));
  }
  // A desaceleração entra na velocidade de TODO o percurso; não existe
  // uma fase final que puxa a orientação para o resultado. Distribuir a
  // volta residual desde o primeiro quadro preserva os choques e permite
  // terminar com velocidade zero e rotação equivalente à identidade.
  for (let i = 0; i < corpos.length; i += 1) {
    for (const eixo of ['rx', 'ry', 'rz'] as const) {
      const acumulados = [0];
      for (let k = 1; k <= passos; k += 1) {
        const progresso = (k - .5) / passos;
        const restante = Math.min(1, (1 - progresso) / .6);
        const freio = restante * restante * (3 - 2 * restante);
        acumulados.push(acumulados[k - 1] + (quadros[k][i][eixo] - quadros[k - 1][i][eixo]) * freio);
      }
      const total = acumulados[passos];
      const voltas = Math.round(total / 360) * 360;
      const proporcao = Math.abs(total) > 1e-9 ? voltas / total : 0;
      for (let k = 0; k <= passos; k += 1) quadros[k][i][eixo] = acumulados[k] * proporcao;
      quadros[passos][i][eixo] = voltas;
    }
  }
  return { quadros, impactos };
}
