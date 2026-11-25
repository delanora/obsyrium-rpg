# Build seguro e publicação separada

## Motivo e escopo

Na publicação da 8.5.2.4, um build foi disparado em `/opt/rpg`; o Vite substituiu
artefatos ativos. Os 357 arquivos anteriores foram restaurados por hash antes da
publicação final. A janela transitória não foi monitorada continuamente; não há
prova de impacto zero. Histórico em `fichario-multinivel-hardening.md`.

Este hardening protege os fluxos oficiais contra acidentes. Não modifica runtime,
Fichário, regras, assets, banco, Prisma, serviço ou permissões. Não publica.

## Instalação e política

Raiz operacional confirmada: `/opt/rpg`; Express serve `client/dist` e o serviço
`rpg.service` executa `/opt/rpg/dist/index.js`. PID de referência 2467899.
`deploy/grimorio.service` é o modelo versionado histórico; não foi aplicado.

`scripts/build-safety.mjs` mantém `/opt/rpg` como instalação protegida versionada,
sem variável de ambiente de bypass. Origens dentro dessa instalação são recusadas,
mesmo com saída alternativa. Destinos iguais, descendentes ou ancestrais da
instalação são recusados; `/opt/rpg-teste` não é um descendente textual falso.

A resolução percorre os segmentos e symlinks, aplicando `..` após resolver o link.
Destinos inexistentes usam o ancestral existente mais próximo. Links pendentes,
ciclos, falta de acesso, strings vazias, URLs ou caminhos ambíguos falham fechados.
O erro começa com `BUILD BLOQUEADO`, informa caminhos/motivo e termina com código
não zero. Não imprime valores de ambiente nem segredos.

## Frontend e ordem de execução

`npm run build:client`, `npm --prefix client run build` e `npm run build` no client
usam o wrapper `scripts/build-client.mjs`. Ele valida a origem antes de chamar
TypeScript (sem emissão) ou Vite e fixa a configuração oficial. Não aceita `--config`
substituto. Os argumentos de root/outDir do Vite continuam chegando à configuração.

A configuração oficial contém o plugin de guarda em `configResolved`, repetido em
`buildStart`. São validados root, origem da configuração, publicDir, cacheDir,
outDir, ambientes e diretórios `rolldownOptions.output`/alias `rollupOptions.output`.
Também se recusam nomes de saída absolutos/com `..` ou funções não determináveis.

