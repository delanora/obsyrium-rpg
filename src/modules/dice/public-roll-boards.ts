import type { ActiveRollDto, DiceRollDto } from './dice.dto.js';

/** Estado efêmero por participante, alimentado somente após autorização HTTP. */
export class PublicRollBoards {
  private readonly boards = new Map<string, ActiveRollDto>();
  get(userId: string): ActiveRollDto | undefined { return this.boards.get(userId); }
  put(board: ActiveRollDto): void { this.boards.set(board.userId, board); }
  remove(userId: string): ActiveRollDto | undefined {
    const previous=this.boards.get(userId);
    this.boards.delete(userId);
    return previous;
  }
  all(): ActiveRollDto[] { return [...this.boards.values()].sort((a,b)=>Date.parse(a.at)-Date.parse(b.at)); }
  latest(): ActiveRollDto | null { return this.all().at(-1) ?? null; }
  remember(roll: DiceRollDto): void {
    if(roll.isPrivate || roll.audience==='masters' || roll.kind==='creation')return;
    const board=this.boards.get(roll.actorUserId);
    if(board)this.boards.set(roll.actorUserId,{...board,lastRoll:roll});
  }
}
