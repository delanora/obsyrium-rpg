# Arquivo do Mestre — Fase 8.5.1

Fundação narrativa privada, acessível pelo card **Fichário do Mestre** no Salão e pela aba Fichário. Publicada em 23/11/2026 após autorização; validação técnica concluída e aceite manual pendente. Nenhuma regra mecânica foi modificada.

## Auditoria e decisões

Base inicial: `21e2ec369bf34a3f96f6bc9df933979a6efce9a2`, branch `main`, igual a `origin/main`. Havia 42 arquivos modificados e seis arquivos/diretórios não rastreados de geografia, cenas, inventário, música, dados e combate. Os WIPs foram preservados, inclusive hunks separados de `MasterPanel`, `MasterHome` e `schema.prisma`. Exceção mínima e necessária: o globo `earth` já usado por `ClassEmblem` na main só estava definido no WIP de `Icon.tsx`; essa definição, também usada pela categoria Região do Arquivo, foi incorporada isoladamente para a entrega compilar sem os demais WIPs. O único recurso de Arquivo existente era o card inativo.

Foram auditados `gridCamera.ts`, `useSceneMapCamera.ts`, `SceneMapEditor.tsx`, `SceneMapScreen.tsx` e `scenes.service.ts`. A câmera existente inclui clamps de cena, pés e dependências de combate; não foi importada nem modificada. As fórmulas afins pequenas foram implementadas em módulo narrativo próprio, sem extrair nem alterar motores compartilhados. Reutilizam-se React, Icon, API/token, helper `newId`, middleware de autorização, erros, Prisma, CAS e semântica de recibos/fingerprint de SceneOperation. Não foram adicionadas dependências. SVG nativo desenha as relações.

## Entidades e limites de versão

- `NarrativeBoard`: nome, descrição, criador e timestamps; `version` guarda metadados e conjunto/geometria das representações do quadro.
- `NarrativeCard`: conteúdo canônico (categoria, título, resumo, texto), criador e timestamps; versão própria para edição/exclusão. Pode aparecer em vários quadros.
- `NarrativePlacement`: referência quadro/card, X/Y, largura/altura e zIndex. Uma representação por card por quadro nesta fase; versão pertence ao quadro. Conteúdo nunca é duplicado.
- `NarrativeLink`: relação canônica entre cards, sem coordenadas ou FK obrigatória ao quadro; versão própria, tipo, descrição, direção e rótulo personalizado. É projetada em qualquer quadro que contenha os dois extremos.
- `NarrativeOperation`: recibo por `(actorId, operationId)`, fingerprint do pedido inteiro e resultado. Não depende de FK da entidade, sobrevivendo à exclusão.

Todos os Mestres da mesa única compartilham o Arquivo. `createdById` é informação de autoria, sem exclusão em cascata quando uma conta sai. Não há campanha, tenancy ou autorização derivada de campos enviados pelo navegador.

A migration `20261124120000_narrative_archive` cria somente cinco tabelas, índices, unicidades e FKs novas. Não altera as tabelas da campanha nem depende das migrations WIP de geografia/log de dados. Não existe backfill.

## API privada

Todas as rotas usam `authenticate` + `requireRole('MASTER')`. Os services também validam o papel para chamadas diretas.

- `GET /api/archive/boards`: quadros.
- `GET /api/archive/boards/:id`: quadro, representações com conteúdo e relações cujos extremos estão presentes; snapshot transacional Repeatable Read.
- `GET /api/archive/cards`: biblioteca leve de títulos/categorias/versões, incluindo cards removidos dos quadros.
- `GET /api/archive/cards/:id`: conteúdo integral.
- `POST /api/archive/operations`: intenção discriminada por `action`, schema estrito.

Ações: `board.create/update/delete`, `card.create/update/delete`, `placement.add/update/remove`, `link.create/update/delete`. Todas exigem `operationId`; updates/deletes exigem `expectedVersion`, inclusive alterações de posição/tamanho (versão do quadro). Criação de card inclui quadro, conteúdo e geometria na mesma transação. Criação de relação valida a presença dos dois cards no quadro informado.

