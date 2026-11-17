import { buildRows, type SeedRow } from './phb-equipment-catalog.js';
import { TOOLS } from './tools/index.js';
import { WEAPONS } from './weapons/index.js';
import { HttpError } from '../../lib/http-error.js';

export interface EquipmentGrant {
  id: string;
  quantity: number;
}
export interface EquipmentProduct {
  id: string;
  name: string;
  description: string;
  category: string;
  weight: number;
  priceCp: number | null;
  details: SeedRow['details'];
  contents?: EquipmentGrant[];
  imageUrl?: string;
  itemId?: string;
}
export interface EquipmentSlot {
  label: string;
  ids: string[];
}
export interface EquipmentOption {
  id: string;
  label: string;
  grants: EquipmentGrant[];
  slots: EquipmentSlot[];
}
export interface EquipmentGroup {
  id: string;
  label: string;
  options: EquipmentOption[];
}
export interface EquipmentDraft {
  selections: Record<string, string>;
  cart: EquipmentGrant[];
  wealth?: { classKey: string; dice: number[]; gold: number };
}
export const EMPTY_EQUIPMENT: EquipmentDraft = { selections: {}, cart: [] };
const g = (id: string, quantity = 1): EquipmentGrant => ({ id, quantity });
const w = (id: string, quantity = 1) => g(`weapon:${id}`, quantity);
const gear = (name: string, quantity = 1) => g(`gear:${name}`, quantity);
const pack = (name: string) => g(`pack:Pacote de ${name}`);
const tool = (id: string) => g(`tool:${id}`);
const custom = (id: string) => g(`story:${id}`);
const shield = g('shield:Escudo');
const leather = g('armor:Leve:Couro'),
  chain = g('armor:Pesada:Cota de malha'),
  scale = g('armor:Média:Cota de escamas');
const ammo = (name: string, quantity: number) => g(`ammo:${name}`, quantity);
const explorer = pack('aventureiro'),
  dungeon = pack('explorador de masmorras');
const toolCommerce: Record<string, [number, number]> = {
  'alchemist-supplies': [50, 8],
  'brewer-supplies': [20, 9],
  'calligrapher-supplies': [10, 5],
  'carpenter-tools': [8, 6],
  'cartographer-tools': [15, 6],
  'cobbler-tools': [5, 5],
  'cook-utensils': [1, 8],
  'glassblower-tools': [30, 5],
  'jeweler-tools': [25, 2],
  'leatherworker-tools': [5, 5],
  'mason-tools': [10, 8],
  'painter-supplies': [10, 5],
  'potter-tools': [10, 3],
  'smith-tools': [20, 8],
  'tinker-tools': [50, 10],
  'weaver-tools': [1, 5],
  'woodcarver-tools': [1, 5],
  'disguise-kit': [25, 3],
  'forgery-kit': [15, 5],
  'herbalism-kit': [5, 3],
  'poisoner-kit': [50, 2],
  'navigator-tools': [25, 2],
  'thieves-tools': [25, 1],
  lute: [35, 2],
  bagpipes: [30, 6],
  shawm: [2, 1],
  horn: [3, 2],
  flute: [2, 1],
  lyre: [30, 2],
  drum: [6, 3],
  dulcimer: [25, 10],
  'pan-flute': [12, 2],
};
const storyNames: Record<string, string> = {
  prayer: 'Livro de orações',
  incense: 'Vareta de incenso',
  incenseBlock: 'Bloco de incenso',
  ceremonial: 'Vestes cerimoniais',
  favor: 'Favor de um admirador',
  guild: 'Carta de apresentação da guilda',
  scam: 'Ferramentas do golpe escolhido',
  colored: 'Frascos de líquidos coloridos para golpes',
  loaded: 'Dados viciados',
  marked: 'Baralho de cartas marcadas',
  notes: 'Anotações de estudos e preces',
  lineage: 'Pergaminho de linhagem',
  trophy: 'Troféu de caça',
  letter: 'Carta de um colega falecido',
  knife: 'Faca pequena',
  luck: 'Amuleto da sorte',
  rank: 'Insígnia de patente',
  enemy: 'Troféu de um inimigo',
  map: 'Mapa da cidade natal',
  mouse: 'Camundongo de estimação',
  family: 'Lembrança dos pais',
  sand: 'Saquinho de areia',
  alms: 'Caixa de esmolas',
  censer: 'Turíbulo',
  string: 'Barbante (3 m)',
};
const products: EquipmentProduct[] = buildRows().map((row) => ({
  id: row.key,
  name: row.name,
  description: row.description,
  category: row.category,
  weight: row.weight,
  priceCp: row.price.gold * 100 + row.price.silver * 10 + row.price.copper,
  details: row.details,
}));
for (const entry of TOOLS) {
  const commerce = entry.id === 'poisoner-kit' ? undefined : toolCommerce[entry.id];
  if (!commerce) continue;
  products.push({
    id: `tool:${entry.id}`,
    name: entry.namePt,
    description: entry.description,
    category: entry.category === 'musicalInstrument' ? 'Instrumentos' : 'Ferramentas',
    weight: commerce[1] * 0.45359237,
    priceCp: commerce[0] * 100,
    details:
      entry.category === 'musicalInstrument' ? { spellFocusKinds: ['musical-instrument'] } : {},
  });
}
for (const [id, name] of Object.entries(storyNames))
  products.push({
    id: `story:${id}`,
    name,
    description: 'Pertence inicial do personagem.',
    category: 'Item Geral',
    weight: 0,
    priceCp: null,
    details: {},
  });
