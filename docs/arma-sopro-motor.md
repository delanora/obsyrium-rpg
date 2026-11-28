# Arma de Sopro — motor racial (27/11/2026)

## Escopo

Implementação local, ainda sem commit/push ou publicação. Curar Ferimentos
(`fee1dd5`) e Retomar o Fôlego (`acb8dcc`) continuam não publicados.

O Draconato prepara sua área no grid do combate ativo. A definição vem da
ancestralidade **racial**, independente da ancestralidade do Feiticeiro:
cone de 15 ft ou linha de 30 × 5 ft, tipo de dano, salvaguarda e CD de
Constituição derivados no servidor. São 2d6, 3d6, 4d6 ou 5d6 nos níveis
1, 6, 11 e 16; sucesso reduz à metade. Referência:
[Basic Rules 2014 — Dragonborn](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/races).

Ação, uso racial, versão e recibo idempotente são confirmados na mesma transação.
O descanso curto/longo reutiliza a recuperação racial existente. A área usa o
planejador e a barreira de salvaguardas das habilidades em área do bestiário:
todos os alvos são resolvidos antes do dano compartilhado. Resistência, imunidade,
concentração e morte seguem os pipelines existentes. Nenhuma magia fictícia,
segunda engine, tabela ou migration foi criada.

A prévia do jogador omite tokens ocultos; o servidor os considera mecanicamente.
O jogador não pode excluir aliados nem enviar dano, CD ou forma personalizados.
Replay diferencia também o papel autenticado, evitando reaproveitar uma resposta
privilegiada. A definição comprometida permanece estável durante a resolução.
O botão protege o próprio gesto de ponteiro contra a captura de pan do grid.

## Limites explícitos

Fora de combate, o marcador de uso continua assistido pelo Mestre, sem resolução
automática de área; nenhum combate artificial é criado. A prévia racial é local,
sem transmissão compartilhada. Não há aceite manual nem deploy. A questão dos
serviços operacionais duplicados permanece pendência antes de qualquer restart.

## Validação

- 85 casos puros: dez ancestralidades, limiares de nível, multiclasse e inválidos.
- 24 verificações HTTP/PostgreSQL: autorização, privacidade, versão, concorrência,
  replay, custos, barreira de saves, snapshot, resistência e imunidade.
- 28 regressões integradas de áreas do bestiário, em combate separado da fixture.
- Chromium real com API simulada: preparo e direção, dimensões bloqueadas,
  confirmação, ausência de exclusão de alvos, payload e botão em viewport móvel.

Banco de teste exclusivo na porta 55439, diretório `/tmp/obsyrium-cura-pg`, schema
`smoke_cure_wounds`; HTTP próprio na porta 3309. Guardas verificam isolamento e
banco vazio antes das fixtures. Cleanup restrito aos IDs criados; zero usuários,
personagens e combates ao final. Nenhum dado da campanha usado como fixture.

Build/typecheck em `/root/validacao-sopro`, usando a mesma composição operacional
isolada documentada em `retomar-folego-motor.md`: overlays de nulabilidade de
localidades/cenas, schema/Client operacional e fixture antiga só no espelho.
Não incorporam WIPs à entrega e não resolvem a divergência preexistente da main.
Não gerar Prisma nem publicar esse espelho inteiro indiscriminadamente.

Build frontend/backend e typechecks aprovados na composição isolada; proteção de
build passou 51 verificações, manifest final com 1.221 hashes. Os 29 WIPs e os
977 arquivos protegidos foram conferidos por hash e permaneceram intactos.
