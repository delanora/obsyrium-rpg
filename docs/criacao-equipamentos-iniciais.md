# Etapa 8 — Equipamentos iniciais

O wizard tem dez etapas: equipamentos na 8, nível/progressão na 9 e revisão na 10. A descrição de classe/antecedente não repete a lista de equipamentos.

## Caminhos

- **Classe e antecedente:** alternativas em botões, com seletores das categorias permitidas (armas, ferramentas, instrumentos e focos). A validação considera proficiências nas alternativas condicionais do Clérigo. Inclui os itens fixos e as moedas do antecedente. Pacotes são exibidos com o conteúdo e desmembrados ao entregar.
- **Compra:** riqueza inicial PHB 2014 da classe inicial, rolada no servidor com D4 e animada na bandeja comum. Catálogo com busca, categoria, detalhes, preço público PHB, carrinho, quantidades e saldo. Substitui os itens e moedas de classe/antecedente. O saldo não gasto vira moedas da ficha.
- **Mestre:** nenhuma concessão de item ou moeda. Inventário/carteira existentes são preservados.

Os itens da vitrine reutilizam o catálogo PHB que alimentava o seed. Sua extração para `shared/phb-equipment-catalog.ts` preservou integralmente as linhas anteriores (comparação automatizada sem executar o seed). `shared/creation-equipment.ts` acrescenta conjuntos, ferramentas/instrumentos e conteúdo estruturado dos pacotes. A loja inicial oferece equipamento comum do PHB, não itens mágicos ou preços privados personalizados do Mestre. As imagens já cadastradas são reaproveitadas por identidade canônica/nome; imagens ausentes ou quebradas têm ícone genérico. Todos os ícones desta etapa têm borda de latão.

Referência: PHB 2014, equipamento/riqueza inicial (p. 143), e [Basic Rules 2014 — Equipment](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/equipment). O Monge usa 5d4 PO, sem multiplicador ×10. Munição cujo preço unitário seria inferior a 1 PC é vendida em lote (20 balas de funda por 4 PC).

## Persistência e autoridade

`creationDraft.equipment` guarda as escolhas/carrinho concluídos na etapa e a riqueza. Nenhuma escolha do cliente contém preço, saldo, resultado de dado ou lista livre de itens concedidos. O servidor refaz a seleção e os custos a partir do catálogo. Escolhas incompletas, categorias incorretas, IDs desconhecidos, quantidades inválidas e saldo insuficiente são recusados.

`POST /api/characters/me/creation/wealth` exige `expectedVersion` e `operationId`. O servidor bloqueia a ficha, confere versão antes do RNG e usa `CharacterOperation`: uma riqueza por classe (`CREATION_WEALTH_RESULT`), inclusive ao mudar de classe e voltar; retries devolvem snapshot (`CREATION_WEALTH_ROLL`). Rolar não entrega moedas.

`POST /api/characters/me/creation/finalize` também exige versão/operação. Uma transação valida o rascunho, resolve o conjunto, confere o limite do inventário, adiciona os itens à mochila sem equipá-los, credita o saldo e fecha a criação. Uma concessão por personagem fica registrada em `CREATION_EQUIPMENT_GRANT`; `CREATION_FINALIZE` guarda o snapshot do pedido. Tudo é confirmado ou revertido junto. Itens/carteira preexistentes são preservados. O evento de ficha é publicado após o commit.

`equipmentDelivered` e o recibo impedem nova concessão após reabrir a criação. Fichas que já estavam finalizadas antes deste recurso também são marcadas como tratadas ao serem reabertas. Não há backfill nem alteração do schema Prisma. O seed não é executado pela funcionalidade nem pelo deploy.

## Verificações

- `src/scripts/check-creation-equipment.ts`: 156 combinações das 12 classes com os 13 antecedentes; referências, pacotes, preços/saldo, categorias e tentativas de fraude.
- `client/scripts/check-creation-equipment-service.mjs`: serviço real com adaptadores em memória; versões, RNG único por classe, replay, concorrência, finalização, imagens, troco, reabertura, modo Mestre e rollback com inventário cheio/saldo insuficiente.
- `client/scripts/check-creation-information.tsx`: 12 classes/40 subclasses mantêm seus benefícios; equipamentos ficam na etapa específica.
- Builds de backend/frontend e verificações de UI de combate.
- Navegador no wizard real com API simulada: alternativas, categoria de foco, conteúdo dos pacotes, imagens/fallback, animação de riqueza, carrinho, saldo, revisão e celular.

Nenhum teste usa usuários, fichas ou outros dados da campanha real. Os testes de serviço não abrem conexão HTTP/PostgreSQL.
