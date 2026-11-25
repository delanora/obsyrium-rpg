# Fichário — 8.5.3: filtros e agrupamentos reutilizáveis

Implementação em validação técnica em 25/11/2026. Não publicada. A fase depende de
publicação separadamente autorizada e aceite manual; não recebe conclusão funcional
antecipada. A 8.5.4 não foi iniciada.

## Base e isolamento

Base `b700a7b668a4afe9a1a679d719090bb4a2262a6d`, branch main igual a origin/main no
início, staging vazio. Os 47 WIPs anteriores foram inventariados por caminho e
SHA256. No schema misto, remover apenas os acréscimos desta fase reproduz exatamente
o arquivo inicial; o commit usa o schema de HEAD acrescido somente dos modelos
narrativos. `backups/` e as duas migrations WIP não integram esta entrega.

Os 2.036 arquivos protegidos de frontend/backend compilados, Client Prisma,
migrations anteriores e backups permanecem idênticos, com exceção intencional do
schema-fonte misto (WIP original preservado). A composição ativa continua sendo o
funcional `0299321b2ce2c2d4bd5df8641c2ade22fd75a3fb`, JS `index-RYNVlaDv.js`, CSS
`index-BwtHA_mH.css` e textura de linho. PID 2467899 preservado; health
`status:ok/database:up`. Nenhuma publicação, restart, migration ou geração de Client
ativo foi executada.

Builds oficiais, typechecks e geração do Client ocorreram exclusivamente em
`/tmp/grupos-853/checkout`. As dependências do Client e seus arquivos gerados são
locais ao espelho; os caches de build não apontam para a instalação ativa.
A guarda oficial foi auditada, inclusive na instalação ativa em modo somente
leitura. Isso não constitui isolamento imposto pelo SO: a dívida operacional
registrada em `build-seguro.md` permanece.

## Diagnóstico Prisma: publicação futura condicionada

A auditoria inicial informou 90 migrations aplicadas. A preparação posterior
apurou **90 registros: 89 concluídos e uma tentativa revertida de hotbar**, sem
falha aberta. São 87 SQLs concluídos da base e duas migrations WIP concluídas:

- `20261110100000_optional_geography_links`;
- `20261110120000_add_dice_roll_log`.

Os checksums dos 89 arquivos concluídos conferem. O arquivo da tentativa revertida
não foi recuperado; ela não deve ser contada como outra migration concluída.
Ver [preparação operacional](fichario-preparacao-publicacao-853.md) para a distinção
entre reprodução efetiva, ledger sintético e histórico real.

`Locality.regionId` e `Scene.localityId` são anuláveis no banco operacional.
O schema e o Client operacionais contêm essas frentes, enquanto main não contém
sua implementação integral. A divergência foi confirmada por metadados somente
leitura e comparação de schemas; não foi corrigida incidentalmente.

A migration nova `20261125120000_narrative_groups` cria apenas duas tabelas,
índices e constraints do Arquivo. Não deriva do schema operacional indiscriminado,
não reverte nulabilidade e não incorpora DiceRollLog, geografia ou combate.

**Antes de autorizar publicação:** preparar e conferir um Client isolado compatível
com a composição efetivamente publicada, preservando os modelos operacionais WIP.
Regenerar simplesmente a partir de main pode remover APIs que o backend ativo
utiliza. Exigir revisão do diff de schema/Client e do histórico aplicado, backup
consistente e publicação seletiva. Não executar `db push`, `migrate dev` ou
`migrate deploy` indiscriminadamente na instalação ativa. A nova migration permanece
pendente em produção. Compatibilidade operacional não declarada resolvida.

## Persistência, contratos e autoridade

`NarrativeGroup` é biblioteca global privada da mesa única: id estável, nome,
`nameKey` único, cor, descrição, versão, autoria e datas. `NarrativeCardGroup` é a
associação canônica M:N com chave composta e FK com cascata. O índice do par atende
consultas por card; índice de groupId atende contagens/remoções por agrupamento.
Nada é associado ao placement, categoria, relação ou estrutura de ramificações.
Não há campaignId, cópia de card, mecânica ou hierarquia nova.

Nome: NFC, espaços consecutivos reduzidos, trim e comparação em minúsculas pt-BR.
Acentos são preservados (`Missão` e `missão` colidem; `Missao` é outro nome).
Limites: 80 caracteres de nome, 500 de descrição, 500 grupos globais e 30 por card.
Cor exige `#RRGGBB`, normalizada em maiúsculas; não aceita CSS arbitrário. IDs
repetidos no conjunto são normalizados/deduplicados. Descrição omitida vira vazia.
Constraints SQL protegem formato da cor, texto não vazio, tamanhos e integridade.

GET `/api/archive/groups` lista metadados e contagem **global de cards canônicos**.
GET de card e graph recebe `groups` aditivo; snapshots antigos podem omiti-lo.
O graph traz a biblioteca global e os resumos dos grupos de cada card, carregados
em lote, sem GET ou consulta individual por representação. Operações antigas sem
groupIds preservam suas associações; `[]` remove todas intencionalmente.

