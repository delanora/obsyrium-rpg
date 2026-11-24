# Relatório técnico — Fase 8.5.2.3

Relatório da implementação anterior à publicação, exclusivamente frontend.
**Atualização: publicação controlada concluída no frontend para o SHA `69276aef46301044acddeaa509988cf847e845f2`; aceite manual da experiência animada pendente.**
Base: `5f61d60027b151f9555914d1fb9ee4ab77c4b49a`, branch `main`.
O SHA final é o commit que adiciona este relatório; a confirmação completa é entregue na conversa.

## Escopo e limites

Animação reversível de entrada/saída e afastamento/restauração em ondas sobre o
layout existente. Geometria única para cards, curvas, rótulos e áreas de interação.
Um RAF por canvas; nenhum resolvedor, projeção ou render React a cada frame.
Fim exato no destino e preservação de preferências relativas. Ver arquitetura e
comandos em [arquivo-mestre.md](arquivo-mestre.md).

47 arquivos WIP anteriores conferidos por SHA-256 e preservados. Sem backend,
Prisma/schema/migration, geração de client, acesso ao banco, restart ou build no
diretório ativo. A textura de linho e a ausência da moldura externa foram mantidas.
Não foi iniciada a 8.5.2.4.

## Evidências e testes

- Build/typecheck frontend em `/tmp/ondas-validacao`, cópia limpa do SHA base com
  somente esta entrega sobreposta; dependências existentes reutilizadas.
- Testes puros: animação 723, layout 718, projeção 25, câmera 16 verificações.
- Animação: 110 ciclos completos e 120 inversões no relógio puro; 100 ciclos
  completos no Chromium com RAF e relógio controlado, além de ciclos em tempo real.
- Chromium: entrada/saída, inversão sem salto, sincronização SVG/rótulos,
  múltiplos núcleos, gestos, reduced-motion, atualização/remoção externa simulada,
  troca/reload. Regressões de personalização, leitor/editor, operações/retry/conflito,
  categorias, mobile e fundo/câmera executadas em harnesses com API em memória.
- Gravação WebM real e capturas de cinco estágios; inspeção de quadros extraídos
  da gravação, separada dos screenshots determinísticos. Evidências anexadas à
  entrega para inspeção e aceite manual; nenhum dado real foi usado como fixture.

## Benchmark antes/depois

Chromium headless, viewport 1600×1000, fixtures com N cards e N−1 relações,
três ciclos completos por cenário, execuções baseline/depois sequenciais. Baseline
em cópia limpa do SHA inicial. Layout é mediana das três expansões. React é a
mediana da soma dos tempos `actualDuration` do Profiler por intenção (seis amostras,
incluindo desmontagem das saídas). RAF P95 é a mediana dos P95 dessas intenções;
inclui montagem, renderização e frames ociosos. DOM/SVG é o P95 da função de pintura,
incluindo commits iniciais/finais; não é uma medição de rasterização/GPU. Valores em
milissegundos, amostras locais, sem garantia de latência de produção.

| Cards | Denso | Layout antes→depois | React antes→depois | RAF P95 antes→depois | DOM/SVG P95 | Long tasks antes→depois |
|---:|:---:|---:|---:|---:|---:|---:|
| 50 | não | 0.9→0.8 | 30.5→48.7 | 16.8→16.72 | 0.5 | 1→1 |
| 100 | não | 0.9→1 | 58.85→86.35 | 16.8→32.15 | 0.8 | 6→9 |
| 200 | não | 1.4→2.3 | 88.95→117.45 | 16.8→25.1 | 1 | 6→7 |
| 500 | não | 6.7→6.6 | 121.1→120.75 | 33.39→41.75 | 7 | 6→6 |
| 50 | sim | 2.6→2.3 | 27.75→41.75 | 16.75→16.8 | 1.2 | 0→0 |
| 100 | sim | 11.8→11.7 | 54.95→88.15 | 16.8→40.15 | 2.4 | 6→9 |
| 200 | sim | 46.1→47 | 88.1→100.65 | 40.55→48.95 | 2 | 6→6 |
| 500 | sim | 25.9→32.8 | 123.35→120.3 | 108.32→83.36 | 6.1 | 12→11 |

Um layout por toggle; nenhum render React por frame. A expansão animada teve um
render do grafo e o recolhimento até dois (retenção/remoção das saídas). A soma de
tempo React aumentou nos cenários animados; há regressão mensurável de interação,
especialmente em 100/200 cards. Não foi classificada como flake nem ocultada.

Mais de 160 afetados ou mais de 200 visíveis consolida imediatamente o destino,
sem RAF de animação. Isso ocorreu em 200 densos e em 500 nas duas distribuições.
O maior long task observado depois foi 268 ms em 500 densos; simplificar a animação
não elimina o custo de montagem do grafo nem os limites do resolvedor existente.

## Pendências para o responsável

- Aceite visual/funcional de fluidez e das curvas nos browsers/hardware usados.
- Publicação frontend concluída; aguardar aceite manual da experiência animada.
  Registro operacional e backup em `docs/arquivo-mestre.md`, seção de publicação.
- Atenção a colisões residuais em densidade extrema, regressão medida nos tempos
  de interação e custo de renderização de cards/conexões em quadros extensos.
- Fundo: aceite anterior parcial 12/13 preservado como histórico; agora aceito
  por ora pelo responsável na autorização de publicação. Radial 15/15, relativo 13/13 e consulta 12/12 são
  aceites anteriores informados pelo responsável.
