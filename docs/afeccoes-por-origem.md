# Fundação de doenças e venenos por origem (28/11/2026)

## Objetivo e escopo

Preparar a identificação de cada doença ou veneno para a próxima extensão de
Mãos Consagradas. Este relatório descreve a fundação; a integração do gasto de cinco pontos está
em `maos-consagradas-neutralizacao.md`. Commit/push do conjunto autorizados pelo
responsável em 28/11/2026; publicação continua sem autorização.

Doença não vira uma Condition fictícia. `mechanicalState.afflictions` guarda
registros opcionais com UUID, tipo, nome, autor e instante. Os sintomas escolhidos
pelo Mestre usam as ConditionInstances existentes, com `sourceType=affliction`
e `sourceId` igual ao UUID. Não existe uma segunda interpretação de condições.
Não há tabela, schema Prisma, migration ou geração de Client novos.

No painel mecânico, o Mestre pode registrar e encerrar cada origem. O jogador
consulta apenas o estado autorizado da própria ficha. Registrar/encerrar é
administração do Mestre, não execução de uma habilidade e não gasta recursos.
As operações reutilizam autorização, versão, operationId, transação, histórico
e notificações de Mechanical State.

Encerrar remove somente os sintomas daquela origem pelo helper central
`removeConditionInstancesBySource`. Fonte manual, Effect, outra afecção, condição
por 0 PV, concentração e postura independente permanecem. Origens de mesmo nome
continuam distintas. Não converte nem apaga Conditions/Effects legados.

A aplicação respeita as imunidades já representadas pela Petrificação e impede
nova doença em personagem com Saúde Divina. Essa guarda não apaga doenças antigas
nem promete todos os passivos raciais mecanizados. Sintomas são explícitos: uma
doença sem condição não recebe penalidade inventada. Dano periódico, incubação,
transmissão, tratamento e progressão continuam assistidos.

## Privacidade e compatibilidade

A projeção pública de NPCs omite registros, rótulos das origens nos sintomas e
logs desta administração; mantém as condições públicas e seus efeitos derivados.
O Mestre recebe o estado completo. Dados antigos sem `afflictions` conservam seu
formato e não recebem diagnósticos inferidos.

**Limite operacional confirmado:** o normalizador de Mechanical State anterior
não conhece o campo novo e o descarta ao regravar um estado que o contenha.
Uma futura publicação exige rollback com normalizador compatível, ou manutenção
desse suporte no backend de retorno. Não restaurar o banco indiscriminadamente
nem apagar afecções para voltar de versão. Nenhum rollback/deploy foi executado
ou autorizado nesta entrega; a preparação desse procedimento fica para publicação.

## Validação

- 19 contratos puros: múltiplas origens, sintomas duplicados, legado, Effects,
  imunidade, queda independente, roundtrip, privacidade e limite do normalizador
  anterior (compatibilidade necessária no rollback).
- 18 verificações HTTP/PostgreSQL: autorização, payload, versão, replay, origem,
  remoção seletiva, Saúde Divina e cura de PV preservando registros/sintomas.
- Chromium real com API simulada: painel do Mestre, registro de veneno, doença
  sem condição, remoção seletiva, versões e visualização sem controles pelo
  jogador; formulário conferido na viewport móvel.
- Regressão da cura variável de Mãos Consagradas: 36 verificações isoladas.
- Build/typechecks frontend/backend em espelho isolado; frontend validado após
  ajuste responsivo. Guarda de build com 51 verificações. Aviso de bundle grande
  permanece. A suíte ampla mantém 604 aprovações e CB138/SC14 anteriores, conforme
  comparação de base registrada na entrega da Hotbar.

## Isolamento e estado

Espelho `/root/validacao-sopro`, incluindo a cura variável anterior e os overlays
operacionais de nulabilidade de localidades/cenas e Client já existente. Não são
incorporados WIPs a esta entrega. Não publicar esse espelho inteiro sem compor
as fontes e preparar o rollback compatível.

Banco descartável na porta 55439, diretório `/tmp/obsyrium-cura-pg`, schema
`smoke_cure_wounds`, HTTP próprio 3309. Guardas conferem porta, schema, diretório
e tabelas de campanha vazias. Fixtures próprias, cleanup apenas dos IDs criados;
zero usuários/personagens/combates ao final. Nenhum dado real como fixture.

Cura de PV versionada em `02e9ba4`; esta fundação e sua neutralização compõem
a extensão isolada seguinte. WIPs alheios, backend ativo, banco da campanha e
artefatos publicados preservados. Sem deploy, restart ou aceite de produção.
Próxima integração: selecionar registros tratáveis em Mãos Consagradas e validar
gasto de cinco pontos por origem, no mesmo commit transacional da Ação.

Continuidade posterior: a neutralização por origem foi integrada localmente,
com escopo e limites em `docs/maos-consagradas-neutralizacao.md`. Este relatório
preserva o escopo da microentrega original; a sequência ainda não foi publicada.