Pedidos repetidos retornam recibo sem aplicar novamente. Reutilizar chave com outro payload resulta em 409 `IDEMPOTENCY_KEY_REUSED`. CAS rejeita edição antiga com 409 `CONFLICT`. Um advisory lock transacional serializa as pequenas mutações privadas para manter integridade entre exclusões em vários quadros e retries; não substitui os relógios CAS. Não há uma segunda engine genérica de concorrência.

## Relações e exclusões

Autorrelações são recusadas. A assinatura normalizada inclui extremos, direção, tipo e rótulo personalizado; relações sem direção ordenam os extremos. Duas relações semanticamente distintas podem coexistir; duplicações iguais são recusadas também por índice único no banco. Rótulos de tipos predefinidos não criam duplicatas artificiais.

Remover representação apaga apenas a posição naquele quadro. Excluir quadro remove suas representações, preservando cards e relações. Excluir card é operação distinta, com confirmação explícita, e remove suas representações e relações por FK cascade. A UI pede confirmação antes de qualquer exclusão. Não se apagam relações por clique simples.

Limites: 100 quadros, 10.000 cards na biblioteca e 500 representações por quadro; coordenadas ±1.000.000, dimensões 180–1600 × 120–1600. Texto narrativo até 100.000 caracteres. O conteúdo é texto, renderizado por React sem HTML arbitrário.

## Câmera, gestos e renderização

Coordenadas visuais livres, sem pés, metros ou limites físicos. Câmera local `{x,y,zoom}`, zoom 15–250%, inversão `cameraPoint`, zoom ancorado no cursor e enquadramento de retângulos incluindo coordenadas negativas. O estado da câmera é mantido por quadro durante a abertura da tela; não é persistido no servidor. A câmera inicial/restaurada é aplicada em layout effect antes da pintura, sem herdar o enquadramento de outro quadro.

`ArchiveCanvas` separa geometria recebida de `visual` (rascunho de arraste/resize). Esse é também o ponto de extensão para futuros deslocamentos temporários, sem campos especulativos no banco. O pan transforma o contêiner; conteúdo memoizado evita reconstruir linhas/títulos quando só a câmera muda. Índices locais por card/par evitam buscas repetidas entre os extremos das linhas.

Arraste pelo cabeçalho, resize por oito bordas/cantos, portas `+` acessíveis ao selecionar/passar o mouse. Linhas SVG têm ponta direcional, rótulos, offsets para relações paralelas e área de clique ampliada. Resumos e referências se adaptam à altura; conteúdo integral permanece no editor. As 16 categorias usam texto, símbolo e tons discretos. Não há execução mecânica por categoria.

Pointer capture mantém o gesto fora do card; Escape, blur, pointercancel e perda de captura cancelam sem gravar. Pan/zoom não enviam requisições; mover/redimensionar salva apenas no pointerup. Notificações de outra janela não sobrescrevem um gesto/editor/salvamento pendente. Portas ficam dentro da moldura para não competir com a alça de um vizinho próximo. Cards sobrepostos podem encobrir trechos das relações; afaste-os para acessar uma linha oculta, sem reorganização automática nesta fase.

Falha de salvamento mantém o rascunho, operação e geometry visual para retry com a MESMA chave. Conflito exige descarte/releitura explícita, sem sobrescrita automática. A interface mostra salvando/salvo/pendência; também permite reabrir o editor para consultar o texto integral.

## Realtime e privacidade

`archive:updated` está registrado nos contratos centrais e é emitido **somente por `toMasters`**, depois do commit. Payload contém apenas `at`, sem texto narrativo. `useRealtime` encaminha invalidação local; a tela relembra listas/snapshot se estiver livre. Não há escrita via Socket.io. Reconexão/foco devem reler o estado sem descartar edições locais.

## Validação e execução segura

