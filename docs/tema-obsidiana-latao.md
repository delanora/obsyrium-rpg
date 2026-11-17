# Tema compartilhado de obsidiana e latão

O acabamento global fica em `client/src/obsidian-theme.css`, importado por `styles.css`. A alteração é de apresentação: não modifica endpoints, operações, regras, banco nem permissões.

A paleta usa obsidiana fria, texto marfim e latão envelhecido. Seções, listas, tabelas, campos e navegação compartilham esses tokens. Molduras do atlas são reservadas às janelas maiores e ao salão do Mestre; cartelas ficam nas ações principais dos diálogos. Cores semânticas de vida, dano, condições e perigo continuam distintas.

As bandejas preservam interior, dados, efeitos, animações e artes originais. Somente botões e contorno externo acompanham o tema. Os tokens internos foram isolados, inclusive na bandeja de atributos do wizard.

Validação: build/typecheck do frontend; verificações de UI de combate; 36 verificações de preparação em React/jsdom com fetch substituído por respostas em memória; navegador com componentes reais do salão do Mestre, cabeçalho e seções, composições representativas de ficha/combate e diálogo em desktop/celular; login/cadastro simulados; wizard; fluxo completo dos quatro D6, repetição de resultado baixo e distribuição; comparação dos estilos internos das duas bandejas com o CSS publicado anteriormente. As composições visuais não são um smoke de uma sessão real de combate. Nenhum teste modifica dados da campanha.

Reversão: retirar somente a importação e este arquivo de tema. Preservar os ícones, funcionalidades, estilos anteriores do wizard/login e os trabalhos paralelos. A autorização de publicação automática foi dada pelo usuário para esta repaginada global.
