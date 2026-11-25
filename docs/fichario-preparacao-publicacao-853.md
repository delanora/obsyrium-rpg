# 8.5.3 — Preparação da publicação e compatibilidade operacional

**Estado atual:** publicação controlada realizada em 25/11/2026, após autorização
expressa e encerramento da sessão informado pelo responsável. **Aceite manual
pendente; a 8.5.3 não está declarada concluída.** Ver a seção final de publicação.

O relato de preparação abaixo é histórico: naquela etapa não houve publicação,
migration em produção, geração de Client ativo ou restart. O Client foi gerado
somente no espelho e posteriormente publicado como artefato. A 8.5.4 não foi
iniciada. Mantida a limitação histórica da tentativa de migration revertida.

## Auditoria e composição real

Funcional `1b1bdc7f4e072fa328ebd1cc696fc5c8c6409cf5`, main = origin/main = ls-remote
no início; staging vazio. Preservados os 47 WIPs por caminhos/SHA256, incluindo
schema-fonte misto e duas migrations não versionadas. `backups/` continua fora do
commit. Nenhum WIP foi incorporado ao código versionado desta preparação.

Serviço efetivo: **rpg.service**, WorkingDirectory `/opt/rpg`, PID **2467899**.
Health operacional `status:ok/database:up`. O nome histórico grimorio.service do
guia não deve substituir essa identificação operacional na publicação futura.

Frontend ativo: funcional publicado `0299321b2ce2c2d4bd5df8641c2ade22fd75a3fb`,
JS `index-RYNVlaDv.js`, CSS `index-BwtHA_mH.css`, linho e identidade preservados.
Há **358 arquivos ativos**: composição reproduzível de 340 arquivos e 18 bundles
anteriores mantidos para cache. Backend ativo: **856 arquivos**, 428 JS e seus maps.

Inventário inicial/final de **2.037 arquivos protegidos**, incluindo dist frontend,
backend, Client Prisma, migrations, schema e backups. Mesmos caminhos/hashes ao
final; nenhum arquivo operacional novo nesses diretórios. A nova migration já
versionada na tarefa funcional explica a diferença de um arquivo em relação ao
inventário anterior de 2.036. Nenhum dado de campanha foi usado como fixture.

Auditorias da guarda oficial na instalação ativa e no espelho confirmaram bloqueio
de build ativo. Builds/typechecks ocorreram em `/tmp/preparacao-853/checkout`, com
dependências e Client gerado próprios. Não houve alteração de permissões,
ownership, mounts, unit ou dependências ativas. O isolamento adicional pelo SO
continua uma dívida; a guarda oficial não é um sandbox universal.

## Histórico: correção da contagem anterior

O banco possui **90 registros, 89 nomes distintos, 89 migrations concluídas e
uma tentativa revertida**, sem falha aberta. Não são 90 migrations concluídas.
As concluídas correspondem a **87 SQLs da base versionada** e duas frentes WIP:

- `20261110100000_optional_geography_links`;
- `20261110120000_add_dice_roll_log`.

Os **89 checksums das concluídas conferem exatamente** com os arquivos disponíveis.
O arquivo `migration_lock.toml` não é uma migration SQL. A main funcional agora
contém 88 SQLs, contando a nova `20261125120000_narrative_groups`, ainda não aplicada
em produção. A nomenclatura/contagem inicial foi corrigida sem reclassificar ou
modificar qualquer registro real.

Há dois registros de `20261107120000_add_character_hotbar`: uma tentativa revertida
com zero passos, seguida da concluída. O checksum da concluída é
`e23dbfdec2043b7e324cdee7902c9f2fde6af6a2dc3ffd22ce4243a78ec877b8`, igual ao arquivo
atual. O da tentativa revertida é
`e9ee9630448e106145055c63f9b654d0844116625d7a64a0cbd71ed9ab1d6d24`.
O SQL exato dessa tentativa não foi localizado no Git/espelhos consultados.
**Não se afirma reprodução literal dos 90 registros históricos.** Essa limitação
arquivística não é ocultada por editar histórico ou substituir seu checksum.

