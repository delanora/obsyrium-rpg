# Etapa 8 — Equipamentos iniciais

O wizard tem dez etapas: equipamentos iniciais na 8, nível/progressão na 9 e revisão na 10.

Três cards registram o caminho escolhido: equipamentos de classe e antecedente; compra com riqueza inicial determinada pela classe; ou combinação com o Mestre. A seleção abre uma subetapa lateral específica. A opção fica em `creationDraft.equipmentMethod`, sem gravar itens, moedas, compras ou rolagens de riqueza. A subetapa de classe consulta o equipamento do catálogo já existente; a de compra identifica a classe de referência, sem calcular ou sortear um orçamento nesta primeira versão.

O servidor valida a opção e a exige ao finalizar. Rascunhos antigos usam a numeração legada: `stepVersion: 2` distingue os novos, e a normalização remapeia 8→9 e 9→10 uma única vez. Rolagens, atributos e demais escolhas são preservados. Não há alteração de schema Prisma nem backfill.

Referência de equipamentos e riqueza (PHB 2014): https://www.dndbeyond.com/sources/dnd/basic-rules-2014/equipment

Verificações: builds de backend/frontend; `src/scripts/check-starting-equipment.ts` (normalização, etapas e schema); `client/scripts/check-starting-equipment-service.mjs` (serviço com adaptadores em memória, três opções salvas/retomadas sem alterar outros campos); navegador com wizard e API simulada, três cards/subetapas, payload, etapas 9/10 e celular. Nenhum dado real foi usado como fixture.
