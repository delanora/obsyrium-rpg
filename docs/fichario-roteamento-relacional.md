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