const packContents: Record<string, EquipmentGrant[]> = {
  assaltante: [
    gear('Mochila'),
    gear('Esferas de metal (saco com 1.000)'),
    custom('string'),
    gear('Sino'),
    gear('Vela', 5),
    gear('Pé de cabra'),
    gear('Martelo'),
    gear('Estaca de ferro', 10),
    gear('Lanterna coberta'),
    gear('Óleo (frasco)', 2),
    gear('Rações (1 dia)', 5),
    gear('Caixa de fogo'),
    gear('Cantil'),
    gear('Corda de cânhamo (15 metros)'),
  ],
  diplomata: [
    gear('Baú'),
    gear('Estojo para mapa ou pergaminho', 2),
    gear('Roupas finas'),
    gear('Tinta (frasco de 30 g)'),
    gear('Pena de escrever'),
    gear('Lâmpada'),
    gear('Óleo (frasco)', 2),
    gear('Papel (uma folha)', 5),
    gear('Perfume (frasco)'),
    gear('Cera de selar'),
    gear('Sabão'),
  ],
  'explorador de masmorras': [
    gear('Mochila'),
    gear('Pé de cabra'),
    gear('Martelo'),
    gear('Estaca de ferro', 10),
    gear('Tocha', 10),
    gear('Caixa de fogo'),
    gear('Rações (1 dia)', 10),
    gear('Cantil'),
    gear('Corda de cânhamo (15 metros)'),
  ],
  artista: [
    gear('Mochila'),
    gear('Saco de dormir'),
    gear('Roupas de fantasia', 2),
    gear('Vela', 5),
    gear('Rações (1 dia)', 5),
    gear('Cantil'),
    tool('disguise-kit'),
  ],
  aventureiro: [
    gear('Mochila'),
    gear('Saco de dormir'),
    gear('Kit de refeição'),
    gear('Caixa de fogo'),
    gear('Tocha', 10),
    gear('Rações (1 dia)', 10),
    gear('Cantil'),
    gear('Corda de cânhamo (15 metros)'),
  ],
  sacerdote: [
    gear('Mochila'),
    gear('Cobertor'),
    gear('Vela', 10),
    gear('Caixa de fogo'),
    custom('alms'),
    custom('incenseBlock'),
    custom('incenseBlock'),
    custom('censer'),
    gear('Vestes'),
    gear('Rações (1 dia)', 2),
    gear('Cantil'),
  ],
  estudioso: [
    gear('Mochila'),
    gear('Livro'),
    gear('Tinta (frasco de 30 g)'),
    gear('Pena de escrever'),
    gear('Pergaminho (uma folha)', 5),
    custom('sand'),
    custom('knife'),
  ],
};
for (const [name, contents] of Object.entries(packContents)) {
  const entry = products.find((item) => item.id === `pack:Pacote de ${name}`)!;
  entry.contents = contents;
  entry.category = 'Pacotes';
  entry.description = 'Pacote PHB 2014. O conteúdo listado é entregue em itens separados.';
  entry.weight = contents.reduce(
    (total, grant) =>
      total + (products.find((item) => item.id === grant.id)?.weight ?? 0) * grant.quantity,
    0,
  );
}
const slingBullets = products.find((item) => item.id === 'ammo:Bala de funda')!;
products.push({ ...slingBullets, id: 'ammo-unit:Bala de funda', priceCp: null });
slingBullets.name = 'Balas de funda (20)';
slingBullets.priceCp = 4;
slingBullets.weight = 0.6;
slingBullets.contents = [g('ammo-unit:Bala de funda', 20)];
export const EQUIPMENT_PRODUCTS: readonly EquipmentProduct[] = products;
export const equipmentProduct = (id: string) => products.find((item) => item.id === id);
const option = (
  id: string,
  label: string,
  grants: EquipmentGrant[] = [],
  slots: EquipmentSlot[] = [],
): EquipmentOption => ({ id, label, grants, slots });
const ids = (kind: 'simple' | 'martial', melee = false) =>
  WEAPONS.filter((item) => item.category === kind && (!melee || item.type === 'melee')).map(
    (item) => `weapon:${item.id}`,
  );
