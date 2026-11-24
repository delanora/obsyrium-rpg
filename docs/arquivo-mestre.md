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

## Fase 8.5.2.1 — fundação de expansão e recolhimento (24/11/2026)

**Estado:** implementada, testada em isolamento e publicada com autorização do
responsável em 24/11/2026. Migration aplicada e backend reiniciado; aceite manual
da microfase permanece pendente. A fundação 8.5.1 foi informada pelo responsável como aprovada em
13/13 critérios; a composição visual do commit `05a5916` foi aprovada e publicada
antes deste pedido. Essa aparência foi preservada.

### Estado inicial e auditoria

HEAD inicial e `origin/main`: `05a5916bab727166925bed0d8ef642c5ca85a011`;
branch `main`; staging inicialmente vazio. Foram encontrados 41 arquivos
rastreados modificados e seis grupos não rastreados, relativos a combate,
inventário, geografia/cenas, música, FABs, log e migrations anteriores. Todos
foram preservados. O schema foi incluído seletivamente como **HEAD + extensão de
NarrativePlacement**, sem incorporar alterações alheias.

O código confirmou os cinco modelos da fundação, operações HTTP privadas,
versionamento e recibos transacionais, invalidação `archive:updated` exclusiva
do Mestre, canvas com geometria visual separada, câmera e o radial compartilhado
`SceneEditorRadialMenu`. Não havia pertencimento nem expansão implementados.
Nenhum componente do radial ou seus contratos/animações foi reconstruído.

### Decisão de modelo e compatibilidade

`NarrativePlacement.parentPlacementId` é um campo opcional para o núcleo pai
**da representação naquele quadro**, sem mudar o conteúdo global de
`NarrativeCard`. Um campo escalar permite no máximo um pai direto. A migration
aditiva `20261124150000_narrative_branches` contém:

- Coluna nullable, sem atribuição retroativa de pais.
- Chave única `(boardId, id)` e índice `(boardId, parentPlacementId)`.
- FK composta `(boardId, parentPlacementId)` para a representação do mesmo quadro.
- CHECK que rejeita a própria representação como pai.

Ciclos entre representações são rejeitados no serviço, dentro da mesma transação
serializada das operações existentes. Não se infere estrutura a partir de
categoria, texto ou relação `Contém`. Raízes antigas continuam independentes.
O teste aplica a migration a uma fixture do schema anterior e comprova que todos
os campos antigos permanecem idênticos e o novo pertencimento é `null`.

O DTO acrescenta `parentPlacementId`; a propriedade é opcional no tipo público
para tolerar snapshots/clientes anteriores. O servidor novo a devolve como
string ou `null`.

### Contratos e operações

A rota permanece `POST /api/archive/operations`; não foram criados writes por
socket nem outro motor de persistência.

| Operação | Extensão |
|---|---|
| `card.create` | Aceita `parentPlacementId` opcional e cria conteúdo, representação, pertencimento e relação opcional atomicamente. |
| `placement.add` | Aceita os mesmos campos opcionais para reutilizar um card de outro contexto sem duplicar seu conteúdo. |
| `placement.parent` | Nova operação: `boardId`, `placementId`, `parentPlacementId` string/null, `expectedVersion`, `operationId` e relação opcional. `null` devolve independência. |

`branchRelation`, quando solicitado explicitamente, contém `relation`, `label`,
`directed` e `description`. A identidade canônica das relações foi centralizada
em `narrativeLinkData`, compartilhada com o fluxo de relações livres. Uma relação
igual existente é reutilizada com o mesmo ID, descrição e versão. Sem esse campo,
a associação estrutural não cria relação narrativa. Remover pertencimento não
apaga nem modifica relações.

