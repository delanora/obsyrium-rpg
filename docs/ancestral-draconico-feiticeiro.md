# Ancestral Dracônico do Feiticeiro

A Linhagem Dracônica declara uma escolha de nível 1 no catálogo de classes, usando o contrato existente `classState.choices['dragon-ancestor']`. A ancestralidade racial continua independente em `raceChoices['draconic-ancestry']`.

A criação apresenta as dez artes raciais reutilizadas em uma galeria compacta dentro da descrição da característica. Arrastar consulta outra opção; clicar escolhe. A galeria compartilha o loop, encaixe, aura e zoom existentes. A escolha é validada pelo resolvedor de características e pode ser trocada durante a criação; é recuperada no DTO e exigida ao finalizar um novo Feiticeiro Dracônico. Magia Selvagem não recebe essa escolha.

Esta mudança não concede sopro nem resistência racial. O elemento aparece como identificação do ancestral, sem antecipar Afinidade Elemental de nível 6. Personagens já finalizados não são migrados.

Validação: builds de backend/frontend; teste puro `src/scripts/check-sorcerer-ancestry.ts`; navegador no wizard real com API simulada, seleção/envio e celular. Sem escrita no banco da campanha.
