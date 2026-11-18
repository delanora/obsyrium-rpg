/** Serviço real, transações e efeitos com adaptadores em memória. Nenhum HTTP/DB real. */
import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = mkdtempSync(join(tmpdir(), 'equipment-service-'));
let character,
  operations = new Map(),
  diceCalls = 0,
  queue = Promise.resolve();
const db = {
  character: {
    findUnique: async () => structuredClone(character),
    findUniqueOrThrow: async () => structuredClone(character),
    updateMany: async ({ where, data }) => {
      if (where.version !== character.version) return { count: 0 };
      character = { ...character, ...structuredClone(data), version: character.version + 1 };
      return { count: 1 };
    },
  },
  characterOperation: {
    findUnique: async ({ where }) =>
      structuredClone(operations.get(where.characterId_operationId.operationId)),
    create: async ({ data }) => {
      assert.ok(!operations.has(data.operationId), 'chave única');
      operations.set(data.operationId, structuredClone(data));
      return data;
    },
  },
  item: {
    findMany: async () => [
      {
        id: 'art-dagger',
        name: 'Adaga',
        category: 'Arma',
        imageUrl: '/fixture-adaga.png',
        details: { canonicalWeaponId: 'dagger' },
      },
    ],
  },
  $queryRaw: async () => [],
};
globalThis.equipmentDb = {
  ...db,
  $transaction: async (fn) => {
    const previous = queue;
    let done;
    queue = new Promise((r) => (done = r));
    await previous;
    const before = structuredClone(character),
      ops = structuredClone(operations);
    try {
      return await fn(db);
    } catch (error) {
      character = before;
      operations = ops;
      throw error;
    } finally {
      done();
    }
  },
};
globalThis.equipmentDice = async (req) => {
  diceCalls++;
  return { dice: req.dice.map(() => ({ value: 3, sides: 4 })) };
};
const adapters = {
  'config/prisma.js': 'export const prisma=globalThis.equipmentDb;',
  'dice/dice.service.js':
    'export const rollTableDice=async(actor,req)=>globalThis.equipmentDice(req);',
  'game-config/game-config.service.js': 'export const getGameConfig=async()=>({startingLevel:1});',
  'custom-races/custom-races.service.js':
    'export const listCustomRaceOptions=async()=>[];export const findCustomRace=async()=>null;export const toCustomRaceDto=x=>x;',
  'characters/characters.service.js':
    'export const toSheetDto=async x=>x;export const createCharacter=()=>{throw Error("Proibido criar conta")};export const levelUpDraft=()=>{};export const setCreationFinalized=()=>{};export const updateDraftSheet=(...args)=>globalThis.equipmentUpdateDraft(...args);export const publishChange=async()=>{};',
};
const actor = { userId: 'fixture', username: 'fixture', displayName: 'Fixture', role: 'PLAYER' };
function fixture(method = 'purchase') {
  operations.clear();
  diceCalls = 0;
  character = {
    id: 'fixture',
    userId: 'fixture',
    name: 'Fixture',
    race: 'Humano',
    raceId: 'human',
    background: 'Criminoso',
    level: 1,
    strength: 14,
    dexterity: 14,
    constitution: 14,
    intelligence: 14,
    wisdom: 14,
    charisma: 14,
    version: 1,
    creationFinalized: false,
    classes: [{ classKey: 'sorcerer', level: 1, subclass: 'Magia Selvagem' }],
    classState: {},
    raceChoices: {},
    features: [],
    skills: { arcana: { proficient: true }, persuasion: { proficient: true } },
    proficiencies: { armor: [], weapons: [], tools: [] },
    inventory: [],
    coins: { pp: 0, gp: 7, ep: 0, sp: 0, cp: 0 },
    creationDraft: {
      stepVersion: 2,
      step: 10,
      mode: 'existing',
      equipmentMethod: method,
      equipment: { selections: {}, cart: [] },
      baseAbilities: {
        strength: 14,
        dexterity: 14,
        constitution: 14,
        intelligence: 14,
        wisdom: 14,
        charisma: 14,
      },
      rolls: [],
      skillPicks: ['arcana', 'persuasion'],
    },
  };
}
try {
  await build({
    stdin: {
      contents:
        "export {rollCreationWealth,finalizeCreation,saveCreationStep} from './src/modules/characters/creation.service.ts';export {equipmentConfiguration} from './src/modules/shared/creation-equipment.ts';",
      resolveDir: process.cwd(),
      loader: 'ts',
    },
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: join(dir, 'service.mjs'),
    plugins: [
      {
        name: 'memoria',
        setup(b) {
          b.onResolve({ filter: /\.js$/ }, (args) => {
            const key = Object.keys(adapters).find((key) =>
              resolve(args.resolveDir, args.path).endsWith(key),
            );
            return key ? { path: key, namespace: 'fixture' } : undefined;
          });
          b.onLoad({ filter: /.*/, namespace: 'fixture' }, (args) => ({
            contents: adapters[args.path],
            loader: 'js',
          }));
        },
      },
    ],
  });
  const { rollCreationWealth, finalizeCreation, saveCreationStep, equipmentConfiguration } = await import(
    pathToFileURL(join(dir, 'service.mjs'))
  );
  globalThis.equipmentUpdateDraft = async (_actor, patch, draft, options) => {
    character = { ...character, ...structuredClone(patch), creationDraft: structuredClone(draft), version: character.version + 1 };
    if (patch.classes) character.classes = patch.classes.map(entry => ({ ...entry, level: entry.level ?? 1 }));
    globalThis.equipmentDraftOptions = options;
  };
  fixture('master');
  character.creationDraft.mode = 'new';
  const preserved = structuredClone(character.creationDraft.baseAbilities);
  await saveCreationStep(actor, { step: 3, resetAbilities: true });
  assert.deepEqual(character.creationDraft.baseAbilities, preserved, 'Voltar preserva atributos');
  character.creationDraft.mode = 'existing';
  character.charisma = 8; character.creationDraft.baseAbilities.charisma = 8;
  await saveCreationStep(actor, { step: 5, classKey: 'sorcerer', subclass: 'Magia Selvagem' });
  assert.equal(globalThis.equipmentDraftOptions.skipClassPrerequisite, true, 'Troca da classe não bloqueia antes dos atributos');
  assert.equal(character.creationDraft.baseAbilities.charisma, 8);
  const oldStep = character.creationDraft.step;
  await saveCreationStep(actor, { step: 6, syncAbilities: true, baseAbilities: { ...character.creationDraft.baseAbilities, charisma: 9 } });
  assert.equal(character.creationDraft.step, oldStep, 'Sincronizar não conclui a etapa');
  assert.equal(character.charisma, 10, 'Aplica o bônus racial no mesmo pipeline');
  assert.equal(globalThis.equipmentDraftOptions.skipClassPrerequisite, true);
  await assert.rejects(() => saveCreationStep(actor, { step: 2, syncAbilities: true, name: 'Fixture' }), /etapa 6/);

  await assert.rejects(() => saveCreationStep(actor, { step: 7, skills: [] }), /Revise os atributos na etapa 6/);
  await assert.rejects(() => saveCreationStep(actor, { step: 6, baseAbilities: character.creationDraft.baseAbilities }), /Carisma: faltam 3/);
  await assert.rejects(() => finalizeCreation(actor, { expectedVersion: character.version, operationId: 'invalid-class-abilities' }), /Carisma 13/);
  fixture('master');
  character.creationDraft.mode = 'new'; character.creationDraft.step = 6;
  character.creationDraft.baseAbilities = {};
  character.creationDraft.rolls = Array.from({ length: 6 }, () => ({ dice: [5, 5, 4, 1], dropped: 3 }));
  await saveCreationStep(actor, { step: 6, syncAbilities: true, baseAbilities: { charisma: 14 } });
  assert.equal(character.charisma, 15);
  assert.deepEqual(character.creationDraft.baseAbilities, { charisma: 14 });
  assert.equal(character.creationDraft.step, 6);
  await assert.rejects(() => saveCreationStep(actor, { step: 6, syncAbilities: true, baseAbilities: { charisma: 15 } }), /exatamente os seis valores/);
  await assert.rejects(() => saveCreationStep(actor, { step: 6, baseAbilities: { charisma: 14 } }), /Faltam valores/);
  fixture();
  await assert.rejects(
    () => rollCreationWealth(actor, { expectedVersion: 0, operationId: 'stale' }),
    /ficha mudou/,
  );
  assert.equal(diceCalls, 0);
  const request = { expectedVersion: 1, operationId: 'wealth' };
  const first = await rollCreationWealth(actor, request);
  assert.equal(diceCalls, 1);
  assert.equal(character.creationDraft.equipment.wealth.gold, 90);
  assert.deepEqual(await rollCreationWealth(actor, request), first);
  assert.equal(diceCalls, 1);
  await rollCreationWealth(actor, {
    expectedVersion: character.version,
    operationId: 'wealth-again',
  });
  assert.equal(diceCalls, 1, 'mesma classe não rerrola');
  character.classes = [{ classKey: 'wizard', level: 1 }];
  await rollCreationWealth(actor, { expectedVersion: character.version, operationId: 'wizard' });
  assert.equal(diceCalls, 2);
  character.classes = [{ classKey: 'sorcerer', level: 1, subclass: 'Magia Selvagem' }];
  await rollCreationWealth(actor, { expectedVersion: character.version, operationId: 'back' });
  assert.equal(diceCalls, 2, 'voltar à classe reaproveita riqueza');
  character.creationDraft.equipment.cart = [{ id: 'weapon:dagger', quantity: 2 }];
  const version = character.version;
  await assert.rejects(
    () => finalizeCreation(actor, { expectedVersion: version - 1, operationId: 'bad-final' }),
    /ficha mudou/,
  );
  assert.equal(character.inventory.length, 0);
  const finalReq = { expectedVersion: version, operationId: 'final' };
  const result = await finalizeCreation(actor, finalReq);
  assert.equal(character.inventory.length, 1);
  assert.equal(character.inventory[0].quantity, 2);
  assert.equal(character.inventory[0].imageUrl, '/fixture-adaga.png');
  assert.equal(character.coins.gp, 93);
  assert.deepEqual(await finalizeCreation(actor, finalReq), result);
  assert.equal(character.coins.gp, 93);
  assert.equal(character.inventory[0].quantity, 2);
  await assert.rejects(() => rollCreationWealth(actor, finalReq), /Identificador/);
  character.creationFinalized = false;
  const before = structuredClone(character.inventory),
    coins = structuredClone(character.coins);
  await finalizeCreation(actor, { expectedVersion: character.version, operationId: 'reopened' });
  assert.deepEqual(character.inventory, before);
  assert.deepEqual(character.coins, coins);
  fixture('master');
  const empty = await finalizeCreation(actor, { expectedVersion: 1, operationId: 'master' });
  assert.equal(empty.character.creationFinalized, true);
  assert.deepEqual(character.inventory, []);
  assert.equal(character.coins.gp, 7);
  fixture();
  await rollCreationWealth(actor, { expectedVersion: 1, operationId: 'start' });
  character.creationDraft.equipment.cart = [{ id: 'gear:Livro de magias', quantity: 10 }];
  const unchanged = structuredClone(character);
  await assert.rejects(
    () => finalizeCreation(actor, { expectedVersion: character.version, operationId: 'overspend' }),
    /excede/,
  );
  assert.deepEqual(character, unchanged);
  fixture('class-background');
  const configuration = equipmentConfiguration('sorcerer', 'criminal', character.proficiencies);
  for (const group of configuration.groups) {
    const option = group.options[0];
    character.creationDraft.equipment.selections[group.id] = option.id;
    option.slots.forEach(
      (slot, index) =>
        (character.creationDraft.equipment.selections[`${group.id}:${option.id}:${index}`] =
          slot.ids[0]),
    );
  }
  await finalizeCreation(actor, { expectedVersion: 1, operationId: 'class-pack' });
  assert.equal(character.coins.gp, 22);
  assert.equal(character.inventory.find((item) => item.name === 'Virote').quantity, 20);
  assert.equal(character.inventory.find((item) => item.name === 'Adaga').quantity, 2);
  assert.ok(character.inventory.some((item) => item.details.componentPouch));
  assert.ok(!character.inventory.some((item) => item.name.startsWith('Pacote')));
  fixture();
  await rollCreationWealth(actor, { expectedVersion: 1, operationId: 'roll-cap' });
  character.creationDraft.equipment.cart = [{ id: 'weapon:dagger', quantity: 1 }];
  character.inventory = Array.from({ length: 300 }, (_, index) => ({
    id: `old-${index}`,
    name: 'Fixture',
    quantity: 1,
    weight: 0,
  }));
  const full = structuredClone(character);
  await assert.rejects(
    () => finalizeCreation(actor, { expectedVersion: character.version, operationId: 'full' }),
    /Não há espaço/,
  );
  assert.deepEqual(character, full);
  fixture();
  await rollCreationWealth(actor, { expectedVersion: 1, operationId: 'roll-parallel-final' });
  character.creationDraft.equipment.cart = [{ id: 'weapon:dagger', quantity: 2 }];
  const finalVersion = character.version;
  await Promise.all([
    finalizeCreation(actor, { expectedVersion: finalVersion, operationId: 'final-a' }),
    finalizeCreation(actor, { expectedVersion: finalVersion, operationId: 'final-b' }),
  ]);
  assert.equal(character.inventory[0].quantity, 2);
  assert.equal(character.coins.gp, 93);
  assert.equal(
    [...operations.values()].filter((operation) => operation.type === 'CREATION_EQUIPMENT_GRANT')
      .length,
    1,
  );
  fixture();
  await Promise.all([
    rollCreationWealth(actor, { expectedVersion: 1, operationId: 'parallel' }),
    rollCreationWealth(actor, { expectedVersion: 1, operationId: 'parallel' }),
  ]);
  assert.equal(diceCalls, 1);
  console.log(
    'Serviço: atributos preservados, requisito adiado à etapa 6, bloqueio posterior/final e riqueza por classe, replay, concorrência, versão, saldo, imagens, finalização atômica, reabertura e ausência de efeitos no modo Mestre aprovados.',
  );
} finally {
  rmSync(dir, { recursive: true, force: true });
}