- Backend: `ARCHIVE_TEST_DATABASE_URL='…?schema=test_archive_identificador' npx tsx src/scripts/check-archive.ts`. Exige schema novo com esse prefixo; falha se já existir. Cria somente as tabelas desta migration e usuários/enum de teste. Inicia HTTP local com autenticação real, prova que Prisma e servidor usam o mesmo schema, verifica digest de todos os dados `public` antes/depois e remove somente o schema criado.
- Câmera: `npx tsx client/scripts/check-archive-camera.ts`.
- Browser: `PLAYWRIGHT_MODULE=/caminho/playwright/index.mjs node client/scripts/check-archive-browser.mjs`. Usa API simulada em memória, não acessa a aplicação real. Requer Chromium e bibliotecas de sistema. Esbuild já está disponível na árvore de dependências do projeto. Capturas ficam em diretório temporário informado pelo teste.
- Typechecks/builds: `npm run typecheck`, `npm run typecheck:client`, `npm run build`, `npm run build:client` (build frontend em cópia isolada, pois client/dist é publicação ativa).
- Regressões relevantes: `npm run test:operation-id`, `npm run test:combat-ui` e `npm run test:scene-map`.

Os testes em memória de UI não equivalem a persistência PostgreSQL. O script de integração comprova leituras posteriores e exclusões no banco; o browser comprova gestos, renderização e retomada da interface após reload com uma API simulada. Resultados e números finais constam no relatório desta entrega. Aprovação manual ainda pendente.

## Limites e continuidade

Sem expansão orgânica, minimapa, layout automático, viagens de câmera, uploads, reprodução de áudio, compartilhamento de imagens, automação de encontros/armadilhas ou conversão em entidades oficiais. As categorias representam informação narrativa. Futuras integrações devem vincular o card canônico, não sua posição, às APIs existentes; não duplicar motores de regras.

Biblioteca não possui busca avançada nem paginação nesta etapa. Geometria de câmera não persiste entre recargas. Não há edição colaborativa em tempo real por caractere: snapshots e conflitos explícitos são a política. Limites de zoom/enquadramento não garantem texto legível ao enquadrar centenas de cards; aproximar para trabalhar. Avaliação de 200 cards não é garantia de escala ilimitada.

## Checklist de aceite manual

- Abrir pelo card e pela aba, criar dois quadros e reutilizar um card sem duplicar o texto.
- Criar/editar conteúdo e categorias, mover e redimensionar em zoom baixo/alto.
- Arrastar portas para conectar, definir tipos/direção e selecionar/editar/excluir linhas.
- Conferir posições/textos/relações após sair e entrar.
- Remover do quadro versus excluir definitivamente; verificar referências nos outros quadros.
- Testar duas abas concorrentes e perda de rede com retry/discard.
- Confirmar privacidade com sessão PLAYER e legibilidade em desktop/celular.
- Dar aceite visual/funcional antes de registrar a fase como totalmente validada.

## Publicação em 23/11/2026

A publicação foi autorizada e executada. Somente `20261124120000_narrative_archive` estava pendente e foi aplicada; as migrations locais de geografia/log de dados já estavam aplicadas. O Prisma foi gerado após comparar os modelos anteriores e confirmar que a estrutura existente foi preservada. O backend recebeu apenas o módulo novo, catálogo narrativo, montagem da rota e constante de evento; o restante do runtime foi preservado. O frontend foi compilado em diretório separado, mantendo as frentes visuais já ativas, e o serviço `rpg.service` foi reiniciado. Não houve `db push`, seed nem criação de fixtures na campanha. Consultas de produção confirmaram as cinco tabelas, registro da migration concluído, rotas sem autenticação respondendo 401, bundle servido idêntico ao publicado e health check saudável. Aceite manual continua pendente.

## Resultados técnicos desta entrega

Validação em árvore isolada contendo exatamente o staging, sem os demais WIPs. Node v22.23.4, Linux x64; Chromium headless, viewport desktop 1440×1050 e celular 390×844.

- Integração real HTTP/PostgreSQL: **53 verificações** aprovadas; schema descartável criado/removido e digest de todos os dados `public` idêntico antes/depois.
- Câmera/ancoragem: **16 verificações puras** aprovadas.
- Browser real com API simulada: pan/zoom sem escrita, arraste e resize em zoom baixo/alto, conexão por arraste, Escape, seleção de relação, criação, recarga, falha 503/retry e ausência de overflow no celular aprovados. ID de operação usa o helper existente, incluindo HTTP local.
- `typecheck` e `build` de backend/frontend aprovados. Build frontend conserva o aviso de bundle grande já existente no projeto; não é erro de compilação.
- Regressões: `test:operation-id`, `test:combat-ui` e `test:scene-map` aprovados; o último executou 38 verificações. Não foi usado o smoke legado da campanha.