A estrutura efetiva foi verificada independentemente: todas as **612 colunas,
106 constraints e 149 índices anteriores** são idênticos entre o banco operacional
e a reprodução descartável, excluindo somente as novas tabelas narrativas. As
consultas operacionais foram executadas em transações READ ONLY, sem ler conteúdo
de campanha. Portanto, a compatibilidade não depende de presumir que uma
reprodução incompleta do ledger seja prova integral do ambiente real.

## Três schemas e Client candidato

Origens e SHA256:

| Referência | Origem | SHA256 |
|---|---|---|
| Main funcional | Git, commit 1b1bdc7 | `7c9b7331a48d20bbb7b6cff440627a1bca1299402b6057da54d11b2e46077dca` |
| Operacional | schema do Client ativo | `9acd12d9d2fe11819c9e11b10b95fada2d05849d5195cac5df86e206397cfc19` |
| Candidato fonte | operacional + relações/modelos narrativos | `a0f4e13922056ed5431a1baf01e2000809f5600888b4f148468da0e6c4bbd738` |
| Candidato gerado | normalização Prisma e output isolado | `fbbd9ec693d37624665f007108705c42723cb313c3f09f0acdd0f9b3cba791fd` |

Diff semântico main → candidato:

- Region preserva relações operacionais diretas com Creature e Scene;
- Locality.regionId e Locality.region permanecem opcionais, com SET NULL;
- Scene.localityId e Scene.locality permanecem opcionais;
- Scene.regionId/region e Creature.regionId/region preservados;
- DiceRollLog preservado, incluindo campos, mapeamentos e índices;
- entidades e relação de agrupamentos já presentes na main permanecem.

Diff operacional → candidato: **somente NarrativeCard.groups, NarrativeGroup e
NarrativeCardGroup**. Não se copiou o schema-fonte misto indiscriminadamente.
Comparação integral do DMMF: **48 modelos e 714 campos anteriores preservados**,
sem alteração de tipo, nulabilidade, relações ou demais metadados. Dois modelos
novos, uma relação nova. Prisma Client e CLI **6.19.3**, mesma versão operacional.

Diffs textuais completos, diff semântico e manifests do Client ficam no diretório
privado da preparação; não foram versionados Clients, dependências ou schemas
operacionais privados. A diferença de hash do schema gerado inclui normalização
e output explicitamente isolado, não mudanças adicionais de modelos.

A comparação schema/DB ainda mostra diferenças **preexistentes**: onDelete de duas
FKs de elevation_requests, default de scenes.updatedAt e nomes de dois índices de
pending_effect_saves. Elas já existem entre o Client operacional e o banco real;
a reprodução dos SQLs concluídos mantém exatamente a estrutura real. **Não aplicar
o SQL de migrate diff** para “corrigir” essas diferenças. A migration nova não as
toca; a divergência global não foi declarada resolvida.

## Migration e aplicação seletiva comprovadas

SQL de `20261125120000_narrative_groups` conferido: CREATE de duas tabelas, índices,
checks e FKs narrativas. Nenhuma alteração de coluna antiga, nulabilidade,
geografia, DiceRollLog, personagem ou combate.

Instância PostgreSQL 15 própria em `/tmp/obsyrium-grupos-pg-NHtNW5/data`, porta
53763, banco `arquivo_grupos_853`. Foram utilizados schemas exclusivos, sentinelas
verificáveis e fixtures próprias. Não se usou o PostgreSQL operacional para testes.

O diretório isolado de migrations contém os **89 arquivos efetivamente concluídos,
com os mesmos checksums**, mais apenas a nova migration pendente. Provas com o
comando oficial Prisma `migrate deploy`, não aplicação manual de SQL:

1. Histórico efetivo: 89 migrations concluídas reproduzidas no schema
   `test_archive_grupos`; nova migration adicionada depois.
2. Aplicação seletiva: apenas narrative_groups foi executada; 89 registros
   anteriores permaneceram idênticos, inclusive timestamps/checksums/status.
3. Segunda execução: nenhuma migration pendente; histórico final de 90 registros
   idêntico ao da primeira aplicação.
4. Schema separado `test_archive_ledger`: falha **sintética** de hotbar, revertida
   com `migrate resolve --rolled-back` **somente nessa fixture descartável**;
   restauração do arquivo correto e aplicação do histórico efetivo.
