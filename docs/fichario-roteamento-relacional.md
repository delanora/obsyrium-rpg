# Fichário — roteamento relacional (8.5.4.2)

Roteamento angular e determinístico das conexões do Arquivo do Mestre. Substitui
as curvas quadráticas de `archiveLinkGeometry.ts` por trajetos com segmentos
retos, diagonais preferencialmente de 45°, transições arredondadas, portas
distribuídas nas bordas, desvio de obstáculos, corredores para relações
paralelas e rótulos posicionados sobre o próprio trajeto.

Escopo estritamente de apresentação: nenhuma alteração de schema, banco, API,
DTOs, modelos de relação, versão de card/quadro ou pertencimento estrutural. A
conexão persistida continua representando apenas a relação canônica; caminhos,
pontos intermediários e encaixes não são persistidos.

## 1. Pipeline

```
snapshot autoritativo
  → projeção estrutural (archiveProjection)
  → layout espacial (archiveLayout / multinível)
  → rotas derivadas (archiveLinkRouting)
  → apresentação animada (useArchiveMotion)
  → filtragem visual (archiveFilters)
```

O roteador consome a geometria já resolvida e **não move cards**. É uma única
representação de rota, calculada em `ArchiveCanvas` com `useMemo` sobre
`archiveRouteSignature` (assinatura estável de ids, posições, tamanhos e pares
visíveis) e compartilhada com o scheduler por `routesRef`. Traço principal,
bainha, hit area, marcadores e rótulos leem o mesmo `path`.

## 2. Arquivos

| Arquivo | Papel |
| --- | --- |
| `client/src/components/archive/archiveLinkGeometry.ts` | primitivas puras: portas, conectores 45°, corredores deslocados, comandos SVG, amostragem |
| `client/src/components/archive/archiveLinkRouting.ts` | planejador determinístico: candidatos, obstáculos, custo, corredores, rótulos, orçamentos |
| `client/src/components/archive/archiveRelationMetrics.ts` | caixa do rótulo e cache de largura |
| `client/src/components/archive/ArchiveCanvas.tsx` | memo por assinatura, `data-route`, `data-route-fallback` |
| `client/src/components/archive/useArchiveMotion.ts` | interpolação a partir das rotas compartilhadas |
| `client/src/components/archive/ArchiveRelationLabel.tsx` | medição real do rótulo + cache compartilhado |
| `client/scripts/check-archive-link-routing.ts` | 28 verificações puras |
| `client/scripts/benchmark-archive-link-routing.ts` | comparação com a geometria publicada da 8.5.4.1 |

## 3. Representação de rota

`ArchiveLinkRoute` carrega origem, destino, lados, pontos, `path`, ponto do
rótulo, comprimento, corredor (`lane`), estratégia, sinalização de fallback e
diagnóstico de obstáculos residuais. `ArchiveLinkRoutePlan` acrescenta lados,
estratégia, custo, cruzamentos contados e ordem de geração (desempate estável).
`ArchiveRouteStats` publica vínculos, candidatos construídos, testes de
obstáculo, fallbacks, cruzamentos, `budgetExceeded` e `maxTests`.

Funções exportadas: `planArchiveLinkRoutes`, `archiveLinkRouteGeometry`,
`archiveLinkRoutePoints`, `archiveRouteSignature`, `archiveLinkPort`,
`angularLinkConnectors`, `offsetArchiveLinkLane`, `archiveLinkPathCommands`,
`sampleArchiveLinkPath`.

## 4. Geometria angular

Parâmetros iniciais (`ARCHIVE_LINK_GEOMETRY`): `clearance 26`, `stub 20`,
`radius 20`, `lane 36`, `portSpan 0.64`.

- cada porta projeta um trecho reto curto (stub) para fora do card;
- os stubs são ligados por segmentos horizontais, verticais ou diagonais de 45°
  (`angularLinkConnectors`);
- cantos recebem arredondamento local por quadrática curta, limitado ao
  comprimento dos segmentos vizinhos, para não inverter direção nem invadir
  obstáculos;
- o caminho final é amostrado por comprimento de arco, e as verificações de
  segurança usam o **path suavizado**, não só a polilinha intermediária.

Conexões diretas e livres são preferidas: `misalignedDirect` (320) penaliza
trajeto direto que não respeita eixos ou 45°, sem justificar desvios
desnecessários.

## 5. Portas e encaixes

