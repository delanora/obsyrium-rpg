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

- 100 a 1 000 vínculos, topologias esparsa/densa/paralelas: **0 interseções**
  de interior de card (a 8.5.4.1 chegava a 574) e **0 rótulos sobrepostos**
  (até 960 antes), sem fallback; custo de 58 ms a 1,06 s;
- vários núcleos distantes: interseções caem de 574 para 124 e de 225 para 40,
  sem fallback; custo de 81 ms a 2,34 s (995 vínculos);
- hub único (radial) é o pior caso: as conexões partem das mesmas portas, o
  desvio é pouco viável e há fallback registrado (354 de 499) com custo de até
  3,9 s; é diagnóstico, não sucesso de desvio;
- núcleos muito distantes (995 vínculos atravessando o quadro inteiro): custo
  de 6,6 s e 437 interseções contra 449 da 8.5.4.1 — o caso em que o ganho é
  pequeno e o custo não é desprezível;
- cruzamentos residuais aumentam em quadros de núcleos distantes: contornar
  cards concentra trajetos em corredores, e a ausência absoluta de cruzamentos
  não é requisito.

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