As operações validam autorização MASTER, UUIDs, quadro, existência, pai único,
autorreferência e ciclos; reutilizam CAS da versão do quadro, advisory lock,
fingerprint e recibos `NarrativeOperation`. Repetir uma associação com nova chave
é rejeitado; repetir a mesma operação retorna replay sem nova escrita/evento.
Para trocar de pai, é preciso remover o pertencimento atual antes de associar o
novo. O cliente omite candidatos já parentados, o próprio núcleo e seus ancestrais;
o servidor mantém a validação autoritativa independentemente disso.

### Política de remoção e exclusão

- Recolher: somente preferência visual local, sem excluir nada.
- Desvincular estruturalmente: torna a representação independente, preservando
  geometria, conteúdo e todas as relações narrativas.
- Remover representação do núcleo: promove os filhos **diretos** a independentes
  na mesma transação, sem alterar filhos de outros quadros nem apagar conteúdo.
- Excluir o card global: promove filhos diretos de suas representações em todos
  os quadros antes da exclusão. Apenas relações/representações do registro
  efetivamente excluído seguem os cascades já existentes.
- Excluir quadro: remove suas representações conforme o contrato anterior,
  preservando conteúdo global. A FK estrutural não impede esse cascade; testado.

Não existe exclusão recursiva de cidades, masmorras ou descendentes narrativos.
As confirmações destrutivas informam a promoção dos filhos.

### Estado local e projeção única

`archiveProjection.ts` contém `projectArchive`, função pura que deriva:

- Representações visíveis, descendentes ocultos e núcleo visível responsável.
- Filhos diretos, estado de expansão e contagem estrutural de cada núcleo.
- Total de relações narrativas diretas e quantidade de vínculos temporariamente
  ocultos, apresentados como indicadores diferentes.
- Conexões desenháveis apenas quando ambas as extremidades estão visíveis.

Não há cópia autoritativa do grafo. As representações e relações originais não
são mutadas pela projeção. O percurso estrutural é iterativo e protegido contra
referências inválidas/ciclos; snapshots inválidos não causam loop infinito. A
mesma projeção alimenta renderização, seleção, portas/hit testing e enquadramento.

O estado aberto/recolhido fica em memória **nesta instância do Fichário**, por
quadro e ID de representação. Trocar quadros preserva as escolhas enquanto o
componente permanece montado. Recarregar a página, fechar o Fichário ou abrir
outra janela começa recolhido: raízes visíveis, descendentes ocultos. IDs removidos
são descartados ao reconciliar snapshots; preferências ainda válidas são mantidas.
Expandir um ancestral respeita o estado local de descendentes, sem controles
avançados nem animações multinível.

Expandir/recolher não faz HTTP, não escreve no banco, não emite realtime e não
muda pan/zoom. Uma criação/associação intencional abre localmente o núcleo para
mostrar o resultado. Demais janelas mantêm suas preferências visuais próprias.

Ao ocultar uma representação selecionada, a seleção passa ao núcleo visível.
Menus sem alvo visível são encerrados. Gestos sobre representações removidas da
projeção são cancelados antes da pintura; controles de cards ocultos não são
renderizados. O desmontar do canvas também encerra o gesto e a captura.

A invalidação privada existente continua usada somente para alterações
persistentes. Janelas ociosas recarregam e reconciliam a projeção. Durante edição,
salvamento, gesto ou radial, a atualização externa é sinalizada e o fluxo
existente de conflito/recarregamento preserva o rascunho. A versão no servidor
impede sobrescrita de estrutura alterada em outra janela.

### Geometria e fronteira para 8.5.2.2

A fonte de verdade continua sendo `NarrativePlacement.x/y/width/height/zIndex`.
A projeção entrega os registros sem reescrevê-los. `ArchiveCanvas.visual` continua
como fronteira separada para geometria renderizada/overrides de interação; a
câmera continua sendo outra transformação independente. A próxima microfase
poderá introduzir offsets temporários nessa fronteira, sem gravar a distribuição
no banco nem alterar o conteúdo narrativo.