CRUD de grupos e conjunto de associações reutilizam `NarrativeOperation`,
normalização/fingerprint, recibo, CAS e a mesma transação/advisory lock global do
Arquivo. Atualizar associações participa da versão do card. Mudanças de membros
incrementam também a versão dos grupos afetados, protegendo a quantidade mostrada
na confirmação de exclusão. Excluir grupo incrementa a versão dos cards associados
para impedir que um editor antigo reponha silenciosamente vínculos removidos.

Excluir grupo remove somente suas associações. Cards, conteúdo, placements,
relações, posições e ramificações permanecem. Excluir card limpa os vínculos com
cascata e atualiza as versões dos grupos afetados. Ambas as exclusões utilizam
confirmação/CAS. Replays não reaplicam efeitos nem emitem invalidação duplicada.

Rotas continuam sob authenticate/MASTER, com conferência também nos serviços.
A invalidação `archive:updated` existente permanece privada de MASTER, emitida
somente após commit, com payload mínimo `{at}`. Não há dados de grupos em salas de
jogadores ou broadcasts públicos. Outras janelas recarregam snapshots; durante
gesto/editor/pedido pendente, a política anterior avisa e conserva o rascunho,
sem descartá-lo nem sobrescrevê-lo silenciosamente.

## Interface e filtros

A barra inferior abre o gerenciador compacto: pesquisa, criação, edição, contagem
global e exclusão com confirmação explícita, inclusive para grupos vazios.
O editor lateral permite pesquisar/marcar grupos e ver a prévia local no card;
apenas Salvar grava o conjunto junto com o conteúdo. Cancelar não associa nem
remove dados canônicos. Criar um grupo é uma intenção independente, persistida
explicitamente no gerenciador; cancelar o card não apaga esse grupo da biblioteca.
Pedidos pendentes bloqueiam o seletor; falha conserva retry com operationId.

Consulta Narrativa exibe nomes e cores em chips, com ativação do filtro. O rodapé
dos cards mostra pontos/contagem compactos e abre a consulta completa, sem aumentar
suas dimensões. As cores de categoria continuam intactas.

O seletor expansível permite QUALQUER UM/TODOS, Destaque/Isolamento, busca e limpar.
Filtros pertencem à memória desta janela, separados por quadro; ao voltar, o quadro
recupera seu filtro. Reload inicia sem filtros, assim como outra janela.
IDs excluídos são podados do estado ativo; sem IDs válidos, apresentação normal.

Pipeline mantido: snapshot → projeção estrutural → layout → poses animadas →
apresentação do filtro. `filterArchive` usa o snapshot completo e `projection.owner`
para contar cards canônicos correspondentes, visíveis/recolhidos e sinalizar o
ancestral visível que contém resultados recolhidos. Não expande automaticamente.
No isolamento, ancestrais visíveis de correspondências ficam como contexto.
Vínculos/rótulos só aparecem quando suas extremidades projetadas são apresentadas.

Destaque atenua com uma **camada visual própria**, sem multiplicar nem sobrescrever
opacity do scheduler. Cards atenuados continuam interativos. Isolamento usa hidden
no card e display:none no grupo SVG da relação, incluindo hit area/rótulo.
Seleção, radial e foco de elementos ocultados são reconciliados; o editor aberto
permanece. Não altera câmera, âncoras, offsets, expansão, geometria, reservas ou
persistência. Sem segundo scheduler, layout por frame ou HTTP ao filtrar.

Preservados margem 1120, folga 32, 12 faixas, veto localizado, linho, ícones,
molduras, dimensões, curvas, durações e limites atuais da animação.

## Validação reproduzível

PostgreSQL 15 em instância própria descartável, porta 44011, diretório
`/tmp/obsyrium-grupos-pg-5cYTZh/data`, banco `arquivo_grupos_853`. Aplicados os
scripts versionados da base e a migration nova no schema `test_archive_grupos`.
O diff Prisma entre o schema de HEAD e o candidato confirmou somente as duas
tabelas/índices/FKs novas; as checks SQL adicionais são explícitas na migration.
A aplicação de teste confere database/schema/data_directory por sentinela no seu
próprio singleton e na conexão de teste antes de criar fixtures. Nenhuma entidade
real foi usada ou alterada. O teste anterior criou/removeu seu schema próprio na
mesma instância descartável, com hash public ANTES = DEPOIS. A instância de teste
foi encerrada após a suíte; o PostgreSQL operacional não foi reiniciado.

Comandos executados no espelho, usando o Client exclusivo já gerado:

- `tsx src/scripts/check-archive-groups.ts`: 89 verificações HTTP/PostgreSQL;
- `tsx src/scripts/check-archive.ts`: 173 verificações anteriores;
- testes puros reserve/layout/motion/projection/camera/multilevel: 2.357 verificações;
- `tsx client/scripts/check-archive-filters.ts`: 802 verificações, incluindo 110 ciclos;
- `node client/scripts/check-archive-groups-browser.mjs`: Chromium/API simulada,
  38 verificações e 100 ciclos, editor, cancelamento, retry, conflito, foco,
  invalidação externa, filtros e celular;
