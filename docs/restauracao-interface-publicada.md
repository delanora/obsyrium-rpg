# Restauração da interface anteriormente publicada — 27/11/2026

## Causa confirmada

A publicação 8.5.4.1 reconstruiu o frontend de `git archive HEAD`, embora a
composição anterior incluísse melhorias locais ainda não versionadas. Preservar
os WIPs em disco e os bundles antigos não preservou essas funcionalidades no
bundle referenciado pelo HTML. O anterior `index-b3SPDXN9.js` contém `music-fab`
e Geografia; `index-BEp4RUM0.js` e o atual `index-Atxhy3xH.js` não contêm.
A documentação anterior de integridade dos artefatos não comprovava equivalência
funcional. O registro histórico daquela publicação fica preservado.

## Correção preparada

Versiona o subconjunto frontend das melhorias já existentes: retração animada dos
atalhos, botão Som e player aberto por clique, Geografia com Regiões, Localidades,
Cenas e vínculos opcionais. Inclui os tipos/APIs frontend correspondentes e duas
fixtures com `Scene.regionId`. Não incorpora inventário, log persistido, alterações
de combate, backend, schema nem migrations locais. O backend ativo já contém os
endpoints e contratos geográficos necessários (conferência somente de leitura).
As demais alterações locais permanecem intactas. O Fichário atual, seu roteador,
worker, textura e barra compacta foram preservados integralmente no candidato.

## Validação

Build/typecheck no checkout isolado `/tmp/restauracao-interface/checkout`, com
341 hashes e 51 verificações da guarda. Chromium com fixtures próprias/API simulada
verificou botão Som, abertura/fechamento, retração e expansão dos atalhos com
transição, três blocos da Geografia, consulta de cenas e botão acessível no
celular, sem erros JavaScript. O host exigiu bibliotecas locais do Chromium e
fonte TTF extraída somente em `/tmp`; nenhum pacote foi instalado no sistema.
O teste reproduzível fica em `client/scripts/check-interface-restaurada-browser.mjs`.
Sem dados reais como fixtures, escrita no banco ou reinício. Build não é deploy:
a publicação aguarda autorização do SHA final conforme AGENTS.md.