Compatibilidade auditada no Vite **8.3.1** instalado, sem depender de uma versão
mais antiga de Rollup: `configResolved` é aguardado na resolução da configuração;
a limpeza/cópia de publicDir ocorre em `vite:prepare-out-dir`, no `renderStart`
posterior. O teste real com configuração oficial comprova que as sentinelas
não são limpas. Referência: [API de plugins](https://vite.dev/guide/api-plugin.html#configresolved).
A CLI direta com a configuração oficial também é protegida, inclusive `--outDir`
e o argumento posicional de root (`vite build <root>`).

**Fronteira de escrita temporária:** o carregador padrão do Vite pode compilar a
própria configuração para `.vite-temp` antes de executar seus hooks, removendo o
arquivo depois. A guarda impede limpeza/emissão dos artefatos publicados, mas não
é uma garantia de zero escrita de cache pela CLI direta antes de carregar o plugin.
O wrapper oficial bloqueia a origem ativa antes de invocar o carregador. Para
zero escrita de qualquer ferramenta, é necessária a camada de permissões abaixo.

## Backend

`npm run build` usa `scripts/build-backend.mjs`: valida origem, tsconfig, outDir,
outFile, declarationDir e tsBuildInfoFile. Opções inválidas, projetos referenciados,
incremental/composite ou ausência de outDir são recusados no fluxo atual.

O compilador é o TypeScript já instalado. Verificações de tipos antecedem a emissão;
a emissão é capturada em memória. Todos os nomes finais são validados antes de
criar o primeiro diretório ou arquivo. Não há limpeza automática do backend.
`npm run typecheck` continua sem emissão e não exige build/publicação. O wrapper
`typecheck.mjs` fixa noEmit e desliga incremental/composite, recusando argumentos
extras capazes de reativar escrita; o build frontend também usa essa verificação.

**Limitação explícita:** `tsc -p ...` executado diretamente não usa esse wrapper e
pode escrever em produção se o usuário tiver permissão. O controle em fixture
comprova essa fronteira. Não existe promessa de proteção universal do compilador.

## Fluxo isolado

1. Registrar SHA, WIPs, composição ativa e hashes de referência.
2. Preparar outro checkout/worktree autorizado ou `git archive` do SHA conferido
   em diretório novo, fora da instalação protegida. O archive não copia `.env`,
   uploads, dependências ou dados reais. Preservar em separado a composição
   publicada necessária; reproduzir seus hashes antes de sobrepor módulos.
3. Disponibilizar dependências próprias nesse checkout. CI/desenvolvimento podem
   usar `npm ci --ignore-scripts` e `npm --prefix client ci --ignore-scripts` como
   instalação separada; isso não gera Prisma automaticamente. O backend requer
   Client pré-gerado compatível com seu schema. Não reutilizar arbitrariamente
   o Client da campanha; geração/instalação com scripts é uma operação separada.
   Esta tarefa não executou instalação, geração Prisma ou migrations.
4. Conferir caminhos físicos e executar, **nesse checkout isolado**:

   ```bash
   npm run audit:build-safety
   npm run build:isolated -- --frontend
   # Ou --backend / --all, com dependências compatíveis.
   ```

5. O pipeline valida caminhos, executa typecheck, build real e testes de proteção;
   depois produz `build-manifest.json`, com SHA256 dos artefatos. Não copia para
   produção, não acessa o banco nem autoriza publicação. O manifest de arquivos
   também não comprova sozinho a origem do SHA: conferir o checkout e os módulos.
6. Executar as demais regressões pertinentes à alteração. Comparar a composição
   final com a referência aprovada e apresentar o resultado para autorização.

Builds permitidos: checkouts em `/tmp`, diretórios de desenvolvimento, worktrees
já autorizados e CI fora da instalação protegida. Não há uma pasta de build única
obrigatória. Desenvolvimento (`vite serve`) não é bloqueado pela guarda de build.
Evitar symlink de toda a pasta node_modules para produção: cacheDir também é saída;
usar diretórios próprios, sem direcionar caches para a instalação ativa.

## Publicação controlada

O antigo `deploy/deploy.sh` apenas explica o procedimento e termina com erro; não
executa build nem restart. Ele misturava build e atualização do ambiente ativo.
Não foi criado um novo mecanismo automático de deploy.

Uma publicação continua exigindo autorização específica de SHA, branch/remoto
conferidos, backup integral e hashes, rollback preparado, assets antes do HTML,
rename atômico do HTML, bundles anteriores preservados, health/rotas/logs e WIPs
conferidos. Backend, restart, migrations e Prisma são autorizações distintas.
Commit/push ou conclusão do build não autorizam nenhuma dessas operações.

## Testes, ativação e limites

`npm run test:build-safety` cria instalações falsas, sentinelas e manifests em
`/tmp/obsyrium-build-guard-*`. Não aponta builds negativos para `/opt/rpg` nem
usa dados da campanha. Cobre scripts npm, Vite direto oficial, overrides CLI/API,
saídas do empacotador, diretórios pais/filhos, caminhos inexistentes, relativos,
redundantes, similares, symlinks intermediários, ciclos e links pendentes.
Verifica código/mensagem de bloqueio e integridade após cada negativa. Builds
reais permitidos e modo serve/typecheck são exercitados nas fixtures.

`npm run audit:build-safety` é somente leitura: confere scripts, presença da guarda
oficial, caminhos físicos, hashes e reconhecimento da instalação ativa pela
política. Não chama compiladores, não resolve a configuração pelo carregador
Vite e não publica. Diferencia a instalação da guarda no checkout operacional da
proteção imposta pelo sistema operacional. Uma cópia antiga continua desprotegida.

Não cobre configuração alternativa que remova o plugin, API do compilador/bare
`tsc`, comandos arbitrários de escrita, usuário root nem troca externa de symlinks
entre validação e escrita. Código/plugin malicioso possui os mesmos privilégios
do processo e pode contornar verificações. Não há fronteira absoluta de segurança.

**Camada recomendada, não aplicada:** usuário de build sem acesso de escrita aos
artefatos ativos, workspace próprio e processo/usuário distinto de publicação,
com validação de destino, SHA, manifest, backup e HTML atômico. Exige autorização
específica para ownership, permissões, serviço ou mounts; pode afetar uploads,
logs e rotinas atuais. Nenhuma dessas mudanças foi feita nesta tarefa.

## Resultado desta entrega — 25/11/2026

Base: `932e2726a0e2c879fc65259ee500dcfbffcea081`, branch main, staging inicial
vazio e 47 WIPs por caminhos/hashes (backups operacionais registrados à parte).
Sem workflow `.github` nesta versão. Auditados package.json, Vite, tsconfig,
Express estático, script legado e unit versionado; nenhum deploy foi executado.

Diretórios relevantes: `/opt/rpg` e seus dist; `/opt/rpg/backups`;
`/tmp/arquivo-publicacao` (espelho reutilizável anterior);
`/tmp/fichario-8524-publicacao` (evidências da publicação anterior);
`/tmp/refinamento-validacao` (dependências/Client pré-gerado preexistente);
`/tmp/build-seguro/checkout` (novo checkout de validação). Espelhos antigos não
foram alterados nem são declarados protegidos: devem receber a guarda e dependências
próprias antes de um uso futuro. Não há novo build/publicação deles nesta tarefa.

O pipeline `npm run build:isolated -- --all` passou no checkout separado:

- typecheck e build completos frontend/backend;
- frontend real com 340 arquivos e backend real com 856 arquivos;
- **51 verificações** da proteção, com npm/CLI/API reais e fixtures descartáveis;
- manifest de **1196 hashes SHA256**, conferido, `published:false`;
- source, destinos, symlinks, pais/filhos, outDir/root, outputs múltiplos e códigos
  de erro exercitados; sentinelas/manifest da instalação simulada idênticos após
  cada tentativa bloqueada;
- typecheck com argumentos de emissão recusado; typechecks normais permitidos;
- controle intencional com `tsc` direto regravou apenas uma sentinela da fixture,
  demonstrando a fronteira sem wrapper. Não foi realizado contra produção.

Uma primeira tentativa do backend completo encontrou **cinco TS2322/TS2345**:
o Client instalado em `/opt/rpg/node_modules/.prisma/client` tipa como anuláveis
Locality.regionId e Scene.localityId, enquanto o código da main pressupõe strings.
Os erros surgiram também no typecheck sem emissão, independente do novo wrapper.
Não foram corrigidos incorporando WIPs ou alterando schema. No checkout de teste,
foi copiada a dupla @prisma/client + Client já pré-gerada e preexistente em
`/tmp/refinamento-validacao/node_modules`; typecheck e build completos passaram.
**Nenhum Client foi gerado nem alterado na instalação ativa.** Isso não resolve
a divergência de dependências/WIPs: futuros builds backend devem conferir seu
artefato Client/schema correspondente. O build falho não emitiu arquivos.

Auditoria operacional somente de leitura (`audit:build-safety`) comprovou no
checkout `/opt/rpg`: scripts protegidos presentes, hashes registrados, configuração
oficial com os hooks e política reconhecendo/bloqueando a origem ativa. Nenhum
compilador ou Vite foi invocado contra os artefatos reais para provar o bloqueio.
A proteção está instalada para os comandos oficiais desse checkout; não é apenas
um commit remoto. As provas de execução negativa ocorreram exclusivamente nas
instalações falsas. A auditoria declara `buildExecuted:false` e
`osIsolationEnforced:false`; não equivale a uma camada de permissões ativa.

Integridade operacional ANTES = DEPOIS: **2036 arquivos** (frontend, backend
compilado, Prisma Client, schema, migrations e backups) e **47 WIPs**, por caminhos
e SHA256. PID **2467899** preservado; health `status:ok/database:up`. Permanecem
publicados o funcional `0299321b2ce2c2d4bd5df8641c2ade22fd75a3fb`, JS
`index-RYNVlaDv.js` e CSS `index-BwtHA_mH.css`. Sem deploy, restart, mudança de
permissões/ownership/mounts, geração Prisma, migrations ou dados reais como fixtures.

Evidências em `/tmp/build-seguro/`: pipeline-final.log, auditoria operacional,
manifests antes/depois e diagnósticos da diferença de Client. O alerta de bundle
>500 kB e todas as dívidas de desempenho/escala do Fichário foram preservados.
O aceite funcional 20/20 da 8.5.2.4 foi registrado nos documentos pertinentes;
não se iniciou a 8.5.3. Aguardar análise do responsável; a camada adicional do SO
permanece proposta e depende de autorização específica.

Versões exercitadas: Linux/POSIX, Node 22.23.4, Vite 8.3.1 e TypeScript 5.9.3 no
backend; frontend usa sua própria versão instalada. CI foi simulado com `CI=1`,
sem workflow novo. Caminhos Windows são recusados nesta política conservadora;
portabilidade Windows não foi comprovada. Reexecutar a suíte antes de atualizar
Vite/compiladores. Não foi necessário executar Chromium, pois a mudança é no
processo de build e não na interface; a prova aqui usa CLI/API reais do Vite.
