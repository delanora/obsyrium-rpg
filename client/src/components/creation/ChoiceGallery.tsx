import { Children, cloneElement, isValidElement, useEffect, useLayoutEffect, useRef, type HTMLAttributes } from 'react';
import './choice-gallery.css';
import { outerIconAura } from './outerIconAura';

/** Navegar pelo carrossel nunca altera a escolha; somente o clique no card seleciona. */
export function ChoiceGallery({ children, className = '', onPreviewIndex, ...props }: HTMLAttributes<HTMLDivElement> & { onPreviewIndex?: (index: number) => void }) {
  const cards = Children.toArray(children);
  const selected = cards.find(card => isValidElement<{ 'aria-pressed'?: boolean }>(card) && card.props['aria-pressed']);
  const selectedKey = isValidElement(selected) ? selected.key : null;
  const compact = cards.length >= 4;
  const firstEnabled = cards.find(card => isValidElement<{ disabled?: boolean }>(card) && !card.props.disabled);
  const firstEnabledKey = isValidElement(firstEnabled) ? firstEnabled.key : null;
  const selectedIndex = Math.max(0, cards.indexOf(selected!));
  const previewCallback = useRef(onPreviewIndex);
  previewCallback.current = onPreviewIndex;
  const previewIndex = useRef(-1);
  const root = useRef<HTMLDivElement>(null);
  const previousSelection = useRef<string | null>(null);
  const dragging = useRef(false);
  const gesture = useRef<{ x: number; scroll: number; pointer: number; moved: boolean } | null>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (settleTimer.current) clearTimeout(settleTimer.current); }, []);
  useEffect(() => {
    if (compact && !selectedKey) root.current?.querySelector<HTMLButtonElement>(':scope > button:not([disabled])')?.click();
  }, [compact, selectedKey, firstEnabledKey]);
  useEffect(() => {
    if (!compact) return;
    let cancelled = false;
    const buttons = root.current?.querySelectorAll<HTMLElement>(':scope > button.is-selected');
    for (const button of buttons ?? []) {
      const image = button.querySelector<HTMLImageElement>('img.race-face-asset, img.class-emblem-art');
      if (!image) continue;
      void outerIconAura(image.src).then(url => {
        if (!cancelled) button.style.setProperty('--outer-icon-aura', `url("${url}")`);
      }).catch(() => { /* Sem halo se a arte não puder ser lida; seleção continua funcional. */ });
    }
    return () => { cancelled = true; };
  }, [compact, selectedKey]);
  function settle() {
    if (dragging.current) return;
    if (gesture.current?.moved) gesture.current = null;
    normalizeLoop();
    const element = root.current;
    if (!element || !compact) return;
    const buttons = [...element.querySelectorAll<HTMLElement>(':scope > button')];
    const center = element.scrollLeft + element.clientWidth / 2;
    const nearest = buttons.reduce<HTMLElement | null>((best, card) => {
      const distance = (item: HTMLElement) => Math.abs(item.offsetLeft - element.offsetLeft + item.offsetWidth / 2 - center);
      return !best || distance(card) < distance(best) ? card : best;
    }, null);
    if (nearest) {
      const left = nearest.offsetLeft - element.offsetLeft - (element.clientWidth - nearest.offsetWidth) / 2;
      if (Math.abs(element.scrollLeft - left) > 1) element.scrollTo({ left, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    }
  }
  function normalizeLoop() {
    const element = root.current;
    if (!element) return;
    const buttons = element.querySelectorAll<HTMLElement>(':scope > button');
    if (compact && buttons.length >= cards.length * 7) {
      const cycle = buttons[cards.length].offsetLeft - buttons[0].offsetLeft;
      let shift = 0;
      if (cycle > 0 && element.scrollLeft < cycle * 1.5) shift = cycle;
      else if (cycle > 0 && element.scrollLeft > cycle * 4.5) shift = -cycle;
      if (shift) {
        // As cópias recém-visíveis precisam receber escala e opacidade antes
        // da pintura, sem interpolar os valores que tinham fora da tela.
        element.classList.add('is-rebasing');
        element.scrollTo({ left: element.scrollLeft + shift, behavior: 'instant' });
        if (gesture.current) gesture.current.scroll += shift;
        highlightCenter();
        void element.offsetWidth;
        requestAnimationFrame(() => element.classList.remove('is-rebasing'));
      }
    }
  }
  function highlightCenter() {
    const element = root.current;
    if (!element) return;
    const center = element.getBoundingClientRect().left + element.clientWidth / 2;
    let nearestIndex = -1;
    let nearestDistance = Infinity;
    for (const card of element.querySelectorAll<HTMLElement>(':scope > button')) {
      const rect = card.getBoundingClientRect();
      const distance = Math.abs(rect.left + rect.width / 2 - center);
      if (distance < nearestDistance) { nearestDistance = distance; nearestIndex = Number(card.dataset.galleryIndex); }
      card.style.setProperty('--carousel-scale', String(Math.max(.62, 1.12 - distance / 700) + .14 * Math.max(0, 1 - distance / card.offsetWidth)));
      const pitch = card.offsetWidth + parseFloat(getComputedStyle(element).columnGap || '0');
      const fade = Math.max(0, distance / pitch - 1.15);
      card.style.setProperty('--carousel-opacity', String(Math.max(.08, 1 - fade * .48)));
    }
    if (nearestIndex >= 0 && nearestIndex !== previewIndex.current) {
      previewIndex.current = nearestIndex;
      previewCallback.current?.(nearestIndex);
    }
  }
  useLayoutEffect(() => {
    if (!compact) return;
    const element = root.current;
    const matches = element ? [...element.querySelectorAll<HTMLElement>(`[data-gallery-index="${selectedIndex}"]`)] : [];
    const center = element ? element.scrollLeft + element.clientWidth / 2 : 0;
    const card = previousSelection.current === null ? matches[3] : matches.reduce<HTMLElement | undefined>((closest, candidate) => {
      const distance = (item: HTMLElement) => Math.abs(item.offsetLeft - (element?.offsetLeft ?? 0) + item.offsetWidth / 2 - center);
      return !closest || distance(candidate) < distance(closest) ? candidate : closest;
    }, undefined);
    if (!element || !card) return;
    const centerSelected = (behavior: ScrollBehavior) => {
      element.scrollTo({ left: card.offsetLeft - element.offsetLeft - (element.clientWidth - card.offsetWidth) / 2, behavior });
      highlightCenter();
    };
    const animate = previousSelection.current !== null && previousSelection.current !== selectedKey
      && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    previousSelection.current = selectedKey ?? '__sem-escolha__';
    centerSelected(animate ? 'smooth' : 'auto');
    let width = element.clientWidth;
    const observer = new ResizeObserver(() => {
      if (element.clientWidth !== width) { width = element.clientWidth; centerSelected('auto'); }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [selectedKey, compact]);
  return <div className={`choice-gallery-shell${compact ? ' is-compact' : ''}`}><div {...props} ref={root} className={`${className} choice-gallery${compact ? ' is-compact' : cards.length < 4 ? ' is-small-selection' : ''}`}
    onScroll={() => {
      highlightCenter();
      if (settleTimer.current) clearTimeout(settleTimer.current);
      // Reposicionar cópias só depois do deslocamento; interromper o scroll suave
      // na metade do ciclo fazia a seleção oscilar entre Halfling e Humano.
      settleTimer.current = setTimeout(settle, 180);
    }}
    onPointerDown={event => {
      if (!compact || event.button !== 0) return;
      if (settleTimer.current) clearTimeout(settleTimer.current);
      event.currentTarget.scrollTo({ left: event.currentTarget.scrollLeft, behavior: 'instant' });
      gesture.current = { x: event.clientX, scroll: event.currentTarget.scrollLeft, pointer: event.pointerId, moved: false };
    }}
    onPointerMove={event => {
      const state = gesture.current;
      if (!state || state.pointer !== event.pointerId || event.buttons === 0) return;
      const delta = event.clientX - state.x;
      if (!state.moved && Math.abs(delta) < 6) return;
      state.moved = true;
      dragging.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      event.currentTarget.scrollLeft = state.scroll - delta;
      normalizeLoop();
    }}
    onPointerUp={event => {
      dragging.current = false;
      if (settleTimer.current) clearTimeout(settleTimer.current);
      settleTimer.current = setTimeout(settle, 180);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    }}
    onPointerCancel={() => { dragging.current = false; gesture.current = null; settleTimer.current = setTimeout(settle, 180); }}
    onClickCapture={event => {
      if (gesture.current?.moved) { event.preventDefault(); event.stopPropagation(); gesture.current = null; }
    }}
    onDragStart={event => event.preventDefault()}>
    {compact ? Array.from({ length: 7 }, (_, cycle) => cards.map((card, index) =>
      isValidElement<HTMLAttributes<HTMLButtonElement>>(card) ? cloneElement(card, {
        key: `${cycle}:${card.key}`, 'data-gallery-index': index,
        ...(cycle !== 3 ? { 'aria-hidden': true, tabIndex: -1 } : {}),
      } as HTMLAttributes<HTMLButtonElement>) : card,
    )) : children}
  </div></div>;
}
