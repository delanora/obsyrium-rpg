import { useRemoteRolls } from './useRemoteRolls';
import { fetchDeath } from '../deathApi';
import { rollAnimationMs, COMMON_THROW_MS } from './rollAnimation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { playCrit, playDice } from '../sound';
import type {
  DiceRollDto,
  DeathSavePresentation,
  DiceRollKind,
  EffectOptionalModifierDto,
  RollBoardDie,
  SessionUser,
} from '../types';
import type { RealtimeHandlers } from '../useRealtime';
import {
  announceActiveRoll,
  clearDiceHistory as clearDiceHistoryRequest,
  fetchActiveRolls,
  fetchDiceHistory,
  fetchEffectOptions,
  rollTableDice,
} from './diceApi';

/** Tipos de dado usados em D&D 5e (d100 = percentual). */
export const DICE_TYPES = [4, 6, 8, 10, 12, 20, 100] as const;

/** Um dado escolhido no pool. `locked` = d20 fixo da rolagem de perícia. */
export interface DicePoolDie {
  sides: number;
  locked: boolean;
}

/**
 * O tabuleiro de quem está rolando, visto por quem apenas assiste.
 *
 * Chega pelo evento `dice:active` (pool, vantagem, fase) e é completado pelo
 * `dice:roll` com o resultado. Só o autor interage: aqui é tudo leitura.
 */
export interface RemoteBoard {
  startedAt?: number;
  updatedAt?: number;
  deathSave?: DeathSavePresentation;
  userId: string;
  actorName: string;
  avatarUrl: string;
  kind: DiceRollKind;
  label: string;
  bonus: number;
  pool: RollBoardDie[];
  advantage: boolean;
  disadvantage: boolean;
  phase: RollPhase;
  result: DiceRollDto | null;
}

/** Contexto da rolagem aberta (livre ou de perícia/salvaguarda). */
export interface RollContext {
  pendingCombatTestId?: string;
  expectedTestVersion?: number;
  /** Pendência autorizada: o servidor deriva atributo, CD, bônus e modo. */
  pendingEffectSaveId?: string;
  visibility?: 'public' | 'private';
  selectedEffectModifiers?: string[];
  entity?: import('../types').MechanicalEntity;
  ability?: import('../types').AbilityKey;
  kind: DiceRollKind;
  /** Perícia/salvaguarda; vazio na rolagem livre. */
  label: string;
  /** Bônus fixo pré-aplicado ao total. */
  bonus: number;
  /**
   * Concentração (Fase 6.4): teste PENDENTE que esta rolagem resolve. O
   * servidor valida a pendência, calcula o bônus/CD e aplica o resultado.
   */
  pendingConcentrationSaveId?: string;
}

export type RollPhase = 'idle' | 'tumbling' | 'settled';

export interface DiceToast {
  id: string;
  roll: DiceRollDto;
}

let toastSequence = 0;

/** Os avisos públicos somem sozinhos depois de 3 segundos. */
const TOAST_MS = 3000;

/**
 * Bandeja do Teste contra a Morte: fecha sozinha 3 s depois que o RESULTADO
 * aparece (nunca durante a animação). Qualquer interação do usuário na janela
 * cancela o fechamento — ninguém perde a leitura do resultado.
 */
const DEATH_SAVE_AUTO_CLOSE_MS = 3000;

/**
 * Ganchos OPCIONAIS da tela. `onDeathSaveApplied` roda depois de uma rolagem de
 * Teste Contra a Morte CONFIRMADA pelo servidor: a tela relê o estado
 * autoritativo (`/api/combat/active`, ficha) e adota o que for mais novo. Não
 * rola de novo, não aplica efeito e não usa o resultado local como autoridade.
 */
export interface DiceRollerOptions {
  onDeathSaveApplied?: (roll: DiceRollDto) => void;
}