5. Nesse cenário: 90 registros iniciais (89 concluídos + uma tentativa revertida),
   somente a nova migration aplicada, 91 registros finais; todos os anteriores,
   incluindo o revertido, intactos. Replay sem alterações.

A falha sintética prova o comportamento do procedimento diante de um registro
revertido; **não substitui o SQL histórico desconhecido nem seu checksum**. Não
houve migrate resolve, alterações de ledger ou migrations na instalação ativa.
Numa publicação futura, o histórico real esperado passa de 90 para 91 registros,
com 90 concluídos e a tentativa revertida anterior preservada.

## Backend candidato: composição seletiva

Foi feita uma compilação de diagnóstico das fontes operacionais disponíveis e
comparação com os JS ativos antes de admitir módulos na composição. As fontes WIP
que já estavam publicadas reproduzem seus JS ativos. Isso não autoriza incorporá-las
à main ou publicar outras alterações locais.

As nove divergências do build genérico foram classificadas: quatro módulos novos
do Arquivo, quatro helpers temporários antigos ausentes das fontes e uma diferença
**apenas de posicionamento de comentário** em characters.routes. O runtime final
não usa esse build como substituição integral: parte dos **bytes ativos** e conserva
inclusive esses helpers, comentário e maps antigos.

Somente estes módulos e seus `.js.map` foram sobrepostos:

- modules/archive/archive.routes;
- modules/archive/archive.schema;
- modules/archive/archive.dto;
- modules/archive/archive.service;
- modules/shared/narrative-groups (novo).

São **oito arquivos existentes substituídos e dois adicionados**, totalizando 858.
Todos os outros bytes permanecem iguais. Dependências transitivas conferidas:
Prisma, auth, hub/eventos, HttpError e shared/narrative continuam os operacionais;
não houve nova dependência npm. O módulo shared/narrative.js é idêntico, pois as
novas interfaces/imports de tipo são apagados na emissão.

A main pura com o Client candidato reproduziu cinco erros de nulabilidade
(TS2322/TS2345 em localidades, cenas e uma fixture de smoke). Não foram contornados
com casts nem resolvidos incorporando WIPs ao repositório. O espelho operacional
correto passou no typecheck/build. Duas fixtures frontend receberam o campo
regionId já exigido pela interface publicada, somente no espelho; não são módulos
de entrega. Um ajuste de composição do schema que inicialmente inseriu a relação
no modelo errado foi recusado pela geração Prisma e corrigido antes dos testes.

## Frontend candidato e manifests

A fonte preservada no espelho anterior reproduziu os **340 hashes** da composição
publicada, incluindo JS/CSS referenciados pelo HTML. O restante do pacote ativo
contém 18 bundles antigos de cache, igualmente preservados.

Sobreposição de apenas sete módulos autorizados: archiveApi, ArchiveCanvas,
ArchiveGroupControls, ArchivePage, ArchiveReader, archive.css e archiveFilters.
Nenhuma troca de styles global, assets, linho, molduras ou código alheio.
Margem 1120, folga 32, 12 faixas, reserva cooperativa, veto localizado, editor,
multinível, curvas/tempos e estabilidade mantidos.

Novos bundles: **index-CFyHXEMX.js** e **index-Cpx3W3fT.css**.
Pacote preparado com **360 arquivos**: os 358 ativos, HTML atualizado e os dois
bundles novos; todos os 357 arquivos ativos diferentes do HTML continuam idênticos.
O Client candidato possui 27 arquivos inventariados. Manifests SHA256 completos de
frontend, backend e Client em `/tmp/preparacao-853/`, junto ao build-manifest oficial.
Esses arquivos são candidatos, não artefatos publicados ou backups de publicação.

## Testes executados

- Typecheck/build oficiais frontend/backend e 51 verificações de build safety.
- 89 HTTP/PostgreSQL de grupos no fonte e novamente nos **JS compilados seletivos**:
  MASTER/PLAYER/visitante, CAS, concorrência, idempotência, rollback, eventos privados,
  associações, exclusões e contratos legados.