Cada card expõe norte, sul, leste e oeste. Os lados candidatos vêm da posição do
destino (`archiveLinkFacingSides`), mas a escolha final considera custo total:
obstáculos, comprimento, ângulo de entrada/saída, número de inflexões e ocupação
do lado. Encaixes ficam na borda real, com margem em relação aos cantos
(`portSpan`), e múltiplas conexões do mesmo lado são distribuídas em slots
determinísticos, com desempate por id estável. Em cards muito conectados o
espaçamento degrada de forma controlada; o card nunca é deslocado ou
redimensionado. `maxBuildsPerLink` limita a exploração e evita custo inútil.

Estabilidade: a troca de porta em relação à rota anterior custa
`sideSwitch 140`, e a troca de estratégia `strategySwitch 45`, de modo que
oscilações geométricas pequenas não reorganizam todas as portas.

## 6. Obstáculos

Os retângulos dos cards são os obstáculos, com folga `clearance` (26) — distinta
da margem externa de 1120 do layout e da folga interna de 32, que não mudam.

- origem e destino são obstáculos especiais: a rota alcança as portas, mas não
  atravessa o interior;
- `segmentCrossesArchiveRect` detecta travessia de interior (peso 1e6) e
  aproximação indevida da folga (peso 900 por unidade);
- os obstáculos relevantes de cada vínculo são pré-filtrados uma única vez
  (`relevantObstacles`, caixa dos dois cards + 3× folga, no máximo 40 nós)
  em vez de varrer o plano por candidato;
- dentro do vínculo, o teste por segmento usa a caixa do segmento como
  prefiltro barato;
- desvios exploram passagens pelas bordas dos obstáculos mais próximos
  (`maxDetourObstacles 4`), sem grade global nem busca irrestrita.

## 7. Função de custo

Ordem de prioridade efetiva, do maior peso para o menor
(`ARCHIVE_ROUTE_WEIGHTS`):

| Critério | Peso |
| --- | --- |
| interior de card | 1 000 000 |
| folga violada (por unidade) | 900 |
| ocupação de porta | 70 |
| troca de lado | 140 |
| cruzamento com conexão vizinha | 140 |
| desvio | 26 |
| estratégia diagonal | 8 |
| direto desalinhado | 320 |
| comprimento (por unidade) | 0,55 |
| inflexão | 34 |
| ângulo de porta | 0,9 |
| alinhamento a eixos/45° | 12 |
| troca de estratégia | 45 |

Desempate: menor custo e, em empate exato, menor ordem de geração. Mesma entrada
e mesmo contexto produzem a mesma rota.

## 8. Corredores e relações paralelas

Relações entre o mesmo par recebem `lane` distintas: o corredor é deslocado no
eixo dominante e fechado por um degrau perpendicular no stub, preservando eixos
e 45°. Cada vínculo continua individual — nada é fundido, agrupado ou
persistido. Sentidos opostos compartilham a geometria, mas mantêm marcador,
rótulo, seleção e hit area próprios.

## 9. Rótulos

O visual vetorial da 8.5.4.1 é preservado; muda apenas a posição derivada. Os
candidatos ficam ao longo do próprio trajeto, priorizando o centro do
comprimento, trechos longos, longe de extremidades, cantos, cards, outros
rótulos e cruzamentos (`labelCard`, `labelOverlap`, `labelCrossing`,
`labelEnd`, `labelCorner`, `labelShortSegment`). Há também um deslocamento
perpendicular curto (até duas vezes meia altura da cápsula), aplicado igual no
planejador e no render, e uma segunda passada mais densa — limitada a 6 trechos,
9 posições e 5 deslocamentos — apenas quando o melhor candidato ainda cai sobre
um card. A largura vem do cache de
`ArchiveRelationLabel` (medido em eventos de atualização, nunca por frame) e a
altura é estimada. O texto permanece horizontal. Sem posição livre, escolhe-se
a menos prejudicial e o resíduo fica registrado; rótulos nunca são ocultados.

## 10. Cache e invalidação

O plano é recalculado apenas quando a assinatura muda: ids visíveis, posição e
tamanho dos cards e pares de relação. Pan, zoom, hover, seleção e mudanças de
conteúdo sem efeito geométrico não invalidam rotas. Durante arraste e resize a
rota existente é reaproveitada (adaptação local) e o recálculo completo acontece
ao final do gesto. Nenhuma nova busca de rotas ocorre em pan/zoom.

## 11. Animação

