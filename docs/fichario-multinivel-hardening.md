# Fichário — 8.5.2.4: multinível e hardening espacial

Implementação frontend publicada controladamente em 25/11/2026. Permanece em
validação funcional/visual e de desempenho até aceite manual. Não inicia a 8.5.3.

## Auditoria da implementação (antes da publicação)

Base: `da03b801131e8f33213ecf444fc215eb52eff3fb`, main/origin/main iguais no início.
Sem alterações posteriores no HEAD inicial; staging vazio. Preservados os 47 WIPs
por caminho/SHA256, incluindo backend e schema com alterações de terceiros.
O diretório operacional não versionado `backups/` também não integra esta entrega.

Ativo: funcional `46eadd3e912a5e47e0360ad0a3dffa339196ff58`, bundle
`index-P9xB2BF_.js`, CSS `index-BwtHA_mH.css`, linho. Os 340 arquivos da composição
publicada foram conferidos por hash. Nenhum artefato ativo foi substituído.

O responsável informou neste escopo o aceite inicial 20/20 da 8.5.2.3 e o novo
aceite integral 14/14 da 8.5.2.3.1. Isso não comprova o aceite visual específico
da ampliação posterior para 1120: este permanece no próximo checklist manual.
O histórico anterior de identificação e correção das piscadas foi preservado.

Auditoria de projeção, layout/transição, motion/hook, Canvas, Page, Reader, editor
lateral, relações/rótulos e fundo; contratos atuais de criação, associação,
desvinculação, promoção, reset e movimentação consultados sem mudança de API.
Builds/testes executados em `/tmp/multinivel`, com baseline por git archive e
candidato separado. APIs Chromium inteiramente simuladas; nenhum banco utilizado.

## Expansão lógica, visibilidade e âncoras

`parentPlacementId` continua definindo pertencimento; categoria/relação narrativa
não define hierarquia. A projeção existente mantém estados lógicos por quadro e
janela. Fechar um ancestral oculta descendentes e seus vínculos, sem apagar o
estado de expansão interno. Reabrir usa o snapshot atual, não um grafo antigo.
Reload continua iniciando recolhido. Não há HTTP de expansão nem persistência nova.

Um índice iterativo de filhos/profundidades evita recontar a cadeia em cada
comparação de ordenação e em cada passo do gesto. Não há limite pequeno novo;
256 níveis foram exercitados, sem recursão JavaScript ou ciclos infinitos.

Raízes expandidas mantêm âncora absoluta validada pela posição persistida.
Núcleos aninhados capturam vetor **entre centros** relativo ao pai, nunca uma
coordenada absoluta independente. A validação inclui geometria própria e caminho
de pertencimento. Transladar/redimensionar um ancestral rebaseia o vetor; mudar a
posição própria, personalização, pertencimento ou linhagem invalida a âncora.

Âncoras relativas ocultas ficam **inativas**, conservadas na memória local enquanto
válidas; a reabertura as aplica ao pai atual. Âncoras absolutas antigas de
ramificações não são reativadas. Exclusões e snapshots podam referências inválidas.
Isso preserva a disposição estabilizada da primeira abertura sem drift posterior.

O preview do gesto transporta também descendentes automáticos, além dos manuais;
customizados continuam usando `branchOffsetX/Y`. Só o comando explícito existente
é enviado; não regrava descendentes nem persiste offsets orgânicos intermediários.
CAS, idempotência, recibos e realtime permanecem sob o backend existente.

## Reservas cooperativas e veto localizado

Preservados: folga 32, margem externa 1120, 12 faixas, organização radial interna,
linho, curvas, dimensões e temporizações. A família visível pertence a uma única
reserva ancestral. Núcleos internos não expulsam seus próprios descendentes nem
criam margem de 1120 entre níveis da mesma família. Nenhuma região é desenhada.