const slot = (label: string, values: string[]): EquipmentSlot => ({ label, ids: values });
const simple = slot('Arma simples', ids('simple')),
  simpleMelee = slot('Arma simples corpo a corpo', ids('simple', true)),
  martial = slot('Arma marcial', ids('martial'));
const instruments = slot(
  'Instrumento musical',
  TOOLS.filter(
    (item) => item.category === 'musicalInstrument' && equipmentProduct(`tool:${item.id}`),
  ).map((item) => `tool:${item.id}`),
);
const artisan = slot(
  'Ferramentas de artesão',
  TOOLS.filter((item) => item.category === 'artisan').map((item) => `tool:${item.id}`),
);
const focus = (kind: string, label: string) =>
  slot(
    label,
    products
      .filter((item) => item.details.spellFocusKinds?.includes(kind as 'arcane'))
      .map((item) => item.id),
  );
const arcane = focus('arcane', 'Foco arcano'),
  holy = focus('holy-symbol', 'Símbolo sagrado'),
  druidic = focus('druidic', 'Foco druídico');
const crossbow = option('crossbow', 'Besta leve e 20 virotes', [
    w('light-crossbow'),
    ammo('Virote', 20),
  ]),
  simpleOption = option('simple', 'Arma simples', [], [simple]);
const packs = (a: EquipmentGrant, b: EquipmentGrant) => [
  option('a', equipmentProduct(a.id)!.name, [a]),
  option('b', equipmentProduct(b.id)!.name, [b]),
];
const focusOptions = [
  option('pouch', 'Bolsa de componentes', [gear('Bolsa de componentes')]),
  option('focus', 'Foco arcano', [], [arcane]),
];
const martialOptions = [
  option('shield', 'Arma marcial e escudo', [shield], [martial]),
  option('two', 'Duas armas marciais', [], [martial, martial]),
];
const classSets: Record<string, { fixed: EquipmentGrant[]; choices: EquipmentOption[][] }> = {
  barbarian: {
    fixed: [explorer, w('javelin', 4)],
    choices: [
      [
        option('axe', 'Machado grande', [w('greataxe')]),
        option(
          'martial',
          'Arma marcial corpo a corpo',
          [],
          [slot('Arma marcial corpo a corpo', ids('martial', true))],
        ),
      ],
      [option('axes', 'Duas machadinhas', [w('handaxe', 2)]), simpleOption],
    ],
  },
  bard: {
    fixed: [leather, w('dagger')],
    choices: [
      [
        option('rapier', 'Rapieira', [w('rapier')]),
        option('longsword', 'Espada longa', [w('longsword')]),
        simpleOption,
      ],
      packs(pack('diplomata'), pack('artista')),
      [option('instrument', 'Instrumento musical', [], [instruments])],
    ],
  },
  cleric: {
    fixed: [shield],
    choices: [
      [
        option('mace', 'Maça', [w('mace')]),
        option('warhammer', 'Martelo de guerra (requer proficiência)', [w('warhammer')]),
      ],
      [
        option('scale', 'Cota de escamas', [scale]),
        option('leather', 'Armadura de couro', [leather]),
        option('chain', 'Cota de malha (requer proficiência)', [chain]),
      ],
      [crossbow, simpleOption],
      packs(pack('sacerdote'), explorer),
      [option('holy', 'Símbolo sagrado', [], [holy])],
    ],
  },
  druid: {
    fixed: [leather, explorer],
    choices: [
      [option('shield', 'Escudo de madeira', [shield]), simpleOption],
      [
        option('scimitar', 'Cimitarra', [w('scimitar')]),
        option('simple-melee', 'Arma simples corpo a corpo', [], [simpleMelee]),
      ],
      [option('druid', 'Foco druídico', [], [druidic])],
    ],
  },
  fighter: {
    fixed: [],
    choices: [
      [
        option('chain', 'Cota de malha', [chain]),
        option('leather', 'Couro, arco longo e 20 flechas', [
          leather,
          w('longbow'),
          ammo('Flecha', 20),
        ]),
      ],
      martialOptions,
      [crossbow, option('axes', 'Duas machadinhas', [w('handaxe', 2)])],
      packs(dungeon, explorer),
    ],
  },
  monk: {
    fixed: [w('dart', 10)],
    choices: [
      [option('shortsword', 'Espada curta', [w('shortsword')]), simpleOption],
      packs(dungeon, explorer),
    ],
  },
  paladin: {
    fixed: [chain],
    choices: [
      martialOptions,
      [
        option('javelins', 'Cinco azagaias', [w('javelin', 5)]),
        option('simple-melee', 'Arma simples corpo a corpo', [], [simpleMelee]),
      ],
      packs(pack('sacerdote'), explorer),
      [option('holy', 'Símbolo sagrado', [], [holy])],
    ],
  },
  ranger: {
    fixed: [w('longbow'), ammo('Flecha', 20), gear('Aljava')],
    choices: [
      [option('scale', 'Cota de escamas', [scale]), option('leather', 'Couro', [leather])],
      [
        option('swords', 'Duas espadas curtas', [w('shortsword', 2)]),
        option('simple', 'Duas armas simples corpo a corpo', [], [simpleMelee, simpleMelee]),
      ],
      packs(dungeon, explorer),
    ],
  },
  rogue: {
    fixed: [leather, w('dagger', 2), tool('thieves-tools')],
    choices: [
      [
        option('rapier', 'Rapieira', [w('rapier')]),
        option('shortsword', 'Espada curta', [w('shortsword')]),
      ],
      [
        option('bow', 'Arco curto, aljava e 20 flechas', [
          w('shortbow'),
          gear('Aljava'),
          ammo('Flecha', 20),
        ]),
        option('sword', 'Espada curta', [w('shortsword')]),
      ],
      [
        option('burglar', 'Pacote de assaltante', [pack('assaltante')]),
        ...packs(dungeon, explorer),
      ],
    ],
  },
  sorcerer: {
    fixed: [w('dagger', 2)],
    choices: [[crossbow, simpleOption], focusOptions, packs(dungeon, explorer)],
  },
  warlock: {
    fixed: [leather, w('dagger', 2)],
    choices: [
      [crossbow, simpleOption],
      focusOptions,
      packs(pack('estudioso'), dungeon),
      [simpleOption],
    ],
  },
  wizard: {
    fixed: [gear('Livro de magias')],
    choices: [
      [option('staff', 'Bordão', [w('quarterstaff')]), option('dagger', 'Adaga', [w('dagger')])],
      focusOptions,
      packs(pack('estudioso'), explorer),
    ],
  },
};
const bgSets: Record<
  string,
  { gold: number; fixed: EquipmentGrant[]; choices?: EquipmentOption[][] }