`useArchiveMotion` consome `routesRef` e interpola poses; traço, bainha, hit
area, marcadores e rótulos saem da mesma rota, sem segundo scheduler. Relações
que entram ou saem preservam opacidade, pose terminal e ausência de elementos
órfãos. Quando a topologia muda (número de segmentos incompatível), não há
interpolação cega de strings SVG: a atualização é determinística e controlada,
documentada como limitação. `reduced-motion` e os limites existentes de
animação continuam valendo.

## 12. Orçamentos e fallbacks

`ARCHIVE_LINK_ROUTING`: `maxLinks 4000`, `maxCandidatesPerLink 64`,
`maxBuildsPerLink 40`, `maxNearbyRouted 16`, `maxDetourObstacles 4`,
`maxSegmentTests 600 000`, `segmentTestsPerLink 4 000`,
`maxAbsoluteSegmentTests 6 000 000`.

O orçamento de testes é proporcional ao número de vínculos (mínimo 600 mil,
teto 6 milhões), para que quadros densos não caiam todos em fallback só por
crescerem. Esgotado o orçamento, `budgetExceeded` é registrado e os vínculos
restantes recebem rota angular determinística com portas válidas: finita, sem
travamento, selecionável, com obstáculos residuais expostos em `residual` e
`data-route-fallback`. A relação nunca é escondida e nenhum card é movido.

## 13. Benchmarks

`client/scripts/benchmark-archive-link-routing.ts` compara a geometria
publicada da 8.5.4.1 (curva quadrática) com o planejador angular, nos mesmos
quadros sintéticos (50/100/200/500 cards; topologias esparsa, densa, radial,
núcleos, paralelas, distantes), mesma quantidade de relações por cenário.
Tempos medidos em Node, sem DOM: são custo de cálculo + `path`, não FPS.

Resultados completos ficam no relatório da fase; em resumo:

Os números pertencem a commits diferentes e **não devem ser cruzados**. A
tabela anterior desta seção associou tempos do roteador angular (8.5.4.2) aos da
geometria publicada (8.5.4.1); a associação correta é:

| medição | hub 499 | distantes 995 | núcleos 995 | densa 1 000 |
| --- | --- | --- | --- | --- |
| 8.5.4.1 publicada (curva quadrática, baseline do benchmark) | 25,9 ms | 104,4 ms | 98,5 ms | 50,5 ms |
| 8.5.4.2 roteador angular inicial (`cba77a9`) | 3,9 s | 6,6 s | 2,34 s | 1,06 s |
| 8.5.4.2.1 hardening (`fd0ce85`) | 1,847 s | 5,522 s | 1,588 s | 0,60–0,77 s |
| 8.5.4.2.2/3 assíncrono (`b04e6be` + esta microfase) | 1,414 s | 5,768 s | 1,745 s | 0,567 s |

A baseline da 8.5.4.1 é **rápida porque atravessa os cards** (até 960 rótulos
sobrepostos e 574 interseções): ela é referência de custo, não de qualidade. Nas
topologias esparsa/densa/paralelas o roteador angular mantém **0 interseções** e
**0 rótulos sobrepostos**; nos núcleos distantes as interseções caem de 574 para
120 (995 vínculos). O hub único continua sendo o pior caso — portas
compartilhadas, desvio pouco viável, orçamento esgotado e fallback registrado —
e é diagnóstico, não sucesso de desvio. Contornar cards concentra trajetos em
corredores: a ausência absoluta de cruzamentos não é requisito.

## 14. Testes

- `npm run test:archive-link-routing` — 28 verificações puras: eixos, diagonais,
  quatro lados, distribuição de portas, proteção de cantos, arredondamento,
  obstáculos simples/múltiplos/alinhados, corredores estreitos, cards
  sobrepostos e quase coincidentes, paralelas, sentidos opostos, geometria
  extrema, coordenadas negativas, determinismo, orçamento, fallback,
  estabilidade de portas, cache, rótulos e preservação da geometria persistida.
- `npm run test:archive-relations-browser` — Chromium real com fixture sintética
  e API simulada; valida traço, bainha, hit area, encaixes, marcadores, rótulos,
  hover, seleção, teclado, arraste, resize, expansão, recolhimento, filtros,
  pan, zoom, reduced-motion, troca de quadro e remoção de relação.
- Suítes espaciais preservadas (layout, filtros, identidade, animação, reserva,
  projeção, multinível, câmera, background, estabilidade).

## 15. Limitações preservadas

- hub único com centenas de relações: desvio quase sempre inviável, custo maior
  e fallback frequente — registrado como diagnóstico, não como sucesso;
