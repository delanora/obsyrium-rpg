#!/usr/bin/env bash
# O antigo fluxo misturava build, escrita no diretório ativo e restart.
# Publicação exige SHA autorizado, backup, hashes e troca atômica separados.
set -euo pipefail
cat >&2 <<'AVISO'
DEPLOY AUTOMÁTICO DESATIVADO: este script não executa build, publicação ou restart.
Prepare um checkout isolado e siga docs/build-seguro.md.
O build validado não autoriza publicação; frontend, backend, migrations e restart
possuem autorizações distintas.
AVISO
exit 1
