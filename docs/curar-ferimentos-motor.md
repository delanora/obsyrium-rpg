# Curar Ferimentos — primeira ampliação da retomada jogável

Implementação local em 27/11/2026. Ainda não publicada.

## Regra e integração

Regra de referência: [Curar Ferimentos — Basic Rules 2014](https://www.dndbeyond.com/spells/2056-cure-wounds).
Uma Ação, Toque, V/S, cura 1d8 + modificador da fonte, +1d8 por nível adicional
do espaço. Sem efeito em mortos-vivos e constructos, sem concentração. O catálogo
já possui esses dados; a entrega registra a execução no motor existente.

Adjudicação espacial do Obsyrium: Toque usa autoalvo ou adjacência de 5 pés entre
footprints. Não herda alcance de arma. Sem geometria conhecida, exige confirmação
de alcance e caminho livre pelo Mestre; uma medição negativa do grid não pode ser
sobreposta por confirmação. Modificações de alcance por características especiais
não são implementadas nesta entrega. O texto não exige enxergar o alvo.

A definição usa `immediate-healing`, a mesma transação de conjuração, consumo de
espaço, Action Economy, cura e consequências de morte existentes. O validador de
alvo vivo foi extraído de Palavra Curativa, preservando seu wrapper e mensagem.
Sem novo endpoint, efeito paralelo, alteração de schema ou migration. Registro
no servidor não significa uma nova UI: o grimório continua planejado.

## Provas realizadas

- 24 verificações de contratos e targeting, incluindo provider real do grid,
  confirmação assistida, upcast e mortos; sem banco.
- 12 verificações HTTP/PostgreSQL: cura e gasto fora de combate, replay sem nova
  cura/gasto, upcast, morto recusado sem custo, Ação em combate, falta de Ação sem
  novo gasto, ausência de cura em constructos/mortos-vivos e cura a zero PV.
- 32 regressões do smoke existente de Palavra Curativa, com fixtures próprias.
- Build/typecheck backend em `/root/validacao-curar-ferimentos`, mais 51 provas da
  guarda oficial e manifest de 868 arquivos. Nenhum build na instalação ativa.

Integração em cluster PostgreSQL novo e descartável, porta 55439,
`/tmp/obsyrium-cura-pg`, schema `smoke_cure_wounds`, com servidor de teste na porta
3309. Guardas verificam porta, schema, data_directory e ausência de usuários antes
das fixtures. A autenticação HTTP usa uma conta UUID exclusiva criada nesse
cluster, confirmando o vínculo da aplicação ao banco de teste. Cleanup restrito
a IDs próprios; zero usuários após cada execução. Não foram usados dados reais.
Os serviços de teste foram encerrados após os testes; o cluster não é produção.

## Limites e composição operacional

A main pura com o Client operacional apresenta cinco erros de nulabilidade
preexistentes em Geografia e uma fixture antiga. Uma falha nova na fixture de
Toque foi corrigida, sem ignorar diagnóstico. O build completo aprovado usa no
espelho as fontes operacionais de localidades/cenas e a fixture correspondentes,
além do schema/Client preexistentes copiados. Isso não incorpora tais WIPs no
commit nem autoriza substituir todo o backend compilado.

Os 29 arquivos WIP anteriores e 977 arquivos de backend/Client/schema/migrations
permaneceram idênticos por SHA256 contra o manifest da última publicação.
Sem geração Prisma, migration, mudança na campanha ou restart de produção.
Sem teste visual de navegador, pois não há alteração de UI. Não se alega cobertura
exaustiva de todas as classes, feats de alcance, concorrência ou condições raras.
Publicação backend e eventual restart exigem autorização separada, backup e
reconciliação com a composição ativa; duplicidade de units deve ser tratada antes.

Próxima microentrega após revisão: Retomar o Fôlego com cura, uso e economia na
mesma operação autoritativa, dentro e fora de combate.
