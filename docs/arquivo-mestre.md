# Arquivo do Mestre — Fase 8.5.1

Fundação narrativa privada, acessível pelo card **Fichário do Mestre** no Salão e pela aba Fichário. Implementação técnica em validação; aceite manual e publicação com migration/reinício dependem de autorização. Nenhuma regra mecânica foi modificada.

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

## Publicação pendente

Esta etapa contém backend e migration. O site ativo não foi alterado: obter autorização para aplicar **somente** `20261124120000_narrative_archive`, gerar o Prisma, publicar os builds e reiniciar o serviço. Não executar migrations não rastreadas de terceiros por consequência desta entrega. Revisar antes as migrations aplicadas/pendentes e preservar o runtime das outras frentes locais. Não usar `db push` nem seed.

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