Amostra prática única com API simulada, incluindo recarga/renderização e 12 quadros de animação durante zoom:

| Cards / relações | Recarga até cards renderizados | Maior intervalo observado entre frames |
| --- | --- | --- |
| 50 / 49 | 179 ms | 16,8 ms |
| 100 / 99 | 278 ms | 33,3 ms |
| 200 / 199 | 440 ms | 33,3 ms |

Esses tempos são observações locais da fixture, não SLA, benchmark de rede/servidor ou promessa de FPS. Não houve requisições de escrita durante pan/zoom. Textos curtos de teste não representam o pior caso de conteúdo máximo.

Falhas encontradas durante o desenvolvimento foram investigadas e corrigidas: serialização do tipo `void` no advisory lock; preparo do enum de usuários no schema descartável; ID de operação em contexto HTTP; nomes acessíveis dos seletores; competição de portas com alças de cards adjacentes; restauração de câmera ao alternar quadros. Ajustes de fixture separaram os cards para selecionar linhas não ocluídas. Nenhuma falha nova foi classificada como flake. Não há aceite manual do responsável nem teste de sessão real nesta etapa.

## Superfície integral e radial contextual

O Fichário ocupa toda a área disponível abaixo do cabeçalho e das abas, sem moldura de container nem rolagem da página. As regras de tela cheia são condicionais à presença de `.archive-page`; as outras abas mantêm seu layout. Um dock flutuante persistente na base reúne seleção/gestão de quadros, novo card, biblioteca, zoom, enquadramento e estado de salvamento, com espaço para os atalhos laterais existentes.

Botão direito no fundo abre a criação na posição clicada, convertida pela câmera em coordenadas do quadro. As categorias são agrupadas em Lugares, Pessoas, Histórias, Pistas e Recursos, além da Anotação direta. Escolher uma categoria abre o editor de conteúdo. Botão direito em um card abre edição, novo card, remoção do quadro e exclusão definitiva; a confirmação destrutiva permanece obrigatória. Relações também têm radial de ações. O botão de engrenagem do card, o acesso inferior e Shift+F10/tecla de contexto oferecem alternativas para toque e teclado.

O componente reutilizado é `SceneEditorRadialMenu`, com os mesmos setores, transições, realce por ponteiro, navegação por setas, Escape e movimento reduzido. A única extensão no componente compartilhado é um rótulo acessível opcional para o botão central; os consumidores de cenas mantêm os textos e comportamentos anteriores. Não foi copiado um motor de menus nem alterado o backend.

Validação desta revisão: typecheck/build do frontend; 38 verificações do editor unificado; 16 verificações de câmera; Chromium real com API simulada para ocupação da área útil, dock em desktop/celular, radial por botão direito, submenus, edição, criação na coordenada do clique com câmera aplicada, persistência/retry e gestos anteriores. A aprovação manual continua pendente.

### Refinamento do arraste e das abas

A geometria local permanece visível até o grafo confirmado ser aplicado, evitando
recuo momentâneo ao salvar arraste ou redimensionamento. A seleção desses cards
permanece ativa. As abas superiores se sobrepõem ao quadro sem fundo, preservando
a tipografia, os botões e a linha dourada. O teste de navegador cobre também
recarregamento com resposta atrasada, além de desktop e celular, com API simulada.

## Fase 8.5.1.1 — integração visual dos ícones (24/11/2026)

O responsável informou no pedido desta fase que a fundação 8.5.1 foi aprovada
manualmente. Este refinamento visual aguarda sua própria aprovação manual;
não foi publicado nem exige restart, migration ou alteração da API.