- Chromium anterior: browser, background, stability e radial, com cenários de ondas,
  multinível e continuidade habilitados; última execução com 7.633 pinturas
  sem descontinuidades, cinco níveis e 100 reversões ancestrais;
- `npm run test:build-safety`: 51 verificações;
- `npm run build:isolated -- --all`: typecheck/build frontend e backend e manifest;
- auditoria build safety: guarda oficial confirmada; nenhum build ativo.

Não executar estes comandos no banco real. O teste de grupos exige URL de schema
explicitamente test_archive_grupos, banco exclusivo e ARCHIVE_TEST_PGDATA sentinela.
A suíte de navegador exige PLAYWRIGHT_MODULE e bibliotecas locais do Chromium.
Ela bloqueia a rede no domínio sintético e simula a API integralmente.

Falhas novas foram investigadas: ajustados nome acessível dos checkboxes (ponto
colorido decorativo), contrato JWT da fixture e seletores/textos do harness. Não
foram classificados como flakes. A regressão de foco no isolamento foi corrigida:
Chromium pode transferir o foco para body ao aplicar hidden antes do layout effect;
a captura de foco lembra o alvo do canvas e retorna ao quadro sem scroll, sem
roubar foco de controles/editor. Asserções anteriores foram preservadas; o teste
HTTP anterior ganhou apenas a aplicação da migration aditiva para o novo Client.

## Medições e dívidas preservadas

Dados brutos do benchmark Chromium em `fichario-grupos-medicoes.json`; três amostras
por combinação, 50/100/200/500 cards e dois grupos sintéticos, sem
filtro/destaque/isolamento e ANY/ALL. Não cobre 500 grupos simultaneamente ativos.
Cada amostra alterna filtro e pan/zoom, confere zero recálculos de layout e geometria
idêntica; nenhuma requisição HTTP. Não mede FPS de produção ou hardware do usuário.

Medianas locais evento → segundo rAF (ms):

| Cards | Sem filtro | Destaque ANY | Destaque ALL | Isolamento ANY | Isolamento ALL |
|---|---:|---:|---:|---:|---:|
| 50 | 30,1 | 31,3 | 31,5 | 31,5 | 31,3 |
| 100 | 31,4 | 30,9 | 31,1 | 31,2 | 23,6 |
| 200 | 31,0 | 31,2 | 38,5 | 31,5 | 22,4 |
| 500 | 37,6 | 44,9 | 32,9 | 31,4 | 31,2 |

Avaliação pura + contagem: medianas locais de aproximadamente 0,019/0,037/0,070/0,184
ms em 50/100/200/500. O custo dominante continua na UI/renderização/composição.
Foram observadas long tasks, inclusive sem filtros: até 234 ms com 500 cards;
destaque ANY teve até 99 ms e ALL até 186 ms. As amostras variam e não comprovam
melhoria universal. A elevação observada em 200 ALL/500 ANY permanece registrada;
não foi ajustado o motor espacial para mascará-la.

Permanecem: veto conservador, conflitos residuais densos, custo do resolvedor,
renderização de cards/conexões, long tasks, limites de animação e compatibilidade
Prisma operacional. Benchmarks não demonstram resolução dessas dívidas.

## Rollback e publicação futura

Esta entrega não autoriza publicar. Preparar em operação futura: backups íntegros
do banco e dos artefatos ativos, espelho da composição real, Client compatível,
aplicação seletiva **somente** da nova migration autorizada e módulos necessários,
restart controlado apenas se autorizado, bundles antes de HTML atômico, preservação
de caches e verificação de autorização/health/logs/integridade/PID.

Rollback recomendado é **de aplicação**, com backend/frontend anteriores e o
Client operacional anterior preservados, mantendo as duas novas tabelas e seus
dados. O backend anterior ignora as associações, que não interferem em geometria
nem usam campos mecânicos. Não apagar agrupamentos/preferências, não remover
constraints, não restaurar indiscriminadamente o banco e não desfazer migrations
anteriores. Antes de retornar novamente ao candidato, reconciliar versões e obter
snapshot novo. Remoção destrutiva das tabelas não integra o rollback autorizado.

## Checklist para aceite manual após publicação autorizada

- Criar, pesquisar, renomear, recolorir e excluir grupos vazios/com cards.
- Associar o mesmo card em quadros diferentes e confirmar atualização canônica.
- Prévia/cancelar/salvar; criar grupo dentro do editor e cancelar o card.
- ANY/ALL, destaque/isolamento, limpar, sem resultados, resultados recolhidos.
- Contexto multinível, sem autoexpansão, geometria/câmera preservadas.
- Filtrar durante expansão/recolhimento; arrastar/resize com filtros.
- Consulta, radial, foco/teclado, celular e informação não dependente só de cor.
- Duas janelas MASTER, conflito explícito, exclusão de filtro ativo.
- PLAYER e visitante sem acesso; efeitos privados sem vazamento.
- Avaliar quadros extensos e aceitar ou registrar limites de desempenho.

Relatório técnico e hashes de auditoria: `/tmp/grupos-853/`. Arquivos temporários
não substituem backup de publicação; não houve novos artefatos publicados.
