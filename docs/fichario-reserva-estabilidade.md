# Fichário — 8.5.2.3.1: reserva externa e continuidade visual

**Publicada exclusivamente no frontend por autorização controlada**, SHA
`4c7e866832804800675c1b01f09f4962a2bd1aae`. A 8.5.2.3 recebeu aceite inicial
informado de 20/20 e foi reaberta após uso adicional. Esta entrega é hardening
pontual, aguarda novo aceite e não inicia a 8.5.2.4.

## Auditoria

HEAD inicial e origin/main: `cb755e89665d2dfd733d609d36969fa0ab55366d`, branch
`main`, staging vazio. Funcional publicado: `69276aef46301044acddeaa509988cf847e845f2`.
Conferência remota por `git ls-remote`. Nenhuma mudança posterior própria antes
da auditoria; 47 WIPs encontrados, caminhos e SHA-256 registrados em
`/tmp/reserva-validacao/wips.json`, preservados. Artefatos ativos também registrados
por hash; nenhum build no diretório publicado.

Foram revistos Canvas, Page, Reader, Background, RelationLabel, projeção, layout,
transição, motion, scheduler, curvas, overrides e confirmação das operações.
Preservados linho aceito por ora, identidade dos cards, câmera, leitor/editor,
menu radial e ausência da moldura externa. Sem dependências novas.

## Reserva externa, sem aumentar os anéis

`archiveLayout.ts` mantém os mesmos 32 de folga interna, raios, ângulos, dimensões,
ordem determinística, âncoras e vetores personalizados. Depois da distribuição
interna, constrói uma **união de retângulos locais**, um por representação visível
da estrutura, incluindo núcleo e descendentes. O pertencimento vem exclusivamente
da hierarquia de placements; relações narrativas não atribuem pertencimento.
Núcleos aninhados visíveis integram a reserva da estrutura ancestral ativa;
estruturas independentes conservam reservas próprias.

Cada retângulo recebe `ARCHIVE_LAYOUT_CONFIG.reserveMargin = 280`, separado de
`gap`. Comparadas visualmente margens 160, 280 e 360 com a mesma fixture, viewport
e câmera. 160 não oferece a largura de um card padrão; 360 afasta mais os vizinhos
sem necessidade na fixture. A margem escolhida, acrescida da folga existente,
oferece espaço para um card padrão de 280×200 em regiões compatíveis.

A união localizada foi preferida à envoltória global: um ramo personalizado
remoto reserva espaço em torno de si, sem afastar cards de todo o corredor entre
ele e o núcleo. Não há polígonos, nova engine, entidade, campo persistido,
configuração de UI ou desenho da reserva. Cada retângulo usa a dimensão real do
card; inclusão/remoção, resize, reset e reposicionamento recalculam o destino nas
mesmas intenções estruturais existentes, nunca nos frames ou a cada pointermove.

### Resolução e proteção contra piora física

O mesmo resolvedor, fila, candidatos de separação e propagação são reutilizados.
A fila resolve primeiro as colisões físicas e sua propagação; depois admite os
retângulos da reserva como obstáculos adicionais de apresentação. Testa a
extensão completa dos cards, não apenas seus centros. Não move âncoras nem ramos
protegidos; elementos distantes não afetados pela reserva/propagação ficam imóveis.
A lista de obstáculos é compartilhada por evento, evitando realocações por card.

O protótipo que aplicava reserva junto à primeira passagem agravou os resíduos
em cenários extremos: no benchmark de 500 densos, passou de 12.287 para 23.794
pares residuais. A investigação levou à prioridade física e a um veto final:
se a preferência de reserva piorar uma sobreposição não tolerada em relação à
geometria física recém-calculada, conserva-se essa geometria física. Não se executa
outro layout ou outra busca: apenas compara e descarta a tentativa temporária.
Se o orçamento já terminou na passagem física, a reserva não consome outro.

`reserveFallback` distingue `collisions` e `budget`; `reserveResiduals` registra
as invasões restantes, distinguindo decisão manual de elemento protegido.
`reserveValidationChecks` contabiliza separadamente o veto, que não propõe novos
deslocamentos. Checks/moves do resolvedor, 16 movimentos/card, 4.000 movimentos e
750.000 checks não foram ampliados. A validação é finita, restrita aos pares com
algum card alterado na tentativa; não ocorre em animações.

