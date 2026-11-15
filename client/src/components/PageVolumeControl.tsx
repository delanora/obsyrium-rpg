import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { getPageAudioSettings, setPageVolume, subscribePageAudio } from '../pageAudio';
import { setMuted } from '../sound';
import { Icon } from './Icon';
import './page-volume.css';

/** Volume desta pessoa, salvo neste navegador; o volume da mesa permanece independente. */
export function PageVolumeControl() {
  const [open, setOpen] = useState(false), [settings, setSettings] = useState(getPageAudioSettings);
  const [offset, setOffset] = useState(0);
  const panel = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null), button = useRef<HTMLButtonElement>(null), slider = useRef<HTMLInputElement>(null);
  const lastAudible = useRef(settings.volume || 1), id = useId();
  const silent = settings.muted || settings.volume === 0;
  useEffect(() => subscribePageAudio(value => { setSettings(value); if (value.volume > 0) lastAudible.current = value.volume; }), []);
  useLayoutEffect(() => {
    if (!open) return;
    const position = () => {
      const anchor = root.current?.getBoundingClientRect(), width = panel.current?.getBoundingClientRect().width;
      if (!anchor || !width) return;
      const left = Math.max(16, Math.min(anchor.right - width, window.innerWidth - width - 16));
      setOffset(anchor.right - left - width);
    };
    position(); window.addEventListener('resize', position);
    return () => window.removeEventListener('resize', position);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    slider.current?.focus();
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  return <div className="page-volume" ref={root} onKeyDown={event => {
    if (event.key === 'Escape' && open) { event.stopPropagation(); setOpen(false); button.current?.focus(); }
  }}>
    <button type="button" ref={button} className="btn btn-small" title="Volume da página" aria-label="Volume da página"
      aria-haspopup="dialog" aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>
      <Icon name={silent ? 'mute' : 'volume'} size={15} />
    </button>
    {open ? <div className="page-volume-panel" ref={panel} style={{ '--page-volume-offset': `${offset}px` } as CSSProperties} id={id} role="dialog" aria-label="Controle de volume">
      <label htmlFor={`${id}-range`}>Volume da página <output>{Math.round(settings.volume * 100)}%</output></label>
      <input id={`${id}-range`} ref={slider} type="range" min="0" max="100" step="1"
        value={Math.round(settings.volume * 100)} aria-valuetext={`${Math.round(settings.volume * 100)} por cento`}
        onChange={event => { setPageVolume(Number(event.target.value) / 100); if (settings.muted) setMuted(false); }} />
      <button type="button" className="btn btn-small page-volume-mute" aria-pressed={silent} onClick={() => {
        if (silent) { if (settings.volume === 0) setPageVolume(lastAudible.current); setMuted(false); } else setMuted(true);
      }}><Icon name={silent ? 'mute' : 'volume'} size={14} />{silent ? 'Ativar sons' : 'Silenciar sons'}</button>
    </div> : null}
  </div>;
}