Auditoria: HEAD inicial `a75b463b2fdb6b0b141e0e0da2c3b05d2afcd4eb`, branch
`main`, sincronizada com `origin/main`, staging inicialmente vazio. As 41
alterações rastreadas preexistentes e os arquivos não rastreados de inventário,
cenas, botões flutuantes, música e migrations de geografia/log foram preservados.
Nenhum deles integra o commit desta fase.

As 16 categorias do catálogo correspondem exatamente às 16 artes do ZIP.
O mapeamento tipado está centralizado em `ArchiveCategoryIcon.tsx` e os PNGs
ficam em `client/public/archive/icons/`, sem duplicatas ou recompressão:

| Categoria estrutural | Arte |
|---|---|
| region — Região | regiao.png |
| locality — Localidade | localidade.png |
| dungeon — Masmorra | masmorra.png |
| room — Sala | sala.png |
| npc — NPC | npc.png |
| creature — Criatura | criatura.png |
| item — Item | item.png |
| faction — Facção | faccao.png |
| event — Acontecimento | acontecimento.png |
| scene — Cena | cena.png |
| encounter — Encontro | encontro.png |
| trap — Armadilha | armadilha.png |
| clue — Pista | pista.png |
| sound — Efeito sonoro | efeito-sonoro.png |
| image — Imagem | imagem.png |
| note — Anotação | anotacao.png |

Todos os arquivos são PNG RGBA 256 × 256, com bytes idênticos aos fornecidos.
Os cabeçalhos usam 44 × 44 px; cards compactos (largura inferior a 230 px ou
altura inferior a 160 px) usam 36 × 36 px. `object-fit: contain`, largura fixa no
flex e a transformação única do quadro mantêm a proporção durante zoom e resize.
O símbolo não recebe caixa independente, recoloração, recorte nem animação
contínua. Sombra de contato discreta o integra ao cabeçalho; a seleção continua
principalmente na moldura, com luz complementar mínima no símbolo. As cores
por categoria e os demais refinamentos existentes foram preservados.

Os PNGs são decorativos, pois categoria e título permanecem em texto acessível.
Não interceptam eventos (`pointer-events: none`, `draggable=false`). O radial e
suas animações, os contratos, a persistência e as regras mecânicas não mudaram.

Arquivos de implementação: `ArchiveCategoryIcon.tsx`, `ArchiveCanvas.tsx`,
`archive.css` e os 16 assets. O cenário de navegador existente foi ampliado em
`client/scripts/check-archive-browser.mjs`, com API exclusivamente simulada:
quadro com todas as categorias, diferentes dimensões, títulos extensos,
transparência real dos pixels, correspondência categoria/arquivo, carregamento,
proporção, ausência de sobreposição com texto e zoom sem escrita na API.
Também passaram os cenários anteriores de pan/zoom, arraste, resize, retry,
conexões, criação, reload e celular, incluindo amostras de 50/100/200 cards.
Typecheck e build do frontend passaram; invariantes de câmera também foram
executadas. Nenhum teste utiliza dados reais da campanha.

Capturas para aceite, preservadas fora do Git:
`/root/.codex/visualizations/2026/11/08/01a1b91f-bed8-7260-a9ac-7553fb7b7adb/fichario-icones/`:

- `icones-16-categorias.png`: visão geral.
- `icones-cabecalhos.png`: cabeçalhos.
- `icones-selecionado-e-tamanhos.png`: seleção e dimensões diferentes.
- `icones-zoom-afastado.png`: visão afastada.
- `icones-aproximacao.png`: aproximação com a câmera real.

Pendências: aprovação visual manual e autorização explícita para publicação.
A próxima etapa não foi iniciada.

## Fase 8.5.1.1 — composição completa com asset pack (24/11/2026)

Estado atual: implementação concluída, aguardando aceite manual e autorização
específica para publicação. A integração anterior dos 16 ícones foi autorizada e
publicada pelo responsável antes deste novo pedido. Nenhuma Expansão Orgânica foi
iniciada.

### Auditoria e escopo