Expandir não move o núcleo, descendentes existentes ou vizinhos. Novas
representações filhas usam posicionamento simples e determinístico à direita do
pai, escalonado pela quantidade de filhos diretos e limitado às coordenadas
válidas. Representações já presentes mantêm integralmente sua geometria.
Enquadrar usa somente os cards atualmente visíveis. Conexões usam os limites
renderizados existentes e reaparecem com os mesmos IDs, tipos e direções.

**Limitação intencional:** pode haver sobreposição ou cards fora da câmera ao
revelar posições persistidas/criar filhos. Não há distribuição radial, colisões,
ondas, deslocamento de vizinhos, timers ou física nesta microfase.

### Interface e aparência

O radial de cards ganhou um submenu `Ramificações`: criar, associar, expandir ou
recolher quando houver filhos e desvincular quando houver pai. O botão `+ N`/`− N`
do rodapé é discreto, intencional e tem nome acessível/estado expandido; hover só
realça. Cards sem filhos não exibem comando de expansão enganoso. `↗ N` indica
vínculos ocultos, sem desenhar relações indiretas artificiais. Em cards mínimos,
o texto de relações pode usar reticências para os controles caberem na moldura.

Formulários de criação/associação permitem registrar/reutilizar uma relação
narrativa opcional, inclusive personalizada e não direcional. Molduras, assets,
texturas, suporte/ícones, rótulos, plano de fundo, tipografia e cores existentes
permaneceram. Nenhum asset novo foi gerado. Nenhum motor mecânico foi alterado.

### Validação executada

Tudo foi validado em checkout isolado de **HEAD + esta tarefa**, com Prisma Client
gerado fora da instalação ativa. Passaram:

- Typecheck backend e frontend.
- Build backend e frontend; permanece o aviso de bundle grande já existente.
- **121 verificações HTTP/PostgreSQL** em schema `test_archive_exp_<uuid>` novo:
  compatibilidade legada, referências, criação atômica e rollback, associação,
  remoção de pertencimento, ciclos, FK/check, pai único, contextos, persistência,
  autorização, CAS/concorrência, replay/fingerprint, relações canônicas e promoção
  de filhos nas exclusões.
- **25 invariantes puras** de visibilidade, relações circulares, hierarquia,
  snapshots inválidos, não duplicação, isolamento entre quadros e não mutação de
  posições/dimensões/IDs/direções após 100 ciclos visuais.
- **16 verificações puras de câmera** já existentes.
- Chromium real, **API simulada**, com o cenário Valdoria/Taverna/Mercado/Guarda/
  Templo/Caverna/Salão/Armadilha/Guardião/Dragão: estado inicial, expansão separada,
  recolhimento, dragão independente, links externos reaparecendo com seus IDs,
  seleção transferida, controles ocultos ausentes, zero HTTP/escritas por expansão,
  câmera e snapshot persistido invariantes, criação pelo radial, associação,
  remoção estrutural, reload e atualização externa. Também núcleo de 180 × 120,
  troca de quadros, 16 categorias, arraste/resize, conexão, retry e celular.

Os testes de banco criam schema e atores próprios, verificam `current_schema`
tanto no cliente de preparação quanto no Prisma usado pela aplicação HTTP,
recusam `public` como alvo e removem somente o schema que acabaram de criar.
Hash dos dados reais em `public`: **ANTES = DEPOIS**; cleanup confirmado. O browser
não se conecta à aplicação da campanha. Não houve smoke legado contra produção.

Falhas encontradas foram investigadas: o primeiro checkout de validação incluía
schema de geografia WIP sem seus serviços correspondentes, corrigido isolando
somente a mudança narrativa; a fixture de migration usava `SELECT *` preparado
antes/depois de adicionar coluna, corrigido com seleção explícita de colunas na
segunda consulta; nomes acessíveis de seletores foram ajustados no componente
novo e no teste. Não foram classificadas como flakes nem ignoradas.