- cruzamentos residuais em topologias de núcleos distantes;
- transições topológicas não interpolam strings SVG;
- dívidas históricas de escala, Prisma, infraestrutura de testes e isolamento
  operacional continuam abertas.

## 16. Encerramento autorizado da 8.5.4.1

Aceite do responsável em 26/11/2026: **19/20**, não 20/20. O único item aberto
era a expectativa de abrir informações ao selecionar uma relação; a investigação
confirmou que a **seleção visual funciona** e que a abertura de informações
relacionais não fazia parte da implementação existente. O responsável autorizou
encerrar a 8.5.4.1 no escopo visual e transferir a Consulta Relacional para a
8.5.4.3.

## 17. Hardening (8.5.4.2.1)

Microfase de correção e custo sobre o roteador existente. Nada foi reescrito: a
representação de rota, as portas, a geometria angular, os corredores, os pesos e
a identidade visual permanecem.

### 17.1 Problemas confirmados e correções

| Problema | Correção |
| --- | --- |
| Diagnóstico binário (`fallback` + residual) não distinguia rota livre de rota nunca verificada | `state`: `verified-clear` / `intersects` / `unverified`, mais `fallbackReason` (`budget`, `no-corridor`), `budget` e `reused` separados |
| `evaluateRoute` devolvia residual vazio ao esgotar o orçamento (parecia rota livre) | retorno com `verified: false`; a rota nunca é classificada como livre sem verificação |
| A validação final usava só os ≤40 obstáculos do planejamento | verificação final independente do caminho **suavizado**, consultando o índice espacial completo; trechos retos testados por inteiro e arcos amostrados só onde existe obstáculo na caixa do canto (passo 4, erro < 1 unidade) |
| `plan.label` guardava apenas `segment`/`at`; o deslocamento escolhido se perdia e o render recalculava outra posição | `ArchiveRouteLabel.offset` explícito, usado na avaliação, no plano, no render e no teste de invariante |
| Distribuição posterior das portas não era revalidada | a validação final acontece **depois** da distribuição de portas, corredor e suavização |
| Orçamento cobria só testes de obstáculo | orçamento de trabalho total em unidades determinísticas: candidatos, cruzamentos, rótulos e verificação final; ao esgotar, a exploração para e o vínculo vira `unverified` com motivo |
| Planejamento global síncrono com custo alto | nível 1 com saída antecipada na primeira alternativa limpa e angularmente fiel; nível 2 só quando há obstáculo; nível 3 (fallback) com orçamento esgotado; vínculos acima de 1 800 unidades usam a estratégia simplificada, sem desvios caros |
| Toda mudança geométrica replanejava o quadro inteiro | reutilização localizada: o plano anterior é preservado quando nem as pontas nem a caixa do trajeto são alcançadas pelas alterações (`placements` do plano anterior); qualquer dúvida invalida |
| Rótulos comparados com todos os anteriores (custo quadrático) | grade espacial dos rótulos já posicionados |

### 17.2 Contrato do rótulo

O rótulo é posicionado **sobre o trajeto**: a suíte instrumentada exige distância
≤ 1,6 unidade entre a cápsula e o path real (linhas e arcos). O deslocamento
perpendicular existe no contrato (`offset`), é avaliado e aplicado no render,
mas permanece em 0 — a correção de sobreposição vem de amostragem mais densa ao
longo do próprio trajeto, não de afastar a cápsula da conexão. A segunda passada
densa (15 posições nos 6 trechos mais longos) só roda quando o melhor candidato
ainda cai sobre um card e a rota tem menos de 1 200 unidades.

### 17.3 Orçamentos

`ARCHIVE_LINK_ROUTING`: `maxWorkUnits 1 200 000`, `minWorkUnits 150 000`,
`workPerLink 900`, `unitsPerBuild 6`, `unitsPerLabelCandidate 6`,
`maxValidateChecks 900 000`, `validateStep 16`, `longLinkDistance 1 800`,
`maxBuildsPerLink 40`, `maxCandidatesPerLink 64`, `maxNearbyRouted 16`,
`maxDetourObstacles 4`.

O teto de trabalho é determinístico (unidades, nunca relógio): mesma entrada e
mesmo plano anterior produzem o mesmo resultado. Esgotado o orçamento, os
vínculos restantes recebem fallback angular e ficam `unverified` — nunca
"livres".

### 17.4 Reutilização e invalidação

