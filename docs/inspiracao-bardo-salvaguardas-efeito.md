# Inspiração de Bardo — salvaguardas de magias de efeito

Entrega de 28/11/2026, sobre `4f539f0`. Referência: [Bardo — Regras Básicas 2014](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/classes).

## Escopo entregue

Integra a decisão pós-d20 às salvaguardas públicas de magias `save-effect`, como Imobilizar Pessoa, incluindo as repetidas no fim do turno. Exige personagem num combate ativo. O servidor preserva o d20, bônus, modo e modificadores calculados pelo pipeline existente. Antes de aplicar sucesso/falha, grava um checkpoint na pendência e oferece ao dono o mesmo card de decisão da entrega anterior. Mestre e terceiros não gastam o dado pelo beneficiário.

Confirmar usa o mesmo consumo compartilhado dos testes solicitados: trava a instância recebida, confere versão da ficha, encerra o efeito com `consumed` e rola o dado no servidor. Recusar conserva a Inspiração. Uma instância expirada ou já consumida não pode ser trocada por outra concedida depois daquele d20. A escolha pode continuar sem o dado.

Condições, concentração e barreira de múltiplos alvos continuam no resolvedor existente. Ele agora aceita a transação da decisão, para que consumo e resolução sejam atômicos. Uma falha na finalização reverte ambos. O caminho normal também trava a pendência e recusa resolver um checkpoint de Inspiração, impedindo contornar a escolha por outra requisição.

## Persistência, acesso e limites

Reutiliza `PendingEffectSave.resolutionSnapshot` com o envelope tipado `inspirationSave`; nenhuma migration, alteração de schema ou geração Prisma. O checkpoint mantém versão, identidade da Inspiração, fingerprint e rolagem provisória. Recarregar/reconectar reconstrói a escolha. Retry conserva o mesmo d20; a mesma chave com payload diferente é recusada. A decisão usa versão da ficha, versão do checkpoint e recibo idempotente em CharacterOperation.

O card só expõe o total provisório, d20 e tier, sem divulgar o identificador interno da instância. Pendências privadas seguem filtradas e não criam uma decisão pública. Falhas automáticas não oferecem o dado. Sem Inspiração, mantém-se o contrato anterior, inclusive a ausência de `clientId` em chamadas legadas. Com Inspiração, a chave é obrigatória antes de sortear.

Não integra ataques, magias `save-damage`, áreas de criaturas, concentração, morte, testes livres, NPCs nem decisões fora de combate. Os custos da conjuração não são repetidos nem reembolsados por esta escolha. A duração da Inspiração continua seguindo o lifecycle já implementado; não há relógio narrativo novo.

## Validação

- 35 verificações HTTP/PostgreSQL descartáveis: snapshot, reconexão, dono, dados forjados, versões, rerrolagem recusada, expiração, cancelamento, concorrência, replay, salvaguarda repetida e rollback transacional.
- Prova de magia com dois alvos: a barreira aguarda a decisão; somente a falha recebe efeito e a concentração nasce pelo motor existente.
- Regressões dos testes solicitados (32) e da concessão (55) aprovadas após extrair o consumo compartilhado.
- Chromium com card real e API simulada: novo endpoint, payload, clique duplo, recusa, observador e celular; capturas conferidas.
- Typechecks, build backend/frontend e proteção de build executados no espelho `/root/validacao-sopro`. O módulo de dados foi validado sobre a main limpa com apenas esta entrega, sem depender do WIP de histórico persistente. Os avisos de tamanho de chunks/importação dinâmica permanecem.
- Suíte ampla: 604 verificações aprovadas e as duas falhas anteriores CB138/SC14. Não declarada integralmente aprovada.
- Os 29 WIPs e os 977 artefatos protegidos foram conferidos por hashes/diff. A composição operacional de geografia opcional do espelho permaneceu apenas na validação.

Fixtures próprias em PostgreSQL descartável na porta 55439 e servidor próprio na 3309. Nenhum dado real usado como fixture. Sem publicação, restart de produção, migrations ou alterações no banco ativo.

## Continuidade e rollback

Não restaurar um resolvedor antigo enquanto houver checkpoint pendente: ele poderia ignorar a escolha e rerrolar. Um rollback futuro precisa manter a guarda ou concluir/cancelar essas pendências pelas operações autorizadas; não apagar preferências/dados ou restaurar o banco indiscriminadamente. Os snapshots e recibos preservam o histórico.

Próximas integrações: salvaguardas de dano e ataques. Manter a escolha depois do d20 e antes da decisão, sem duplicar os resolvedores. Roadmaps Git e Drive atualizados; aceite/publicação continuam separados do commit/push.

Continuidade: `docs/inspiracao-bardo-salvaguardas-dano.md` registra a integração seguinte, sem alterar o escopo histórico e as provas desta entrega.
