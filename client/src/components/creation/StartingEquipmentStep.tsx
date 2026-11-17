import { useEffect, useRef, useState } from 'react';
import { Icon } from '../Icon';
import {
  STARTING_EQUIPMENT_LABELS,
  type StartingEquipmentMethod,
} from '../../../../src/modules/shared/starting-equipment';
import {
  equipmentConfiguration,
  resolveEquipmentPlan,
  STARTING_WEALTH,
  type EquipmentDraft,
} from '../../../../src/modules/shared/creation-equipment';
import {
  EquipmentGrantList,
  EquipmentIcon,
  EquipmentItem,
  equipmentPrice,
  useEquipmentProducts,
} from './equipmentUi';
import { CommonDicePool } from '../../dice/CommonDicePool';
import { CommonTrayFrame } from '../../dice/CommonTrayFrame';
import { rollAnimationMs } from '../../dice/rollAnimation';
import type { DiceRollDto } from '../../types';
import '../../dice/common-tray.css';
import './ability-step.css';
export function StartingEquipmentStep({
  method,
  details,
  disabled,
  classKey,
  className,
  background,
  backgroundId,
  proficiencies,
  draft,
  delivered,
  onChange,
  onWealth,
  onChoose,
}: {
  method: StartingEquipmentMethod | null;
  details: boolean;
  disabled: boolean;
  classKey: string;
  className: string;
  background: string;
  backgroundId: string;
  proficiencies: { armor?: string[]; weapons?: string[] };
  draft: EquipmentDraft;
  delivered: boolean;
  onChange: (draft: EquipmentDraft) => void;
  onWealth: () => Promise<EquipmentDraft>;
  onChoose: (method: StartingEquipmentMethod) => void;
}) {
  const products = useEquipmentProducts(),
    config = equipmentConfiguration(classKey, backgroundId, proficiencies);
  const [search, setSearch] = useState(''),
    [category, setCategory] = useState(''),
    [rolling, setRolling] = useState(false),
    [result, setResult] = useState<DiceRollDto | null>(null),
    [error, setError] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    pending = useRef(false),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  const wealth = draft.wealth?.classKey === classKey ? draft.wealth : undefined,
    rule = STARTING_WEALTH[classKey];
  const select = (id: string, value: string) =>
    onChange({ ...draft, selections: { ...draft.selections, [id]: value } });
  let plan: ReturnType<typeof resolveEquipmentPlan> | null = null;
  let missing = '';
  try {
    plan = resolveEquipmentPlan(method, classKey, backgroundId, draft, proficiencies);
  } catch (err) {
    missing = err instanceof Error ? err.message : 'Conclua as escolhas.';
  }
  const spent = draft.cart.reduce(
      (sum, row) =>
        sum + (products.find((item) => item.id === row.id)?.priceCp ?? 0) * row.quantity,
      0,
    ),
    budget = (wealth?.gold ?? 0) * 100;
  const count = (id: string) => draft.cart.find((row) => row.id === id)?.quantity ?? 0;
  const quantity = (id: string, n: number) => {
    const cart = draft.cart.filter((row) => row.id !== id);
    if (n > 0) cart.push({ id, quantity: Math.min(999, n) });
    onChange({ ...draft, cart });
  };
  async function roll() {
    if (pending.current || disabled || wealth) return;
    pending.current = true;
    setRolling(true);
    setError('');
    try {
      const saved = await onWealth();
      if (!mounted.current) return;
      const entry = saved.wealth!;
      setResult({
        id: 'creation-wealth',
        actorUserId: '',
        actorName: '',
        clientId: null,
        kind: 'creation',
        label: 'Riqueza inicial',
        dice: entry.dice.map((value) => ({ sides: 4, value })),
        total: entry.gold,
        bonus: 0,
        advantage: false,
        disadvantage: false,
        isPrivate: true,
        crit: false,
        lucky: false,
        at: '',
      });
      timer.current = setTimeout(
        () => {
          if (mounted.current) {
            setRolling(false);
            pending.current = false;
          }
        },
        window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 80 : rollAnimationMs(),
      );
    } catch (err) {
      if (mounted.current) {
        setError(err instanceof Error ? err.message : 'Falha ao rolar.');
        setRolling(false);
        pending.current = false;
      }
    }
  }
  const savedResult: DiceRollDto | null = wealth
    ? {
        id: 'wealth-saved',
        actorUserId: '',
        actorName: '',
        clientId: null,
        kind: 'creation',
        label: 'Riqueza inicial',
        dice: wealth.dice.map((value) => ({ sides: 4, value })),
        total: wealth.gold,
        bonus: 0,
        advantage: false,
        disadvantage: false,
        isPrivate: true,
        crit: false,
        lucky: false,
        at: '',
      }
    : null;
  if (delivered)
    return (
      <p className="section-note">
        Os equipamentos iniciais desta ficha já foram tratados. Reabrir a criação não entrega itens
        ou moedas novamente.
      </p>
    );
  if (!details || !method)
    return (
      <>
        <p className="section-note">Como você quer obter seus equipamentos iniciais?</p>
        <div
          className="wizard-mode-cards wizard-equipment-cards"
          role="group"
          aria-label="Forma de obter equipamentos iniciais"
        >
          {(
            [
              {
                key: 'class-background',
                icon: 'sword',
                hint: 'Escolha entre as alternativas da classe e receba também os itens e moedas do antecedente.',
              },
              {
                key: 'purchase',
                icon: 'coin',
                hint: `Role a riqueza inicial de ${className || 'sua classe'} e monte seu próprio conjunto de equipamentos.`,
              },
              {
                key: 'master',
                icon: 'crown',
                hint: 'Combine os equipamentos com o Mestre. Esta opção não entrega itens nem dinheiro.',
              },
            ] as const
          ).map((option) => (
            <button
              type="button"
              key={option.key}
              disabled={disabled}
              aria-pressed={method === option.key}
              className={`wizard-mode-card${method === option.key ? ' is-selected' : method ? ' is-dimmed' : ''}`}
              onClick={() => onChoose(option.key)}
            >
              <Icon name={option.icon} size={40} />
              <strong>{STARTING_EQUIPMENT_LABELS[option.key]}</strong>
              <span>{option.hint}</span>
            </button>
          ))}
        </div>
      </>
    );
  return (
    <section
      className="wizard-option-detail equipment-step"
      aria-label="Detalhes dos equipamentos iniciais"
    >
      <h3>{STARTING_EQUIPMENT_LABELS[method]}</h3>
      {method === 'master' ? (
        <p>
          Você combinará os equipamentos diretamente com o Mestre após finalizar o personagem.
          Nenhum item ou dinheiro será entregue pela criação.
        </p>
      ) : method === 'class-background' ? (
        <>
          <p>
            Escolha suas alternativas de {className}. Os itens de {background} também entram no
            conjunto.
          </p>
          {config.groups.map((group) => {
            const choice = group.options.find((option) => option.id === draft.selections[group.id]);
            return (
              <fieldset className="equipment-choice" key={group.id}>
                <legend>{group.label}</legend>
                <div className="equipment-options">
                  {group.options.map((option) => (
                    <button
                      type="button"
                      className={`btn${choice?.id === option.id ? ' is-chosen' : ''}`}
                      key={option.id}
                      disabled={disabled}
                      aria-pressed={choice?.id === option.id}
                      onClick={() => select(group.id, option.id)}
                    >
                      {option.grants[0] ? (
                        <EquipmentIcon
                          item={products.find((item) => item.id === option.grants[0].id)!}
                        />
                      ) : (
                        <span className="equipment-icon">
                          <Icon
                            name={
                              option.slots.some((slot) => slot.label.startsWith('Arma'))
                                ? 'sword'
                                : 'bag'
                            }
                            size={24}
                          />
                        </span>
                      )}
                      {option.label}
                    </button>
                  ))}
                </div>
                {choice ? (
                  <>
                    <EquipmentGrantList rows={choice.grants} products={products} />
                    {choice.slots.map((slot, index) => {
                      const key = `${group.id}:${choice.id}:${index}`,
                        id = draft.selections[key],
                        item = products.find((item) => item.id === id);
                      return (
                        <div key={key}>
                          <label className="field">
                            <span>
                              {slot.label}
                              {choice.slots.length > 1 ? ` ${index + 1}` : ''}
                            </span>
                            <select
                              aria-label={`${slot.label}${choice.slots.length > 1 ? ` ${index + 1}` : ''}`}
                              disabled={disabled}
                              value={id ?? ''}
                              onChange={(event) => select(key, event.target.value)}
                            >
                              <option value="">— escolha —</option>
                              {slot.ids.map((id) => (
                                <option key={id} value={id}>
                                  {products.find((item) => item.id === id)?.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          {item ? <EquipmentItem item={item} /> : null}
                        </div>
                      );
                    })}
                  </>
                ) : null}
              </fieldset>
            );
          })}
          <h4 className="wizard-information-heading">Itens fixos e antecedente</h4>
          <EquipmentGrantList rows={config.fixed} products={products} />
          <p>
            Moedas do antecedente: <strong>{config.gold} PO</strong>.
          </p>
        </>
      ) : (
        <>
          <p>
            A riqueza de {className} é{' '}
            <strong>
              {rule?.count}d4{rule?.multiplier === 10 ? ' × 10' : ''} PO
            </strong>
            . A compra substitui os itens e moedas iniciais de classe e antecedente.
          </p>
          <div
            className="dice-stage is-standard-roll ability-tray equipment-wealth-tray"
            aria-label="Bandeja de riqueza inicial"
          >
            <div className={`dice-ring${rolling ? ' is-rolling' : ''}`}>
              <div className="dice-ring-inner">
                <div className="dice-ring-floor">
                  <CommonDicePool
                    pool={Array.from({ length: rule?.count ?? 0 }, () => ({
                      sides: 4,
                      locked: true,
                    }))}
                    result={result ?? savedResult}
                    rolling={rolling && result !== null}
                    settled={!rolling || result === null}
                    extraD20={0}
                  />
                </div>
              </div>
              <CommonTrayFrame />
            </div>
            <button
              type="button"
              className="btn btn-primary"
              disabled={disabled || rolling || !!wealth}
              onClick={() => void roll()}
            >
              {rolling ? 'Rolando...' : wealth ? 'Riqueza já rolada' : 'Rolar riqueza inicial'}
            </button>
          </div>
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          {wealth && !rolling ? (
            <>
              <div className="equipment-balance" aria-live="polite">
                <span>
                  Riqueza <strong>{equipmentPrice(budget)}</strong>
                </span>
                <span>
                  Carrinho <strong>{equipmentPrice(spent)}</strong>
                </span>
                <span className={spent > budget ? 'form-error' : ''}>
                  Saldo <strong>{equipmentPrice(budget - spent)}</strong>
                </span>
              </div>
              <div className="grid grid-2">
                <label className="field">
                  <span>Buscar equipamento</span>
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Categoria</span>
                  <select value={category} onChange={(event) => setCategory(event.target.value)}>
                    <option value="">Todas</option>
                    {[
                      ...new Set(
                        products
                          .filter((item) => item.priceCp !== null && item.priceCp > 0)
                          .map((item) => item.category),
                      ),
                    ].map((name) => (
                      <option key={name}>{name}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="equipment-shop" aria-label="Catálogo de equipamentos">
                {products
                  .filter(
                    (item) =>
                      item.priceCp !== null &&
                      item.priceCp > 0 &&
                      (!category || item.category === category) &&
                      item.name
                        .toLocaleLowerCase('pt-BR')
                        .includes(search.toLocaleLowerCase('pt-BR')),
                  )
                  .map((item) => (
                    <article className="equipment-shop-card" key={item.id}>
                      <EquipmentItem item={item} />
                      <p>{equipmentPrice(item.priceCp!)}</p>
                      <div className="equipment-quantity">
                        <button
                          type="button"
                          className="btn btn-small"
                          disabled={disabled || count(item.id) === 0}
                          aria-label={`Remover ${item.name}`}
                          onClick={() => quantity(item.id, count(item.id) - 1)}
                        >
                          −
                        </button>
                        <output aria-label={`Quantidade de ${item.name}`}>{count(item.id)}</output>
                        <button
                          type="button"
                          className="btn btn-small"
                          disabled={
                            disabled || count(item.id) >= 999 || spent + item.priceCp! > budget
                          }
                          aria-label={`Adicionar ${item.name}`}
                          onClick={() => quantity(item.id, count(item.id) + 1)}
                        >
                          +
                        </button>
                      </div>
                    </article>
                  ))}
              </div>
              <h4 className="wizard-information-heading">Carrinho</h4>
              {draft.cart.length ? (
                <div className="equipment-grants">
                  {draft.cart.map((row) => {
                    const item = products.find((item) => item.id === row.id)!;
                    return (
                      <article className="equipment-shop-card" key={row.id}>
                        <EquipmentItem item={item} quantity={row.quantity} />
                        <div className="equipment-quantity">
                          <button
                            type="button"
                            className="btn btn-small"
                            disabled={disabled}
                            aria-label={`Diminuir ${item.name} no carrinho`}
                            onClick={() => quantity(row.id, row.quantity - 1)}
                          >
                            −
                          </button>
                          <span>{row.quantity}</span>
                          <button
                            type="button"
                            className="btn btn-small"
                            disabled={
                              disabled || row.quantity >= 999 || spent + item.priceCp! > budget
                            }
                            aria-label={`Aumentar ${item.name} no carrinho`}
                            onClick={() => quantity(row.id, row.quantity + 1)}
                          >
                            +
                          </button>
                          <button
                            type="button"
                            className="btn btn-small"
                            disabled={disabled}
                            aria-label={`Tirar ${item.name} do carrinho`}
                            onClick={() => quantity(row.id, 0)}
                          >
                            Remover
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <p className="section-note">
                  Nenhum item no carrinho. Você pode guardar a riqueza para depois.
                </p>
              )}
            </>
          ) : null}
        </>
      )}
      {method !== 'master' ? (
        <>
          <h4 className="wizard-information-heading">Você receberá ao finalizar</h4>
          {plan && !rolling ? (
            <>
              <EquipmentGrantList rows={plan.grants} products={products} />
              <p>
                Moedas: <strong>{equipmentPrice(plan.remainingCp)}</strong>.
              </p>
            </>
          ) : (
            <p className="section-note">{missing || 'Aguarde a rolagem.'}</p>
          )}
        </>
      ) : null}
    </section>
  );
}