`ArchiveRoutePlanSet.placements` guarda a geometria usada no plano. No ciclo
seguinte, cada vínculo é reutilizado quando: existe plano anterior verificado,
nenhum dos dois cards mudou de posição/tamanho, e a caixa do trajeto (inflada em
`clearance + labelGap + 8`) não toca nenhum retângulo alterado. Mudanças no
conjunto de vínculos (criar/remover relação) invalidam o plano inteiro de forma
conservadora.

### 17.5 Resultados medidos (Node, sem DOM)

- esparsa/densa/paralelas: 29 ms (100 vínculos) a 769 ms (1 000), todas
  `verified-clear`, zero interseções e zero rótulos sobrepostos;
- vários núcleos: 48 ms a 1 588 ms (995 vínculos), 875 verificadas e 120 com
  interseção confirmada;
- hub único: 162 ms (49), 301 ms (99), 363 ms (199) e 1 847 ms (499, com 317
  fallbacks por orçamento);
- núcleos muito distantes: 89 ms (95) a 5 522 ms (995) — o pior caso restante;
- atualizações: mover card 83 ms (114 de 120 rotas reutilizadas), redimensionar
  90 ms, criar relação 52 ms (116 reutilizadas), remover relação 55 ms (replan
  conservador), mover obstáculo 56 ms; pan e zoom não replanejam nada.

### 17.6 Limitações registradas

- O cenário de 995 vínculos atravessando o quadro inteiro ainda custa ~5,5 s: o
  trabalho é limitado, mas o custo por vínculo (cruzamentos e rótulos) segue
  alto nesse extremo; não é recomendado abrir quadros dessa escala sem
  particionamento.
- Remoção de relação invalida o plano inteiro (conservador por decisão).
- O hub único mantém fallback frequente: é limite físico de portas, não defeito
  de diagnóstico.
- `intersects` é diagnóstico, não um erro: a relação continua visível,
  selecionável e com rótulo.

## 18. Planejamento assíncrono (8.5.4.2.2)

Microfase focada em **responsividade**, não em reduzir o custo de cálculo. O
roteador puro continua sendo o único algoritmo: ele só deixou de rodar na
thread principal.

### 18.1 Arquitetura

- `archiveRoute.worker.ts` — worker de módulo (Vite) que importa
  `planArchiveLinkRoutes`; não conhece DOM, câmera, cards persistidos ou dados
  de campanha. Recebe geometria de apresentação, devolve plano serializado.
- `archiveRouteContract.ts` — contrato versionado (`ARCHIVE_ROUTE_PROTOCOL`):
  quadro (`boardId`), `requestId`, `generation`, assinatura geométrica,
  placements, vínculos, plano anterior serializável e o plano de resposta com
  diagnóstico/métricas. Arrays de pares chave-valor, nada de `Map` no
  `postMessage`. Sem `SharedArrayBuffer`.
- `archiveRoutePlanner.ts` — fila e ciclo de vida na thread principal: um
  trabalho em voo, um pendente (o mais recente substitui o anterior), descarte
  por geração/assinatura/quadro, substituição controlada do worker
  (`stallMs 4 000`, `maxRestarts 2`, `maxDiscards 8`) e falha declarada.
- `archiveRouteValidation.ts` — verificação geométrica dos comandos SVG reais.
- `ArchiveCanvas.tsx` — pede o plano quando a assinatura muda, mantém o plano
  provisório visível e aplica o resultado somente se ainda for o atual.

A thread principal continua dona de apresentação, interação, câmera, gestos,
scheduler de animação (um único `useArchiveMotion`) e da aplicação do plano.
Nenhum worker é criado por vínculo, por quadro ou por frame.

### 18.2 Resultados obsoletos

Um resultado só é aplicado quando `requestId` é o do trabalho em voo **e**
`generation`, `signature` e `boardId` coincidem com o estado atual — checado na
fila e de novo no canvas. Cobrem troca de quadro, mover/redimensionar, expandir/
recolher, remover card, remover relação, atualização de snapshot e desmontagem
(que descarta e termina o worker). Resposta atrasada nunca restaura conexão
removida nem mistura planos de quadros diferentes; cada descarte é contado em
`discarded`.

### 18.3 Primeira apresentação

Enquanto o worker trabalha, o quadro mostra `provisionalArchiveRoutePlan`:
reaproveita a **forma** do plano anterior (lados, corredor, estratégia, rótulo)
e, para vínculos novos, um caminho angular direto. Custo linear, sem consulta a
obstáculos. Toda rota provisória sai `unverified` com `fallbackReason:
"provisional"`; o viewport expõe `data-route-plan="provisional|definitive"`.
Nada é escondido, nenhum controle é bloqueado e não há indicador de carregamento.

