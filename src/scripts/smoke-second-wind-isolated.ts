/** Retomar o Fôlego: HTTP/PostgreSQL em cluster descartável, nunca na campanha. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { prisma } from '../config/prisma.js';
import { signToken } from '../lib/jwt.js';
import { normalizeClassState, restoreShortRestResources } from '../modules/shared/classes.js';
import { characterClassAdjustments } from '../modules/characters/characters.dto.js';
import { seedSpellRepertoire } from './spell-slot-fixtures.js';

const url = new URL(process.env.DATABASE_URL!);
assert.equal(url.port, '55439');
assert.equal(url.searchParams.get('schema'), 'smoke_cure_wounds');
const sentinel: any[] = await prisma.$queryRawUnsafe("SELECT current_setting('data_directory') AS directory, current_schema() AS schema");
assert.equal(sentinel[0].directory, '/tmp/obsyrium-cura-pg');
assert.equal(sentinel[0].schema, 'smoke_cure_wounds');
assert.equal(await prisma.user.count(), 0);
assert.equal(await prisma.character.count(), 0);
assert.equal(await prisma.combat.count(), 0);
let checks = 0;
const users: string[] = [], characters: string[] = [], combats: string[] = [];
const check = (label: string, ok: unknown) => { assert.ok(ok, label); checks++; };
try {
  const make = async (classes: unknown) => {
    const user = await prisma.user.create({ data: { username: 'folego_' + randomUUID(), displayName: 'Fixture', passwordHash: 'fixture', role: 'PLAYER' } });
    users.push(user.id);
    const character = await prisma.character.create({ data: { userId: user.id, name: 'Fôlego Fixture', hpCurrent: 1, hpMax: 100, hpTemp: 7, speed: 9, wisdom: 16, classes: classes as any } });
    characters.push(character.id);
    return { user, character, token: signToken({ sub: user.id, username: user.username, displayName: user.displayName, role: 'PLAYER' }) };
  };
  const fighter = await make([{ classKey: 'fighter', subclass: '', level: 2 }, { classKey: 'cleric', subclass: '', level: 3 }]);
  const other = await make([{ classKey: 'wizard', subclass: '', level: 3 }]);
  const post = async (token: string, body: unknown, path = '/characters/me/features/second-wind') => {
    const response = await fetch('http://127.0.0.1:3309/api' + path, { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { status: response.status, data: await response.json() as any };
  };
  const fresh = () => prisma.character.findUniqueOrThrow({ where: { id: fighter.character.id } });
  const body = async (operationId = randomUUID()) => ({ operationId, expectedVersion: (await fresh()).version });
  const reset = async (data: Record<string, unknown> = {}) => prisma.character.update({ where: { id: fighter.character.id }, data: { classState: {}, hpCurrent: 1, deathState: {}, mechanicalState: {}, ...data, version: { increment: 1 } } });
  const request = await body(), before = await fresh(), used = await post(fighter.token, request);
  assert.equal(used.status, 200, JSON.stringify(used.data));
  check('sentinela HTTP: usuário criado neste cluster controla a própria ficha', used.data.character.id === fighter.character.id);
  if (process.env.SECOND_WIND_FIXTURE_OUTPUT) writeFileSync(process.env.SECOND_WIND_FIXTURE_OUTPUT, JSON.stringify(used.data.character));
  check('dado server-side d10 mais nível de Guerreiro, não total', used.data.roll.dice >= 1 && used.data.roll.dice <= 10 && used.data.roll.bonus === 2 && used.data.roll.total === used.data.roll.dice + 2);
  check('cura e PV temporários preservados fora de combate', used.data.character.hpCurrent === before.hpCurrent + used.data.healed && used.data.character.hpTemp === 7);
  const replay = await post(fighter.token, request), after = await fresh();
  check('replay retorna mesmo snapshot sem repetir cura/consumo', replay.status === 200 && replay.data.replayed && JSON.stringify(replay.data.roll) === JSON.stringify(used.data.roll) && after.hpCurrent === used.data.character.hpCurrent && after.version === used.data.character.version);
  const exhausted = await post(fighter.token, await body());
  check('sem uso não cura nem muda versão', exhausted.status === 409 && exhausted.data.error === 'INSUFFICIENT_RESOURCE' && (await fresh()).version === after.version);
  check('não Guerreiro recusado', (await post(other.token, { operationId: randomUUID(), expectedVersion: other.character.version })).status === 403);
  check('não aceita alvo ou resultado enviados pelo cliente', (await post(fighter.token, { ...await body(), characterId: other.character.id, roll: 10 })).status === 400);
  await reset();
  const stale = await body(); await reset(); const staleBefore = await fresh();
  check('versão antiga não cobra', (await post(fighter.token, stale)).status === 409 && (await fresh()).version === staleBefore.version);
  const foreignId = randomUUID();
  await prisma.characterOperation.create({ data: { characterId: fighter.character.id, operationId: foreignId, type: 'outra-operacao', requestFingerprint: '{}', result: {} } });
  check('chave usada por outra operação recusada', (await post(fighter.token, await body(foreignId))).data.error === 'IDEMPOTENCY_KEY_REUSED');
  for (const data of [{ hpCurrent: 0 }, { mechanicalState: { conditions: [{ id: 'incapacitado-fixture', condition: 'incapacitated', appliedAt: new Date().toISOString() }] } }, { deathState: { dead: true } }]) {
    await reset(data); const current = await fresh(); const response = await post(fighter.token, await body());
    check('estado impeditivo não cobra nem cura', response.status === 409 && response.data.error === 'FEATURE_INCAPACITATED' && (await fresh()).version === current.version);
  }
  await reset({ hpCurrent: 100 }); const full = await post(fighter.token, await body());
  check('a PV máximos consome uso sem exceder teto', full.status === 200 && full.data.healed === 0 && full.data.remaining === 0);
  const spent = await fresh();
  const restored = restoreShortRestResources(normalizeClassState(spent.classState), characterClassAdjustments(spent).resources);
  check('recurso participa da recarga curta canônica', (restored.used['second-wind'] ?? 0) === 0);
  await reset();
  const shared = await body(); const race = await Promise.all([post(fighter.token, shared), post(fighter.token, shared)]);
  check('mesma chave concorrente: mesma cura e uma operação', race.every(r => r.status === 200) && race[0].data.character.version === race[1].data.character.version && await prisma.characterOperation.count({ where: { characterId: fighter.character.id, operationId: shared.operationId } }) === 1);
  await reset(); const raceVersion = (await fresh()).version;
  const distinct = await Promise.all([post(fighter.token, { operationId: randomUUID(), expectedVersion: raceVersion }), post(fighter.token, { operationId: randomUUID(), expectedVersion: raceVersion })]);
  check('chaves distintas concorrentes: somente um vencedor', distinct.filter(r => r.status === 200).length === 1 && distinct.filter(r => r.status === 409).length === 1);
  await reset();
  const combat = await prisma.combat.create({ data: { status: 'ACTIVE', currentIndex: 0, round: 1, turnSequence: 1, combatants: { create: [
    { kind: 'CHARACTER', characterId: fighter.character.id, ownerUserId: fighter.user.id, name: 'Guerreiro', initiative: 20, initiativeRoll: 20, dexterityMod: 0, turnEconomy: { actionsGranted: 1, actionsUsed: 0, movementBudget: 9 } },
    { kind: 'CHARACTER', characterId: other.character.id, ownerUserId: other.user.id, name: 'Outro', initiative: 10, initiativeRoll: 10, dexterityMod: 0 },
  ] } }, include: { combatants: true } }); combats.push(combat.id);
  const participant = combat.combatants.find(c => c.characterId === fighter.character.id)!;
  const inCombat = await post(fighter.token, await body()); assert.equal(inCombat.status, 200, JSON.stringify(inCombat.data));
  let economy = (await prisma.combatant.findUniqueOrThrow({ where: { id: participant.id } })).turnEconomy as any;
  check('em combate consome bônus, mantém ação e movimento', economy.bonusActionUsed && economy.actionsUsed === 0 && economy.movementBudget === 9);
  await reset(); const bonusBefore = await fresh(); const bonusBlocked = await post(fighter.token, await body());
  check('bônus indisponível desfaz recurso e cura', bonusBlocked.status === 409 && (await fresh()).version === bonusBefore.version);
  await prisma.combat.update({ where: { id: combat.id }, data: { currentIndex: 1, turnSequence: 2 } });
  check('fora do turno recusado', (await post(fighter.token, await body())).data.error === 'FEATURE_OUT_OF_TURN');
  await prisma.combat.update({ where: { id: combat.id }, data: { currentIndex: 0, turnSequence: 3 } });
  await seedSpellRepertoire({ characterId: fighter.character.id, classKey: 'cleric', spellIds: ['cure-wounds'] });
  const master = await prisma.user.create({ data: { username: 'mestre_' + randomUUID(), displayName: 'Fixture', passwordHash: 'fixture', role: 'MASTER' } }); users.push(master.id);
  const token = signToken({ sub: master.id, username: master.username, displayName: master.displayName, role: 'MASTER' });
  const spell = await post(token, { operationId: randomUUID(), spellId: 'cure-wounds', caster: { kind: 'character', id: fighter.character.id }, targets: [{ kind: 'character', id: fighter.character.id }], castingResource: { kind: 'spell-slot', level: 1 }, spatialConfirmation: { withinRange: true, clearPath: true } }, '/spells/cast-proof');
  check('Retomar o Fôlego não impõe restrição de magia de Ação Bônus', spell.status === 201);
  console.log(`${checks} verificações de Retomar o Fôlego aprovadas em HTTP/PostgreSQL isolados.`);
} finally {
  await prisma.combat.deleteMany({ where: { id: { in: combats } } });
  await prisma.spellCast.deleteMany({ where: { casterEntityId: { in: characters } } });
  await prisma.character.deleteMany({ where: { id: { in: characters } } });
  await prisma.user.deleteMany({ where: { id: { in: users } } });
  assert.equal(await prisma.user.count(), 0); assert.equal(await prisma.character.count(), 0); assert.equal(await prisma.combat.count(), 0);
  await prisma.$disconnect();
}