export function useDiceRoller(user: SessionUser, options: DiceRollerOptions = {}) {
  const isMaster = user.role === 'MASTER';

  const [open, setOpen] = useState(false);
  const [context, setContext] = useState<RollContext | null>(null);
  const [pool, setPool] = useState<DicePoolDie[]>([]);
  const [advantage, setAdvantageValue] = useState(false);
  const [disadvantage, setDisadvantageValue] = useState(false);
  // A rolagem do mestre já nasce privada: a mesa só acompanha se ele desmarcar
  // "Privada" (o aviso é opcional, não o padrão). Rolagem de jogador é sempre
  // pública, então o padrão deles continua sendo avisar.
  const [isPrivate, setPrivate] = useState(isMaster);
  const [phase, setPhase] = useState<RollPhase>('idle');
  const [result, setResult] = useState<DiceRollDto | null>(null);
  const [deathSaveBefore, setDeathSaveBefore] = useState<DeathSavePresentation | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Modificadores OPCIONAIS (6.5G) oferecidos pelo SERVIDOR para esta rolagem.
  // Default: desmarcado (o PHB diz "pode" — a escolha é real).
  const [effectOptions, setEffectOptions] = useState<EffectOptionalModifierDto[]>([]);
  const [selectedEffectModifiers, setSelectedEffectModifiers] = useState<string[]>([]);
  const [toasts, setToasts] = useState<DiceToast[]>([]);
  const [history, setHistory] = useState<DiceRollDto[]>([]);
  // Tabuleiro de outra pessoa da mesa, espelhado aqui (só para assistir).
  const { boards: remoteBoards, onActive: applyRemote, onRoll: applyRemoteRoll } = useRemoteRolls(user.id);
  const remote = remoteBoards[0] ?? null;

  // Reconhece a própria rolagem no tempo real (para não repetir o aviso).
  const myClientId = useRef<string | null>(null);
  const settleTimer = useRef<number | null>(null);
  const toastTimers = useRef<number[]>([]);
  // Auto-fechamento da bandeja do Teste contra a Morte (só esse fluxo).
  const autoCloseTimer = useRef<number | null>(null);
  const autoCloseCancelled = useRef(false);
  // Gancho de reconciliação sempre atualizado (o pai pode passar um closure
  // novo a cada render sem recriar `submit` nem reexecutar efeitos).
  const deathSaveHook = useRef(options.onDeathSaveApplied);
  deathSaveHook.current = options.onDeathSaveApplied;

  // O mestre carrega o histórico já acumulado ao abrir o painel.
  useEffect(() => {
    if (!isMaster) return;
    let active = true;

    fetchDiceHistory()
      .then((rolls) => {
        if (active) setHistory(rolls);
      })
      .catch(() => {
        // Sem histórico ainda: a lista começa vazia.
      });

    return () => {
      active = false;
    };
  }, [isMaster]);

  useEffect(
    () => () => {
      if (settleTimer.current !== null) window.clearTimeout(settleTimer.current);
      if (autoCloseTimer.current !== null) window.clearTimeout(autoCloseTimer.current);
      toastTimers.current.forEach((timer) => window.clearTimeout(timer));
    },
    [],
  );

  /**
   * Interação durante a janela de 3 s CANCELA o fechamento automático.
   * Antes de a janela começar (animação, pool) não há nada para cancelar.
   */
  const cancelAutoClose = useCallback(() => {
    if (autoCloseTimer.current === null) return;
    autoCloseCancelled.current = true;
    window.clearTimeout(autoCloseTimer.current);
    autoCloseTimer.current = null;
  }, []);

  const reset = useCallback(() => {
    setContext(null);
    setEffectOptions([]);
    setSelectedEffectModifiers([]);
    setPool([]);
    setAdvantageValue(false);
    setDisadvantageValue(false);
    setPrivate(isMaster);
    setResult(null);
    setDeathSaveBefore(null);
    setPhase('idle');
    setError(null);
  }, [isMaster]);

  /** Rolagem livre: pool vazio, o jogador monta a combinação. */
  const openFree = useCallback(() => {
    reset();
    setOpen(true);
  }, [reset]);

  /** Rolagem de perícia/salvaguarda: abre com 1d20 fixo e o bônus aplicado. */
  const openSkillRoll = useCallback(
    (input: RollContext) => {
      reset();
      autoCloseCancelled.current = false;
      setContext(input);
      setSelectedEffectModifiers(input.selectedEffectModifiers ?? []);
      setPrivate(input.visibility === 'private' || (input.visibility === undefined && isMaster));
      setPool([{ sides: 20, locked: true }]);
      setOpen(true);
    },
    [reset, isMaster],
  );

  // Leitura autorizada do ciclo atual. Nunca adota uma resposta tardia durante o giro.
  useEffect(() => {
    if (!open || context?.kind !== 'death-save' || phase !== 'idle' || !context.entity) return;
    let live = true;
    fetchDeath(context.entity).then(({ death }) => {
      if (live) setDeathSaveBefore({ successes: death.successes, failures: death.failures, stabilized: death.stabilized, dead: death.dead });
    }).catch(() => {});
    return () => { live = false; };
  }, [open, context?.kind, context?.entity?.kind, context?.entity?.id, phase]);

  /**
   * Busca as opções OPCIONAIS quando a bandeja abre para um teste com entidade.
   * O servidor deriva o escopo: `save` (inclui Concentração/CON), `check` ou
   * `attack`. Um Bless NÃO aparece em teste de habilidade.
   */
  useEffect(() => {
    if (!open || !context?.entity) {
      setEffectOptions([]);
      return;
    }
    const roll =
      context.kind === 'save' || context.kind === 'concentration'
        ? ('save' as const)
        : context.kind === 'skill'
          ? ('check' as const)
          : null;
    if (!roll) {
      setEffectOptions([]);
      return;
    }
    let live = true;
    const ability = context.kind === 'concentration' ? 'constitution' : context.ability;
    fetchEffectOptions(context.entity, roll, ability)
      .then((options) => {
        if (live) setEffectOptions(options);
      })
      .catch(() => {
        if (live) setEffectOptions([]);
      });
    return () => {
      live = false;
    };
  }, [open, context?.entity, context?.kind, context?.ability]);

  const toggleEffectModifier = useCallback((id: string) => {
    setSelectedEffectModifiers((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }, []);

  const close = useCallback(() => {
    if (autoCloseTimer.current !== null) {
      window.clearTimeout(autoCloseTimer.current);
      autoCloseTimer.current = null;
    }
    setOpen(false);
  }, []);

  // Fechamento automático da bandeja do TESTE CONTRA A MORTE: o relógio só
  // começa quando a animação terminou e o resultado está visível (`settled`).
  // Escopo restrito a `kind === 'death-save'` — as outras rolagens não mudam.
  useEffect(() => {
    if (autoCloseTimer.current !== null) {
      window.clearTimeout(autoCloseTimer.current);
      autoCloseTimer.current = null;
    }
    if (!open) return;
    if (phase !== 'settled' || !result || context?.kind !== 'death-save') return;
    if (autoCloseCancelled.current) return;
    autoCloseTimer.current = window.setTimeout(() => {
      autoCloseTimer.current = null;
      setOpen(false);
    }, DEATH_SAVE_AUTO_CLOSE_MS);
    return () => {
      if (autoCloseTimer.current !== null) {
        window.clearTimeout(autoCloseTimer.current);
        autoCloseTimer.current = null;
      }
    };
  }, [open, phase, result?.id, context?.kind]);

  // A rolagem privada do mestre não é divulgada para a mesa.
  const isPrivateRoll = isPrivate && isMaster;
  const announcing = open && !isPrivateRoll;

  // O tabuleiro como a mesa o vê: pool, vantagem/desvantagem e o bônus do teste.
  const board = useMemo(
    () => ({
      pool: pool.map((die) => ({ sides: die.sides, locked: die.locked })),
      advantage,
      disadvantage,
      bonus: context?.bonus ?? 0,
    }),
    [pool, advantage, disadvantage, context?.bonus],
  );

  // Espelha o tabuleiro para a mesa (abrir/fechar, mexer no pool, trocar de
  // teste). A queda não é anunciada daqui: quem anuncia é o servidor, no início
  // da rolagem (ver `submit`), para não haver dois pedidos concorrentes.
  const announced = useRef(false);

  useEffect(() => {
    // Sem nada anunciado não há o que desfazer — evita um pedido por carga de tela.
    if (!announcing && !announced.current) return;
    announced.current = announcing;

    void announceActiveRoll({
      active: announcing,
      label: context?.label ?? '',
      kind: context?.kind ?? 'free',
      ...(context?.kind === 'death-save' && context.entity ? {entity:context.entity} : {}),
      private: isPrivateRoll,
      ...board,
    }).catch(() => {
      // A mesa só não acompanha: a rolagem continua funcionando.
    });
  }, [announcing, isPrivateRoll, context?.label, context?.kind, context?.entity?.kind, context?.entity?.id, board]);

  // Fechar a aba no meio da rolagem não pode deixar a faixa presa na mesa (o
  // servidor também limpa pelo disconnect, isto cobre o fechamento normal).
  useEffect(
    () => () => {
      if (announced.current) void announceActiveRoll({ active: false }).catch(() => {});
    },
    [],
  );

  // Tabuleiro que já estava aberto quando esta tela carregou.
  useEffect(() => {
    let active = true;

    fetchActiveRolls()
      .then((states) => {
        if (!active) return;
        // Mesmo caminho do evento: o tabuleiro pode chegar no meio da queda
        // (assiste o restante) ou depois dela (já com o resultado).
        states.forEach(applyRemote);
      })
      .catch(() => {
        // Sem estado: nenhum tabuleiro para assistir.
      });

    return () => {
      active = false;
    };
  }, [user.id, applyRemote]);

  const revisaoDoPool = useRef(0);

  const addDie = useCallback((sides: number) => {
    if (context?.pendingCombatTestId || context?.pendingEffectSaveId || context?.pendingConcentrationSaveId) return;
    revisaoDoPool.current += 1;
    if (settleTimer.current !== null) window.clearTimeout(settleTimer.current);
    setPhase('idle');
    setResult(null);
    setPool((prev) => [...prev, { sides, locked: false }]);
  }, [context?.pendingCombatTestId, context?.pendingEffectSaveId, context?.pendingConcentrationSaveId]);

  const removeDie = useCallback((index: number | number[]) => {
    if (context?.pendingCombatTestId || context?.pendingEffectSaveId || context?.pendingConcentrationSaveId) return;
    revisaoDoPool.current += 1;
    if (settleTimer.current !== null) window.clearTimeout(settleTimer.current);
    setPhase('idle');
    setResult(null);
    const indices = new Set(Array.isArray(index) ? index : [index]);
    setPool((prev) => prev.filter((die, position) => !indices.has(position) || die.locked));
  }, [context?.pendingCombatTestId, context?.pendingEffectSaveId, context?.pendingConcentrationSaveId]);

  const setAdvantage = useCallback((value: boolean) => {
    setAdvantageValue(value);
    if (value) setDisadvantageValue(false);
  }, []);

  const setDisadvantage = useCallback((value: boolean) => {
    setDisadvantageValue(value);
    if (value) setAdvantageValue(false);
  }, []);

  const submit = useCallback(async () => {
    if (phase === 'tumbling' || pool.length === 0 || (result && (context?.pendingCombatTestId || context?.pendingEffectSaveId || context?.pendingConcentrationSaveId))) return;

    const clientId = `${user.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    myClientId.current = clientId;

    const revisaoEnviada = revisaoDoPool.current;
    setPhase('tumbling');
    setResult(null);
    setError(null);
    // Nova rolagem = nova janela de leitura: o auto-fechamento vale de novo.
    autoCloseCancelled.current = false;

    // Não há anúncio de queda daqui: o servidor marca a fase `tumbling` no
    // começo da própria rolagem. Dois pedidos paralelos (anúncio + rolagem)
    // podiam chegar fora de ordem e o anúncio apagava o resultado recém-chegado
    // no tabuleiro de quem assiste — o dado ficava na tela sem total.
    // Concentração: o modo da rolagem é derivado no SERVIDOR (Constituição +
    // condições/exaustão). Não mandamos vantagem/desvantagem da bandeja — o
    // servidor as ignoraria de qualquer forma.
    const sendRollMode = context?.kind !== 'concentration' && !context?.pendingEffectSaveId;

    try {
      const roll = await rollTableDice({
        dice: pool.map((die) => ({ sides: die.sides })),
        advantage: sendRollMode && advantage,
        disadvantage: sendRollMode && disadvantage,
        bonus: context?.bonus ?? 0,
        label: context?.label ?? '',
        kind: context?.kind ?? 'free',
        private: isPrivate && isMaster,
        clientId,
        entity: context?.entity,
        ability: context?.ability,
        ...(context?.pendingCombatTestId ? { pendingCombatTestId: context.pendingCombatTestId, expectedTestVersion: context.expectedTestVersion } : {}),
        ...(context?.pendingEffectSaveId ? { pendingEffectSaveId: context.pendingEffectSaveId } : {}),
        ...(isMaster ? { visibility: isPrivate ? 'private' as const : 'public' as const } : {}),
        ...(context?.pendingConcentrationSaveId
          ? { pendingConcentrationSaveId: context.pendingConcentrationSaveId }
          : {}),
        ...(selectedEffectModifiers.length > 0 ? { selectedEffectModifiers } : {}),
      });

      if (revisaoEnviada !== revisaoDoPool.current) return;
      setResult(roll);
      // Teste Contra a Morte aplicado pelo SERVIDOR: a tela relê o estado
      // autoritativo em vez de esperar o próximo evento. Nada é recalculado
      // aqui — o resultado dos dados continua sendo só apresentação.
      if (context?.kind === 'death-save') deathSaveHook.current?.(roll);
      if (!roll.autoFail) playDice({ durationMs: rollAnimationMs(roll.kind), contactDelayMs: roll.kind === 'death-save' ? 0 : COMMON_THROW_MS, diceCount: roll.dice.length });
      if (roll.crit) playCrit();

      if (settleTimer.current !== null) window.clearTimeout(settleTimer.current);
      settleTimer.current = window.setTimeout(() => setPhase('settled'), rollAnimationMs(context?.kind));
    } catch (err) {
      setPhase('idle');
      setError(err instanceof Error ? err.message : 'Falha ao rolar os dados.');

      // A rolagem não aconteceu: devolve o tabuleiro da mesa ao estado parado
      // (o anúncio da queda foi feito pelo servidor e ficaria pendurado).
      if (announcing) {
        void announceActiveRoll({
          active: true,
          label: context?.label ?? '',
          kind: context?.kind ?? 'free',
          private: isPrivateRoll,
          ...board,
        }).catch(() => {});
      }
    }
  }, [
    phase,
    result,
    pool,
    advantage,
    disadvantage,
    context,
    isPrivate,
    isMaster,
    user.id,
    announcing,
    isPrivateRoll,
    board,
    selectedEffectModifiers,
  ]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  /** Zera o log lateral (mestre) no servidor e na memória local. */
  const clearHistory = useCallback(async () => {
    try {
      await clearDiceHistoryRequest();
      setHistory([]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao limpar o histórico.');
    }
  }, []);

  /** Dados extras da vantagem/desvantagem: cada d20 do pool vira dois. */
  const extraD20 = useMemo(
    () =>
      advantage || disadvantage
        ? pool.filter((die) => die.sides === 20).length
        : 0,
    [pool, advantage, disadvantage],
  );

  const handlers = useMemo<RealtimeHandlers>(
    () => ({
      // O tabuleiro de outra pessoa da mesa (para assistir a rolagem).
      onDiceActive: applyRemote,

      onDiceRoll: (payload) => {
        const { roll } = payload;

        // O mestre guarda todas as rolagens (públicas e privadas) no log lateral.
        if (isMaster) {
          setHistory((prev) => [roll, ...prev.filter((item) => item.id !== roll.id)].slice(0, 100));
        }

        // Rolagem da criação de personagem: entra no log do mestre (acima), mas
        // não vira aviso para ninguém — ela já aparece dentro do assistente.
        if (roll.kind === 'creation') return;

        applyRemoteRoll(roll);

        // A própria rolagem já aparece na janela: não vira aviso para o autor.
        if (roll.clientId && roll.clientId === myClientId.current) return;

        // O aviso só entra quando os dados de quem rolou terminam de cair — sem
        // isso o resultado apareceria na mesa antes de aparecer para quem rolou.
        const delay = rollAnimationMs(roll.kind);

        toastSequence += 1;
        const id = `dice-toast-${toastSequence}`;

        toastTimers.current.push(
          window.setTimeout(() => {
            setToasts((prev) => [{ id, roll }, ...prev].slice(0, 5));

            // Some sozinho depois de 3 segundos (ou antes, se dispensarem).
            toastTimers.current.push(
              window.setTimeout(() => {
                setToasts((prev) => prev.filter((toast) => toast.id !== id));
              }, TOAST_MS),
            );
          }, delay),
        );
      },
    }),
    [isMaster, applyRemote, applyRemoteRoll],
  );

  return {
    isMaster,
    open,
    context,
    pool,
    extraD20,
    remote,
    remoteBoards,
    advantage,
    disadvantage,
    isPrivate,
    phase,
    result,
    deathSaveBefore,
    error,
    effectOptions,
    selectedEffectModifiers,
    toggleEffectModifier,
    toasts,
    history,
    handlers,
    openFree,
    openSkillRoll,
    close,
    cancelAutoClose,
    addDie,
    removeDie,
    setAdvantage,
    setDisadvantage,
    setPrivate,
    submit,
    dismissToast,
    clearHistory,
  };
}

export type DiceRollerState = ReturnType<typeof useDiceRoller>;