Aplicação: se um resultado chega durante arraste/redimensionamento/conexão, ele
fica guardado e é aplicado quando o gesto termina (`flushPending`) — o traço não
muda no meio do gesto. Traço, bainha, hit area, encaixes, marcadores, rótulos,
seleção, hover e filtros continuam vindo do mesmo plano.

### 18.4 Validação geométrica dos comandos reais

`validateFinalPath` passou a validar `archiveLinkPathCommands(pontos)` — os
comandos que o SVG desenha, já arredondados em duas casas:

- `L`: teste exato de segmento contra retângulo (Liang–Barsky);
- `Q`: subdivisão de De Casteljau. Enquanto a corda do sub-arco, inflada pelo
  desvio máximo da curva à corda (`|P0 − 2C + P2| / 4`), não toca o retângulo, a
  ausência de interseção é **demonstrada** por limite geométrico, não amostrada.
  Na tolerância (0,1 unidade) o toque é reportado como interseção — falso
  positivo da ordem da tolerância, nunca falso negativo;
- subdivisão que estoura profundidade ou orçamento ⇒ **inconclusivo**, e a rota
  fica `unverified` (nunca "livre").

O índice espacial consulta só a caixa de cada comando, então a verificação
continua local mesmo com o índice completo.

### 18.5 Reutilização e portas

- `reusablePlan` devolve **cópia profunda** (`cloneRoutePlan`): a distribuição
  de portas nunca muta o plano anterior.
- Reutilizar exige: plano anterior verificado, mesma lane, mesmo texto de
  vínculo (`topology`), conjunto de vínculos inalterado (criar/remover relação
  invalida em bloco), pontas sem mudança e a caixa do trajeto **e do rótulo**
  livres das áreas alteradas.
- Rotas reutilizadas entram na ocupação e nos trajetos já fixados, mantêm o
  encaixe distribuído (`fixed`) e não são revalidadas nem reposicionadas; o
  rótulo delas entra na grade de colisão para não ser sobreposto.
- Sem certificação, invalida. A contagem de reutilizadas caiu onde a topologia
  mudou (criar/remover relação replaneja tudo) — correção antes de número.

### 18.6 Orçamento

Além de candidatos, construções, rótulos e validação final, passam a ser pagos:
construção do índice espacial, cada consulta ao índice (proporcional ao número
de obstáculos devolvidos) e os cruzamentos pelo produto real
(segmentos × segmentos). Ao esgotar, a exploração para: não se posicionam mais
rótulos, os vínculos restantes viram fallback angular `unverified` com motivo
`budget`. Continua determinístico — nada de timeout de relógio.

### 18.7 Chromium real (worker real, fixtures sintéticas)

Seis cenários, Worker de módulo servido como arquivo, entrada real do Chromium
(`page.mouse`). Long tasks ≥ 50 ms; latência medida na página (evento → próximo
frame pintado).

| cenário | plano | montagem | planejamento ocioso | interação | aplicação | envio | recepção | worker | p95 wheel/pan | relações |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 50 cards | 211 ms | 115 ms | **0** | 0 | 115 ms | 0,2 ms | 0,5 ms | 21 ms | 16,2 / 16,3 ms | 50 |
| 100 cards | 353 ms | 190 ms | **0** | 0 | 82 ms | 0,3 ms | 0,5 ms | 41 ms | 15,4 / 15,8 ms | 113 |
| 200 cards | 560 ms | 353 ms | **0** | 0 | 66 ms | 0,3 ms | 0,9 ms | 60 ms | 16,1 / 31,4 ms | 237 |
| 500 cards | 1 439 ms | 730 ms | **0** | 1 (315 ms) | 130 ms | 1,4 ms | 2,8 ms | 148 ms | 16,3 / 21,8 ms | 613 |
| 995 relações distantes | 2 585 ms | 804 ms | **0** | 4 (436 ms) | 163 ms | 2,3 ms | 3,8 ms | 1 182 ms | 16,0 / 115,2 ms | 995 |
| falha do worker | — | 188 ms | 2 (78 ms) | 4 (108 ms) | — | — | — | — | 16,2 / 30,5 ms | 113 provisórias |

