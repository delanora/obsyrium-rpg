# Criação: repertório inicial e distribuição preservada

A etapa 5 mantém a classe como item principal. Subclasse (quando escolhida no primeiro nível), Truques e Magias aparecem nessa ordem na trilha. Só existem subetapas de repertório para classes com essas escolhas no nível 1; Paladino e Patrulheiro continuam sem conjuração nessa entrada.

O seletor oferece busca por nome/escola, cards temáticos e consulta de descrição, componentes, duração, alcance e tempo de conjuração. Atributo de conjuração, bônus de ataque e CD vêm do DTO da classe. Truques e magias são editados separadamente, preservando a outra parte do livro. Classes preparadoras selecionam as magias preparadas; o Mago monta o grimório e marca o preparo separadamente. Listas e limites continuam validados pelo endpoint de livro de magias existente. Magias raciais/de juramento derivadas não entram nas escolhas editáveis. Salvar e navegar entre subetapas guardam as alterações; falha mantém a seleção aberta para nova tentativa. A etapa 9 conserva o editor de progressão para personagens acima do nível 1.

Voltar para uma etapa anterior preserva valores distribuídos e rolagens. O pedido legado `resetAbilities` não apaga mais os valores. Repetir explicitamente uma rolagem continua limpando a distribuição correspondente ao fluxo anterior.

A troca de classe inicial não barra o jogador antes dos atributos. O requisito de atributo já existente no Obsyrium é conferido na etapa 6: a mensagem mostra o atributo e quantos pontos faltam, considerando os bônus raciais. Guerreiro mantém a alternativa Força OU Destreza. Etapas posteriores e finalização também recusam a combinação inválida no servidor, para impedir bypass da interface. Não se altera a regra de elegibilidade da progressão/multiclasse.

Verificações: builds de frontend/backend; serviço real com adaptadores em memória (`check-creation-equipment-service.mjs`) para preservação e validação; navegador com wizard real e API simulada para subetapas, persistência entre listas, indicadores, retorno sem reset e versão móvel. Nenhuma campanha real é usada como fixture. Não há migração.
