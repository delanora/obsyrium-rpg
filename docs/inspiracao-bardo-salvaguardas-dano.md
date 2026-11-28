# Inspiração de Bardo — salvaguardas de dano

Entrega de 28/11/2026, sobre `82a132f`. Continua a janela pós-d20 das etapas anteriores, sem ampliar o catálogo de magias.

## Funcionamento

Salvaguardas públicas de personagens em combate ativo, provenientes de execuções `save-damage` e de habilidades em área já suportadas, agora oferecem a decisão de Inspiração no registro. A rolagem original fica persistida como provisória. O dono escolhe usar o dado ou continuar sem gastá-lo; Mestre e terceiros não escolhem por ele.

A resolução usa o total final na mesma transação do consumo e do recibo. O resolvedor de dano existente recebe essa transação; não há uma segunda conta de sucesso, dano, resistência, concentração ou morte. Antes da decisão, o d20 não pode ser rerrolado e não há dano da execução pendente.

A barreira multi-alvo continua esperando todas as salvaguardas. O dano simultâneo é rolado uma vez e gera eventos individuais. Nenhum espaço, recurso da fonte ou economia é cobrado novamente por esta decisão. Sucesso sem dano (Chama Sagrada), metade, resistências, concentração e ciclo de morte permanecem nos pipelines anteriores.

## Snapshot, replay e concorrência

A pendência mantém o checkpoint `inspirationSave` enquanto aguarda a decisão. Ao resolver dano, o motor substitui esse checkpoint pelo snapshot canônico `save-result`; o snapshot completo de dano permanece na execução, com uma referência por alvo. O recibo em CharacterOperation sustenta retries mesmo depois dessa substituição, sem repetir dado, dano ou consequências.

O resolvedor normal também trava a linha da pendência e recusa contornar uma decisão aberta. A versão da ficha, a versão do checkpoint, o dono e a chave de operação são conferidos. Instância expirada ou já consumida pode ser recusada, mas não trocada silenciosamente por uma concessão nova. Falhas automáticas não oferecem o dado; pendências privadas mantêm sua filtragem.

Sem schema, migrations ou geração Prisma. Preserva as guardas de rollback das etapas anteriores: uma versão antiga não deve ignorar checkpoints pendentes. Antes de um rollback futuro, manter a compatibilidade ou concluir/cancelar as pendências por operações autorizadas, sem apagar dados.

## Validação

- 37 verificações HTTP/PostgreSQL descartáveis: d20 imutável, reconexão, versões, payload forjado, autorização, expiração, cancelamento, concorrência, replay após substituição do checkpoint, sucesso sem dano e falha automática.
- Área com dois alvos: espera a decisão; um roll de dano compartilhado, eventos distintos, metade e resistência no pipeline canônico; dano gera pendência de concentração.
- Dano letal atravessa o lifecycle de morte. Falha controlada na escrita de PV comprova rollback conjunto de ficha, dano, consumo e pendência; retry após remover a falha funciona. A injeção usou trigger restrito ao ID da fixture, criado/removido apenas no schema descartável. O erro esperado aparece no log desse servidor de teste.
- Regressões aprovadas: salvaguardas de efeito (35), testes solicitados (32), concessão (55), Sopro racial (24) e habilidades em área (28).
- Chromium, componente real e API simulada: card de Chama Sagrada, decisão, payload, clique duplo, recusa, observador e celular; captura conferida.
- Typechecks e builds backend/frontend no espelho `/root/validacao-sopro`. Módulo de dados validado sobre a main limpa com apenas o gate desta entrega, sem incorporar o WIP de histórico persistente.
- Suíte ampla: 604 verificações aprovadas e as mesmas falhas anteriores CB138/SC14. Não declarada integralmente aprovada.
- 29 WIPs e 977 artefatos protegidos conferidos por hashes/diff. A composição operacional de geografia opcional do espelho permaneceu apenas para validação.

Servidor próprio na porta 3309, PostgreSQL próprio na 55439 e schema sentinela descartável. Nenhum dado da campanha usado como fixture. Sem publicação, restart de produção ou alteração do banco ativo. Roadmaps Git e Drive atualizados.

## Próxima integração

Ataques de arma e mágicos ainda precisam da janela antes da decisão de acerto e aplicação de dano. Concentração, morte, testes livres, NPCs e consumo fora de combate continuam fora deste escopo. Não declarar a Inspiração inteiramente concluída.
