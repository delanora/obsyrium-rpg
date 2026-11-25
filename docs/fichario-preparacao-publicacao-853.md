# 8.5.3 — Preparação da publicação e compatibilidade operacional

Preparação técnica validada em 25/11/2026 para análise do responsável. **Não houve
publicação, migration em produção, geração de Client ativo ou restart.** A aprovação
desta preparação não é autorização de publicação nem aceite da fase. A 8.5.4 não
foi iniciada. Limitação histórica explicitada abaixo: não se afirma reprodução
literal da tentativa de migration revertida.

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