Ramos personalizados remotos continuam em regiões locais quando desconectados.
O teste de conectividade continua usando regiões infladas pela margem vigente:
com 1120, distâncias menores podem conectar-se. Não foi alterada silenciosamente
a geometria aprovada para evitar esse efeito; não se promete corredor ausente
quando as regiões efetivamente se conectam. Exceções manuais continuam locais e
validadas pela geometria persistida; recolher encerra o ciclo das reservas ocultas.

O resolvedor continua único, em duas prioridades: física e preferência de reserva.
Uma tentativa possui snapshot físico seguro. Havendo várias reservas e piora
física, componentes são unidos conservadoramente por dependência da mesma reserva,
caixas dos caminhos percorridos (incluindo destinos intermediários) e conflitos
entre destinos. Não se usam famílias narrativas como prova de independência.

Somente componentes rejeitados são restaurados quando a separação espacial foi
comprovada. A composição conjunta é novamente validada contra a geometria física
e a tolerância original. Qualquer dúvida, novo conflito ou orçamento esgotado
restaura a tentativa inteira. Com uma única reserva, conserva-se o veto rápido:
não vale construir componentes quando não há outra reserva independente a salvar.

A fixture A densa/B distante comprova reserva válida de B e rejeição de A sem
piora física. A variação aproximada/interdependente comprova segurança conjunta;
não se declara que todo caso denso será separável ou solucionável.

Orçamento único de 750.000 checks para resolvedor + conectividade indexada +
identificação de componentes/validação de segurança; 4000 movimentos e 16/card
preservados. Diagnósticos posteriores possuem teto separado de 750.000 inspeções,
sem movimentações ou tentativas extras, e sinalizam truncamento quando aplicável.
Não se concede orçamento completo por núcleo. Os contadores distinguem checks,
indexação, segurança, diagnóstico e movimentos. O fallback não é sucesso.

Diagnósticos compatíveis recebem componentes aceitos/rejeitados/interdependentes
e estado por reserva (atendida, parcial, vetada, orçamento ou invasão protegida).
Se a tentativa inteira é válida sem necessidade de separação, ela é contada como
um conjunto aceito, sem alegar independência entre cada card.

## Renderização e continuidade

Conteúdo de cards foi extraído para um componente memoizado, preservando chave,
article, atributos `data-base-*`, callbacks e identidade DOM. O comparador inclui
geometria, card, pertencimento, offsets, seleção, contadores, títulos e handlers;
foco, ações e áreas de interação não foram removidos. Relações/fundo continuam nos
mesmos componentes. Não há virtualização, culling, Canvas/WebGL ou redesign.

`archiveMotion`, `useArchiveMotion` e o scheduler não foram substituídos. Preservados
160 afetados/200 visíveis, degradação instantânea, tempos/curvas, origem ancestral
visível de saída, poses terminais e origem dos rótulos. Nenhum layout/projeção ou
render React por frame. O gesto continua pausando e retomando a apresentação.

## Validação e limites do aceite

Suítes puras anteriores: reserva 479, layout 718, animação 723, projeção 25,
câmera 16 = 1961. A suíte multinível acrescenta 396 verificações, incluindo
110 ciclos, profundidades 2/3/5/32/256, personalização, ancestral movido/resize,
promoção, remoção, dados inválidos, orçamento e segurança do veto localizado.
Total: **2357** verificações puras. Valores não finitos são tratados no layout,
sem alterar o snapshot nem contratos válidos do servidor.

A asserção histórica de restauração global após qualquer veto foi substituída
por comparação física par a par: o veto localizado pode preservar uma região
válida, mas não pode agravar colisões além do snapshot físico/tolerância anterior.
Os demais invariantes e cenários anteriores foram mantidos.