- 173 regressões HTTP anteriores, em schema próprio; public ANTES = DEPOIS na
  instância descartável (não é uma declaração de hash de dados da campanha).
- 802 verificações puras de filtros + 2.357 regressões espaciais.
- Chromium: 38 verificações de agrupamentos e 100 ciclos; suites anteriores de
  navegação, fundo, estabilidade e radial, com ondas/multinível habilitados.
  Última regressão: **7.634 pinturas sem descontinuidades**, cinco níveis e
  100 reversões ancestrais, além de gestos, câmera, posições e celular.
- Novo `scripts/check-archive-operational.mjs`: **35 verificações no candidato +
  35 no backend/Client anteriores**, ambos contra o banco com as tabelas novas.
  Geografia sem vínculos obrigatórios, SET NULL, edição de cenas, permissões,
  rolagem persistida e carregada por **outro processo**, grupos preservados após
  atualização pelo backend anterior. Cleanup seletivo e sentinela antes de escrita.
- Guarda do novo teste: runtime `/opt/rpg` recusado antes de importar Client/conectar.
- Bootstrap real do candidato em processo próprio: health/database up, HTML,
  ambos os bundles servidos idênticos aos manifests e rota privada retornando 401.
  Processo de teste encerrado; não se reiniciou serviço algum.

A instância PostgreSQL de teste foi encerrada após a suíte. Não foram executados
smokes gerais, testes sobre a campanha ou validação manual do responsável. O erro
de nulabilidade na main é diagnóstico esperado e documentado, não flake. Erros
SQL impressos nos testes negativos de constraints são asserções esperadas.

Não se alteraram parâmetros para mascarar desempenho. Permanecem as dívidas de
long tasks, renderização, densidade extrema, resolvedor, veto conservador e limites
de animação. O benchmark geral do navegador ainda apresenta custo alto com 500
cards; as amostras desta preparação não comprovam resolução dessas dívidas.

## Plano de publicação futura — exige autorização expressa

1. Revalidar SHA funcional, commit documental, remoto, WIPs, PID e hashes ativos.
   Se a composição tiver mudado, refazer o espelho; não publicar um pacote obsoleto.
2. Fazer backup consistente do banco (`pg_dump` em snapshot consistente) e backup
   integral de frontend, backend compilado e Client operacional. Manifests SHA256
   conferidos, armazenados fora do Git, sem segredos expostos. As cópias desta
   preparação não substituem esse backup atualizado. Não foi feito dump real aqui.
3. Congelar/conferir o diretório isolado de histórico: 89 arquivos anteriores
   conferidos e apenas narrative_groups pendente. Configurar a URL operacional de
   modo privado e executar migrate deploy **somente após autorização específica**.
   Nunca utilizar indiscriminadamente o checkout misto, migrate dev, db push ou SQL
   avulso sem ledger. Conferir que os 90 registros anteriores ficaram intactos.
4. Publicar o Client candidato 6.19.3 e a sobreposição seletiva backend (dez
   arquivos), preservando os demais. Não substituir todo dist por build da main.
   Não substituir o schema-fonte WIP. Conferir todos os hashes publicados.
5. Restart controlado **de rpg.service**, quando expressamente autorizado, pois
   Node não recarrega os novos módulos/Client em execução. Registrar PID novo e
   verificar health, banco, endpoints privados, status Prisma e logs.
6. Publicar bundles/assets antes da troca atômica do HTML, conservando os bundles
   antigos. Liberar HTML novo somente depois do backend saudável. Validar textura,
   bundles, frontend e ausência de erros. Não criar fixtures na campanha.
7. Solicitar aceite funcional/visual do responsável antes de encerrar a 8.5.3.

## Rollback de aplicação

Guardar pares anteriores de backend/Client/frontend e seus manifests. Se houver
falha, restaurar **a aplicação anterior** e seu Client, fazer o restart controlado
quando autorizado e restaurar o HTML anterior, preservando caches. Validar health,
rotas, logs e o novo PID. Os testes com os artefatos anteriores e tabelas novas
passaram; a edição pelo backend antigo preserva vínculos desconhecidos por ele.

