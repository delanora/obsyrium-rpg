import { playDice } from '../sound';
import { COMMON_THROW_MS } from './rollAnimation';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { DiceRollDto, TableRollActivePayload } from '../types';
import type { RemoteBoard } from './useDiceRoller';
import { rollAnimationMs } from './rollAnimation';

export const SPECTATOR_RESULT_MS = 5000;

/** Uma projeção por participante; timers de um jogador nunca afetam outro. */
export function useRemoteRolls(ownUserId: string) {
  const [boards, setBoards] = useState<RemoteBoard[]>([]);
  const current = useRef(new Map<string, RemoteBoard>());
  const sequence = useRef(0);
  const metadata = useRef(new Map<string, RemoteBoard>());
  const timers = useRef(new Map<string, number[]>());
  const update = useCallback((id: string, board: RemoteBoard | null) => {
    if(board)current.current.set(id,board);else current.current.delete(id);
    setBoards([...current.current.values()].sort((a,b)=>(b.updatedAt??0)-(a.updatedAt??0)));
  }, []);
  const clearTimers = useCallback((id: string) => {
    timers.current.get(id)?.forEach(window.clearTimeout);
    timers.current.delete(id);
  }, []);
  useEffect(()=>()=>timers.current.forEach(list=>list.forEach(window.clearTimeout)),[]);
  const present = useCallback((board: RemoteBoard, remaining: number, expiresIn = remaining + SPECTATOR_RESULT_MS) => {
    clearTimers(board.userId);
    update(board.userId,board);
    if(!board.result)return;
    const rollId=board.result.id;
    const settle=window.setTimeout(()=>{
      const now=current.current.get(board.userId);
      if(now?.result?.id===rollId)update(board.userId,{...now,phase:'settled'});
    },remaining);
    const expire=window.setTimeout(()=>{
      if(current.current.get(board.userId)?.result?.id===rollId)update(board.userId,null);
      timers.current.delete(board.userId);
    },expiresIn);
    timers.current.set(board.userId,[settle,expire]);
  },[clearTimers,update]);

  const onActive = useCallback((payload: TableRollActivePayload) => {
    if(payload.userId===ownUserId || payload.kind==='creation')return;
    if(!payload.active){
      metadata.current.delete(payload.userId);
      // O resultado já publicado termina sua animação e os cinco segundos.
      if(!current.current.get(payload.userId)?.result){clearTimers(payload.userId);update(payload.userId,null);}
      return;
    }
    const existing = current.current.get(payload.userId);
    if (existing?.result && Date.parse(payload.at) < Date.parse(existing.result.at)) return;
    sequence.current = Math.max(Date.now(), sequence.current + 1);
    const board: RemoteBoard={userId:payload.userId,actorName:payload.actorName,avatarUrl:payload.avatarUrl,
      kind:payload.kind,label:payload.label,bonus:payload.board.bonus,pool:payload.board.pool,
      advantage:payload.board.advantage,disadvantage:payload.board.disadvantage,deathSave:payload.deathSave,
      phase:payload.board.phase==='tumbling'?'tumbling':'idle',result:null,updatedAt:existing?.phase==='idle' && payload.board.phase==='idle' ? existing.updatedAt : sequence.current};
    metadata.current.set(payload.userId,board);
    if(payload.lastRoll && !payload.lastRoll.isPrivate && payload.lastRoll.audience!=='masters'){
      const startedAt=Date.parse(payload.lastRoll.at)||Date.now();
      const remaining=Math.max(0,rollAnimationMs(payload.kind)-(Date.now()-startedAt));
      if(Date.now()-startedAt>=rollAnimationMs(payload.kind)+SPECTATOR_RESULT_MS)return;
      present({...board,result:payload.lastRoll,startedAt,phase:remaining?'tumbling':'settled'},remaining,Math.max(0,rollAnimationMs(payload.kind)+SPECTATOR_RESULT_MS-(Date.now()-startedAt)));
    }else{
      clearTimers(payload.userId);update(payload.userId,board);
    }
  },[ownUserId,present,clearTimers,update]);

  const onRoll = useCallback((roll: DiceRollDto) => {
    if(roll.actorUserId===ownUserId || roll.isPrivate || roll.audience==='masters' || roll.kind==='creation')return;
    const existing=current.current.get(roll.actorUserId);
    if(existing?.result?.id===roll.id)return;
    if (!roll.autoFail) playDice({ durationMs: rollAnimationMs(roll.kind), contactDelayMs: roll.kind === 'death-save' ? 0 : COMMON_THROW_MS, diceCount: roll.dice.length });
    const cached=metadata.current.get(roll.actorUserId);
    const startedAt=Date.now();
    sequence.current = Math.max(startedAt, sequence.current + 1);
    present({userId:roll.actorUserId,actorName:roll.actorName,avatarUrl:cached?.avatarUrl??'',kind:roll.kind,label:roll.label,
      bonus:roll.bonus,pool:cached?.pool??roll.dice.map(d=>({sides:d.sides,locked:true})),
      advantage:roll.advantage,disadvantage:roll.disadvantage,deathSave:roll.deathSaveState?.before??cached?.deathSave,
      phase:roll.autoFail?'settled':'tumbling',result:roll,startedAt,updatedAt:sequence.current},roll.autoFail?0:rollAnimationMs(roll.kind));
  },[ownUserId,present]);
  return { boards, onActive, onRoll };
}
