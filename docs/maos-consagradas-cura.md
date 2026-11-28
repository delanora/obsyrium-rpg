# Mãos Consagradas — primeira entrega: cura variável (28/11/2026)

## Escopo PHB 2014 e limites

Cura por toque, como Ação, gastando uma quantidade inteira escolhida da reserva.
O máximo continua derivado: cinco vezes o nível de **Paladino**, não o nível total.
Descanso longo recupera a reserva; curto não. Não usa espaços, dado de cura ou
modificador de conjuração. Referência: [Paladino — Basic Rules 2014](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/classes#Paladin).

Esta é a parte de cura de PV, não a característica inteira concluída. Remover
uma doença ou neutralizar um veneno por cinco pontos exige escolher sua origem;
essa execução permanece assistida e será tratada separadamente. Curar PV não
remove genericamente Envenenado. Constructos e mortos-vivos não recebem efeito,
mas a ativação gasta os pontos escolhidos e a Ação. Excesso de cura respeita o
teto de PV e não devolve pontos gastos; PV temporários são preservados.

Autoalvo funciona também fora de combate, sem encontro artificial. Outros alvos
exigem toque verificado no grid do mesmo combate (até 5 ft, UI 1,5 m), sem barreira.
Geometria desconhecida ou alturas diferentes bloqueiam sem custo, indicando a
necessidade de resolução assistida pelo Mestre. Não foi criado um bypass de
confirmação espacial pelo jogador nem uma fila nova para o Mestre.

## Execução e interface

O jogador escolhe alvo e quantidade no mesmo diálogo, aberto pela ficha ou pela
Hotbar. As opções públicas incluem personagens de jogadores e instâncias
visíveis do próprio combate. Tokens ocultos não aparecem nem podem ser usados
por ID. A lista não divulga PV privados de NPCs. O recurso recebido pelo DTO
entra na Hotbar existente, preservando o contrato de organização personalizada.

O servidor deriva posse, saldo, estado, alcance, barreiras e economia. Valida
versão de fonte e alvo, trava o combate ativo e confirma cura, uso e Ação na
mesma transação. Os pontos pedidos entram no fingerprint da operação; replay
não cura nem cobra novamente. Erro reverte os custos. Nenhum máximo é persistido.

Reutiliza `gridSpatialProvider`, `damageTargetOf`, `resolveHealing` e
`applyHealConsequences`. A cura a 0 PV limpa o ciclo de morte e a Inconsciência
causada por 0 PV; condições independentes permanecem. Mortos e decisões de morte
pendentes não são contornados. A instância do NPC recebe a cura, não o template.
Após o commit, ficha, ciclo de morte e combate notificam os consumidores existentes.
Não cria SpellCast fictício ou outra engine de cura.

## Validação

- 36 verificações HTTP/PostgreSQL: reserva, quantidades, autoalvo fora de combate,
  aliado a 0 PV, conservação do veneno, NPC/template, constructo, morto-vivo,
  toque, barreira, elevação, privacidade, versões, replay e concorrência.
- Regressão de Surto de Ação: 24 verificações HTTP/PostgreSQL.
- 22 contratos puros da Hotbar, agora incluindo a referência de Mãos Consagradas.
- Chromium real com API simulada: Hotbar e CombatTracker reais, abertura do
  diálogo, quantidade variável, payload mínimo, saldo, limites, Escape, desktop
  e diálogo dentro da viewport móvel.
- Builds e typechecks frontend/backend em espelho isolado; frontend validado
  novamente após ajustes finais. Guarda de build: 51 verificações aprovadas.
- Suíte ampla: 604 verificações aprovadas e duas falhas anteriores (CB138/SC14),
  já reproduzidas na base na entrega da Hotbar. Não declaradas resolvidas.

## Isolamento e publicação

Espelho `/root/validacao-sopro`, com a composição operacional isolada das entregas
anteriores: overlays de nulabilidade de localidades/cenas e Client existente.
Não integram o commit e não resolvem a divergência preexistente da main com o
Client operacional. Não publicar o espelho inteiro indiscriminadamente.

PostgreSQL descartável na porta 55439, diretório `/tmp/obsyrium-cura-pg`, schema
`smoke_cure_wounds`, HTTP próprio 3309. Guardas verificam porta, schema, diretório
e ausência de usuários/personagens/combates antes das fixtures. Cleanup somente
dos IDs criados; zero usuários/personagens/combates ao terminar. Sem dados reais
como fixtures. Processos próprios encerrados após validar.

A linha WIP anterior de CombatTracker permanece separada no staging. Os demais
WIPs e artefatos ativos foram preservados. Sem alterações de Prisma/schema ou
migrations, sem geração de Client, deploy ou restart. As entregas recentes do
motor e da Hotbar também continuam aguardando publicação autorizada; a duplicidade
de serviços permanece pendência operacional antes de qualquer restart.

Commit/push autorizados pelo responsável em 28/11/2026. Esta autorização
não inclui publicação ou restart; a sequência será registrada separadamente.

Continuidade posterior: a neutralização por origem foi integrada localmente,
com escopo e limites em `docs/maos-consagradas-neutralizacao.md`. Este relatório
preserva o escopo da microentrega original; a sequência ainda não foi publicada.

Commit funcional de cura: `02e9ba4`, enviado à main em 28/11/2026. Extensão de
afecções e neutralização versionada separadamente; publicação continua pendente.
