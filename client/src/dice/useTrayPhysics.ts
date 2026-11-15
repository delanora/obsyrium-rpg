import { playDice } from '../sound';
import { traySoundTimeline } from './traySoundTimeline';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { prepararBandeja, simularBandeja, type PoseDado } from './trayPhysics';
import { prepararRolamento, matrizDoRolamento } from './trayRolling';
import { rollAnimationMs, COMMON_THROW_MS } from './rollAnimation';

const deslocamento = (p: PoseDado) => `translate(calc(-50% + ${p.x * 50}cqw), calc(-50% + ${p.y * 50}cqw))`;

/** A simulação move apenas apresentação; não interfere no dado já rolado. */
export function useTrayPhysics(quantidade: number, animar: boolean, rolagemId?: string, startedAt?: number) {
  const elemento = useRef<HTMLDivElement>(null);
  const posesDeEspera = useRef<string[]>([]);
  const preparacao = useMemo(() => prepararBandeja(quantidade), [quantidade]);
  const simulacao = useMemo(() => rolagemId ? simularBandeja(preparacao.poses, preparacao.raio, rollAnimationMs() - COMMON_THROW_MS) : null, [preparacao, rolagemId]);
  const rolamento = useMemo(() => simulacao ? prepararRolamento(simulacao.quadros, preparacao.raio * .88) : null, [simulacao, preparacao]);
  useLayoutEffect(() => {
    const arena = elemento.current;
    if (!arena) return;
    const ajustarEscala = () => {
      const largura = arena.getBoundingClientRect().width;
      arena.style.setProperty('--physical-box', `${preparacao.raio * largura}px`);
      arena.style.setProperty('--physical-scale', String(preparacao.raio * largura * .88 / 200));
    };
    ajustarEscala();
    const observador = new ResizeObserver(ajustarEscala);
    observador.observe(arena);
    const slots = Array.from(arena.querySelectorAll<HTMLElement>('.common-die-slot'));
    const sombras = Array.from(arena.querySelectorAll<HTMLElement>('.common-die-shadow'));
    const animacoes: Animation[] = [];
    const reduzirMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const poses = simulacao ? simulacao.quadros[simulacao.quadros.length - 1] : preparacao.poses;
    if (simulacao) {
      const duracao = rollAnimationMs();
      arena.dataset.impacts = String(simulacao.impactos);
      if (animar && !reduzirMovimento) {
        const contato = COMMON_THROW_MS / duracao;
        slots.forEach((slot, i) => {
          const inicial = preparacao.poses[i];
          const elevacao = preparacao.raio * .65;
          const trajeto = simulacao.quadros.map((quadro, k) => ({ offset: contato + (1 - contato) * k / (simulacao.quadros.length - 1), transform: deslocamento(quadro[i]) }));
          animacoes.push(slot.animate([
            { offset: 0, transform: deslocamento(inicial) },
            { offset: contato * .15, transform: `${deslocamento({ ...inicial, y: inicial.y - elevacao * .4 })} scale(1.08)` },
            { offset: contato * .46, transform: `${deslocamento({ ...inicial, y: inicial.y - elevacao })} scale(1.24)` },
            { offset: contato * .7, transform: `${deslocamento({ ...inicial, y: inicial.y - elevacao * .78 })} scale(1.16)` },
            ...trajeto,
          ], { duration: duracao, easing: 'linear' }));
          const sombra = sombras[i];
          if (sombra) animacoes.push(sombra.animate([
            { offset: 0, transform: deslocamento(inicial), opacity: .75 },
            { offset: contato * .46, transform: `${deslocamento(inicial)} scale(.7)`, opacity: .25 },
            ...trajeto.map(k => ({ ...k, opacity: .75 })),
          ], { duration: duracao, easing: 'linear' }));
          const orientacao = slot.querySelector<HTMLElement>('.ddie-orient');
          if (orientacao && rolamento) {
            const faceFinal = orientacao.style.transform;
            const largada = `${matrizDoRolamento(rolamento[0][i])} ${faceFinal}`;
            animacoes.push(orientacao.animate([
              { offset: 0, transform: posesDeEspera.current[i] ?? faceFinal },
              { offset: contato * .46, transform: `rotateX(180deg) rotateY(150deg) ${largada}` },
              ...rolamento.map((quadro, k) => ({ offset: contato + (1 - contato) * k / (rolamento.length - 1), transform: `${matrizDoRolamento(quadro[i])} ${faceFinal}` })),
            ], { duration: duracao, easing: 'linear' }));
          }
        });
      }
    }
    const elapsed = startedAt ? Math.max(0, Date.now() - startedAt) : 0;
    const visualStart = performance.now() - elapsed;
    if (animar) animacoes.forEach(animation => { animation.startTime = visualStart; });
    if (animar && simulacao && rolagemId && quantidade > 0) {
      playDice(reduzirMovimento ? { rollId: rolagemId } : {
        rollId: rolagemId, animationStartMs: visualStart, durationMs: rollAnimationMs(), diceCount: quantidade,
        cues: traySoundTimeline(simulacao, preparacao.raio, rollAnimationMs() - COMMON_THROW_MS),
      });
    }
    // A posição final fica como base da animação; ao terminar não há retorno
    // ao lugar de partida nem travessia de outra peça para "encaixar" o dado.
    slots.forEach((slot, i) => {
      if (poses[i]) {
        slot.style.transform = deslocamento(poses[i]);
        if (sombras[i]) sombras[i].style.transform = deslocamento(poses[i]);
      }
      if (!animar) posesDeEspera.current[i] = slot.querySelector<HTMLElement>('.ddie-orient')?.style.transform ?? '';
    });
    return () => { observador.disconnect(); animacoes.forEach(a => a.cancel()); };
  }, [preparacao, simulacao, rolamento, animar, startedAt, rolagemId, quantidade]);
  return elemento;
}
