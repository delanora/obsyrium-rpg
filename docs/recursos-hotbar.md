# Recursos executáveis na Hotbar (28/11/2026)

## Comportamento

Retomar o Fôlego, Surto de Ação e Arma de Sopro aparecem a partir dos recursos
que o DTO autoritativo concede ao personagem. Catálogo sem executor não vira
atalho. Nível, raça, saldo e recuperação continuam derivados no servidor.
A integração é do jogador; não acrescenta controle de ficha alheia ao Mestre.

Sem organização salva, os recursos entram automaticamente na grade após os
ataques disponíveis. Com organização salva, preservam-se posições e vazios
intencionais: novos recursos aparecem em “Ver todas” e no editor para atribuição.
Remover um atalho não o faz reaparecer num espaço vazio. Perder acesso à classe
ou raça desativa a referência salva; não concede posse nem consome nada.

A preferência JSON aceita `feature` para os três IDs registrados, além de
`attack`. Referências desconhecidas são recusadas. A identidade usa categoria
mais origem para impedir colisão entre ataque e recurso homônimos. Nada além
da referência é persistido. Sem schema Prisma, migrations ou geração de Client.

Os cliques chamam os mesmos executores da ficha. Retomar o Fôlego e Surto usam
versão atual e operationId gerado pela API existente; a resposta atualiza a
ficha por versão e o realtime atualiza o combate. Há bloqueio de envio em voo.
O Sopro consulta as opções e abre a preparação existente no grid, sem consumir
uso antes de confirmar a área. Trocar para recurso limpa a seleção de ataque;
trocar de combate descarta a solicitação de área. A interface indica turno,
saldo e economia indisponíveis; o servidor revalida todas as guardas.

Futuros recursos precisam de executor e registro explícitos antes de entrar na
Hotbar. Magias, itens e recursos sem executor não foram adicionados nesta entrega.
Surto não foi classificado como Ação ou Bônus: ativá-lo continua sem esses custos.

## Validação

- 21 contratos puros de descoberta, progressão por DTO, perda de acesso,
  bloqueios, categorias, persistência, colisões e preservação da organização.
- 18 verificações HTTP/PostgreSQL, incluindo as regressões de personalização:
  salvar/recarregar, replay, concorrência, payload inválido, referências dos três
  recursos e ausência de gasto ao organizar a Hotbar.
- Chromium real com API simulada, CombatTracker e Hotbar reais: dois executores
  de classe, atualização da versão, bloqueio após uso, preparação racial sem
  consumo, layout vazio intencional, editor/salvamento com categoria feature,
  screenshots desktop e celular. Fixtures exportadas dos smokes próprios.
- Typechecks e build frontend/backend no espelho isolado; validação final do
  frontend após o ajuste da seleção de ataque.

A suíte ampla `test:combat-ui` não está verde: CB138 (asserção estrutural do
registro de cura) e SC14 (composição de cenas com vínculos operacionais) falham
igualmente antes e depois. A comparação usou fontes da HEAD anterior, no mesmo
espelho e com as mesmas dependências. Não foram declaradas flakes nem corrigidas
fora deste escopo. SC144 e SC174 foram atualizadas para incluir resourceBusy,
mantendo o bloqueio de pré-iniciativa e morte; as demais verificações passaram.

## Isolamento e operação

Espelho `/root/validacao-sopro`, reutilizado das entregas anteriores, com overlays
operacionais de nulabilidade de localidades/cenas e Prisma Client existente.
Esses overlays não integram o commit; a divergência preexistente da main com o
Client operacional permanece. Não publicar o espelho inteiro indiscriminadamente.

Integração em PostgreSQL na porta 55439, diretório `/tmp/obsyrium-cura-pg`, schema
`smoke_cure_wounds`, HTTP próprio na porta 3309. Guardas conferem porta, schema,
diretório e banco vazio. Fixtures próprias e cleanup somente de seus IDs; zero
usuários, personagens e combates ao terminar. Nenhum dado real como fixture.

Os WIPs de CombatTracker e do teste amplo foram separados no staging; a linha
anterior `presentation="dock"` e as alterações de cenas dos testes não pertencem
a esta entrega. Os demais WIPs e artefatos ativos são conferidos por hash.

Implementação validada, sem publicação, restart, migration ou aceite em produção.
Curar Ferimentos, Retomar o Fôlego, Sopro e Surto permanecem não publicados.
A duplicidade de serviços operacional continua pendência anterior ao restart.
