# Surto de Ação — motor de classe (28/11/2026)

## Escopo e contrato

Surto de Ação executável pelo botão de recursos da ficha do próprio jogador.
O servidor deriva a posse e os usos do catálogo: Guerreiro 2 recebe um uso;
Guerreiro 17 recebe dois por descanso curto/longo, mas só um por turno.
Referência: [Guerreiro — Basic Rules 2014](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/classes#Fighter).

A operação exige turno próprio em combate ativo e personagem capaz de agir.
Concede exatamente uma Ação, sem consumir Ação/Bônus para ativar, sem restaurar
Movimento, Reação ou Ação Bônus e sem alterar Ataque Extra. Reutiliza a mesma
TurnEconomy dos ataques e magias. Nenhuma restrição artificial de uma magia de
nível por turno; a regra de magia de Ação Bônus permanece no motor de conjuração.

Uso na ficha, concessão na economia e recibo idempotente são atômicos. Guardas de
versão da ficha, combate e combatente previnem cruzamento com mudança de turno.
O cliente envia somente expectedVersion e operationId. Pedidos repetidos retornam
o snapshot; outra operação com a mesma chave falha sem consumo. Realtime atualiza
ficha e combate depois do commit.

`actionSurgeUsed` é um booleano no JSON da economia, com default false para dados
legados. Somente o início do próximo turno recria a economia normal e limpa o
marcador. Não há schema Prisma, migration ou geração de Client nesta entrega.
O máximo de usos continua derivado; somente o gasto fica na ficha.

Fora de combate a ativação é recusada sem custo: a concessão depende de um turno.
Isso não cria encontro artificial. Exploração e passagem de tempo continuam
pendências próprias. Não há Hotbar nova nem remodelação do grimório.

## Validação e isolamento

- 24 verificações HTTP/PostgreSQL: posse, nível, duas reservas no nível 17,
  limite por turno, turno seguinte, recarga, estados impeditivos, versão,
  replay, concorrência, payload estrito e rollback dos custos.
- Duas conjurações reais de Curar Ferimentos usam as duas Ações; terceira falha.
  A restrição de magia bônus foi conferida no helper canônico.
- Chromium com fixture própria e API simulada: botão, pendência, saldo, erro,
  modo leitura e viewport móvel.
- Regressão de Retomar o Fôlego: 20 verificações HTTP/PostgreSQL.
- Regressão do Sopro racial: 24 verificações HTTP/PostgreSQL e 28 de áreas do bestiário.
- Build frontend/backend e typechecks aprovados; 51 verificações da guarda de build,
  manifest com 1.225 hashes. Aviso de bundle grande do Vite permanece.
- 29 WIPs e 977 arquivos protegidos intactos por hash.

Validação em `/root/validacao-sopro`, espelho isolado reutilizado da entrega
anterior, com os overlays operacionais de nulabilidade de localidades/cenas e
Prisma Client já compatível. Os overlays não integram este commit; a divergência
preexistente da main com esse Client não foi corrigida. Nunca publicar o espelho
inteiro indiscriminadamente. Build/typecheck apenas nesse espelho.

PostgreSQL exclusivo na porta 55439, data_directory `/tmp/obsyrium-cura-pg`, schema
`smoke_cure_wounds`, HTTP próprio na porta 3309. Guardas verificam diretório,
porta, schema e ausência de usuários/personagens/combates. Cleanup apenas dos IDs
criados; dados da campanha nunca são fixtures. Processos de teste encerrados.

## Estado

Implementado e validado, sem deploy ou aceite de produção. Curar Ferimentos,
Retomar o Fôlego e Arma de Sopro também continuam aguardando publicação autorizada.
A duplicidade de serviços operacional permanece pendência separada antes de
qualquer restart. Próxima entrega deve receber escopo e provas próprios; Mãos
Consagradas e Inspiração de Bardo seguem na expansão guiada por dependências.