Amostra local da projeção pura (1000 projeções alternando recolhido/expandido):
50 cards **45,50 ms**, 100 cards **40,07 ms**, 200 cards **76,71 ms** no total.
Diferenças de aquecimento/JIT impedem inferir uma escala linear desses números.
Amostras headless de renderização/gestos de 50/100/200 cards estão nas evidências.
São observações locais, sem garantia de FPS ou desempenho em produção.

### Evidências e continuidade

Capturas e logs:
`/root/.codex/visualizations/2026/11/08/01a1b91f-bed8-7260-a9ac-7553fb7b7adb/fichario-expansao/`.

- `expansao-inicial-recolhido.png`
- `expansao-cidade.png`
- `expansao-cidade-masmorra.png`
- `expansao-recolhida-vinculos-preservados.png`
- `expansao-estrutura-apos-reload.png`
- `expansao-nucleo-compacto.png`
- `navegador.txt`, `projecao.txt`, `camera.txt`

Checklist manual: criar núcleo e dois filhos; associar independente já presente e
um card de outro quadro; alternar expansão e confirmar que um card apenas
relacionado continua visível; verificar links externos/seleção; abrir outra janela
com estado visual diferente; remover pertencimento e núcleo; conferir a geometria
original; avaliar badge/controles em cards pequenos.

Antes da publicação será necessário autorizar a migration aditiva, gerar o Prisma
Client compatível, publicar os builds e reiniciar o backend. Essas operações não
foram executadas no serviço ativo. Revisar o estado das migrations anteriores e
preservar os WIPs no procedimento de publicação.

Próximas microfases, **não iniciadas**: 8.5.2.2 distribuição radial/colisões;
8.5.2.3 ondas/animações; 8.5.2.4 experiência multinível avançada/hardening.
A fase 8.5.2 inteira não está concluída.


### Publicação autorizada da 8.5.2.1 — 24/11/2026

O responsável autorizou a publicação do commit `ddb5e7c`. Foi conferido o histórico
com checksums das migrations anteriores: somente
`20261124150000_narrative_branches` estava pendente e foi aplicada por
`prisma migrate deploy`. O status final é atualizado, com 88 migrations
conhecidas. O Prisma ativo foi comparado semanticamente com o schema antes de
ser gerado: apenas `NarrativePlacement` mudou; os modelos das demais frentes
foram preservados.

O backend foi reconstruído em checkout isolado e recebeu somente os módulos
`archive.service.js` e `archive.schema.js`, com seus source maps. O frontend foi
reconstruído no espelho de publicação que preserva as frentes visuais já ativas.
Após a migration e a geração do Prisma, `rpg.service` foi reiniciado uma vez:
PID `2042000` → `2341486`. Health check saudável, banco disponível e estado ativo.
Os módulos backend servidos são idênticos ao build validado. Bundles publicados:
`index-BO20P-2O.js` e `index-CX9JPIDF.css`, conferidos byte a byte via HTTP.
A rota privada `/api/archive/boards` sem token continua retornando 401.

A verificação operacional detectou edições concorrentes durante a publicação:
10 novas operações narrativas, dois cards, duas representações e uma relação
foram registrados após a leitura inicial. Por isso o digest narrativo de produção
não permaneceu igual. Nenhum snapshot de dados foi restaurado e nenhuma edição
foi removida. A migration é exclusivamente DDL; imediatamente após sua aplicação,
antes de ativar os novos controles, todas as representações ainda tinham pai
`null`. Isso não altera o resultado **ANTES = DEPOIS** dos testes isolados
registrados acima, que foram executados antes da publicação.

Não houve seed, `db push`, fixture mutável na campanha ou publicação das demais
alterações backend WIP. Artefatos anteriores foram guardados em
`/tmp/expansao-publicacao-backup/`. A migração é compatível com o código anterior;
um eventual rollback de artefatos não deve remover a coluna nem apagar relações.
As microfases 8.5.2.2–4 continuam planejadas e não iniciadas.