Leitura: o planejador não produz nenhuma long task na thread principal; o que
aparece durante a interação é repintura dos ~1000 caminhos SVG (custo de
apresentação pré-existente), não cálculo de rota. Pan/zoom não geram pedidos;
troca de quadro no meio do plano não deixa vínculo obsoleto; ciclos de expansão/
recolhimento mantêm o SVG estável; falha do worker mantém as relações visíveis
em estado provisório, com a interface responsiva e sem planejamento síncrono.

### 18.8 Node (custo de cálculo, sem DOM)

| topologia | 50 | 100 | 200 | 500 cards |
| --- | --- | --- | --- | --- |
| esparsa | 28,6 ms | 40,0 ms | 69,2 ms | 225,8 ms (1 000 vínculos) |
| densa | 47,8 ms | 92,2 ms | 253,7 ms | 570,5 ms (1 000) |
| paralelas | 36,6 ms | 75,1 ms | 344,2 ms | — |
| núcleos | 45,6 ms | 116,4 ms | 387,8 ms | 1 750,4 ms (995) |
| distantes | 85,7 ms | 290,8 ms | 1 149,4 ms | 5 972,3 ms (995) |
| radial (hub) | 146,5 ms | 145,0 ms | 238,3 ms | 1 521,2 ms (orçamento esgotado) |

O extremo de núcleos distantes ficou ~8 % mais caro que na 8.5.4.2.1 (5 972 ms
contra 5 522 ms): a validação por comandos reais e as consultas cobradas custam
mais. É o preço da correção geométrica — e agora roda fora da thread principal.

Atualizações (60 cards / 120 vínculos): mover card 17,6 ms (114 reutilizadas),
redimensionar 22,2 ms (109), criar relação 74,6 ms (replaneja: topologia mudou),
remover relação 67,0 ms (idem), mover obstáculo 13,7 ms (106), pan/zoom 0.

### 18.9 Limitações

- Montagem inicial de 500 cards ainda custa ~730 ms de long task (613 vínculos
  criados de uma vez); é renderização, não planejamento, e não foi otimizada
  nesta microfase.
- Selecionar um vínculo em quadro com ~1000 relações custa até ~290 ms de
  re-render do SVG (pré-existente).
- Pan em quadro de 995 relações pode custar 100–440 ms por frame de repintura.
- Criar/remover relação invalida a reutilização em bloco (conservador).
- O hub único (radial) continua esgotando o orçamento e caindo em fallback: é
  limite físico de portas.
- O worker é único por canvas; não há pool. Falhas são recuperadas no máximo
  duas vezes antes de a interface ficar em modo provisório.


## 19. Hardening final da integração assíncrona (8.5.4.2.3)

Microfase de integração: a arquitetura de worker da 8.5.4.2.2 não foi refeita e
não houve nova rodada de otimização de quadros extremos.

### 19.1 Ciclo de vida do worker

- O vigia cobre a **fila inteira**: quando o prazo expira sem pendente, o voo é
  marcado como travado; um pedido que chega depois substitui o worker na hora,
  em vez de esperar outro prazo inteiro. Antes, esse pedido ficava esperando um
  worker mudo sem vigilância.
- Cada instância de worker responde pela **própria identidade**
  (`worker !== this.worker` ⇒ descarte), então resposta atrasada de worker
  substituído não toca o voo atual, mesmo reenviando o mesmo `requestId`.
- Mensagem fora do protocolo é contada por voo; na segunda, o worker é
  substituído (limite `maxInvalid`). `messageerror`, exceção de fábrica e erro do
  worker seguem o mesmo caminho de falha de transporte — o controlador nunca fica
  permanentemente ocupado.
- A substituição **recoloca o voo na fila** quando não há pendente mais novo: um
  worker trocado por estalo de protocolo não faz o quadro perder o planejamento.
- `retry()` reenvia a última geometria com `requestId`/`generation` novos (antes a
  resposta seria descartada como geração vencida). Recuperação automática só por
  mudança relevante de contexto (outro quadro); repetir o mesmo pedido não gera
  tentativas infinitas.

### 19.2 Contrato mínimo

`encodeRouteRequest` monta DTOs campo a campo: card = `id`, `cardId`, `x`, `y`,
`width`, `height`; vínculo = `id`, `sourceId`, `targetId`, `relation`, `label`,
`directed`; plano anterior idem. Nada de `...spread` de objeto recebido: título,
resumo, conteúdo, descrição ou grupos de card não atravessam a fronteira do
worker. O teste usa objetos deliberadamente sujos e compara as chaves exatas.

### 19.3 Métricas de rótulo

