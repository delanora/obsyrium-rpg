import { useLayoutEffect, useMemo, useRef } from 'react';
import { prepararBandeja, simularBandeja, type PoseDado } from './trayPhysics';
import { prepararRolamento, matrizDoRolamento } from './trayRolling';
import { rollAnimationMs } from './rollAnimation';

const deslocamento = (p: PoseDado) => `translate(calc(-50% + ${p.x * 50}cqw), calc(-50% + ${p.y * 50}cqw))`;

/** A simulação move apenas apresentação; não interfere no dado já rolado. */
export function useTrayPhysics(quantidade: number, animar: boolean, rolagemId?: string) {
  const elemento = useRef<HTMLDivElement>(null);
  const preparacao = useMemo(() => prepararBandeja(quantidade), [quantidade]);
  const simulacao = useMemo(() => rolagemId ? simularBandeja(preparacao.poses, preparacao.raio, rollAnimationMs()) : null, [preparacao, rolagemId]);
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
    const animacoes: Animation[] = [];
    const poses = simulacao ? simulacao.quadros[simulacao.quadros.length - 1] : preparacao.poses;
    if (simulacao) {
      const duracao = rollAnimationMs();
      arena.dataset.impacts = String(simulacao.impactos);
      if (animar && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        slots.forEach((slot, i) => {
          animacoes.push(slot.animate(simulacao.quadros.map(quadro => ({ transform: deslocamento(quadro[i]) })), { duration: duracao, easing: 'linear' }));
          const orientacao = slot.querySelector<HTMLElement>('.ddie-orient');
          if (orientacao && rolamento) {
            const faceFinal = orientacao.style.transform;
            animacoes.push(orientacao.animate(rolamento.map(quadro => ({ transform: `${matrizDoRolamento(quadro[i])} ${faceFinal}` })), { duration: duracao, easing: 'linear' }));
          }
        });
      }
    }
    // A posição final fica como base da animação; ao terminar não há retorno
    // ao lugar de partida nem travessia de outra peça para "encaixar" o dado.
    slots.forEach((slot, i) => { if (poses[i]) slot.style.transform = deslocamento(poses[i]); });
    return () => { observador.disconnect(); animacoes.forEach(a => a.cancel()); };
  }, [preparacao, simulacao, rolamento, animar]);
  return elemento;
}
