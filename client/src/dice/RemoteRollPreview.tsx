import { useLayoutEffect, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../components/Icon';
import { Portrait } from '../components/Portrait';
import { RemoteRollBoard } from './RemoteRollBoard';
import type { RemoteBoard } from './useDiceRoller';
import './spectator-preview.css';

export function RemoteRollPreview({ boards, selected, onSelect, onExpand, onRoll, onClose, anchor }: {
  boards: RemoteBoard[]; selected: RemoteBoard; onSelect: (id: string) => void;
  onExpand: () => void; onRoll: () => void; onClose: () => void;
  anchor: RefObject<HTMLButtonElement | null>;
}) {
  const [position,setPosition]=useState({left:12,bottom:80,maxHeight:500});
  useLayoutEffect(()=>{
    const button=anchor.current;
    if(!button)return;
    const place=()=>{
      const r=button.getBoundingClientRect();
      setPosition({left:Math.max(8,Math.min(r.left,window.innerWidth-Math.min(320,window.innerWidth-16)-8)),bottom:Math.max(8,window.innerHeight-r.top+8),maxHeight:Math.max(80,r.top-16)});
    };
    place();const resize=new ResizeObserver(place);resize.observe(button);window.addEventListener('resize',place);
    return()=>{resize.disconnect();window.removeEventListener('resize',place);};
  },[anchor]);
  return createPortal(<section className="dice-spectator-preview" style={position} aria-label="Prévia das rolagens da mesa">
    <header className="dice-spectator-header">
      <span><Icon name="die" size={14}/> Rolagens da mesa</span>
      <button type="button" className="dice-head-close" aria-label="Recolher prévia de rolagens" onClick={onClose}><Icon name="x" size={14}/></button>
    </header>
    <div className="dice-spectator-actors" role="group" aria-label="Quem está rolando">
      {boards.map(board=><button type="button" key={board.userId} className="dice-spectator-actor" aria-pressed={board.userId===selected.userId} title={board.actorName} onClick={()=>onSelect(board.userId)}>
        <Portrait src={board.avatarUrl} alt="" size="sm" icon="users" zoomable={false}/>
        <span>{board.actorName.trim().split(/\s+/)[0] || 'Participante'}</span>
        <i className={board.phase==='tumbling'?'is-rolling':''} aria-hidden="true"/>
      </button>)}
    </div>
    <div className="dice-spectator-surface"><RemoteRollBoard key={selected.userId} board={selected} presentation="preview" onClose={onClose}/></div>
    <footer className="dice-spectator-actions">
      <button type="button" onClick={onExpand}>Expandir visualização <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" aria-hidden="true"><path d="M3 9 9 3M3 3h6v6"/></svg></button>
      <button type="button" onClick={onRoll}><Icon name="die" size={14}/> Rolar meus dados</button>
    </footer>
  </section>,document.body);
}
