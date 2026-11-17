import { useEffect, useRef, useState } from 'react';
import './page-scrollbar.css';

/** Rolagem da página sobreposta; painéis internos conservam suas barras nativas. */
export function PageScrollbar() {
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; y: number; scroll: number } | null>(null);
  const [metrics, setMetrics] = useState({ top: 0, height: 0, max: 0, scroll: 0 });
  useEffect(() => {
    const root = document.documentElement;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const viewport = root.clientHeight, max = Math.max(0, root.scrollHeight - viewport);
        const height = Math.min(viewport, Math.max(36, viewport * viewport / root.scrollHeight));
        setMetrics({ height, max, scroll: window.scrollY, top: max ? window.scrollY / max * (viewport - height) : 0 });
      });
    };
    root.classList.add('has-page-scrollbar');
    const observer = new ResizeObserver(measure);
    observer.observe(document.body);
    window.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    measure();
    return () => {
      root.classList.remove('has-page-scrollbar'); observer.disconnect(); cancelAnimationFrame(frame);
      window.removeEventListener('scroll', measure); window.removeEventListener('resize', measure);
    };
  }, []);
  if (!metrics.max) return null;
  const moveTo = (value: number) => window.scrollTo({ top: Math.max(0, Math.min(metrics.max, value)), behavior: 'instant' });
  return <div className="page-scrollbar" ref={track} role="scrollbar" aria-label="Rolagem da página"
    aria-controls="root" aria-orientation="vertical" aria-valuemin={0} aria-valuemax={Math.round(metrics.max)}
    aria-valuenow={Math.round(metrics.scroll)} tabIndex={0}
    onKeyDown={event => {
      const positions: Record<string, number> = { ArrowDown: metrics.scroll + 40, ArrowUp: metrics.scroll - 40,
        PageDown: metrics.scroll + innerHeight * .9, PageUp: metrics.scroll - innerHeight * .9, Home: 0, End: metrics.max };
      if (event.key in positions) { event.preventDefault(); moveTo(positions[event.key]); }
    }}
    onPointerDown={event => {
      if (event.button !== 0) return;
      event.preventDefault(); event.currentTarget.focus({ preventScroll: true });
      const y = event.clientY - event.currentTarget.getBoundingClientRect().top;
      if (y < metrics.top || y > metrics.top + metrics.height) {
        moveTo(metrics.scroll + (y < metrics.top ? -1 : 1) * innerHeight * .9); return;
      }
      drag.current = { id: event.pointerId, y: event.clientY, scroll: window.scrollY };
      event.currentTarget.setPointerCapture(event.pointerId);
    }}
    onPointerMove={event => {
      const start = drag.current;
      if (!start || start.id !== event.pointerId) return;
      const travel = (track.current?.clientHeight ?? innerHeight) - metrics.height;
      if (travel > 0) moveTo(start.scroll + (event.clientY - start.y) / travel * metrics.max);
    }}
    onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}
    onLostPointerCapture={() => { drag.current = null; }}>
    <span className="page-scrollbar-thumb" style={{ height: metrics.height, transform: `translateY(${metrics.top}px)` }} />
  </div>;
}
