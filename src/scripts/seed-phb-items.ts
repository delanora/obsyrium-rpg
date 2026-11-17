import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { buildRows, stableStringify } from '../modules/shared/phb-equipment-catalog.js';

/**
 * Cadastra no catálogo de itens as ARMAS, as MUNIÇÕES e as ARMADURAS/ESCUDOS do
 * PHB 2014.
 *
 *   npm run seed:phb-items
 *
 * Por que existe: a MECÂNICA das 37 armas já vive em `shared/weapons/catalog`
 * (dano, propriedades, alcances, munição, id canônico) e a das armaduras em
 * `shared/armor-class` (a CA sai de `armorType` + `baseArmorClass`, e o escudo
 * de `armorClassBonus`). O que falta para tudo isso valer na ficha é o ITEM do
 * catálogo — é ele que o mestre envia para a mochila e o jogador equipa (arma
 * na mão, armadura no peitoral). Este script copia o catálogo canônico para
 * `items` e acrescenta o que a regra NÃO guarda (peso e preço do livro, que são
 * dados de comércio).
 *
 * Regras do script:
 * - **Idempotente**: arma casa por `details.canonicalWeaponId`, munição por
 *   `details.ammoType` e armadura/escudo por nome + categoria. Rodar de novo
 *   ATUALIZA em vez de duplicar.
 * - Nunca apaga item nenhum e nunca mexe em item sem vínculo canônico.
 * - Grava `details` pelo `sanitizeItemDetails` (a mesma barreira da rota), então
 *   o que o editor aceita é exatamente o que fica salvo.
 * - Alcance é INTEIRO em `details`: zarabatana (7,5 m) e rede (1,5/4,5 m) são
 *   arredondados ao gravar, como o editor do mestre já faz.
 */

/** 1 libra = 0,45359237 kg (o projeto guarda peso em kg). */
/** Id de arma canônica já vinculado ao item (ou `null`). */
function canonicalIdOf(details: unknown): string | null {
  if (!details || typeof details !== 'object') return null;
  const value = (details as Record<string, unknown>).canonicalWeaponId;
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function ammoTypeOf(details: unknown): string | null {
  if (!details || typeof details !== 'object') return null;
  const value = (details as Record<string, unknown>).ammoType;
  return typeof value === 'string' && value.length > 0 ? value : null;
}

async function main(): Promise<void> {
  const rows = buildRows();
  const items = await prisma.item.findMany({
    select: {
      id: true,
      name: true,
      category: true,
      description: true,
      weight: true,
      details: true,
      priceGold: true,
      priceSilver: true,
      priceCopper: true,
    },
  });

  const byCanonical = new Map<string, (typeof items)[number]>();
  const byAmmoType = new Map<string, (typeof items)[number]>();
  const byNameCategory = new Map<string, (typeof items)[number]>();
  for (const item of items) {
    const canonical = canonicalIdOf(item.details);
    if (canonical && !byCanonical.has(canonical)) byCanonical.set(canonical, item);
    if (item.category === 'Munição') {
      const ammo = ammoTypeOf(item.details);
      if (ammo && !byAmmoType.has(ammo)) byAmmoType.set(ammo, item);
    }
    // Armadura/escudo não têm id canônico no schema: a chave é nome + categoria.
    const nameKey = `${item.category}::${item.name.trim().toLowerCase()}`;
    if (!byNameCategory.has(nameKey)) byNameCategory.set(nameKey, item);
  }

  let created = 0;
  let updated = 0;
  let unchanged = 0;

  for (const row of rows) {
    const existing = row.match.canonicalWeaponId
      ? byCanonical.get(row.match.canonicalWeaponId)
      : row.match.ammoType
        ? byAmmoType.get(row.match.ammoType)
        : byNameCategory.get(`${row.category}::${row.name.trim().toLowerCase()}`);

    const details = row.details as Prisma.InputJsonValue;
    if (!existing) {
      await prisma.item.create({
        data: {
          name: row.name,
          description: row.description,
          weight: row.weight,
          category: row.category,
          rarity: null,
          requiresAttunement: false,
          imageUrl: '',
          details,
          priceGold: row.price.gold,
          priceSilver: row.price.silver,
          priceCopper: row.price.copper,
          campSupplyEnabled: false,
          campSupplyValue: 0,
        },
      });
      created += 1;
      continue;
    }

    // Só grava o que mudou: rodar o script de novo não infla `version` à toa.
    const same =
      existing.name === row.name &&
      existing.description === row.description &&
      existing.weight === row.weight &&
      existing.category === row.category &&
      existing.priceGold === row.price.gold &&
      existing.priceSilver === row.price.silver &&
      existing.priceCopper === row.price.copper &&
      stableStringify(existing.details) === stableStringify(row.details);

    if (same) {
      unchanged += 1;
      continue;
    }

    await prisma.item.update({
      where: { id: existing.id },
      data: {
        name: row.name,
        description: row.description,
        weight: row.weight,
        category: row.category,
        details,
        priceGold: row.price.gold,
        priceSilver: row.price.silver,
        priceCopper: row.price.copper,
        version: { increment: 1 },
      },
    });
    updated += 1;
  }

  console.log(
    `✔ Catálogo do PHB 2014: ${created} criado(s), ${updated} atualizado(s), ${unchanged} já estava(m) igual(is) — ${rows.length} linha(s) no total.`,
  );
}

main()
  .catch((error) => {
    console.error('❌ Falha ao popular o catálogo do PHB 2014:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
