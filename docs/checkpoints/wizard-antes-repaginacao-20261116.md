# Ponto de retorno do wizard antes da repaginada

Referência permanente: tag `codex/wizard-antes-repaginacao-20261116`.

Base funcional publicada: `37127d86655a2b9cf236ae4607e7c84ab0b3f492`.

O usuário pediu este ponto de retorno antes de enviar o asset pack da nova identidade visual. A versão inclui o wizard atual, carrosséis, avatar com molduras, ícones de raças/classes/antecedentes, Tabaxi e a bandeja/distribuição dos atributos.

Quando o usuário disser **“volta como era”**, desfazer somente a repaginada visual iniciada depois deste checkpoint. Usar os commits isolados dessa repaginada para produzir uma reversão revisável; preservar outras funcionalidades, WIPs e dados da mesa. Não executar reset destrutivo, force push nem restaurar o repositório inteiro sobre mudanças posteriores.

Os arquivos do wizard estão sem alterações locais neste checkpoint. Os WIPs existentes de inventário, geografia, música, combate e histórico são externos à repaginada e permanecem intactos, fora deste commit.

Há também uma cópia local do frontend publicado em `/tmp/wizard-pre-repaginacao-20261116/client-dist` para recuperação imediata enquanto esse backup local existir. A tag remota é a referência durável do código. Publicação no site ativo é uma operação separada da reversão do código, sujeita à autorização aplicável.