## Fase 8.5.2.2 — distribuição radial e colisões — 24/11/2026

### Estado auditado e escopo

HEAD inicial e `origin/main`: `feae51c043f21d94615a0c3d4286a92e38735812`,
branch `main`. A implementação da 8.5.2.1 é `ddb5e7c742b241663b18b545f095610d29549e8e`;
sua publicação foi registrada por `feae51c`, ambos conferidos no remoto.
A migration `20261124150000_narrative_branches` está aplicada (ledger consultado
somente para leitura, término em 24/11/2026 11:48:32 UTC). O responsável informa
aceite manual de **13/13 da 8.5.2.1**, substituindo a pendência histórica acima.

Foram preservados 41 arquivos rastreados com WIPs e seis grupos não rastreados:
combate/preparação, inventário, geografia/criaturas, música, busca/log de dados,
modelos e migrations de outras frentes. Nenhum integra esta entrega.
Não há mudança de backend, banco, dependência, asset, estética, regra de jogo ou
animação. Os builds desta fase foram executados em `/tmp/radial-validacao`;
`client/dist`, Prisma e serviço ativos não foram alterados. **Não publicado.**

### Arquitetura e decisões

O pipeline é **snapshot persistido → projectArchive (visibilidade) → layoutArchive
(geometria temporária) → override do gesto → câmera**. Reutiliza os contratos
estruturais, seleção, menu radial, operações/CAS e o lifecycle de confirmação da
fase anterior. Não existe segundo caminho de escrita.

O novo `archiveLayout.ts` é puro, sem DOM, câmera, relógio ou HTTP. Ordena núcleos
por profundidade estrutural/ID e filhos por ângulo persistido/ID. Usa dimensões
reais, folga de 32 unidades e anéis adaptativos (capacidade inicial oito, mais
quatro por anel). Preserva direções significativas; filhos inicialmente
coincidentes recebem espaçamento angular equilibrado. Avalia posições em até
24 direções e 12 expansões de raio. Núcleos ativos são obstáculos fixos.

Abrir um núcleo captura sua posição **visual atual** como âncora local, inclusive
se outro núcleo já o deslocou. Essa restrição permanece enquanto ele está aberto;
fechar remove sua âncora. Assim, a mesma entrada normalizada (snapshot, expansão,
âncoras) produz o mesmo resultado, mas históricos que capturam âncoras diferentes
podem produzir resultados diferentes. Não se somam offsets sucessivos. Mudança
externa da posição persistida invalida a âncora antiga. O estado é por quadro e
janela; reload inicia recolhido.

A detecção usa AABB com folga. Colisões introduzidas ou agravadas pela expansão
entram numa fila; o deslocamento busca uma saída curta com preferência para fora
do núcleo responsável. O vizinho movido propaga a verificação aos próximos.
Sobreposições preexistentes de independentes que não pioraram são preservadas;
a expansão não reorganiza globalmente o quadro. Ramos e núcleos são reservados
antes dos independentes. Prioridades e desempates são estáveis.

O cálculo termina com limites explícitos: 750.000 verificações no resolvedor,
4.000 movimentos totais, 16 por card e coordenadas entre ±1.000.000. A varredura
final dos pares é quadrática e separada desse orçamento. Não há promessa de
resolver qualquer densidade: retorna conflitos residuais, sinaliza limite atingido
e mostra contagem discreta na barra inferior quando necessário. Nenhum card é
ocultado ou excluído para resolver colisões.

A saída inclui geometria, offsets, afetados com origem/destino, núcleo responsável,
profundidade/distância e diagnósticos. `archiveLayoutTransition` compara geometrias
anterior/nova e prepara a fronteira para a 8.5.2.3; **não anima nada** nesta fase.

### Gestos, conexões e reconciliação

