# Atributos na criação

No modo personagem novo, a etapa 6 usa `CommonDicePool`, `CommonTrayFrame` e a mesma física, arremesso, escala, som e duração da bandeja comum. Os quatro D6 são fixos. A UI aguarda a animação antes de apresentar o novo card e só abre a distribuição após seis resultados válidos. Rolagens persistidas podem ser retomadas.

A subetapa **Distribuir atributos** fica na trilha lateral. Os cards aceitam arraste por ponteiro (mouse ou toque), e também seleção por clique/teclado seguida do atributo. A identidade visual usa o índice da rolagem: resultados iguais são peças distintas. Remover devolve o valor à reserva; arrastar entre atributos permite trocá-los. O contrato persistido continua sendo o multiconjunto de valores, validado pelo servidor.

O modo personagem existente conserva a entrada numérica anterior.

## Mínimo de 8 — regra personalizada autorizada

A mesa autorizou repetir o resultado de 4d6 descartando o menor quando a soma é **menor que 8**. O card mostra “Você tirou menos que 8. Pode rolar de novo”. `retryIndex` substitui apenas essa posição, sem apagar as outras cinco; o novo resultado também pode exigir repetição. Não se aplica piso artificial aos dados. Distribuição/finalização rejeitam valores abaixo do mínimo.

Repetir ou recomeçar limpa a distribuição do rascunho, preservando os demais resultados quando a operação é individual. A regra não é apresentada como PHB 2014.

## Autoridade e verificações

`POST /api/characters/me/creation/roll` conserva o sorteio no servidor e o histórico do mestre. A ficha é bloqueada na transação antes de validar versão, conferir a elegibilidade da repetição e rolar. A escrita usa a versão atual. `operationId` reutiliza `CharacterOperation`, com tipo e fingerprint do pedido; uma repetição HTTP não sorteia novamente. Os campos de concorrência são opcionais para compatibilidade com abas antigas; o novo cliente os envia.

O teste `client/scripts/check-creation-rolls.mjs` usa o serviço real com adaptadores em memória, sem API ou banco. Ele não comprova concorrência PostgreSQL; a exclusão mútua depende de `FOR UPDATE` na mesma transação. A validação no navegador usa rolagens simuladas e confere animação, limite de seis, mensagem/repetição, arraste, duplicados e celular. Nenhum personagem real é fixture.
