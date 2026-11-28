# Retomar o Fôlego — motor e acesso pela ficha

Implementação de 27/11/2026, commit funcional
`acb8dccdced4bd656128b8e34d257a877938a6f9`, enviado à main e conferido no remoto
canônico. Roadmap.md e Roadmap do Drive sincronizados; ainda não publicada.

## Comportamento

Referência: [Guerreiro — Basic Rules 2014, Second Wind](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/classes#SecondWind).
Cura própria de 1d10 + nível de Guerreiro, com um uso recuperado em descanso curto
ou longo. Em combate ativo, somente no próprio turno e consumindo Ação Bônus.
Fora de combate, não exige criar um encontro. A pré-iniciativa permanece bloqueada
até o início dos turnos, acompanhando a indisponibilidade dos controles de combate.

Novo endpoint privado `POST /api/characters/me/features/second-wind`: recebe apenas
`expectedVersion` e `operationId`. Não aceita alvo, resultado, quantidade de cura,
nível ou custo fornecidos pelo cliente. Deriva a posse e o saldo do catálogo e a
cura exclusivamente do nível de Guerreiro, inclusive em multiclasse. Personagem
morto, incapacitado ou com zero PV não pode acionar a característica. A PV máximos,
o uso pode ocorrer e é consumido, sem ultrapassar o teto ou alterar PV temporários.

Reutiliza Action Economy, contexto de turno, resolvedor de cura, CharacterOperation,
DTO e realtime existentes. Guarda estrutural do combate estabiliza o turno antes
da economia; CAS da ficha ocorre antes de rolar. Cura, recurso, economia, registro
e recibo ficam na mesma transação. Replay devolve o snapshot persistido, sem nova
rolagem; chave de outro tipo é recusada. Concorrência não pode produzir duas curas
com o mesmo saldo/versão. O estado persiste somente uso, não máximo do recurso.

A característica não cria SpellCast nem aplica a restrição de magia de Ação Bônus.
A ficha recebe botão no card de recurso, com estado pendente, erros e bloqueios de
saldo/somente leitura. A atualização adota o DTO retornado com guarda de versão;
nenhum PATCH otimista executa a cura. O registro de dados recebe a rolagem após o
commit. Falhas de notificação não convertem uma operação confirmada em erro HTTP.
Não acrescenta slot de Hotbar nem controle de outros personagens pelo Mestre.

## Validação

- 20 verificações HTTP/PostgreSQL: cura fora de combate, nível de classe em
  multiclasse, teto/PV temporários, posse, payload estrito, versão antiga,
  idempotência, chave de outro tipo, concorrência com chaves iguais e distintas,
  estado impeditivo, falta de saldo, turno e Ação Bônus; conjuração de Ação continua
  permitida após a característica. A recarga curta foi conferida pelo helper
  canônico de descanso, sem alegar execução HTTP de um descanso nesta suíte.
- Chromium com DTO de fixture própria: botão em ficha finalizada, pendência,
  bloqueio por saldo, erro recuperável, modo somente leitura e largura de celular.
  API simulada, sem campanha.
- Typecheck e build frontend/backend em `/root/validacao-retomar-folego`; 51
  verificações da guarda de build, manifest de 1213 arquivos. Nenhum build ativo.

O build usa a mesma composição operacional de compatibilidade geográfica da
entrega anterior: fontes de localidades/cenas, Client e fixture antiga somente
no espelho. A divergência preexistente de nulabilidade da main não foi corrigida
nem os WIPs incorporados à entrega. O backend anterior em produção não foi
substituído. Não executar o build inteiro como deploy indiscriminado.

Integração em PostgreSQL exclusivo de teste na porta 55439, data_directory
`/tmp/obsyrium-cura-pg`, schema `smoke_cure_wounds`; servidor próprio na porta 3309.
Guardas conferem porta, schema, diretório e ausência de usuários, fichas e combates
antes das fixtures. Token de conta UUID própria confirma que o HTTP usa o mesmo
banco. Cleanup restrito aos IDs criados; zero usuários/fichas/combates depois.
Sem dados reais como fixtures, migrations ou geração Prisma. Os processos de teste
são encerrados após a validação. 29 WIPs e 977 arquivos protegidos preservados por
hash contra o manifest operacional anterior.

## Estado e continuidade

Commit/push concluídos e remoto conferido. Aguarda publicação autorizada; não há
aceite manual de produção.
O serviço operacional duplicado continua pendência separada antes de restart.
Curar Ferimentos segue versionado em `fee1dd5`, ainda não publicado; esta entrega
não muda seu status. Próxima microetapa planejada: Arma de Sopro racial, com área,
CD, salvaguarda, dano, uso e recarga no mesmo fluxo autoritativo.
