# Criação: repertório inicial e distribuição preservada

A etapa 5 mantém a classe como item principal. Subclasse (quando escolhida no primeiro nível), Truques e Magias aparecem nessa ordem na trilha. Só existem subetapas de repertório para classes com essas escolhas no nível 1; Paladino e Patrulheiro continuam sem conjuração nessa entrada.

O seletor oferece busca por nome/escola, cards temáticos e consulta de descrição, componentes, duração, alcance e tempo de conjuração. Atributo de conjuração, bônus de ataque e CD vêm do DTO da classe. Truques e magias são editados separadamente, preservando a outra parte do livro. Classes preparadoras selecionam as magias preparadas; o Mago monta o grimório e marca o preparo separadamente. Listas e limites continuam validados pelo endpoint de livro de magias existente. Magias raciais/de juramento derivadas não entram nas escolhas editáveis. Salvar e navegar entre subetapas guardam as alterações; falha mantém a seleção aberta para nova tentativa. A etapa 9 conserva o editor de progressão para personagens acima do nível 1.

Voltar para uma etapa anterior preserva valores distribuídos e rolagens. O pedido legado `resetAbilities` não apaga mais os valores. Repetir explicitamente uma rolagem continua limpando a distribuição correspondente ao fluxo anterior.

A troca de classe inicial não barra o jogador antes dos atributos. O requisito de atributo já existente no Obsyrium é conferido na etapa 6: a mensagem mostra o atributo e quantos pontos faltam, considerando os bônus raciais. Guerreiro mantém a alternativa Força OU Destreza. Etapas posteriores e finalização também recusam a combinação inválida no servidor, para impedir bypass da interface. Não se altera a regra de elegibilidade da progressão/multiclasse.

Verificações: builds de frontend/backend; serviço real com adaptadores em memória (`check-creation-equipment-service.mjs`) para preservação e validação; navegador com wizard real e API simulada para subetapas, persistência entre listas, indicadores, retorno sem reset e versão móvel. Nenhuma campanha real é usada como fixture. Não há migração.

## Atualização de valores derivados

A distribuição sincroniza automaticamente após uma pausa curta na edição (400 ms) e é confirmada antes de sair da etapa, inclusive ao voltar. Os pedidos são serializados para que uma resposta antiga não sobrescreva uma edição mais recente. O modo `syncAbilities` usa a mesma escrita de ficha e o mesmo DTO do servidor, sem concluir a etapa nem liberar o avanço. Isso renova conjuração (ataque, CD e limite de preparo), PV, CA, iniciativa, perícias e demais projeções do motor existente. Salvamentos do livro de magias na etapa de progressão também renovam o estado interno do wizard.

Uma distribuição parcial pode ser sincronizada: cada valor informado ainda precisa pertencer às rolagens disponíveis, sem reutilizar mais ocorrências do que foram roladas. Concluir a etapa continua exigindo os seis valores e os requisitos da classe; as guardas posteriores/finais permanecem. O limite de magias preparadas é recebido do servidor, não recalculado no seletor com uma segunda regra.
