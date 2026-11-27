import { useEffect, useId, useRef, useState } from 'react';
import { ArchiveDockPopover } from './ArchiveDockPopover';

/** Seletor da barra inferior: as opções sempre abrem acima, fora do recorte. */
export function ArchiveBoardSelect({ boards, value, disabled, onChange }: {
  boards: { id: string; name: string }[];
  value: string;
  disabled: boolean;
  onChange: (id: string) => void;
}) {
  const anchor = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement | null>(null);
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const close = (focus = false) => {
    setOpen(false);
    if (focus) anchor.current?.focus();
  };
  const choose = (index: number) => {
    const board = boards[index];
    if (!board) return;
    close(true);
    if (board.id !== value) onChange(board.id);
  };
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (!anchor.current?.contains(e.target as Node) && !panel.current?.contains(e.target as Node)) close();
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  useEffect(() => {
    if (open) document.getElementById(`${id}-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active, id]);
  const show = () => {
    setActive(Math.max(0, boards.findIndex(b => b.id === value)));
    setOpen(true);
  };
  return <>
    <button ref={anchor} type="button" className="btn archive-board-trigger" data-board-id={value} disabled={disabled}
      aria-label="Quadro narrativo" aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? id : undefined}
      aria-activedescendant={open ? `${id}-${active}` : undefined}
      onClick={() => open ? close() : show()}
      onBlur={e => { if (!panel.current?.contains(e.relatedTarget as Node)) close(); }}
      onKeyDown={e => {
        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
          e.preventDefault();
          if (!open) show();
          else setActive(i => e.key === 'Home' ? 0 : e.key === 'End' ? boards.length - 1 :
            Math.max(0, Math.min(boards.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1))));
        } else if (open && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); choose(active); }
        else if (open && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); }
        else if (e.key === 'Tab') close();
      }}>
      <span>{boards.find(b => b.id === value)?.name ?? 'Selecione'}</span><span aria-hidden="true">▴</span>
    </button>
    {open && <ArchiveDockPopover anchor={anchor} className="archive-board-options" id={id} role="listbox"
      aria-label="Quadros disponíveis">
      <div ref={element => { panel.current = element; }}>
        {boards.map((board, index) => <div key={board.id} id={`${id}-${index}`} role="option" data-board-id={board.id}
          aria-selected={board.id === value} className={active === index ? 'is-active' : ''}
          onPointerDown={e => e.preventDefault()} onMouseMove={() => setActive(index)} onClick={() => choose(index)}>
          {board.name}
        </div>)}
      </div>
    </ArchiveDockPopover>}
  </>;
}
