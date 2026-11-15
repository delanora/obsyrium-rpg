/** Conteúdo de consulta: reutiliza o catálogo sem executar regras ou conceder recursos. */
import { barbarian } from '../../../../src/modules/shared/classes/barbarian';
import { bard } from '../../../../src/modules/shared/classes/bard';
import { cleric } from '../../../../src/modules/shared/classes/cleric';
import { druid } from '../../../../src/modules/shared/classes/druid';
import { fighter } from '../../../../src/modules/shared/classes/fighter';
import { monk } from '../../../../src/modules/shared/classes/monk';
import { paladin } from '../../../../src/modules/shared/classes/paladin';
import { ranger } from '../../../../src/modules/shared/classes/ranger';
import { rogue } from '../../../../src/modules/shared/classes/rogue';
import { sorcerer } from '../../../../src/modules/shared/classes/sorcerer';
import { warlock } from '../../../../src/modules/shared/classes/warlock';
import { wizard } from '../../../../src/modules/shared/classes/wizard';

export const CLASS_PRESENTATIONS = [barbarian, bard, cleric, druid, fighter, monk, paladin, ranger, rogue, sorcerer, warlock, wizard];

/** Opções iniciais PHB 2014. Texto de referência, sem entrega ao inventário.
 * Fonte: https://www.dndbeyond.com/sources/dnd/basic-rules-2014/classes
 */
export const CLASS_STARTING_EQUIPMENT: Record<string, string[]> = {
  barbarian: ['Machado grande ou outra arma marcial corpo a corpo.', 'Dois machados de mão ou uma arma simples.', 'Pacote de explorador e quatro azagaias.'],
  bard: ['Rapieira, espada longa ou uma arma simples.', 'Pacote de diplomata ou de artista.', 'Alaúde ou outro instrumento musical; armadura de couro e adaga.'],
  cleric: ['Maça ou martelo de guerra (se tiver proficiência).', 'Brunea, armadura de couro ou cota de malha (se tiver proficiência).', 'Besta leve com 20 virotes ou uma arma simples.', 'Pacote de sacerdote ou de explorador; escudo e símbolo sagrado.'],
  druid: ['Escudo de madeira ou uma arma simples.', 'Cimitarra ou uma arma simples corpo a corpo.', 'Armadura de couro, pacote de explorador e foco druídico.'],
  fighter: ['Cota de malha ou armadura de couro, arco longo e 20 flechas.', 'Uma arma marcial e um escudo ou duas armas marciais.', 'Besta leve com 20 virotes ou dois machados de mão.', 'Pacote de aventureiro ou de explorador.'],
  monk: ['Espada curta ou uma arma simples.', 'Pacote de aventureiro ou de explorador; dez dardos.'],
  paladin: ['Uma arma marcial e um escudo ou duas armas marciais.', 'Cinco azagaias ou uma arma simples corpo a corpo.', 'Pacote de sacerdote ou de explorador; cota de malha e símbolo sagrado.'],
  ranger: ['Brunea ou armadura de couro.', 'Duas espadas curtas ou duas armas simples corpo a corpo.', 'Pacote de aventureiro ou de explorador; arco longo, aljava e 20 flechas.'],
  rogue: ['Rapieira ou espada curta.', 'Arco curto, aljava e 20 flechas ou uma espada curta.', 'Pacote de assaltante, de aventureiro ou de explorador.', 'Armadura de couro, duas adagas e ferramentas de ladrão.'],
  sorcerer: ['Besta leve com 20 virotes ou uma arma simples.', 'Bolsa de componentes ou foco arcano.', 'Pacote de aventureiro ou de explorador; duas adagas.'],
  warlock: ['Besta leve com 20 virotes ou uma arma simples.', 'Bolsa de componentes ou foco arcano.', 'Pacote de estudioso ou de aventureiro.', 'Armadura de couro, uma arma simples e duas adagas.'],
  wizard: ['Bordão ou adaga.', 'Bolsa de componentes ou foco arcano.', 'Pacote de estudioso ou de explorador; grimório.'],
};
