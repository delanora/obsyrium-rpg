# Mandrágora (Mandrake) — conteúdo adicional

Fonte: PDF “Valdas Mandrake.pdf”, enviado pelo usuário, duas páginas numeradas 10 e 11. Inclusão autorizada como exceção ao catálogo PHB 2014.

## Implementação

- Raça `mandrake`, nome exibido Mandrágora; Sabedoria +2, tamanho Médio, caminhada 9 m, idioma Comum, sem visão no escuro.
- Primavera: Destreza +1, caminhada 10,5 m, resistência a dano elétrico.
- Verão: Força +1, resistência a fogo.
- Outono: Carisma +1, resistência a veneno; Baga Abençoada racial já no nível 1.
- Inverno: Constituição +1, resistência a frio; permanece Médio.
- Clava Mágica usa Sabedoria desde o nível 1. Baga Abençoada é concedida no nível 3 (nível 1 no Outono), e Pele de Árvore no nível 5, com um uso independente por descanso longo para cada magia limitada.

Os resolvedores raciais e os contadores existentes são reutilizados. Os mesmos IDs de recurso continuam válidos ao subir de nível, sem conceder outro uso de Baga Abençoada ao Outono no nível 3. A criação descreve apenas o que está disponível no primeiro nível; a ficha recebe as magias conforme o nível total.

## Limites da automação

Continuam descritivos: nutrição pela luz solar, respiração/absorção pelas extremidades, proficiência condicional de Furtividade em ambiente natural, comunicação e consulta a plantas, vantagens situacionais de Raízes Profundas, Compleição Poderosa e a possibilidade de escolher o próprio membro como clava. Não se concede proficiência global em Furtividade nem se muda o tamanho real do Inverno.

A cura das bagas do Outono é igual à proficiência, conforme o PDF; essa exceção não altera a magia global de Baga Abençoada e requer resolução pelo Mestre nesta entrega. Conceder uma magia na ficha e controlar seus usos não equivale a implementar um novo handler de execução ou targeting especial no combate.

Não há migração nem mudança de fichas existentes. Os testes de catálogo, progressão e descanso são puros e não acessam banco. A conferência do wizard usa API simulada.