Manter narrative_groups/narrative_card_groups e seus dados. Não remover tabelas,
constraints, preferências relativas ou migrations; não alterar ledger; não
restaurar indiscriminadamente o banco. Exclusão intencional de card pelo backend
antigo ainda limpa vínculos por FK, como esperado. Ele não conhece os contadores de
versão dos grupos: ao retornar ao candidato exigir snapshots novos, contagens
atuais e recarga das janelas, sem reaplicar rascunhos obsoletos. A limpeza de offsets
relativos continua no backend operacional anterior preservado.

## Parecer e limites

**Preparação técnica aprovada para análise da autorização de publicação**, sustentada
por igualdade estrutural do estado anterior, preservação integral das APIs,
reprodução byte a byte do frontend, sobreposição backend conferida, aplicação
seletiva e rollback testados. A limitação da tentativa histórica revertida está
registrada; não se declara reprodução literal de seu SQL/ledger.

O diretório `/tmp/preparacao-853/` contém candidato, anterior, schemas/diffs privados,
históricos, manifests e logs de ensaio. É temporário: revalidar e preservar os
artefatos revisados antes de qualquer operação futura. Nenhum Client, dependência,
dump, schema privado ou dado de campanha integra o commit.

Aguardar análise e autorização expressa para **migration, publicação backend/Client,
frontend e restart**. Não executar essas operações com base apenas neste parecer.
Não iniciar a 8.5.4.

## Publicação controlada — 25/11/2026

### Autorização e Git

Funcional autorizado: `1b1bdc7f4e072fa328ebd1cc696fc5c8c6409cf5`.
Preparação/base da publicação: `c2b25e49344465a12a582ac2bc16fada062f66a8`.
Main, origin/main e ls-remote conferidos antes da operação, staging vazio.
A autorização incluiu expressamente backup, somente a migration narrativa,
Client candidato, sobreposição seletiva, restart de rpg.service, frontend,
verificações e rollback de aplicação. Nenhuma autorização para a 8.5.4.

O responsável inicialmente informou sessão em andamento: não houve migration,
troca de arquivos ou restart enquanto essa condição persistia. Após informar
“finalizei a sessão”, foi feito novo backup e retomada a janela de publicação.

### Backup atualizado e restauração validada

Backup utilizado: `/opt/rpg/backups/publicacao-853-20261125T204342/`, criado às
20:43:42 UTC, depois do encerramento informado da sessão. Diretório privado 0700,
dump 0600. `banco.dump` custom-format, **8.466.231 bytes**, SHA256:

`019ac2e1d3daf7710143dbb65892f64647bc58f9486a5e45e4af47a346304ecc`

Inclui frontend anterior completo (358 arquivos), backend anterior (856), Client
anterior (18), schemas pertinentes, histórico integral e SQLs para auditoria.
Os 1.232 arquivos de artefatos anteriores conferem por SHA256 com suas origens.
Backups anteriores foram preservados; tentativas anteriores não foram usadas
como substituição deste backup atualizado.

O dump foi listado e **restaurado integralmente** em outra instância PostgreSQL,
acessível apenas por socket Unix em diretório privado, sem listener TCP. Restore
com no-owner/no-privileges para não reproduzir permissões operacionais no ensaio;
o dump original mantém seus metadados. Conferidos 90 registros/89 concluídos.
Nenhuma suíte usou os dados restaurados como fixture. A instância foi encerrada
e sua cópia descartável removida; o backup original permanece íntegro.

O backup recebeu, em diretórios separados, auditoria pós-publicação e delta
candidato (dez arquivos backend, 27 Client, HTML e dois bundles), permitindo
reconstrução sem depender de /tmp. Os arquivos anteriores continuaram idênticos.
Manifest final SHA256: **1.392 entradas**, além do próprio manifest. Nenhum dump,
Client, dependência, schema privado, token ou conteúdo de campanha foi versionado.

### Revalidação isolada antes da alteração operacional

Guarda oficial conferida no ativo e no espelho; nenhum build em /opt/rpg.
Reexecutado `npm run build:isolated -- --all` no espelho, incluindo typechecks,
builds e 51 verificações de proteção. Bundles reproduzidos com os mesmos nomes
e hashes autorizados; os dez JS/maps também idênticos ao candidato preparado.

