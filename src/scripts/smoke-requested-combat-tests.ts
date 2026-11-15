/** Integração HTTP: recusa qualquer banco/schema que não seja descartável e exclusivo. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { prisma } from '../config/prisma.js';
import { signToken } from '../lib/jwt.js';
import { onTurnStart } from '../modules/shared/action-economy.js';

async function main() {
  const url = new URL(process.env.DATABASE_URL!);
  assert.match(url.pathname, /^\/grimorio_smoke_requested_/);
  assert.match(url.searchParams.get('schema') ?? '', /^smoke_requested_/);
  const base = process.env.PLAYABLE_BASE_URL!;
  assert.equal(new URL(base).hostname, '127.0.0.1');
  assert.equal(new URL(base).port, '3141');
  assert.equal(await prisma.user.count(), 0);
  assert.equal(await prisma.combat.count(), 0);
  const ids: string[] = [], characters: string[] = [];
  let combatId: string | undefined, creatureId: string | undefined, regionId: string | undefined, localityId: string | undefined;
  try {
    const makeUser = async (role: 'MASTER' | 'PLAYER') => {
      const user = await prisma.user.create({ data: { username: 'fixture_' + randomUUID(), displayName: 'Fixture', passwordHash: 'fixture', role } });
      ids.push(user.id); return user;
    };
    const master = await makeUser('MASTER'), player = await makeUser('PLAYER'), peer = await makeUser('PLAYER');
    const a = await prisma.character.create({ data: { userId: player.id, name: 'Ladino isolado', dexterity: 16,
      classes: [{ classKey: 'rogue', level: 1 }], skills: { stealth: { proficient: true, expertise: true } }, hpMax: 30, hpCurrent: 30 } });
    const b = await prisma.character.create({ data: { userId: peer.id, name: 'Bardo isolado', classes: [{ classKey: 'bard', level: 2 }], hpMax: 30, hpCurrent: 30 } });
    characters.push(a.id, b.id);
    const region = await prisma.region.create({ data: { name: 'Região isolada' } }); regionId = region.id;
    const locality = await prisma.locality.create({ data: { name: 'Localidade isolada', regionId } }); localityId = locality.id;
    const creature = await prisma.creature.create({ data: { name: 'NPC isolado', kind: 'NPC', wisdom: 14, localities: { connect: [{ id: locality.id }] } } }); creatureId = creature.id;
    const combat = await prisma.combat.create({ data: { status: 'ACTIVE', round: 1, turnSequence: 1 } }); combatId = combat.id;
    const makeUnit = (data: object) => prisma.combatant.create({ data: { combatId: combat.id, kind: 'CHARACTER', name: 'Fixture', dexterityMod: 0, initiative: 10, turnEconomy: onTurnStart(9), ...data } });
    const ua = await makeUnit({ characterId: a.id, ownerUserId: player.id });
    const ub = await makeUnit({ characterId: b.id, ownerUserId: peer.id });
    const un = await makeUnit({ creatureId, kind: 'NPC', name: creature.name });
    const token = (u: typeof master) => signToken({ sub: u.id, username: u.username, displayName: u.displayName, role: u.role });
    const http = async (path: string, body?: unknown, actor = master) => {
      const response = await fetch(base + '/api' + path, { method: body ? 'POST' : 'GET', headers: { Authorization: 'Bearer ' + token(actor), 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
      return { status: response.status, data: await response.json() as any };
    };
    // Sentinela comprova que HTTP e Prisma usam exatamente o mesmo schema.
    assert.equal((await http('/characters/me', undefined, player)).data.character.id, a.id);
    const economyBefore = JSON.stringify((await prisma.combatant.findMany({ where: { combatId }, orderBy: { id: 'asc' } })).map(u => u.turnEconomy));
    const version = async () => (await prisma.combat.findUniqueOrThrow({ where: { id: combat.id } })).version;
    const requests = async (actor = master) => (await http(`/combat/${combatId}/resolution-requests`, undefined, actor)).data.requests.filter((card: any) => card.kind === 'requested-test');
    const ask = async (unit: string, kind: string, key: string, dc = 15) => {
      const result = await http(`/combat/${combatId}/participants/${unit}/tests`, { kind, key, dc, expectedVersion: await version(), operationId: randomUUID() });
      assert.equal(result.status, 200, JSON.stringify(result));
      return (await requests()).filter((r: any) => r.requestedTest.kind === kind && r.requestedTest.key === key && r.target.id === (unit === ua.id ? a.id : unit === ub.id ? b.id : un.id)).at(-1);
    };
    const rollInput = (card: any) => ({ pendingCombatTestId: card.requestedTest.id, expectedTestVersion: card.requestedTest.version,
      kind: 'free', dice: [{ sides: 100 }], bonus: 99, ability: 'charisma', entity: { kind: 'character', id: b.id }, label: 'Não confiar no cliente', clientId: randomUUID() });
    const path = `/combat/${combatId}/participants/${ua.id}/tests`;
    const create = { kind: 'skill', key: 'stealth', dc: 15, expectedVersion: await version(), operationId: randomUUID() };
    assert.equal((await http(path, create, player)).status, 403);
    assert.equal((await http(path, { ...create, dc: -1 })).status, 400);
    assert.equal((await http(path, { ...create, key: 'inexistente' })).status, 400);
    assert.equal((await http(path, create)).status, 200);
    assert.equal((await http(path, create)).status, 200, 'Retry da solicitação não duplica.');
    assert.equal((await http(path, { ...create, dc: 20 })).status, 409);
    const skill = (await requests(player))[0];
    assert.equal((await requests(peer)).length, 0);
    assert.equal(await prisma.combatTestRequest.count({ where: { combatId } }), 1);
    const input = rollInput(skill);
    assert.equal((await http('/dice/roll', input, peer)).status, 403);
    assert.equal((await http('/dice/roll', { ...input, expectedTestVersion: 9 }, player)).status, 409);
    const first = await http('/dice/roll', input, player);
    assert.equal(first.status, 201, JSON.stringify(first));
    assert.equal(first.data.roll.bonus, 7, 'Destreza +3 e expertise +4.');
    assert.equal(first.data.roll.kind, 'skill');
    assert.equal(first.data.roll.dice[0].sides, 20);
    assert.equal(first.data.roll.dice.length, 1);
    assert.match(first.data.roll.label, /Furtividade.*CD 15/);
    assert.equal((await http('/dice/roll', input, player)).data.roll.id, first.data.roll.id, 'Retry devolve a mesma rolagem.');
    assert.equal((await http('/dice/roll', { ...input, bonus: 98 }, player)).data.error, 'IDEMPOTENCY_KEY_REUSED');
    assert.equal((await requests(player)).length, 0);
    const save = await ask(ua.id, 'save', 'dexterity');
    const races = await Promise.all([http('/dice/roll', rollInput(save), player), http('/dice/roll', rollInput(save), player)]);
    assert.deepEqual(races.map(r => r.status).sort(), [201, 409]);
    assert.equal(races.find(r => r.status === 201)!.data.roll.bonus, 5, 'Salvaguarda proficiente da classe.');
    const ability = await ask(ub.id, 'ability', 'wisdom');
    assert.equal((await http('/dice/roll', rollInput(ability), peer)).data.roll.bonus, 1, 'Pau para Toda Obra no teste de atributo.');
    const npc = await ask(un.id, 'save', 'wisdom');
    assert.equal((await requests(player)).length, 0, 'Pedido do NPC não chega ao jogador.');
    const npcRoll = await http('/dice/roll', { ...rollInput(npc), visibility: 'private' });
    assert.equal(npcRoll.status, 201); assert.equal(npcRoll.data.roll.bonus, 2); assert.equal(npcRoll.data.roll.isPrivate, true);
    await prisma.character.update({ where: { id: a.id }, data: { mechanicalState: { conditions: [{ id: 'poison-fixture', condition: 'poisoned', sourceType: 'manual', appliedAt: new Date().toISOString() }], exhaustionLevel: 0, log: [] } } });
    const poisoned = await ask(ua.id, 'skill', 'stealth');
    const poisonedRoll = await http('/dice/roll', rollInput(poisoned), player);
    assert.equal(poisonedRoll.data.roll.disadvantage, true, 'Condição entra no motor de testes.');
    assert.equal(poisonedRoll.data.roll.dice.length, 2);
    await prisma.character.update({ where: { id: a.id }, data: { mechanicalState: { conditions: [{ id: 'paralyzed-fixture', condition: 'paralyzed', sourceType: 'manual', appliedAt: new Date().toISOString() }], exhaustionLevel: 0, log: [] } } });
    const paralyzed = await ask(ua.id, 'save', 'dexterity');
    const paralyzedRoll = await http('/dice/roll', rollInput(paralyzed), player);
    assert.equal(paralyzedRoll.data.roll.autoFail, true, 'Paralisado falha automaticamente em DES.');
    assert.deepEqual(paralyzedRoll.data.roll.dice, []);
    await prisma.character.update({ where: { id: a.id }, data: { mechanicalState: {} } });
    const cancelled = await ask(ua.id, 'ability', 'strength');
    const cancelPath = `/combat/${combatId}/tests/${cancelled.requestedTest.id}/cancel`;
    const cancel = { expectedVersion: await version(), operationId: randomUUID() };
    assert.equal((await http(cancelPath, cancel, player)).status, 403);
    assert.equal((await http(cancelPath, cancel)).status, 200);
    assert.equal((await http('/dice/roll', rollInput(cancelled), player)).status, 409);
    const ended = await ask(ua.id, 'ability', 'strength');
    await prisma.combat.update({ where: { id: combatId }, data: { status: 'ENDED' } });
    assert.equal((await requests()).length, 0);
    assert.equal((await http('/dice/roll', rollInput(ended), player)).status, 409);
    const economyAfter = JSON.stringify((await prisma.combatant.findMany({ where: { combatId }, orderBy: { id: 'asc' } })).map(u => u.turnEconomy));
    assert.equal(economyAfter, economyBefore, 'Solicitar e rolar não gastam ações.');
    const journal = (await prisma.combat.findUniqueOrThrow({ where: { id: combatId } })).economyLog as any[];
    assert.equal(journal.filter(e => e.action === 'requested-test').length, 6, 'Uma linha por teste, sem duplicação por retry.');
    assert.ok(journal.every(e => /CD 15/.test(e.message)));
    console.log('OK: HTTP, CD, perícias/expertise, atributos/classe, saves, privacidade, persistência, versão, idempotência, corrida, cancelamento, fim e economia.');
  } finally {
    if (combatId) await prisma.combat.deleteMany({ where: { id: combatId } });
    if (creatureId) await prisma.creature.deleteMany({ where: { id: creatureId } });
    if (localityId) await prisma.locality.deleteMany({ where: { id: localityId } });
    if (regionId) await prisma.region.deleteMany({ where: { id: regionId } });
    await prisma.character.deleteMany({ where: { id: { in: characters } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
