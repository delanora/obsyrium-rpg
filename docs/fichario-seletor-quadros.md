# Seletor de quadros acima da barra — 27/11/2026

O seletor nativo na barra inferior podia abrir para baixo, com pouca área útil.
`ArchiveBoardSelect` passa a usar a mesma infraestrutura de portal dos demais
painéis da barra: lista acima do botão, rolagem própria e posicionamento limitado
à largura da tela. Seleção conserva o refresh e as guardas existentes do Fichário.
Setas, Home/End, Enter/Espaço, Escape, Tab e clique fora são suportados; a lista
indica o quadro selecionado. O controle segue bloqueado durante operações e edição.

Validação isolada: typecheck, build frontend e 51 verificações da guarda;
Chromium em desktop/celular com fixtures próprias verificou posição, seleção por
mouse/teclado e fechamento. As suítes antigas tiveram a interação com o seletor
atualizada; execução completa delas não é alegada por essa adaptação.
Sem backend, banco, migrations, restart ou publicação. A publicação requer
aprovação específica do SHA conforme AGENTS.md.
