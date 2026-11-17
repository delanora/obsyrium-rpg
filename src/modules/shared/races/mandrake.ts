import type { Race } from './types.js';

/** Conteúdo adicional do PDF Valda's (Mandrake), autorizado pela mesa; não PHB. */
export const mandrake: Race = {
  id: 'mandrake', namePt: 'Mandrágora', nameEn: 'Mandrake',
  description: 'Povo de casca, raízes e folhas que une os mundos animal e vegetal. Cresce por um ano e um dia antes da colheita, amadurece em uma década e pode viver séculos. Sua estação de colheita determina a linhagem. Conteúdo adicional de Valda’s, fora do PHB 2014.',
  abilityScoreIncrease: [{ ability: 'wisdom', amount: 2 }],
  speed: 9, size: 'Medium', languages: ['Comum'],
  traits: [
    { id: 'mandrake-plant-nature', name: 'Natureza Vegetal', description: 'Com quatro horas diárias de luz solar direta, você dispensa comida. Pode respirar pelas folhas e extremidades e absorver água e nutrientes pelos pés. Ao se esconder em ambientes naturais, pode somar a proficiência à Furtividade mesmo sem ser proficiente.' },
    { id: 'mandrake-root-magic', name: 'Magia das Raízes', description: 'Você conhece Clava Mágica e pode aplicá-la a um dos próprios membros, tratando-o como uma clava em vez de um ataque desarmado. No 3º nível, pode conjurar Baga Abençoada uma vez por descanso longo; no 5º, Pele de Árvore uma vez por descanso longo. Sabedoria é seu atributo de conjuração.', mechanicalEffects: [
      { type: 'spell', spellId: 'shillelagh', ability: 'wisdom' },
      { type: 'spell', spellId: 'goodberry', ability: 'wisdom', minLevel: 3, castLevel: 1, perRest: 'long' },
      { type: 'spell', spellId: 'barkskin', ability: 'wisdom', minLevel: 5, castLevel: 2, perRest: 'long' },
    ] },
    { id: 'mandrake-plant-speech', name: 'Comunicação com Plantas', description: 'Você fala, lê e escreve Comum. Pode comunicar ideias simples a plantas não mágicas e perguntar sobre acontecimentos próximos do último dia, como criaturas que passaram e mudanças do tempo.' },
  ],
  subraces: [
    { id: 'mandrake-spring', namePt: 'Primavera', abilityScoreIncrease: [{ ability: 'dexterity', amount: 1 }], speed: 10.5, traits: [
      { id: 'mandrake-sprightly', name: 'Movimento Vivaz', description: 'Seu deslocamento de caminhada aumenta para 10,5 m.' },
      { id: 'mandrake-storm-resistance', name: 'Resistência às Tempestades', description: 'Você tem resistência a dano elétrico.', mechanicalEffect: { type: 'resistance', damageTypes: ['Elétrico'] } },
    ] },
    { id: 'mandrake-summer', namePt: 'Verão', abilityScoreIncrease: [{ ability: 'strength', amount: 1 }], traits: [
      { id: 'mandrake-deep-roots', name: 'Raízes Profundas', description: 'Com os pés em solo natural, você tem vantagem nas salvaguardas de Força e nos testes de habilidade para resistir a empurrões, quedas e outros deslocamentos involuntários.' },
      { id: 'mandrake-fire-resistance', name: 'Resistência aos Incêndios', description: 'Você tem resistência a dano de fogo.', mechanicalEffect: { type: 'resistance', damageTypes: ['Fogo'] } },
    ] },
    { id: 'mandrake-autumn', namePt: 'Outono', abilityScoreIncrease: [{ ability: 'charisma', amount: 1 }], traits: [
      { id: 'mandrake-abundance', name: 'Abundância', description: 'Você recebe Baga Abençoada já no 1º nível, com um uso por descanso longo. Cada baga criada por esse traço cura pontos de vida iguais ao seu bônus de proficiência.', mechanicalEffect: { type: 'spell', spellId: 'goodberry', ability: 'wisdom', castLevel: 1, perRest: 'long' } },
      { id: 'mandrake-poison-resistance', name: 'Resistência às Toxinas', description: 'Você tem resistência a dano de veneno.', mechanicalEffect: { type: 'resistance', damageTypes: ['Veneno'] } },
    ] },
    { id: 'mandrake-winter', namePt: 'Inverno', abilityScoreIncrease: [{ ability: 'constitution', amount: 1 }], traits: [
      { id: 'mandrake-cold-resistance', name: 'Resistência à Geada', description: 'Você tem resistência a dano de frio.', mechanicalEffect: { type: 'resistance', damageTypes: ['Frio'] } },
      { id: 'mandrake-powerful-build', name: 'Compleição Poderosa', description: 'Conte como uma categoria de tamanho maior para capacidade de carga e para o peso que pode empurrar, arrastar ou erguer. Seu tamanho continua Médio.' },
    ] },
  ],
};
