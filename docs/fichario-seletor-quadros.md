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

## Publicação autorizada — 27/11/2026

Commit funcional `7ca8e102fd4efe27c2b13534efeb6647ef67ff01`, enviado e conferido
em main/origin/main e remoto canônico. Build/typecheck em
`/root/validacao-dropup-fichario`, 51 verificações da guarda e teste Chromium de
seleção/posição acima/fechamento em desktop e celular aprovados.

Backup integral validado em
`/opt/rpg/backups/dropup-fichario-20261127T233959Z`, com manifests e `rollback.py`.
Assets publicados antes do HTML atômico: 368 arquivos anteriores, 341 no candidato,
370 finais, bundles anteriores preservados. Todos os 341 arquivos conferidos por
SHA256 via HTTP local; bundle `assets/index-Dz7MMkFn.js`. Presença de Geografia e
player flutuante também conferida no bundle, preservando a restauração anterior.
Backend, schema, migrations e Client idênticos por hash; 29 arquivos WIP intactos.
Health `ok/database:up`, sem alterações de banco ou restart solicitado/executado.

A conferência detectou mudança operacional externa ao escopo desta entrega:
`grimorio.service` atende a porta 3000 com PID 786 e diretório `/opt/rpg`, enquanto
`rpg.service` já estava em ciclo de auto-restart por `EADDRINUSE` antes da
publicação. O serviço que atende permaneceu ativo, sem avisos recentes no journal.
Nenhum dos serviços foi alterado ou interrompido. A duplicidade de units fica como
pendência operacional separada; não equivale a health global de serviços saudável.