O worker não tem DOM nem a medição do render, então as larguras medidas vão
**explicitamente** no pedido (`labels: [texto, largura]`) e o roteador aceita
`labelWidth`, usando a mesma caixa que a cápsula apresenta. A assinatura do plano
inclui as larguras **quantizadas em 8 unidades**: oscilação de poucos pixels não
replaneja, mudança relevante (fonte carregada, texto novo) replaneja. A medição
avisa no máximo uma vez por largura nova, então não há laço
medição → planejamento → render. O offset perpendicular continua zero.

### 19.4 Validação geométrica: categorias explícitas

- `hit` — o traço entra mais de `ARCHIVE_PATH_CLEARANCE` (0,5 unidade) no
  interior de um card: vira `residual` e estado `intersects`;
- `touch` — encosta na caixa ou entra até a folga: contato de borda, porta do
  próprio vínculo e arredondamento de duas casas do path. **Não** é ausência de
  contato, e não é interseção;
- inconclusivo — orçamento ou profundidade esgotados: nunca vira
  `verified-clear`.

`verified-clear` passa a significar: nenhum comando desenhado entra mais de 0,5
unidade no interior de nenhum card próximo **e** nenhuma região ficou sem
verificação. Segmentos menores que 0,5 unidade deixaram de ser ignorados
(comprimento zero vira teste de ponto); o `inset` de 1 unidade dos segmentos
retos foi substituído pela folga única, aplicada igual a retas e arcos.

### 19.5 Integração com o canvas

- Troca de quadro limpa plano anterior **e** resultado guardado.
- A decisão de aplicar é uma regra pura (`archiveRouteApplyPolicy`): `drop` para
  assinatura/quadro antigos, `defer` durante gesto, `apply` fora dele.
- Rotas provisórias continuam `unverified`/`provisional`; o scheduler de
  animação não foi alterado e não há segundo motor.

### 19.6 Testes

- `npm run test:archive-async-routing` — **41** verificações: ciclo de vida
  (estouro sem pendente, worker mudo, resposta inválida, `messageerror`,
  resultado de worker substituído, recuperação, troca de quadro, cancelamento,
  desmontagem), DTO sem extras, larguras de rótulo, assinatura com tolerância,
  ausência de laço de medição, segmentos curtos/degenerados, curvas na borda,
  inconclusivo e aplicação durante gesto.
- Referências preservadas: 28 de roteamento puro, 17 de hardening, 53 de
  Chromium assíncrono, 143 de relações em Chromium, 221 sondas de estabilidade,
  2.357 invariantes espaciais, 802 de filtros, 7 de identidade e 51 da guarda
  operacional.
- `check-archive-radial-browser.mjs` recebeu **só infraestrutura**: dublê do
  worker injetado no fixture (via `routeWorker` da `ArchivePage`) e diagnóstico
  real de falha. Ele avança até o clique em "Editar card" na Consulta narrativa e
  a página é encerrada pelo Chromium (`Target page, context or browser has been
  closed`, sem evento `crash` nem `pageerror`); `check-archive-browser.mjs`
  falha esperando o aviso de falha simulada de salvamento e
  `check-archive-groups-browser.mjs` cai na captura de falha. As três falham
  **identicamente na árvore exportada de `b04e6be`**: são pré-existentes e não
  foram declaradas aprovadas.

### 19.7 Desempenho (sem rodada nova de otimização)

Chromium (fixtures sintéticas, worker real): 50 cards 215 ms de plano / 0 long
task do planejador; 100 → 397 ms; 200 → 570 ms; 500 → 1 448 ms; 995 distantes →
2 523 ms; falha do worker → 113 rotas provisórias, zero planejamento síncrono.
Envio 0,1–1,6 ms, recepção 0,6–5,6 ms. Node: 5,768 s em distantes 995, 1,745 s
em núcleos 995, 0,567 s em densa 1 000 e 1,414 s no hub. Atualizações: mover
card 23,0 ms (114 reutilizadas), redimensionar 20,9 ms (109), mover obstáculo
13,2 ms (106), criar relação 76,1 ms, remover 61,5 ms, pan/zoom 0. O custo extra
da folga única e do contato de borda é de poucos milissegundos.

### 19.8 Limitações preservadas

Montagem inicial de 500 cards, repintura de centenas de relações, seleção em
quadros com ~1 000 vínculos, hubs extremamente conectados e custo computacional
do planejamento distante continuam dívidas do hardening geral do Fichário. As
três suítes Chromium históricas seguem falhando por infraestrutura do host.
Nada foi publicado nesta microfase e a 8.5.4.3 não foi iniciada.