> = {
  acolyte: {
    gold: 15,
    fixed: [
      custom('prayer'),
      custom('incense'),
      custom('incense'),
      custom('incense'),
      custom('incense'),
      custom('incense'),
      custom('ceremonial'),
      gear('Roupas comuns'),
    ],
    choices: [[option('holy', 'Símbolo sagrado', [], [holy])]],
  },
  charlatan: {
    gold: 15,
    fixed: [gear('Roupas finas'), tool('disguise-kit')],
    choices: [
      [
        option('liquids', 'Frascos de líquidos coloridos', [custom('colored')]),
        option('dice', 'Dados viciados', [custom('loaded')]),
        option('cards', 'Cartas marcadas', [custom('marked')]),
      ],
    ],
  },
  criminal: { gold: 15, fixed: [gear('Pé de cabra'), gear('Roupas comuns')] },
  entertainer: {
    gold: 15,
    fixed: [custom('favor'), gear('Roupas de fantasia')],
    choices: [[option('instrument', 'Instrumento musical', [], [instruments])]],
  },
  'folk-hero': {
    gold: 10,
    fixed: [gear('Pá'), gear('Panela de ferro'), gear('Roupas comuns')],
    choices: [[option('artisan', 'Ferramentas de artesão', [], [artisan])]],
  },
  'guild-artisan': {
    gold: 15,
    fixed: [custom('guild'), gear('Roupas de viajante')],
    choices: [[option('artisan', 'Ferramentas de artesão', [], [artisan])]],
  },
  hermit: {
    gold: 5,
    fixed: [
      gear('Estojo para mapa ou pergaminho'),
      custom('notes'),
      gear('Cobertor'),
      gear('Roupas comuns'),
      tool('herbalism-kit'),
    ],
  },
  noble: { gold: 25, fixed: [gear('Roupas finas'), gear('Anel de sinete'), custom('lineage')] },
  outlander: {
    gold: 10,
    fixed: [
      w('quarterstaff'),
      gear('Armadilha de caça'),
      custom('trophy'),
      gear('Roupas de viajante'),
    ],
  },
  sage: {
    gold: 10,
    fixed: [
      gear('Tinta (frasco de 30 g)'),
      gear('Pena de escrever'),
      custom('knife'),
      custom('letter'),
      gear('Roupas comuns'),
    ],
  },
  sailor: {
    gold: 10,
    fixed: [w('club'), gear('Corda de seda (15 metros)'), custom('luck'), gear('Roupas comuns')],
  },
  soldier: {
    gold: 10,
    fixed: [custom('rank'), custom('enemy'), gear('Roupas comuns')],
    choices: [
      [
        option('dice', 'Jogo de dados', [gear('Conjunto de dados')]),
        option('cards', 'Jogo de cartas', [gear('Conjunto de cartas')]),
      ],
    ],
  },
  urchin: {
    gold: 10,
    fixed: [
      custom('knife'),
      custom('map'),
      custom('mouse'),
      custom('family'),
      gear('Roupas comuns'),
    ],
  },
};
export const STARTING_WEALTH: Record<string, { count: number; multiplier: number }> = {
  barbarian: { count: 2, multiplier: 10 },
  bard: { count: 5, multiplier: 10 },
  cleric: { count: 5, multiplier: 10 },
  druid: { count: 2, multiplier: 10 },
  fighter: { count: 5, multiplier: 10 },
  monk: { count: 5, multiplier: 1 },
  paladin: { count: 5, multiplier: 10 },
  ranger: { count: 5, multiplier: 10 },
  rogue: { count: 4, multiplier: 10 },
  sorcerer: { count: 3, multiplier: 10 },
  warlock: { count: 4, multiplier: 10 },
  wizard: { count: 4, multiplier: 10 },
};
export function equipmentConfiguration(
  classKey: string,
  backgroundId: string,
  proficiencies: { armor?: string[]; weapons?: string[] } = {},
) {
  const cls = classSets[classKey],
    bg = bgSets[backgroundId];
  const groups: EquipmentGroup[] = [];
  for (const [prefix, sets] of [
    ['class', cls?.choices],
    ['background', bg?.choices],
  ] as const)
    for (const [index, options] of (sets ?? []).entries())
      groups.push({
        id: `${prefix}:${prefix === 'class' ? classKey : backgroundId}:${index}`,
        label:
          prefix === 'class'
            ? `Escolha da classe ${index + 1}`
            : `Escolha do antecedente ${index + 1}`,
        options: options.filter(
          (option) =>
            !(
              classKey === 'cleric' &&
              ((option.id === 'chain' && !proficiencies.armor?.includes('Armaduras pesadas')) ||
                (option.id === 'warhammer' &&
                  !proficiencies.weapons?.some((p) =>
                    /marciais|martelo de guerra|warhammer/i.test(p),
                  )))
            ),
        ),
      });
  return {
    groups,
    fixed: [...(cls?.fixed ?? []), ...(bg?.fixed ?? []), gear('Bolsa')],
    gold: bg?.gold ?? 0,
    wealth: STARTING_WEALTH[classKey],
  };
}
export function normalizeEquipmentDraft(raw: unknown): EquipmentDraft {
  const value = raw as Partial<EquipmentDraft> | null;
  const selections: Record<string, string> = {};
  if (value?.selections && typeof value.selections === 'object')
    for (const [key, val] of Object.entries(value.selections).slice(0, 80))
      if (typeof val === 'string' && key.length < 200 && val.length < 200) selections[key] = val;
  const cart: EquipmentGrant[] = [];
  if (Array.isArray(value?.cart))
    for (const row of value.cart.slice(0, 150))
      if (
        row &&
        typeof row.id === 'string' &&
        Number.isInteger(row.quantity) &&
        row.quantity > 0 &&
        row.quantity <= 999
      )
        cart.push({ id: row.id, quantity: row.quantity });
  const wealth = value?.wealth;
  return {
    selections,
    cart,
    ...(wealth &&
    typeof wealth.classKey === 'string' &&
    Array.isArray(wealth.dice) &&
    wealth.dice.every((n) => Number.isInteger(n) && n >= 1 && n <= 4) &&
    Number.isSafeInteger(wealth.gold)
      ? { wealth }
      : {}),
  };
}
export function resolveEquipmentPlan(
  method: string | null | undefined,
  classKey: string,
  backgroundId: string,
  draft: EquipmentDraft,
  proficiencies: { armor?: string[]; weapons?: string[] } = {},
) {
  const config = equipmentConfiguration(classKey, backgroundId, proficiencies);
  const grants: EquipmentGrant[] = [];
  let gold = 0,
    spent = 0;
  if (method === 'master') return { grants, gold, spent, remainingCp: 0 };
  if (method === 'class-background') {
    if (!classSets[classKey] || !bgSets[backgroundId])
      throw new HttpError('Classe ou antecedente sem equipamento inicial.', 400);
    grants.push(...config.fixed);
    gold = config.gold;
    for (const group of config.groups) {
      const selected = group.options.find((option) => option.id === draft.selections[group.id]);
      if (!selected) throw new HttpError(`Conclua ${group.label.toLowerCase()}.`, 400);
      grants.push(...selected.grants);
      for (const [slotIndex, slot] of selected.slots.entries()) {
        const id = draft.selections[`${group.id}:${selected.id}:${slotIndex}`];
        if (!slot.ids.includes(id))
          throw new HttpError(`Escolha ${slot.label.toLowerCase()}.`, 400);
        grants.push(g(id));
      }
    }
  } else if (method === 'purchase') {
    const wealth = draft.wealth,
      rule = STARTING_WEALTH[classKey];
    if (
      !wealth ||
      !rule ||
      wealth.classKey !== classKey ||
      wealth.dice.length !== rule.count ||
      !wealth.dice.every((value) => Number.isInteger(value) && value >= 1 && value <= 4) ||
      wealth.gold !== wealth.dice.reduce((sum, n) => sum + n, 0) * rule.multiplier
    )
      throw new HttpError('Role a riqueza inicial da classe selecionada.', 400);
    gold = wealth.gold;
    const seen = new Set<string>();
    for (const row of draft.cart) {
      const item = equipmentProduct(row.id);
      if (
        !item ||
        item.priceCp === null ||
        item.priceCp <= 0 ||
        seen.has(row.id) ||
        !Number.isInteger(row.quantity) ||
        row.quantity < 1 ||
        row.quantity > 999
      )
        throw new HttpError('Item ou quantidade inválida no carrinho.', 400);
      seen.add(row.id);
      spent += item.priceCp * row.quantity;
      grants.push(row);
    }
    if (spent > gold * 100) throw new HttpError('O carrinho excede sua riqueza inicial.', 400);
  } else throw new HttpError('Escolha como obter os equipamentos iniciais.', 400);
  const expanded = new Map<string, number>();
  const add = (row: EquipmentGrant) => {
    const product = equipmentProduct(row.id);
    if (!product) throw new HttpError(`Equipamento desconhecido: ${row.id}`, 400);
    if (product.contents)
      for (const part of product.contents) add(g(part.id, part.quantity * row.quantity));
    else expanded.set(row.id, (expanded.get(row.id) ?? 0) + row.quantity);
  };
  grants.forEach(add);
  if (expanded.size > 150)
    throw new HttpError('Equipamentos demais para o inventário inicial.', 400);
  return {
    grants: [...expanded].map(([id, quantity]) => ({ id, quantity })),
    gold,
    spent,
    remainingCp: gold * 100 - spent,
  };
}

export function equipmentArtwork(
  product: EquipmentProduct,
  items: readonly {
    id: string;
    name: string;
    category: string;
    imageUrl: string;
    details: unknown;
  }[],
) {
  const fold = (text: string) =>
    text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  const candidates = items.filter((item) => item.imageUrl);
  return (
    candidates.find(
      (item) =>
        product.id.startsWith('weapon:') &&
        (item.details as { canonicalWeaponId?: string })?.canonicalWeaponId === product.id.slice(7),
    ) ??
    candidates.find(
      (item) =>
        product.category === 'Munição' &&
        (item.details as { ammoType?: string })?.ammoType === product.details.ammoType,
    ) ??
    candidates.find(
      (item) =>
        fold(item.name) === fold(product.name) &&
        (item.category === product.category ||
          (['Ferramentas', 'Instrumentos', 'Pacotes'].includes(product.category) &&
            item.category === 'Item Geral')),
    )
  );
}