Reexecutados e aprovados em PostgreSQL de fixtures, **separado da validação do
dump real e do banco operacional**:

- 89 HTTP/PostgreSQL com os módulos compilados seletivos;
- 173 regressões HTTP anteriores;
- 35 verificações operacionais no candidato e 35 no backend/Client anteriores,
  incluindo geografia opcional e persistência do log carregado por outro processo;
- 802 verificações puras de filtros e 2.357 regressões espaciais;
- 38 verificações Chromium de grupos e 100 ciclos de filtragem;
- suites Chromium anteriores de navegação, fundo, estabilidade e radial, incluindo
  ondas, multinível, câmera, gestos, posições personalizadas e celular.

A instância de fixtures foi encerrada ao concluir as suítes. Testes isolados não
foram executados sobre a campanha real. Não houve validação manual do responsável
nesta operação automatizada.

### Banco e histórico efetivamente publicados

Prisma migrate deploy executado **no diretório isolado conferido**, com os 89 SQLs
concluídos anteriores e exclusivamente narrative_groups pendente. SQL idêntico ao
SHA funcional autorizado, SHA256:

`bb2dd1ff0e3dfdfaf964452722ed31ea78e70f73556c3dc7fbcfbba4950c4cac`

Somente `20261125120000_narrative_groups` foi aplicada, de **17:54:08.375 a
17:54:08.394 -03:00**. Histórico passou de 90 para **91 registros**, de 89 para
**90 concluídos**, mantendo uma tentativa revertida e nenhuma falha aberta.
Todos os 90 registros anteriores permaneceram **integralmente idênticos**, incluindo
checksums, timestamps, logs, status e identificadores. As duas migrations WIP e a
tentativa revertida de hotbar não foram alteradas ou reclassificadas.

Criadas somente as duas tabelas narrativas, com **8 constraints e 4 índices**.
Preservadas as 612 colunas, 106 constraints e 149 índices anteriores. Não se aplicou
migrate diff, resolve, dev, db push ou SQL de correção de divergências preexistentes.
`prisma migrate status` confirmou ausência de migrations pendentes.

Os hashes agregados de linhas e contagens das **49 tabelas anteriores**, excluindo
somente o histórico intencionalmente alterado e as duas tabelas novas, permaneceram
iguais antes/depois da migration e depois do restart/frontend. Foi uma auditoria
somente leitura: não se criaram personagens, cards, quadros, grupos ou fixtures
na campanha real. As estruturas e arquivos deliberadamente publicados não são
indevidamente classificados como ANTES = DEPOIS.

### Client, backend, restart e verificações operacionais

Publicado o Client candidato **6.19.3**, com **27 arquivos** conferidos por SHA256,
preservando exatamente os **48 modelos e 714 campos anteriores**. Adicionados
somente NarrativeCard.groups, NarrativeGroup e NarrativeCardGroup. O Client
anterior possuía 18 arquivos; os nove arquivos adicionais são runtime da geração
customizada validada. Não houve generate ativo, troca geral de node_modules,
substituição do schema-fonte misto ou mudança de versão das dependências.

Mantido o schema gerado SHA256
`fbbd9ec693d37624665f007108705c42723cb313c3f09f0acdd0f9b3cba791fd`.
Somente os quatro módulos archive routes/schema/dto/service e o novo
shared/narrative-groups, cada qual com JS/map, foram sobrepostos: **oito arquivos
existentes substituídos e dois adicionados; total 858**. Todos os demais bytes do
backend foram preservados, inclusive helpers antigos e o comentário de routes.
Permissões e ownership dos arquivos existentes permaneceram iguais; nenhum
chmod/chown foi executado.

Restart exclusivamente de **rpg.service**, às **20:55:29.253 UTC / 17:55:29.253
-03:00**. PID **2467899 → 3297180**. Recuperação medida desde o comando até health
`status:ok/database:up`: **0,672 s**. Serviço active/running, ExecMainStatus 0.