Chromium real: suites geral, radial/consulta/editor, fundo, estabilidade e ondas;
fixtures próprias, API em memória. Incluem falha/retry/conflito, criação/remoção,
reset, personalização, quadros, reload, gestos/cancelamento, pan/zoom e mobile.
A extensão multinível abre cinco níveis, movimenta ancestral, preserva expansão
interna, reverte 100 vezes, remove descendente oculto e verifica ausência de HTTP
de expansão e drift. Relógio controlado e tempo real foram utilizados.

Sondas verificam a pintura imperativa e atributos DOM, não cada frame efetivamente
apresentado pelo monitor. Capturas e WebM são evidências complementares; inspeção
manual humana permanece necessária. Apenas Chromium executado; sem afirmação de
Firefox/WebKit. Combinações exaustivas de concorrência e todos os gestos em cada
profundidade não estão comprovadas pela matriz automatizada.

## Medições

Mesmas fixtures, viewport 1600×1000, câmera, margem 1120 e limites no baseline e
candidato. CPU: 9 execuções/cenário, descartadas 2, mediana de 7. Chromium:
3 ciclos completos/cenário, Profiler, amostras RAF/long tasks e pintura DOM/SVG.
Matriz 50/100/200/500 × esparso/denso/multinível/independente/interdependente.
Custos de automação e gestos da suíte geral não são tratados como CPU do layout.
Não há declaração de ganho de FPS; RAF headless não mede FPS de um monitor.

As tabelas comparativas e evidências finais complementam esta seção abaixo.

## Pendências registradas antes da publicação

Aguardar publicação autorizada, aceite multinível e aceite específico da reserva
1120. Permanecem: veto conservador quando não se comprova independência, colisões
residuais em densidade extrema, custo do resolvedor, renderização extensa, long
tasks e limites atuais de animação. A reserva não é um otimizador espacial global.
Ganhos pontuais de memoização não encerram essas dívidas. Sem backend, banco,
Prisma, migrations, restart ou deploy. Nenhuma frente da 8.5.3 foi iniciada.

## Comparativo medido

Medições completas, contadores, decomposição por etapas e renderização em
`docs/fichario-multinivel-medicoes.json`. São amostras locais headless, não SLA.

| Cards | Cenário | Projeção antes/depois (ms) | Layout antes/depois (ms) | React ao recolher antes/depois (ms) | Long tasks antes/depois (6 operações) |
|---:|---|---:|---:|---:|---:|
| 50 | esparso | 0.07/0.11 | 1.96/3.25 | 58.8/35.3 | 2/2 |
| 50 | denso | 0.06/0.06 | 4.81/4.78 | 54.8/32.6 | 1/0 |
| 50 | multinivel | 0.06/0.06 | 2.21/2.22 | 48.0/30.3 | 3/3 |
| 50 | independente | 0.06/0.06 | 2.65/2.82 | 52.4/33.5 | 0/0 |
| 50 | interdependente | 0.06/0.06 | 3.74/3.91 | 51.6/32.4 | 1/0 |
| 100 | esparso | 0.11/0.11 | 3.77/4.10 | 122.7/69.5 | 9/6 |
| 100 | denso | 0.11/0.11 | 18.99/18.61 | 114.0/63.6 | 9/6 |
| 100 | multinivel | 0.11/0.13 | 6.92/7.39 | 104.4/63.3 | 9/6 |
| 100 | independente | 0.11/0.11 | 7.96/7.81 | 112.1/68.4 | 9/6 |
| 100 | interdependente | 0.11/0.11 | 10.69/11.13 | 109.0/65.3 | 9/6 |
| 200 | esparso | 0.21/0.21 | 8.45/12.10 | 130.9/65.1 | 7/6 |
| 200 | denso | 0.19/0.20 | 43.38/42.99 | 236.8/64.8 | 8/8 |
| 200 | multinivel | 0.10/0.09 | 8.68/8.64 | 132.7/70.1 | 9/6 |
| 200 | independente | 0.09/0.09 | 9.70/9.64 | 226.1/153.8 | 8/8 |
| 200 | interdependente | 0.09/0.09 | 13.26/13.18 | 79.4/63.2 | 8/8 |
| 500 | esparso | 0.23/0.23 | 22.09/22.36 | 43.3/170.4 | 6/6 |
| 500 | denso | 0.25/0.25 | 30.49/32.56 | 191.7/168.5 | 12/12 |
| 500 | multinivel | 0.23/0.23 | 40.18/40.22 | 49.2/57.0 | 6/6 |
| 500 | independente | 0.23/0.24 | 49.50/51.25 | 189.0/163.5 | 9/8 |
| 500 | interdependente | 0.23/0.23 | 59.86/55.96 | 195.5/164.4 | 6/6 |