Cards, portas, endpoints, rótulos/seleção de conexões e Enquadrar consomem o mesmo
grafo visual, sobreposto pelo gesto ativo. Pan/zoom não recalculam o layout nem
persistem a câmera como posição de card. Abertura/recolhimento não muda a câmera.
A memoização depende da projeção/snapshot e das âncoras, não dos frames do ponteiro.
Uma atualização de snapshot ainda recalcula, mesmo se for apenas conteúdo.

Arraste explícito confirma a posição visual final escolhida pelo Mestre somente
para aquele card. Resize confirma dimensões e delta da borda sobre a origem
persistida, sem incorporar o deslocamento temporário. O início visual é capturado
no pointerdown; Escape cancela. O override permanece até ACK; retry conserva
operationId, conflito permite descartar/recarregar. Se o card é núcleo aberto,
a âncora é reconciliada com a geometria confirmada. Outros offsets não são gravados.
Fechar todas as expansões restaura exatamente a organização persistida atual,
respeitando movimentos que o Mestre confirmou explicitamente.

Arquivos: novo `archiveLayout.ts`; integração em `ArchivePage.tsx` e
`ArchiveCanvas.tsx`; novos `check-archive-layout.ts` e
`check-archive-radial-browser.mjs`; ampliação de `check-archive-browser.mjs`;
este relatório e o trecho correspondente de `roadmap.md`.

### Validação e desempenho

- Typecheck e build de backend/frontend passaram no checkout isolado. O Vite
  mantém aviso de bundle acima de 500 kB; não é comprovação de falha funcional.
- **499 verificações puras**: 0/1/2/4/8/24/48 filhos, dimensões heterogêneas,
  coordenadas negativas/extremas, coincidências, obstáculos e cadeia B→C,
  independentes distantes, múltiplos núcleos, aninhamento, limites/fallback,
  âncoras, gestos, determinismo e **100 ciclos** sem acumulação.
- Regressões anteriores: **25 invariantes de projeção e 16 de câmera** passaram.
- **121 verificações HTTP/PostgreSQL** da 8.5.2.1 passaram em schema descartável
  exclusivo, com limpeza seletiva e hash dos dados `public` **ANTES = DEPOIS**.
  A rejeição esperada de pai igual ao próprio ID aparece no log do Prisma; foi
  assertada pelo teste, não ignorada como flake.
- Chromium real com **API simulada**, sem requisições ao servidor da campanha:
  expansão/recolhimento, dois núcleos, vizinhos, restauração, gestos sobre núcleo,
  ramo e vizinho deslocado, Escape, falha503/retry, conflito409/descarte, criação,
  associação/desanexação, conexão via porta, seleção de linha, atualização externa,
  alternância de quadro, reload, enquadramento e celular passaram. O cenário de
  demonstração exige zero colisões residuais. Capturas foram inspecionadas.
- Regressão geral do Chromium: categorias/assets, radial e gestos com
  50/100/200/500 cards, três ciclos por tamanho. Instrumentação exclusiva do teste
  confirmou ausência de recálculo durante pan/zoom/frames dos gestos e uma escrita
  por confirmação. Não foram executados smokes de combate, pois não foram alterados.

Algoritmo puro em Node: cinco aquecimentos e 12 medições por cenário. Tempos locais
em ms, sem garantia de SLA/FPS. Aplicação abaixo é sobreposição de mapas puros,
**não renderização React/DOM**.

| Cards | Densidade | Mediana | p95 | Aplicação mediana | Movimentos | Residuais |
|---|---|---:|---:|---:|---:|---:|
| 50 | esparsa | 0,734 | 1,183 | 0,009 | 7 | 0 |
| 50 | extrema | 1,093 | 1,261 | 0,007 | 99 | 0 |
| 100 | esparsa | 1,280 | 1,659 | 0,014 | 26 | 0 |
| 100 | extrema | 9,348 | 10,701 | 0,016 | 655 | 6 |
| 200 | esparsa | 3,786 | 4,706 | 0,026 | 42 | 0 |
| 200 | extrema | 39,400 | 44,427 | 0,026 | 2247 | 466 |
| 500 | esparsa | 7,989 | 10,447 | 0,077 | 44 | 0 |
| 500 | extrema | 30,569 | 45,461 | 0,065 | 4000 | 23254 |

