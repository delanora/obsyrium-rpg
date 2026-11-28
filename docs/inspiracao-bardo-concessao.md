# Inspiração de Bardo — concessão do dado

Entrega de 28/11/2026. Referência: [Classes das Regras Básicas 2014](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/classes).

## Escopo

Primeira fatia funcional: outro personagem jogador recebe um dado, gastando um uso e uma Ação Bônus do Bardo. A ficha e a Hotbar reutilizam o mesmo executor HTTP autoritativo. O servidor deriva o máximo por Carisma (mínimo um), a recuperação e o dado pelo nível de Bardo, sem usar o nível total multiclasse.

O dado fica em EffectInstance público, com definição própria d6/d8/d10/d12 imutável. Não injeta modificadores nem oferece escolha antes de rolar. Uma inspiração ativa impede outra, inclusive de outro Bardo. A guarda de versão do alvo evita concessões concorrentes. Recurso, economia, efeito e recibo idempotente entram na mesma transação. Retries não repetem efeitos; alteração do payload com a mesma chave é recusada. Fonte e alvo são validados no servidor.

A duração reutiliza o lifecycle canônico: dez minutos equivalem a cem rodadas de combate, ancoradas na fonte. Não há relógio narrativo automático após encerrar o combate; o Mestre encerra o efeito pelo controle existente.

## Limites explícitos

Esta entrega exige combate ativo com grid, turno da fonte, alvo jogador distinto, até 60 ft (18 m), mesma altura e caminho conhecido. Surdez, inconsciência e morte do alvo impedem receber. Visão não é requisito. Barreiras e desníveis exigem adjudicação de audição; não se afirma que paredes sempre bloqueiem som pela regra. Silêncio e outros fenômenos acústicos não modelados permanecem sob controle do Mestre.

Consumo após o d20 e antes da decisão do resultado é a próxima fatia. NPCs, uso fora do grid, Palavras de Interrupção, Inspiração em Combate e Inspiração Superior não foram automatizados. O efeito não é uma magia e não exige concentração.

## Correção compartilhada

O cálculo de recursos confundia modificador de atributo −1 com sentinela de usos ilimitados. O piso agora é aplicado ao resultado de atributo; somente uma declaração explícita de máximo −1 sem atributo conserva a sentinela. Há regressões para Carisma 6/8/10/12/16 e declaração ilimitada; Fúria e Forma Selvagem de nível 20 mantêm esse contrato.

## Validação

- 55 verificações no PostgreSQL/HTTP descartáveis: autorização, versões, idempotência, corridas, não acúmulo, economia, níveis, duração, recuperação, alcance e estados impeditivos.
- 23 contratos da Hotbar, incluindo referência persistida do novo recurso.
- Chromium com CombatTracker e Hotbar reais, API simulada e fixtures próprias: confirmação, payload sem dado/custo fornecido, atualização da ficha, Escape e largura de celular. Capturas desktop/celular conferidas.
- Typechecks e build frontend/backend exclusivamente no espelho isolado `/root/validacao-sopro`; manifest com 1.245 hashes. A composição operacional de geografia opcional do espelho foi preservada, sem incorporá-la nesta entrega.
- Suíte ampla: 604 aprovadas, duas falhas anteriores CB138 e SC14. Não declarada integralmente aprovada.
- Os 29 WIPs anteriores e 977 arquivos protegidos conferidos por hashes (CombatTracker separado por diff; normalização do teste legado documentada nas entregas anteriores).

Nenhum dado real foi utilizado como fixture. Cluster próprio na porta 55439 e servidor próprio na 3309, encerrados após validação. Sem migrations, geração Prisma, alteração do banco ativo, deploy ou restart de produção. Entregas anteriores continuam aguardando publicação autorizada.

## Próximo passo

Conectar o consumo ao momento correto de ataque, teste e salvaguarda. Não antecipar um bônus antes da rolagem nem duplicar os motores existentes. Atualizações registradas no roadmap Git e na aba Roadmap do Codex do Aventureiro.

Atualização: o consumo em testes solicitados pelo Mestre está descrito em `docs/inspiracao-bardo-decisao.md`. Os demais resolvedores continuam pendentes; o escopo e a validação acima preservam o histórico desta primeira entrega.
