import { ABILITY_KEYS, ABILITY_LABELS } from '../dnd5e.js';
import type { Race } from './types.js';

/** PDF Valdas SpiritHost: conteúdo adicional autorizado, não PHB 2014. */
export const spirithost: Race = {
  id: 'spirithost', namePt: 'Spirithost', nameEn: 'Spirithost',
  description: 'Humanoides vivos, parcialmente materiais, ligados à Fronteira Etérea. Amadurecem na adolescência e podem viver séculos. Sua aparência lembra fantasmas, mas não são mortos-vivos. Conteúdo adicional de Valda’s, fora do PHB 2014.',
  abilityScoreIncrease: [{ ability: 'dexterity', amount: 1 }],
  speed: 9, size: 'Medium', languages: ['Comum'], bonusLanguageChoices: 1,
  hasChoices: [{ id: 'spirithost-ability', label: 'Outro atributo +2', apply: 'ability', amount: 2,
    options: ABILITY_KEYS.filter(ability => ability !== 'dexterity').map(ability => ({ id: ability, label: ABILITY_LABELS[ability] })),
  }],
  traits: [
    { id: 'spirithost-ethereal-vision', name: 'Visão Etérea', description: 'Enquanto estiver no Plano Material, você enxerga até 18 m no Plano Etéreo. Esse traço não concede visão no escuro.' },
    { id: 'spirithost-incorporeal-movement', name: 'Movimento Incorpóreo', description: 'Você atravessa criaturas como terreno difícil. Pode atravessar objetos, mas não mais de 0,3 m de pedra, 2,54 cm de metal comum ou 0,9 m de madeira ou terra; uma lâmina fina de chumbo bloqueia a passagem. Se terminar o movimento sobreposto a uma criatura ou objeto sólido, é expulso ao espaço livre mais próximo que possa ocupar e sofre 2 de dano de força por 0,3 m percorrido nessa expulsão.' },
    { id: 'spirithost-ethereal-nature', name: 'Natureza Etérea', description: 'Você pode ficar o dobro do tempo sem comer, beber ou respirar, sem penalidades. Seu corpo pesa metade do que pesaria um humano de tamanho semelhante.' },
    { id: 'spirithost-spirit-speech', name: 'Fala dos Espíritos', description: 'Você pode conjurar Falar com os Mortos sem espaço de magia nem componentes materiais, fazendo apenas uma pergunta ao cadáver. Recupera o uso após um descanso longo.' },
    { id: 'spirithost-translucence', name: 'Translucidez', description: 'Com uma ação bônus, você fica magicamente invisível até o início do próximo turno, ou até atacar, rolar dano ou obrigar alguém a fazer uma salvaguarda. Criaturas que enxergam no Plano Etéreo continuam vendo você normalmente. Recupera o uso após um descanso curto ou longo.' },
  ],
};