Os cenários extremos de 100/200/500 atingem limites e preservam conflitos
explicitamente. Menor tempo em 500 não significa melhor resolução: o orçamento
encerra o trabalho antes. Os cenários esparsos e a demonstração não têm residuais.

Comparação Chromium contra HEAD inicial, mesmo script, três ciclos por tamanho:

| Cards | Render inicial antes/depois (ms) | Gestos mediana antes/depois (ms) | Maior intervalo de frame antes/depois (ms) |
|---|---:|---:|---:|
| 50 | 244 / 315 | 568 / 677 | 16,7 / 16,7 |
| 100 | 360 / 419 | 928 / 1025 | 33,3 / 66,8 |
| 200 | 566 / 746 | 1619 / 1757 | 33,4 / 50,1 |
| 500 | 884 / 931 | 3175 / 3758 | 66,7 / 83,4 |

Essas durações incluem automação, eventos e renderização, têm variância e não
isolam custo do algoritmo. A rodada atual ficou mais lenta; não se afirma ganho
de FPS nem equivalência de desempenho. O contador confirma que o resolvedor não
roda nos frames medidos dos gestos. Cards/linhas numerosos continuam caros no DOM.
No cenário radial com gravação, evento→segundo rAF variou de 62,9 a 116,9 ms;
o cálculo puro instrumentado do cenário ficou em torno de 0–0,6 ms. Não confundir
essas métricas nem extrapolar o resultado local para dispositivos dos jogadores.

Durante a validação, o teste de endpoints precisou tolerar 0,01 unidade do quadro:
o CSSOM serializa pixels com arredondamento (diferença observada de 0,00045).
As invariantes puras continuam exatas. O helper de clique radial foi corrigido para
usar a mesma ordem angular do componente existente. A aritmética de resize foi
agrupada como origem + (final − início), preservando decimais quando o delta é zero.
Nenhuma falha nova foi classificada como flake; testes anteriores foram mantidos.

### Evidências, aceite e próxima fase

Evidências locais em
`/root/.codex/visualizations/2026/11/08/01a1b91f-bed8-7260-a9ac-7553fb7b7adb/fichario-radial/`:
organização global, recolhido, expandido com vizinhos, dois núcleos, somente facção,
restaurado, gestos, conexão selecionada, enquadramento e celular; logs de testes,
comparação antes/depois e gravação real WebM completa + `demonstracao.webm` (14s).
São fixtures simuladas; não representam edição/aceite manual da campanha real.

Checklist manual: expandir Templo/filhos e observar vizinhos; abrir segundo núcleo;
recolher um sem mover o outro; recolher ambos; mover/redimensionar um vizinho;
verificar portas/linhas e Enquadrar; alternar quadro; reload; avaliar legibilidade e
comportamento em região densa. Testar em hardware/browser do responsável antes de
aprovar a experiência. Risco principal: conflitos residuais e custo DOM em áreas
densas. A solução é limitada e observável, não um empacotador global ótimo.

Entrega em um commit isolado em `main`, com push sem force e conferência do SHA
remoto; o SHA final consta no relatório da entrega (não autorreferenciar o commit
neste documento). WIPs anteriores devem permanecer fora do staging.
**Aguarda aprovação manual; sem deploy, restart ou migration nesta fase.**
8.5.2.3/4 não foram iniciadas. Para a 8.5.2.3, consumir os snapshots da transição,
animando somente a projeção temporária, sem alterar autoridade/persistência e sem
inserir o resolvedor no loop de frames.

### Publicação controlada da 8.5.2.2 — 24/11/2026