O veto é conservador para a composição inteira calculada: em um quadro
incompatível, uma reserva de outro núcleo pode também ficar parcial. Um tratamento
mais fino por componente é dívida para análise posterior, não um novo motor aqui.
Não se promete área livre total em densidade extrema.

### Decisão manual e restauração

Uma intenção externa explícita, confirmada pelo fluxo HTTP existente, ganha uma
exceção local às reservas dos ciclos ativos. Inclui o fim do arraste que sai da
reserva e alcança a cadeia de vizinhos: o resolvedor não disputa a posição
recém-confirmada pelo Mestre. A exceção só é válida enquanto X/Y/largura/altura
persistidos coincidirem; nenhuma preferência nova é enviada ao servidor.
Ramificações internas continuam usando seus vetores persistidos existentes.

A exceção é concedida depois do ACK e refresh válido; não confirma antecipadamente
o rascunho. Retry, conflito, idempotência, versão e cancelamento continuam no fluxo
anterior. Resize de card apenas automaticamente deslocado não cria exceção de
posição; resize de uma intenção manual já protegida atualiza sua geometria local.
Criação de ramificação não cria uma falsa exceção externa.

Recolher/abrir o núcleo limpa a exceção daquele ciclo. A memória é por quadro,
conservada ao alternar quadros nesta janela, sem transportar câmera ou overrides;
reload limpa a memória local. As posições explicitamente persistidas permanecem.
Snapshot externo com geometria diferente invalida a exceção. Recolhimento sempre
recalcula sobre o snapshot atual e as demais reservas ativas, sem restaurar um
snapshot antigo nem persistir deslocamentos automáticos.

## Piscadas: reprodução, causa e correção

Harness com Chromium real, fixture própria e sonda em **cada pintura do scheduler**,
incluindo a fronteira síncrona anterior ao commit React de remoção. Na baseline:
6.218 pinturas instrumentadas, 1.832 descontinuidades observadas — 607 retomadas
indevidas de saída e 1.225 diferenças de geometria. Durante os estágios de movimento,
foram registradas duas diferenças em card independente e seis nos descendentes ao
mover o núcleo. Contagens são observações instrumentadas; não equivalem a 1.832
frames visíveis ao usuário.

**Movimento:** a reconciliação podia pintar com a closure/refs do commit anterior
sobre uma base `left/top` que o React já havia atualizado. A assinatura não incluía
a base e as dimensões. Isso produziu as coordenadas intermediárias incompatíveis
registradas na sonda. O commit agora reconcilia o estado primeiro e só pinta após
coletar as referências do commit atual. O Canvas fornece `data-base-*`; transforms
relativos usam essa base efetivamente commitada, e a assinatura inclui base e
dimensões. A assinatura de relações inclui a origem atual do rótulo. Não mudou keys,
não há debounce, ocultação do arraste, filtro, aumento de duração ou will-change geral.

**Recolhimento:** confirmado o caminho apontado no prompt: ao concluir, o mapa final
já não continha saídas, mas os elementos ainda estavam montados. O fallback
`archivePose` os repintava em escala/opacidade normais antes da remoção React.
`completeArchiveMotion` mantém a pose terminal com opacidade zero, escala 0,3 e
`exiting: true` até o commit de remoção, inclusive em finalização imediata e na
troca para movimento reduzido. Depois, as poses sem representação montada são
podadas. Não há atraso artificial. Reversão antes da remoção parte dessa pose.

Cards e curvas/rótulos/hit areas continuam usando a mesma apresentação. Saídas
terminais mantêm opacidade zero e nenhuma interação; as relações não reaparecem.
O último override de gesto conserva prioridade até aplicar o snapshot confirmado.
O scheduler continua único, com descarte ao desmontar, sem render React, projeção
ou resolvedor por frame. Curvas, tempos e limites 160 afetados/200 visíveis mantidos.

As sondas detectam inclusive estados incorretos dentro do commit, que podem não
ser capturados pelo compositor do WebM. A gravação isoladamente não comprova a
eliminação de um frame. Comparação real antes/depois, capturas determinísticas e
inspeção de quadros consecutivos são complementares; aceite final é do responsável.

## Validação

Todos os harnesses são locais com fixtures próprias; API simulada para operações.
Sem banco real, contas/cards da campanha como fixtures, migration, Prisma, restart
ou alteração de artefatos ativos. Build/typecheck em `/tmp/reserva-validacao`.

