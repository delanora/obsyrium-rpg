# Atlas de molduras — criação de personagem

Fonte: “Atlas de Molduras Douradas e Obsidiana.png”, imagem de 1536 × 1024 fornecida pelo usuário para a repaginada do wizard.

A ferramenta de edição de imagens preparou a transparência das áreas vazias. Os recortes usam o RGB da imagem original e somente o alfa da máscara, preservando cores, texturas e posições. As peças conservam sua resolução nativa e foram convertidas em WebP de alta qualidade.

Peças selecionadas para o wizard e o cabeçalho compartilhado:

| Arquivo | Recorte original (x, y, largura, altura) | Uso |
|---|---|---|
| moldura-painel.webp | 619, 243, 140, 169 | Contorno externo em nove partes; cantos preservados |
| divisor.webp | 21, 463, 460, 49 | Separador abaixo do título da etapa |
| ornamento-navbar.webp | 513, 755, 420, 73 | Ornamento curvo exclusivo do cabeçalho, centralizado na tela |
| cartela.webp | 1266, 618, 266, 57 | Nome da opção no painel de descrição |
| botao.webp | 1266, 778, 266, 59 | Ações principais |
| gema.webp | 523, 839, 26, 32 | Acento pequeno no título e na agulha |

O restante do atlas não é repetido como decoração. Painéis internos e navegação usam fundos discretos; as artes dos cards conservam suas próprias molduras, sem aros duplicados. Todas as regras ficam em `client/src/components/wizard-atlas.css`, limitadas ao wizard. Não altera mecânicas, banco, música, dados ou a navegação existente.

Ponto de retorno: tag `codex/wizard-antes-repaginacao-20261116`, commit `5788e6c`. A repaginada deve permanecer em commit isolado para que “volta como era” reverta somente esta mudança visual, preservando outros trabalhos.

Revisão de 17/11/2026: o divisor ganhou margem vertical para preservar a ponta inferior. O cabeçalho usa uma peça distinta, extraída com a mesma máscara de transparência já preparada, sem regenerar a textura original.

O cabeçalho usa também `ornamento-navbar-amplo.webp` (recorte 53, 880, 1430, 140), com a gema central em x=768 do atlas. O recorte fica simétrico em torno dessa gema; CSS oculta os divisores e cantos vizinhos, conservando o arabesco inferior solicitado.
