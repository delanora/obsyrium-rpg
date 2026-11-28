# Inspiração de Bardo — decisão após o d20 em testes solicitados

Entrega de 28/11/2026, sobre a concessão de `07672d9`. Referência: [Bardo — Regras Básicas 2014](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/classes).

## Comportamento

Testes de atributo, perícias e salvaguardas solicitados pelo Mestre pelo registro de combate agora podem consumir a Inspiração recebida. O motor existente rola o d20, condições, vantagem e modificadores. Havendo Inspiração ativa, o servidor persiste o resultado provisório e mantém a solicitação pendente, sem registrar sucesso/falha. A bandeja indica o estado provisório e permite continuar no registro.

O card oferece ao dono do personagem **Usar Inspiração dN** ou **Continuar sem usar**. Observadores e Mestre não decidem pelo beneficiário. O Mestre conserva a possibilidade de cancelar a solicitação. Recusar não gasta o efeito. Confirmar encerra a instância pelo lifecycle canônico (`consumed`) e rola o dado no servidor; o total final usa o mesmo d20 e bônus originais. Somente após a decisão o resultado final entra no histórico/notificação e no diário com sucesso/falha.

O tier vem da definição da instância recebida, não da classe atual nem de campos do cliente. A solicitação guarda qual efeito estava disponível naquele d20: uma concessão nova não substitui silenciosamente um efeito expirado ou gasto. Se ele deixou de estar disponível, o jogador pode concluir sem o dado.

## Persistência e concorrência

Reutiliza `CombatTestRequest.result`/`version`, sem schema ou migration. O estado continua `pending` durante a decisão; o resultado provisório contém a marca tipada `inspirationPending`. Recarregar/reconectar reconstrói o card do servidor. Repetir o pedido original devolve o mesmo d20; uma nova chave não autoriza rerrolagem. Reutilizar a chave com payload diferente é recusado.

A decisão exige versão da solicitação e da ficha, além de `operationId` UUID. Combat, ficha, efeito, resultado e recibo seguem uma transação. O lock do combate serializa conclusão/cancelamento/término; o lock da instância protege contra encerramento/expiração. Uma mesma Inspiração não vence em dois testes. O recibo em CharacterOperation permite replay sem outro dado nem consumo. Não existe nova economia de ação para gastar o dado recebido.

## Limites e continuidade

Esta fatia não integra ataques, salvaguardas de aplicações de magia, concentração, morte, testes livres da bandeja nem NPCs. Esses caminhos mantêm seu comportamento anterior; não se afirma que a Inspiração esteja completa. Testes privados rolados pelo Mestre seguem assistidos e não criam decisão pública. Falhas automáticas não oferecem um dado incapaz de mudar seu resultado.

A CD já era pública nos testes solicitados e permanece assim. O sistema adia a decisão formal de sucesso/falha, mas não tenta impedir que o jogador compare números conhecidos. O dado só é oferecido depois do d20, sem transformá-lo em bônus obrigatório antecipado. A duração e os limites da concessão continuam os da entrega anterior.

Rollback futuro precisa preservar o reconhecimento de `pending` com resultado provisório ou concluir/cancelar essas solicitações antes de restaurar um backend anterior. O resolvedor antigo não reconhece a marca e poderia rerrolar uma solicitação ainda pendente. Não apagar dados para contornar essa incompatibilidade. Esta entrega não publica nem executa rollback.

## Validação

- 32 verificações HTTP/PostgreSQL descartáveis: d20 imutável, reconexão, autorização do dono, versões, payload forjado, expiração, substituição de efeito, recusa, cancelamento pelo Mestre, concorrência e replay.
- Regressão das 55 verificações da concessão aprovada.
- Chromium com o componente real e API simulada: decisão, payload, clique duplo, recusa, observador e celular. Capturas conferidas; o aviso adicional da bandeja também passou por typecheck/build, sem alegar teste completo de interação da bandeja neste cenário.
- Typechecks e build frontend/backend exclusivamente em `/root/validacao-sopro`. O módulo de dados também foi conferido a partir da versão limpa da main com apenas as mudanças desta entrega, sem depender do WIP de histórico persistente.
- Suíte ampla: 604 verificações aprovadas e as mesmas duas falhas anteriores CB138/SC14. Não declarada integralmente aprovada.
- WIPs e artefatos protegidos conferidos por hashes/diff; nenhum WIP incorporado ao commit. A composição operacional de geografia opcional do espelho foi mantida apenas para validação.

Fixtures próprias em cluster/schema descartáveis, porta 55439, e servidor próprio na porta 3309. Sem dados reais, migration, geração Prisma, publicação ou restart de produção. Roadmaps Git e Drive atualizados. Próxima fatia: integrar os demais resolvedores sem duplicar mecânica nem antecipar a decisão ao d20.

Continuidade: `docs/inspiracao-bardo-salvaguardas-efeito.md` registra a integração seguinte, preservando o escopo e as provas históricas desta entrega.
