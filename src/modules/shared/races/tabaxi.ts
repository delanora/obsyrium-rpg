import type { Race } from './types.js';

/**
 * Exceção personalizada autorizada pela mesa, não conteúdo do PHB 2014.
 * Fonte: https://coroa-das-entidades.fandom.com/pt-br/wiki/Tabaxi
 * Adjudicação aprovada: Silvestre e dois idiomas à escolha; aumentos afetam
 * o valor do atributo, seguindo o contrato racial, não o modificador direto.
 * Traços especiais ficam descritivos até integração com os motores existentes.
 */
export const tabaxi: Race = {
  id: 'tabaxi',
  namePt: 'Tabaxi',
  nameEn: 'Tabaxi',
  description: 'Humanoides felinos curiosos e ágeis. Versão personalizada da Wiki Coroa das Entidades, com quatro linhagens; não pertence ao PHB 2014.',
  abilityScoreIncrease: [{ ability: 'dexterity', amount: 2 }],
  speed: 9,
  size: 'Medium',
  darkvision: 18,
  languages: ['Silvestre'],
  bonusLanguageChoices: 2,
  traits: [
    { id: 'tabaxi-feline-agility', name: 'Agilidade Felina', description: 'Dobre seu deslocamento até o fim do turno. Recupere esse uso após um turno inteiro sem se deslocar.' },
    { id: 'tabaxi-climbing', name: 'Escalada Felina', description: 'Seu deslocamento de escalada é 6 m.' },
    { id: 'tabaxi-darkvision', name: 'Visão no Escuro', description: 'Enxergue na penumbra e na escuridão até 18 m, distinguindo cores nesta versão.' },
    { id: 'tabaxi-reflexes', name: 'Reflexos Felinos', description: 'Vantagem nas salvaguardas de Destreza; pode usar Destreza em Atletismo.' },
    { id: 'tabaxi-furtividade', name: 'Capacidade Felina: Furtividade', description: 'Proficiência em Furtividade.', mechanicalEffect: { type: 'skillProficiency', target: 'stealth' } },
    { id: 'tabaxi-sobrevivencia', name: 'Capacidade Felina: Sobrevivência', description: 'Proficiência em Sobrevivência.', mechanicalEffect: { type: 'skillProficiency', target: 'survival' } },
    { id: 'tabaxi-natural-weapons', name: 'Armas Naturais', description: 'Presas e garras causam 1d6 de dano perfurante.' },
    { id: 'tabaxi-languages', name: 'Idiomas', description: 'Silvestre e dois idiomas à escolha.' },
  ],
  subraces: [
    { id: 'tabaxi-panther', namePt: 'Pantera', abilityScoreIncrease: [{ ability: 'charisma', amount: 1 }], traits: [
      { id: 'tabaxi-camouflage', name: 'Camuflagem Facilitada', description: 'Some 1d6 à Furtividade na penumbra ou escuridão.' },
    ] },
    { id: 'tabaxi-lion', namePt: 'Leão', abilityScoreIncrease: [{ ability: 'strength', amount: 1 }], traits: [
      { id: 'tabaxi-pounce', name: 'Bote Certeiro', description: 'Vantagem ao agarrar; após sucesso, pode morder com ação bônus.' },
    ] },
    { id: 'tabaxi-leopard', namePt: 'Leopardo', abilityScoreIncrease: [{ ability: 'wisdom', amount: 1 }], traits: [
      { id: 'tabaxi-swiftness', name: 'Rapidez', description: 'Some proficiência à iniciativa. Se agir primeiro, seu primeiro ataque tem vantagem.' },
    ] },
    { id: 'tabaxi-tiger', namePt: 'Tigre', abilityScoreIncrease: [{ ability: 'constitution', amount: 1 }], traits: [
      { id: 'tabaxi-tiger-weapons', name: 'Armas Naturais Aprimoradas', description: 'Suas armas naturais causam crítico com 19 ou 20 no d20.' },
    ] },
  ],
};