- `check-archive-reserve.ts`: 441 verificações, incluindo 110 ciclos sem offsets,
  crescimento/remoção (dois ramos cabem sem afastamento adicional na fixture), resize,
  manual, múltiplas reservas, ramo remoto, negativos,
  limites, determinismo, veto sob saturação e finalização exata/terminal.
- Regressões puras preservadas: animação 723 (110 ciclos e 120 inversões), layout
  718, projeção 25 e câmera 16. Não foi necessário remover invariantes anteriores.
- `check-archive-stability-browser.mjs`: antes/depois sob a mesma fixture/câmera;
  100 ciclos, ACK atrasado, movimentos do núcleo/card externo, crescimento,
  dois núcleos, cancelamento por Escape/blur, saída 319/320 ms, reversão tardia,
  reduced-motion durante saída e ausência de poses órfãs. A sonda deve executar
  mais de 200 vezes; zero execução não pode produzir aprovação falsa.
- `ARCHIVE_MOTION_EVIDENCE=1 ARCHIVE_STABILITY_EVIDENCE=1` no harness radial:
  API simulada com criação de duas ramificações, manual confirmado, resize,
  retry/conflito, consulta/editor, snapshots externos, troca/reload/mobile e
  100 ciclos de animação. A continuidade é conferida antes de cada reload e ao fim,
  somando contadores no processo Node para não perder evidência ao navegar.
- Regressões gerais e fundo/câmera executadas em Chromium. Sem Firefox/WebKit
  instalados/disponíveis; não se afirma validação complementar neles.

A reserva maior deixou uma alça da fixture antiga sob o dock. O teste passou a
ajustar a câmera **antes** do gesto e manteve todas as verificações geométricas e
HTTP. Outra asserção nova encontrou a disputa de posição na cadeia externa; isso
levou à proteção explícita do movimento confirmado. Um erro de tipo do novo campo
`protected` foi corrigido antes de concluir o build. Contadores de sonda que eram
zerados no reload foram substituídos por checkpoints, sem eliminar a asserção.
Não houve falha classificada como flake.

Na candidata final, a fixture de continuidade registrou 6024 pinturas sem
descontinuidade, máximo de 12 poses (12 representações intencionais após
as criações), terminando com 5 poses e 5 elementos visíveis. A suíte
com API simulada registrou 7.426 pinturas sem descontinuidade, atravessando ACK,
retry, conflito, resize, criação e consulta. Identidade DOM conservada nos gestos
de card independente e núcleo. Duas escritas da fixture direta correspondem aos
dois arrastes confirmados; criações e demais operações do harness API são
intencionais. Reserva e animação não originam operações HTTP.

## Benchmark comparativo

Mesma fixture, viewport 1600×1000 e condições do harness, 50/100/200/500 cards,
N−1 relações, esparso/denso, três ciclos completos por cenário, baseline cb755e8
em cópia limpa e candidata em execuções sequenciais. Layout = mediana das três
expansões (CPU). React = mediana da soma `actualDuration` por intenção. RAF P95 =
mediana dos P95 por intenção, incluindo montagem/consolidação/frames ociosos;
DOM/SVG = P95 da função de pintura, não rasterização/GPU. Long tasks = total nas
seis intenções. São amostras locais, não uma garantia de latência percebida.

| Cards | Denso | Layout ms antes→depois | Afetados | Moves (inclui tentativa) | Resíduos físicos | Resíduos reserva | Reserva |
|---:|:---:|---:|---:|---:|---:|---:|---|
| 50 | não | 1→1.1 | 10→15 | 4→17 | 0→0 | 0 | aplicada |
| 100 | não | 1→1.7 | 12→21 | 6→27 | 0→0 | 0 | aplicada |
| 200 | não | 1.5→3.7 | 12→26 | 6→33 | 0→0 | 0 | aplicada |
| 500 | não | 6.6→12.3 | 12→26 | 6→33 | 0→0 | 0 | aplicada |
| 50 | sim | 2.3→3.9 | 45→49 | 240→320 | 0→0 | 0 | aplicada |
| 100 | sim | 11.2→14.3 | 95→95 | 795→922 | 74→74 | 17 | collisions |
| 200 | sim | 45.3→48.5 | 195→195 | 2123→2234 | 594→594 | 20 | collisions |
| 500 | sim | 32.2→26.7 | 481→481 | 4000→4000 | 12287→12287 | 55 | budget |

