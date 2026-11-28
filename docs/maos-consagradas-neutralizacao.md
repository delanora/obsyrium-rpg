# Mãos Consagradas — neutralização por origem (28/11/2026)

## Escopo funcional

No mesmo diálogo da ficha e Hotbar, o Paladino escolhe entre cura de PV e
neutralização. Escolhe uma ou mais afecções registradas do mesmo alvo; o servidor
cobra cinco pontos por origem, numa única Ação em combate. Não aceita custo,
quantidade de pontos ou resultado enviados pelo cliente nesse modo. Não mistura
cura e neutralização numa mesma operação.

Referência: [Paladino — Basic Rules 2014](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/classes#Paladin).
O PHB permite neutralizar múltiplos venenos/doenças, pagando separadamente por
cada um. Constructos e mortos-vivos continuam sem efeito; a ativação gasta os
pontos e a Ação, sem remover registros ou sintomas.

Reutiliza a transação de Mãos Consagradas: posse, saldo, incapacidade, toque,
versões da fonte/alvo, trava de combate, economia e recibo idempotente. O modo e
as origens distinguem o fingerprint da cura. A ordem dos IDs é normalizada para
replay; duplicatas são inválidas. Um ID inexistente ou não autorizado recusa o
lote inteiro antes de gastar ou remover qualquer origem válida.

`removeAffliction` usa o cleanup central por fonte. Só os registros selecionados
e seus sintomas são encerrados. Conditions legadas, Effects, outra afecção,
queda independente e ciclo de morte permanecem. Neutralizar não restaura PV,
não ressuscita e não reinicia Concentração que já terminou.

## Publicação de diagnósticos

As origens nascem privadas. O Mestre pode publicar/tornar privada cada origem
pelo painel mecânico existente, com versão e operationId; jogadores não podem
executar essa administração.

O Paladino vê suas próprias origens e as publicadas pelo Mestre nos outros alvos.
A operação revalida esse acesso no commit: saber um ID privado não permite curar
ou consultar a origem. Diagnósticos privados são omitidos tanto de NPCs quanto
de personagens na projeção comum do combate. O proprietário continua recebendo
seu estado completo na ficha/consulta privada.

A projeção pública mantém os sintomas mecânicos, mas retira identificadores,
rótulos e metadados das origens privadas, além de logs de afecção. Sintomas
privados equivalentes são agrupados numa etiqueta estável, sem expor sua contagem. Para origens
publicadas, expõe identidade/tipo/nome necessários à seleção, sem autoria ou
instante de aplicação. Não divulga quantas origens privadas existem.

## Limites explícitos

Somente afecções registradas no domínio novo são tratáveis. Conditions manuais
ou Effects antigos não são reclassificados; venenos de conteúdo ainda não
integrado, dano periódico, incubação e progressão continuam assistidos. Não é
cobertura completa de todos os venenos, doenças e magias do PHB.

O toque mantém a regra da entrega anterior: autoalvo também fora de combate;
outros alvos apenas com geometria confiável no mesmo combate, sem barreiras ou
altura divergente. Não foi criada confirmação espacial pelo jogador nem uma
fila nova de adjudicação. Esses casos continuam assistidos pelo Mestre.

## Validação

- 34 verificações HTTP/PostgreSQL de neutralização: custo, lote, replay em ordem
  inversa, concorrência, payload, saldo, incapacidade, turno, versões, alcance,
  NPCs, constructos/mortos-vivos, publicação e recusa de IDs privados.
- 36 regressões da cura variável de PV e 18 da administração de afecções.
- 23 contratos puros de afecções, incluindo projeção pública seletiva e autoria.
- Chromium real com Hotbar/CombatTracker e API simulada: modo, seleção, custo,
  saldo insuficiente, payload sem custo cliente e apresentação móvel; regressão
  do diálogo de cura de PV também aprovada.
- Builds/typechecks frontend e backend no espelho isolado, com frontend validado
  novamente após refinamento do formulário. Guarda de build: 51 verificações.
- Suíte ampla: 604 aprovações e CB138/SC14 anteriores, já reproduzidas na base.
  Não declaradas resolvidas. Avisos de bundle e import dinâmico ineficaz permanecem.

## Operação e separação das entregas

Espelho `/root/validacao-sopro` reúne as três microentregas locais de Mãos
Consagradas e os overlays operacionais anteriores de nulabilidade de localidades/
cenas e Client existente. Não publicar esse espelho inteiro indiscriminadamente.
Sem schema Prisma, migrations ou geração de Client novos.

Banco descartável em 55439, diretório `/tmp/obsyrium-cura-pg`, schema
`smoke_cure_wounds`, HTTP próprio 3309. Guardas verificam isolamento e tabelas
vazias. Fixtures próprias; cleanup apenas dos IDs criados e zero usuários,
personagens e combates ao terminar. Nenhum dado da campanha como fixture.

A cura de PV foi versionada isoladamente em `02e9ba4`, com push confirmado.
Fundação e neutralização compõem a extensão seguinte, com commit/push autorizados
pelo responsável em 28/11/2026. WIPs alheios e artefatos ativos preservados.
Sem deploy, restart, alteração do banco real ou aceite de produção.

O rollback futuro precisa preservar o normalizador de afecções e sua visibilidade.
Backend antigo pode descartar o campo novo ao regravar; não apagar preferências
nem restaurar indiscriminadamente o banco. Procedimento compatível deve ser
preparado e validado antes de eventual publicação autorizada.

Versionamento confirmado em 28/11/2026: cura `02e9ba48389228224c22db6212910bef2ef744f5`
e extensão `2a8eb3725db701cd11bc1356a5a05c3049ace98c`, ambos enviados à main.
Os fontes versionados correspondem ao espelho validado; publicação não executada.