Autorizada pelo responsável exclusivamente para o frontend, após análise.
Commit funcional publicado: **`2bcfcd14e960ede5ac0d164ae84b0a14258cdd1f`**, branch
`main`, push e igualdade com `origin/main` confirmados antes da publicação.
O commit contém somente três módulos frontend, três scripts de teste frontend e
documentação/roadmap: **nenhum backend, schema Prisma ou migration** desta entrega.
Os 47 arquivos/grupos WIP existentes foram registrados por SHA-256 e conferidos
intactos após a publicação; nada foi incorporado ou descartado.

Build executado somente em `/tmp/radial-publicacao/client`, um novo espelho isolado
da fonte anteriormente publicada. Antes da atualização, o build desse espelho
reproduziu byte a byte o HTML e todos os arquivos por ele referenciados em produção.
Quatro bundles históricos extras, não referenciados, estavam no diretório ativo;
não foram removidos. Depois foram sobrepostos somente `ArchivePage.tsx`,
`ArchiveCanvas.tsx` e `archiveLayout.ts` do commit autorizado. Isso preserva as
outras frentes frontend já publicadas, mesmo quando ainda são WIPs no checkout.
O espelho reutilizável de publicação também foi atualizado para a próxima operação.

Backup completo dos artefatos anteriores:
`/tmp/radial-publicacao/rollback-client-dist/`. Manifests, builds e evidências:
`/tmp/radial-publicacao/`. A publicação copiou assets antes de trocar o HTML por
rename atômico, sem apagar bundles antigos. Para rollback, restaurar os arquivos
desse backup e trocar o HTML por último; não alterar banco ou serviço.

Artefatos principais publicados:

- JavaScript: **`/assets/index-DvzluyZM.js`**.
- CSS: **`/assets/index-CX9JPIDF.css`**, idêntico ao CSS anterior.
- `index.html` referencia o novo JavaScript e o mesmo CSS.
- 338 arquivos do build conferidos localmente por SHA-256; HTML e ambos os bundles
  também baixados por HTTP e comparados byte a byte com o build isolado.

Verificações pós-publicação:

- Frontend disponível por HTTP; Chromium real carregou o login de produção,
  encontrou os campos esperados e não registrou `pageerror` ou `requestfailed`.
  Nenhuma autenticação ou escrita foi feita na campanha.
- Health check: `status: ok`, `database: up`.
- `/api/archive/boards` sem token permanece 401.
- `rpg.service` ativo, PID **2341486** antes e depois; não houve restart.
- Journal do serviço desde o início da operação sem entradas, portanto sem erros
  relevantes observados nessa janela. Isso não substitui monitoramento prolongado.
- 964 arquivos de backend compilado, Prisma/schema/migrations e client gerado
  conferidos por hash, intactos. Não houve build backend, geração do Prisma,
  aplicação de migration ou alteração de dados de teste em produção.
- O teste dedicado do Chromium foi repetido sobre a fonte do espelho de publicação
  com **API simulada**, passando expansão, vizinhos, restauração, dois núcleos,
  gestos, Escape, retry/conflito, estruturas, conexões, quadros, externo e celular.
  Evidências dessa rodada: `/tmp/arquivo-radial-browser-GA2bmD/`.
  A preservação das demais funcionalidades é sustentada pela reprodução do build
  anterior e pela sobreposição restrita, não por uma sessão completa da campanha.

Pontos de atenção mantidos: **colisões residuais em densidade extrema; regressão
observada nos tempos de interação; custo DOM de cards e conexões em quadros
extensos**. As métricas e limites acima continuam válidos; a publicação não os
resolve. O build mantém aviso de bundle grande. A observação em produção foi
breve e somente de leitura; o aceite funcional pós-deploy depende do responsável.

A publicação foi registrada em commit documental separado, sem misturar WIPs.
**Aguardar validação manual. A 8.5.2.3 não foi iniciada.**