Antes de liberar HTML, **13 GETs operacionais não mutáveis** conferiram health,
Arquivos MASTER 200, PLAYER 403, visitante 401 (grupos/quadros/cards) e APIs anteriores
de regiões, cenas e histórico de dados. Tokens de verificação foram efêmeros,
utilizados apenas em memória, sem criar contas ou registrar credenciais. Repetida
a conferência depois da publicação. Novo PID sem erros relevantes nos logs;
nenhum erro de inicialização, Client ou tabela inexistente foi observado.

### Frontend efetivamente publicado

Após backend saudável, publicados primeiro os dois bundles e conferidos por
resposta HTTP e SHA256; somente depois o HTML mudou por **rename atômico**.

| Artefato | SHA256 |
|---|---|
| index-CFyHXEMX.js | `78dbb2c8605f7ba967216958d4606ee527e8cee8c876f2941d039bda1d8f23f8` |
| index-Cpx3W3fT.css | `18894a8562147674fe6078af37cdd2811ea9cd9c250fe6ee84f2e7230f0a6ead` |
| index.html | `f858e8d9c0ae961f0bf33444716554e2d127de27970aafc45aef543b33b0fb5b` |

Total ativo **360 arquivos**, todos idênticos ao manifest candidato. Os **357
arquivos anteriores diferentes do HTML** permaneceram intactos, incluindo bundles
antigos de cache, linho e demais assets. Editor, consulta, multinível, margem
1120, folga 32, 12 faixas, veto localizado e identidade visual preservados.
Verificação operacional por HTTP no serviço/origem; não se confunde com renderização
Chromium de fixtures ou com aceite visual manual.

### Integridade, incidentes e rollback

**47 WIPs por caminhos/hashes preservados**, inclusive schema-fonte misto e duas
migrations WIP. Backups anteriores, arquivos de backend não autorizados e assets
fora do delta permaneceram iguais. Os 2.037 arquivos do inventário inicial foram
conferidos distinguindo os caminhos autorizados dos que deveriam permanecer
imutáveis; os novos arquivos/cópias de backup são alterações autorizadas.

Incidentes de execução, sem corrupção ou necessidade de rollback:

- A primeira tentativa de pg_dump não conectou por seleção inadequada de parâmetros
  libpq; foi refeita com conexão explícita e privada. Somente o backup atualizado,
  validado por restauração, foi utilizado.
- A revisão automática inicialmente não reconheceu a autorização da migration e
  bloqueou o comando antes de executá-lo. O trecho explícito da autorização foi
  relido; nova execução foi aceita. Não houve contorno da rejeição.
- A validação inicial do publicador encontrou conversão str/Path incorreta antes
  de copiar arquivos ou reiniciar. Corrigida, com nova conferência dos mesmos hashes.
- A primeira consulta de journal usou timestamp não aceito pelo journalctl local;
  corrigida para UTC sem alterar o serviço. A leitura final passou.

A migration e o restart efetivos passaram; **rollback de aplicação não foi
necessário**. Procedimento e pares anteriores completos permanecem disponíveis no
backup informado, com o delta candidato para retorno posterior. Em eventual rollback,
conservar as tabelas/dados novos e o histórico Prisma; nunca restaurar o banco
indiscriminadamente, remover constraints ou apagar preferências. Ao retornar ao
candidato, exigir snapshots novos e recarga das janelas, sem reaplicar rascunhos
obsoletos. A compatibilidade do backend anterior com as tabelas novas foi novamente
ensaiada em fixtures, não na campanha.

### Estado e pendências após publicação

**8.5.3 publicada, aguardando aceite manual funcional/visual.** Não declarada
concluída. O checklist funcional desta documentação continua aplicável.
Persistem dívidas de desempenho/renderização, long tasks, quadros densos, resolvedor,
veto conservador, limites de animação e isolamento adicional por permissões.
A divergência global entre main/schema/Client operacional **não foi resolvida**;
futuras publicações devem preservar a composição seletiva e as APIs existentes.
A limitação arquivística da tentativa histórica revertida permanece registrada.

Auditoria privada: backup informado e `/tmp/publicacao-853/`. Nenhum dado real,
dump, Client ou schema operacional privado integra o commit documental. Aguardar
validação do responsável. Não iniciar a Fase 8.5.4.