| Cards | Denso | Área envoltória afetada antes→depois | React ms | RAF P95 ms | DOM/SVG P95 ms | Long tasks | Degradação (de 6) | Durações ms |
|---:|:---:|---:|---:|---:|---:|---:|---:|---|
| 50 | não | 1931209→4282309 | 48.4→49.35 | 16.8→16.8 | 0.8 | 1→1 | 0→0 | 580 |
| 100 | não | 2612425→5527750 | 85.2→89.75 | 31.9→31.85 | 1.2 | 9→9 | 0→0 | 580 |
| 200 | não | 2612425→8018631 | 120.35→125.65 | 33.37→33.4 | 2.3 | 7→8 | 0→0 | 580 |
| 500 | não | 2612425→8018631 | 115.15→121.75 | 31.18→49.97 | 4.7 | 6→6 | 6→6 | 0 |
| 50 | sim | 7103471→9560007 | 42.6→46.8 | 16.7→16.75 | 1.8 | 1→1 | 0→0 | 505, 510 |
| 100 | sim | 11160639→11160639 | 90.95→86.2 | 33.4→40.55 | 3.5 | 9→9 | 0→0 | 505, 510 |
| 200 | sim | 27376173→27376173 | 124.3→128.65 | 65.62→89.41 | 4 | 6→9 | 6→6 | 0 |
| 500 | sim | 20758785→20758785 | 187.6→179.4 | 91.66→83.37 | 6.8 | 10→10 | 6→6 | 0 |

A área é a envoltória dos destinos afetados, em unidades² do Fichário, **não** a
área livre real nem a união exata dos retângulos da reserva. As durações são dos
planos calculados, não tempo de automação. Degradação por limites de animação e
veto da reserva são decisões distintas. Em 100/200 densos, o veto conservou os
74/594 resíduos físicos anteriores, deixando 17/20 invasões de reserva. Em 500
densos, orçamento físico esgotado: conserva os 12.287 resíduos anteriores e não
tenta a reserva (55 invasões). Nos cenários esparsos, reserva completa sem novos
resíduos; em 50 densos também foi aplicada sem resíduos.

Houve aumento de CPU de layout (p.ex. 200 esparsos: 1,5→3,7 ms; 500 esparsos:
6,6→12,3 ms), coerente com mais checks/deslocamentos e validação adicional. O veto
impediu a regressão geométrica importante do protótipo. Não se declara ganho de
FPS; permanecem custos e variação de renderização/RAF, especialmente em 100/200
e nos quadros densos. Orçamentos e limites de animação não foram aumentados.


Um layout por intenção, nenhum por frame; uma montagem do grafo na expansão e
até duas no recolhimento. As medidas de automação dos harnesses de gestos são
reportadas separadamente de CPU/RAF; as sondas verificam continuidade, não FPS.
As dívidas anteriores de interação em 100/200 cards e renderização extensa
permanecem. A primeira tentativa e a investigação de saturação não foram ocultadas.

## Arquivos, segurança e entrega

Alterados os módulos frontend de Page/Canvas, layout, motion e hook de apresentação;
RelationLabel/Reader/Background/projeção/curva foram auditados e preservados.
Adicionados testes de reserva e estabilidade; estendidos os harnesses radial e de
benchmark. Documentação pertinente atualizada, Roadmap resumido. Nenhum backend,
DTO de persistência, schema ou migration desta entrega.

SHA final, push e conferência `origin/main`/`git ls-remote` são apresentados na entrega.
Um único commit isolado; 47 WIPs preservados. Publicação realizada por autorização separada; registro operacional em
`docs/arquivo-mestre.md`. Aguardar novo aceite manual da 8.5.2.3 em hardening.

### Checklist manual e dívidas

- Comparar expansão anterior/atual: organização interna igual, margem externa maior.
- Criar ramificações aproveitando a região liberada e conferir crescimento/recolhimento.
- Mover/resize, soltar, cancelar, repetir/reverter e consultar durante a transição.
- Posicionar um card na reserva; conferir respeito ao ACK e a restauração atual.
- Conferir dois núcleos e um ramo remoto; testar hardware/browser do responsável.
- Aceitar ou ajustar futuramente a margem; não adicionar controle de UI nesta fase.
- Limites remanescentes: veto conservador para toda a composição, reservas parciais
  sob conflitos/budget, colisões físicas prévias em densidade extrema e long tasks.
- 8.5.2.4: avaliar refinamento por componente e escala sem ampliar escopo agora.