HEAD inicial `2ff8d713a01a84afbdfcfe11412f5b1a7f1d0a1e`, branch `main`,
`origin/main` coincidente, staging vazio. As 41 modificações rastreadas e os seis
grupos não rastreados preexistentes (inventário, cenas, FABs, música e migrations)
foram preservados. O commit desta fase contém apenas componentes/estilos/teste do
Fichário, assets e documentação pertinente.

Foram lidos o prompt, `LEIA-ME.txt` e `manifest.json` do ZIP, além de AGENTS,
roadmap, documentação e código atual. As 16 categorias coincidem com a tabela da
integração anterior: `region`, `locality`, `dungeon`, `room`, `npc`, `creature`,
`item`, `faction`, `event`, `scene`, `encounter`, `trap`, `clue`, `sound`, `image`,
`note`. Slugs e cores seguem o manifesto. `ArchiveCategoryIcon.tsx` centraliza
ícone, pasta, cor e variáveis dos componentes; uma categoria inesperada usa as
peças comuns e a arte de anotação, sem mudar catálogo ou contratos.

### Assets e composição

Fonte: `obsyrium-componentes-cards-16-categorias (1).zip`. A prévia de 1600 × 1120
foi inspecionada e comparada aos cards renderizados, sobretudo Facção e Encontro.
Todos os componentes são RGBA; apenas a prévia é RGB. As molduras, texturas e
divisores repetidos nas pastas têm hashes idênticos. Os ícones também são
idênticos aos já instalados, portanto não foram duplicados.

- `client/public/archive/card-parts/`: 106 PNGs únicos. São 16 conjuntos temáticos
  com cinco recortes de cabeçalho e um suporte, mais dez peças comuns (cinco
  recortes, suporte genérico, moldura, fundo, divisor e rótulo).
- Os 16 ícones existentes em `archive/icons/` são reutilizados. Peças não
  recortadas permanecem byte a byte idênticas às do ZIP.
- O plano de fundo geral do Fichário não foi alterado.

A moldura original de 497 × 318 usa `border-image` com slice **56** e largura
visual **28 px**, em pseudo-elemento absoluto sem preenchimento central e sem
alterar o box do card. Cantos mantêm a escala; apenas as faixas laterais se
expandem. Não é o PNG inteiro esticado. As nove partes separadas do ZIP não
precisam ser duplicadas no projeto porque o navegador faz o mesmo recorte.

O cabeçalho (495 × 136) usa cinco segmentos em vez de três para preservar também
a gema central, além dos cantos e do adorno direito. Cortes horizontais em
**0, 80, 230, 266, 359, 495**, mantendo os 136 px de altura. Apenas os dois miolos
sem ornamentos se expandem. A altura do cabeçalho é **78 px**, ou **74 px** nos
cards compactos; a área da arte tem 76/72 px devido ao inset de 1 px. As larguras
dos três adornos fixos seguem essa mesma razão. Recortes foram feitos sem
reamostragem e recompostos em Chromium: os 17 cabeçalhos (16 categorias + comum)
produziram pixels renderizados idênticos aos originais. A recompressão PNG sem
perdas economizou 312.135 bytes nos recortes, sem mudar o conteúdo descomprimido.

Suportes mantêm a proporção original **239:296**, com **64 × 79,26 px** nos cards
normais e **48 × 59,45 px** nos compactos. Os ícones continuam em **44 × 44** ou
**36 × 36 px**, sem filtro de recoloração nem caixa adicional. O suporte normal
avança cerca de 7 px sobre o conteúdo, com espaçamento que preserva a leitura.

A textura interna vem de `fundo.png`, em `cover` com escurecimento leve. O divisor
comum aparece uma vez no rodapé com altura fixa de 10 px, preservando a gema
central; não é repetido sobre a linha já incorporada ao cabeçalho. Em cards com
menos de 148 px de altura, esse divisor é omitido e o resumo fica em uma linha
com reticências para não interceptar o texto. Categoria, título, resumo, relações,
quantidade e controles continuam sendo texto/HTML/SVG do aplicativo.

