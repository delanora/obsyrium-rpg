# Retomada do motor jogável — diagnóstico inicial

Data: 27/11/2026. Base versionada conferida: `1395aa85a677cd71db696b490217c8eec51b3aef`.
O Fichário permanece em manutenção; a prioridade volta às fases 6 e 7.

## Critério de cobertura

Catálogo, contador de usos, efeito mecânico, economia e interface são capacidades
separadas. Um contador funcionando não prova a aplicação do benefício. A revisão
abaixo é de código, não validação ponta a ponta nem aceite de uma sessão real.
Não foram consultados ou alterados personagens da campanha como fixtures.

## Magias: registro central de execução

`src/modules/spells/execution/spell-execution-registry.ts` registra quatro magias
reais e três definições sintéticas de teste. As sintéticas não contam como
conteúdo jogável. O catálogo PHB é mais amplo que a cobertura deste registro.

| Magia | Padrão existente | Limite a conferir em integração |
|---|---|---|
| Bênção | Efeito imediato e concentração | Consumo, modificadores, duração e fim da concentração |
| Imobilizar Pessoa | Salvaguarda, efeito e concentração | Alvo humanoide, salvaguardas repetidas e término |
| Chama Sagrada | Salvaguarda e dano | Escala de truque, imunidades e interação com cobertura |
| Palavra Curativa | Cura imediata | Ação bônus, espaço, modificador da fonte e cura a zero PV |

Isso não invalida os motores genéricos de ataque mágico, múltiplos ataques,
salvaguardas ou áreas. Sua existência não registra automaticamente magias reais.
O serviço usa `spellExecutionDefinition`; uma entrada ausente é recusada com
`SPELL_EXECUTION_NOT_IMPLEMENTED`. Não adicionar uma magia apenas à lista da UI.

O mesmo serviço admite contexto de turno nulo, correspondente a uso fora de
combate. A duração inicia no commit; fora de combate seu acompanhamento continua
manual, pois não existe relógio global. Validar usos fora de combate exige
conferir alvos, componentes e persistência; não basta omitir o consumo de ação.

## Classes: primeiras lacunas confirmadas

| Característica | O que existe | Lacuna desta leitura |
|---|---|---|
| Fúria | Toggle, custo, bônus e resistências consumidos pelos cálculos | Não considerar economia, expiração e encerramento automático completos sem revisão específica |
| Retomar o Fôlego | Recurso/recarga no catálogo do Guerreiro | Não foi encontrado executor próprio de cura `1d10 + nível de Guerreiro`; catálogo declara pendência |
| Surto de Ação | Recurso e progressão no catálogo | Não foi encontrado executor pelo ID que conceda a ação extra; existência do recurso não prova alteração de TurnEconomy |
| Mãos Consagradas | Reserva derivada do nível de Paladino | Falta provar gasto variável e cura/remoção de condições num fluxo atômico |
| Inspiração de Bardo | Recurso no catálogo | Falta provar entrega a outro alvo, duração e consumo posterior do dado |
| Recuperação Arcana/Natural | Endpoint próprio no descanso curto | Conferir regressão de orçamento, nível de classe, espaços e limite de uso |
| Mestre Místico | Endpoint próprio de recuperação de pacto | Conferir regressão de recuperação e consumo único |

Evidências: arquivos de classes em `src/modules/shared/classes/`,
`toggleFeature`, `recoverSlots` e `useEldritchMaster` em characters.service,
e consumo dos ajustes de Fúria em combat.service/damage-resolution.
Esta é triagem dos fluxos principais, não auditoria exaustiva de todas as
subclasses e talentos. O arquivo characters.service possui WIP anterior que
precisa ser preservado ao implementar operações novas.

## Raças

`POST /api/characters/me/racial-features/use` deriva posse, limite e recarga,
valida versão e idempotência e incrementa o uso. O contrato explicita que não
executa dano, salvaguarda ou magia. Logo, Arma de Sopro não está mecanicamente
concluída apenas porque seu botão consome um uso.

As áreas de criaturas já têm motor próprio; isso não prova que o Sopro de um
personagem draconato passe por esse motor. Resistência Implacável já possui oferta própria no ciclo de morte (ver
`shared/death.ts` e `death.service`); requer revisão desse fluxo, não implementação
do zero. Magias raciais precisam de conferência do vínculo com o motor de conjuração.
Passivas raciais podem alimentar o DTO; devem ser auditadas separadamente dos
recursos acionáveis. Raças personalizadas existentes mantêm suas regras próprias,
sem apresentá-las como PHB 2014 nem alterar suas regras por esta retomada.

## Sequência de entregas pequenas

1. **Cura executável:** ampliar o padrão existente com Curar Ferimentos, validando
   toque, Ação, V/S, atributo da fonte, upcast, alvos e ausência de efeito em
   constructos/mortos-vivos. Provar combate e uso fora dele, sem relógio fictício.
2. **Recurso de classe completo:** Retomar o Fôlego como operação própria:
   cura + consumo do uso + Ação Bônus em combate, atomicamente; fora de combate
   sem exigir um encontro artificial. Reutilizar o resolvedor de cura/morte.
3. **Recurso racial completo:** Arma de Sopro, com ancestralidade, área, CD,
   dano por nível, salvaguarda e recarga, reutilizando os resolvedores existentes.
4. **Expansão guiada por dependências:** Mãos Consagradas, Inspiração, Surto de
   Ação e reações. Cada um recebe escopo e prova próprios; não prometer que uma
   única abstração cobrirá todas as exceções.
5. **Integração e UI:** duração entre exploração/combate, componentes, ficha e
   Hotbar. O grimório com páginas animadas permanece planejado para detalhamento
   posterior com o responsável; não antecipar a remodelação visual.

Essa sequência é proposta técnica de implementação, não estado concluído.
Cada entrega exige testes de concorrência/idempotência, custo único, erro sem
consumo, efeitos/descanso, persistência e realtime. Integração usa banco/schema e
servidor descartáveis, nunca a campanha. Não houve build, migração, restart ou
deploy nesta triagem. A duplicidade operacional dos serviços já registrada
continua pendência separada antes de futuras publicações backend.
