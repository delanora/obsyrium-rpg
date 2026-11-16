import { Children, isValidElement, useLayoutEffect, useRef, type HTMLAttributes } from 'react';
import './choice-gallery.css';

/** Navegar pelo carrossel nunca altera a escolha; somente o clique no card seleciona. */
export function ChoiceGallery({ children, className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  const cards = Children.toArray(children);
  const selected = cards.find(card => isValidElement<{ 'aria-pressed'?: boolean }>(card) && card.props['aria-pressed']);
  const selectedKey = isValidElement(selected) ? selected.key : null;
  const compact = selectedKey !== null;
  const root = useRef<HTMLDivElement>(null);
  const previousSelection = useRef<string | null>(null);
  const gesture = useRef<{ x: number; scroll: number; pointer: number; moved: boolean } | null>(null);
  function highlightCenter() {
    const element = root.current;
    if (!element) return;
    const center = element.getBoundingClientRect().left + element.clientWidth / 2;
    for (const card of element.querySelectorAll<HTMLElement>(':scope > button')) {
      const rect = card.getBoundingClientRect();
      const distance = Math.abs(rect.left + rect.width / 2 - center);
      card.style.setProperty('--carousel-scale', String(1 + .12 * Math.max(0, 1 - distance / 130)));
      const pitch = card.offsetWidth + parseFloat(getComputedStyle(element).columnGap || '0');
      const fade = Math.max(0, distance / pitch - 1.15);
      card.style.setProperty('--carousel-opacity', String(Math.max(.08, 1 - fade * .48)));
    }
  }
  useLayoutEffect(() => {
    const element = root.current;
    const card = element?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!element || !card) return;
    const centerSelected = (behavior: ScrollBehavior) => {
      element.scrollTo({ left: card.offsetLeft - element.offsetLeft - (element.clientWidth - card.offsetWidth) / 2, behavior });
      highlightCenter();
    };
    const animate = previousSelection.current !== null && previousSelection.current !== selectedKey
      && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    previousSelection.current = selectedKey;
    centerSelected(animate ? 'smooth' : 'auto');
    let width = element.clientWidth;
    const observer = new ResizeObserver(() => {
      if (element.clientWidth !== width) { width = element.clientWidth; centerSelected('auto'); }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [selectedKey]);
  return <div className={`choice-gallery-shell${compact ? ' is-compact' : ''}`}><div {...props} ref={root} className={`${className} choice-gallery${compact ? ' is-compact' : ''}`}
    onScroll={highlightCenter}
    onPointerDown={event => {
      if (!compact || event.button !== 0) return;
      event.currentTarget.scrollTo({ left: event.currentTarget.scrollLeft, behavior: 'instant' });
      gesture.current = { x: event.clientX, scroll: event.currentTarget.scrollLeft, pointer: event.pointerId, moved: false };
    }}
    onPointerMove={event => {
      const state = gesture.current;
      if (!state || state.pointer !== event.pointerId || event.buttons === 0) return;
      const delta = event.clientX - state.x;
      if (!state.moved && Math.abs(delta) < 6) return;
      state.moved = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      event.currentTarget.scrollLeft = state.scroll - delta;
    }}
    onPointerUp={event => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    }}
    onPointerCancel={() => { gesture.current = null; }}
    onClickCapture={event => {
      if (gesture.current?.moved) { event.preventDefault(); event.stopPropagation(); gesture.current = null; }
    }}
    onDragStart={event => event.preventDefault()}>
    {children}
  </div></div>;
}