Há ganhos de atualização React em várias amostras e custos adicionais em outras;
não houve ganho universal. O custo do layout esparso de 50/200 apresentou regressão
nesta rodada; a segurança por componente tem custo e permanece ponto de atenção.
Long tasks continuam presentes, especialmente na montagem/remoção de quadros
extensos. Não se declara encerrado o hardening de desempenho nem ganho de FPS.
A decomposição usa instrumentação apenas no bundle descartável: hierarquia/índice,
radial, reservas, obstáculos/propagação, segurança/componentes e diagnóstico/saída.
Ordenação e profundidade integram hierarquia; não há precisão de microbenchmark
para cada operação interna. Não foram introduzidos relógios de produção.

## Evidências da implementação e preservação (antes da publicação)

2357 verificações puras, typecheck e build isolados passaram. Vite mantém o aviso
de bundle maior que 500 kB; não foi mascarado nem tratado como resolvido.
Chromium final: 7637 pinturas sondadas sem descontinuidades, 100 ciclos da suíte
de ondas e 100 reversões multinível, além de sequência em tempo real e arraste
do ancestral com ACK simulado. Estabilidade independente: zero falhas em 221
chamadas; suíte geral e fundo aprovadas. Screenshot de cinco níveis evidencia
também sobreposições manuais/protegidas da fixture, não ausência universal de
conflitos. Seis quadros consecutivos foram extraídos da gravação em 56,2 s para
inspeção da transição, sem confundir sondas DOM com frames do monitor.

Evidências locais preservadas (PNG, WebM, seis quadros e logs):
`/root/.codex/visualizations/2026/11/08/01a1b91f-bed8-7260-a9ac-7553fb7b7adb/fichario-multinivel/`.
Execuções isoladas e snapshot de hashes: `/tmp/multinivel/`.

Conferência final: 47 WIPs por caminho/hash; 340 artefatos ativos por hash;
backend compilado/Prisma íntegros; PID 2467899 inalterado; health ok/database up.
Sem escrita em dados reais, sem migração, sem geração Prisma ou restart.
A aprovação funcional desta implementação e os ganhos parciais de renderização
não encerram as pendências de desempenho, cobertura concorrente exaustiva ou
aceite humano. Publicação depende de nova autorização, expressamente separada
do commit/push nesta entrega.

## Publicação controlada — 25/11/2026

Funcional autorizado/publicado: `0299321b2ce2c2d4bd5df8641c2ade22fd75a3fb`.
HEAD, main, origin/main e git ls-remote coincidiram antes da publicação. Nenhuma
alteração adicional da implementação foi feita durante esta operação.

Composição anterior: funcional `46eadd3e912a5e47e0360ad0a3dffa339196ff58`,
JS `index-P9xB2BF_.js`, CSS `index-BwtHA_mH.css`. Reprodução isolada por hash dos
340 arquivos do build anterior antes da sobreposição exclusiva de:

- `ArchiveCanvas.tsx`;
- `ArchivePage.tsx`;
- `archiveLayout.ts`;
- `archiveHierarchy.ts` (novo).