`ArchiveRelationLabel.tsx` usa o PNG fornecido em três segmentos via
`border-image` dentro de `foreignObject`; as extremidades têm 16 px e a altura
34 px. A largura é medida a partir do texto SVG real, acrescida de 32 px de
margem. Relações personalizadas não são cortadas. A medição é compartilhada por
texto/fonte/estado de carregamento em cache limitado a 512 entradas. Direção,
caminho das linhas, hit area acessível e seleção continuam no mecanismo anterior.

Normal e hover usam moldura fosca com realce leve de opacidade. Seleção evidencia
principalmente a moldura, sem animação contínua. Os assets decorativos não recebem
ponteiro; portas, oito alças, botões e menu radial permanecem funcionais. Não houve
mudança de schema, API, persistência, autorização, realtime, versionamento,
idempotência, câmera ou regras mecânicas.

### Validação e desempenho observado

Passaram typecheck e build do frontend e as 16 verificações puras de câmera.
O build mantém o aviso existente de chunks acima de 500 kB, sem erro de compilação.
Chromium real, com API exclusivamente simulada em memória, cobriu:

- 16 categorias, PNGs e camadas decodificados, transparência e proporções;
- títulos extensos, cards de 180 × 120 até 520 × 200 e 220 × 420;
- dimensões persistidas preservadas, 9-slice de 56/28 px e fallback;
- pan/zoom, arraste, resize, seleção, conexões e atualização de suas extremidades;
- relações curtas/personalizadas, radial, botões, criação, reload, falha/retry;
- desktop/celular e quadros de 50/100/200 cards com conexões;
- ausência de novas requisições de assets durante pan, zoom, arraste e resize.

A comparação anterior usa um checkout do HEAD inicial e os mesmos gestos. Valores
pontuais de Chromium headless local, API simulada, sem promessa de FPS ou SLA:

| Cards | Render anterior/atual (ms) | Ciclo pan+arraste+resize anterior/atual (ms) | Maior intervalo de frame anterior/atual (ms) |
|---|---|---|---|
| 50 | 223 / 234 | 623 / 688 | 16,8 / 16,8 |
| 100 | 277 / 433 | 801 / 854 | 33,3 / 33,4 |
| 200 | 445 / 566 | 1186 / 1621 | 50 / 50 |

A composição aumentou o custo inicial e o ciclo automatizado de interação em
quadros extensos. Foram removidos filtros permanentes dos ícones, compartilhados
assets e medições e reduzido o rótulo para uma única superfície segmentada. O
cache natural do navegador é reutilizado. O aceite deve incluir avaliação de
fluidez no equipamento do responsável; estes números isolados não substituem
uma sessão real.

Os testes não se conectam à aplicação nem ao banco da campanha. Nenhum registro
real é usado como fixture, alterado ou restaurado.

### Capturas e publicação

Capturas preservadas em
`/root/.codex/visualizations/2026/11/08/01a1b91f-bed8-7260-a9ac-7553fb7b7adb/fichario-componentes/`:

- `componentes-16-categorias.png`: todas as categorias e dimensões variadas.
- `componentes-faccao-encontro-conexoes.png`: composição e rótulos curtos/longos.
- `componentes-detalhe.png`: moldura, cabeçalho, suporte, ícone e divisor.
- `componentes-proporcoes-livres.png`: cards mínimos, horizontais e verticais.
- `componentes-selecionado.png` e `componentes-menu-radial.png`: estados e ações.
- `componentes-16-categorias-afastado.png` e `componentes-conexoes-afastado.png`.
- `componentes-mobile.png` e `referencia-fornecida.png`.
- `validacao-atual.txt` e `comparacao-anterior.txt`: resultados observados.

Durante a validação, um build foi executado por engano no diretório ativo.
A versão aprovada anterior foi imediatamente restaurada a partir do espelho de
publicação; os 108 artefatos novos foram removidos. Comparação integral dos
arquivos, bundles HTTP `index-DNFxFHA8.js`/`index-BNg-a_mO.css`, health saudável e
PID `2042000` inalterado comprovaram a restauração. Não houve restart nem escrita
em dados. A nova composição **não permanece publicada**. A validação final foi
repetida em checkout isolado.

Pendências: aceite visual/fluidez e autorização explícita para publicação.
Não foi iniciada a próxima fase.