Novo JS `index-RYNVlaDv.js`; CSS inalterado. Somente esse asset e `index.html`
foram efetivamente sobrepostos na publicação final. Os assets foram conferidos
antes do rename atômico do HTML. Todos os 356 arquivos anteriores não HTML foram
preservados para clientes com cache; os 340 arquivos do novo build foram
conferidos por SHA256. Linho e demais assets permaneceram idênticos.

### Desvio operacional inicial e recuperação

Houve um erro do agente: o primeiro comando de reprodução foi iniciado em
`/opt/rpg`, contrariando a exigência de não construir no diretório ativo. O Vite
substituiu os artefatos. A composição anterior foi imediatamente restaurada a
partir das cópias existentes e dos hashes registrados **antes de prosseguir**;
os 357 arquivos anteriores voltaram a coincidir integralmente. Apenas o bundle
novo gerado pelo comando incorreto foi removido nessa recuperação. Backend,
banco e serviço não foram reiniciados/alterados. A disponibilidade durante essa
janela transitória não foi monitorada continuamente; não se afirma impacto zero.

Após a restauração, reprodução, typecheck, build e regressões de validação foram
executados exclusivamente em `/tmp/fichario-8524-publicacao`. O novo build
validado isoladamente é a fonte da publicação final. O incidente está registrado
nessa pasta em `incidente-restauracao.txt` e `incidente-build-ativo.log`; não foi
tratado como cumprimento do procedimento de build isolado inicial.

### Backup, rollback e conferências

Backup integral após restauração, conferido por SHA256 (357 arquivos):
`/opt/rpg/backups/frontend-8524-20261125-073600`. Os 356 arquivos dos backups
preexistentes também foram preservados por hash. Rollback exclusivamente frontend:
`python3 /tmp/fichario-8524-publicacao/rollback.py`. O script valida o backup,
restaura assets primeiro e index.html atomicamente por último, preservando
bundles adicionais. Não envolve banco, backend ou restart. Não foi necessário
executá-lo após a publicação final.

Reexecutadas 2357 verificações puras, typecheck e build isolados, além de Chromium
geral, radial/consulta/editor, fundo, estabilidade e ondas/multinível. Cinco
níveis, movimentos, 100 ciclos/reversões, personalização, retry/conflito, atualização
externa, troca/reload e reduced-motion passaram com API simulada. Sonda final:
7637 pinturas sem descontinuidades; estabilidade independente: zero falhas em
221 chamadas. Teste Chromium adicional de veto localizado: 1 componente aceito,
1 rejeitado, 75 dependências agregadas; região livre preservada e composição
interdependente fisicamente segura. Margem 1120, faixas 12 e folga 32 conferidas.
Nenhum dado real da campanha foi usado como fixture mutável.

HTML, JS, CSS e linho respondem HTTP 200 e coincidem com os hashes do build.
Health `status:ok/database:up`; quatro GETs privados do Arquivo sem autenticação
retornaram 401. Journal do serviço desde o início da operação: zero linhas de
erro/exception/fatal/failed. PID **2467899** permaneceu inalterado. Preservados
os 47 WIPs por caminhos/hashes e 965 arquivos de backend compilado, schema,
migrations e Prisma Client. Não houve geração Prisma, migration ou escrita
operacional no banco. Espelho `/tmp/arquivo-publicacao` atualizado e conferido
somente após confirmação da publicação. Evidências em `/tmp/fichario-8524-publicacao`.

### Estado após publicação

8.5.2.4 permanece em validação. Preservados os aceites históricos 20/20 e 14/14.
Pendentes o aceite específico da margem 1120, aceite multinível e avaliação de
desempenho. Mantidas sem correção nesta publicação: React ao recolher 500 cards
esparsos **43,3 → 170,4 ms**, aumento de CPU em cenários esparsos, long tasks,
colisões extremas, fallback global quando a independência não é comprovada,
cobertura concorrente não exaustiva, limites 160/200 e aviso de bundle >500 kB.
Não se declara encerrado o hardening. Nenhuma frente da 8.5.3 foi iniciada.
