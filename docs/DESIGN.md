# Design do sistema: método, decisões e como repetir

> Escrito para quem vai mexer na interface. Registra por que o visual é como é, o que aproveitamos de uma
> referência externa (a página da VOAS Contabilidade) e o passo a passo para o próximo ajuste nascer com o mesmo rigor.

## 1. O problema: a primeira versão parecia "padrão"

A v0.1 a v0.4 funcionava, mas tinha os vícios que a skill `frontend-design` do ISV (`../_ux-design/skills/frontend-design/SKILL.md`) lista como marcas de página gerada:

| Vício | Onde aparecia |
|---|---|
| Kit de cartões: tudo em cartões iguais, mesmo raio, mesma sombra | Tela inicial era uma pilha de 4 cartões idênticos |
| "Abrir →" em todo link | Cada cartão da tela inicial |
| Estrutura sem informação: nada priorizado | Tela inicial não respondia "o que falta fechar?" |
| Cor sem significado | Número de KPI em vermelho com selo verde "Meta atingida" |
| Dado crítico tratado como o resto | Estoque zerado igual a qualquer linha da planilha |
| Cabeçalho pesado | 4 botões ocupavam 1/4 da tela no celular |

## 2. O que aproveitamos da referência (e o que não serve)

A página da VOAS mostra uma forma de fazer "robusto" e com personalidade. As técnicas abaixo são transferíveis; o resto é de página de venda, não de ferramenta de trabalho.

**Transferível**
- **Um só lugar com os tokens.** Cores, tipografia, espaços e raios num único `:root`, com nomes que dizem o papel (`--navy-deep`, `--verde`, `--title`), não o valor. Aqui: `css/isv.css`.
- **Superfícies com papel.** Fundo claro para trabalhar, painel escuro para o que importa. Aqui: o painel escuro "Fechamento do mês" contra o fundo claro.
- **Prévia com dado real em vez de ilustração genérica.** A referência mostra um DRE, um fluxo de caixa. Aqui: o próprio fechamento do mês, a cobertura de estoque.
- **Papéis tipográficos claros.** Uma família para títulos e números (Manrope), outra para texto (Segoe UI). Números com `font-variant-numeric: tabular-nums`.
- **Robustez como regra, não detalhe.** Link "pular para o conteúdo", foco visível (`:focus-visible`), `prefers-reduced-motion`, `[hidden]` forçado com `!important`, `inert` em painéis escondidos, margens seguras do celular (`env(safe-area-inset-*)`), fallback quando uma imagem não carrega, nada que dependa só de cor.
- **Texto que diz o que acontece.** Botões com verbo ("Continuar lançamento"), vazio e erro que orientam.

**Não serve para nós (e por quê)**
- WebGL/3D, rolagem suave (Lenis), tela de abertura animada, seções "presas" à rolagem: são efeitos de vitrine. Nosso uso é diário, no celular e em rede de hospital, onde rapidez e previsibilidade valem mais.
- Rótulos em caixa alta com fonte monoespaçada em toda parte: a própria skill do ISV lista isso como vício.
- Copiar a marca. A identidade é do ISV: azul `#0a3d62`, verde do logo, logo oficial.

## 3. Direção adotada

**Assunto e tarefa.** Farmácia hospitalar fechando o mês. Quem lança precisa saber "o que falta"; quem acompanha precisa saber "quem já fechou". Tudo gira em torno do **fechamento do mês**.

**Elemento memorável (um só).** O painel escuro **Fechamento de Maio/2026** na tela inicial: anel de progresso, uma linha por tarefa (coordenador) ou por unidade (coordenação), ação primária em âmbar. O resto é quieto.

**Cores (base)**
| Nome | Valor | Papel |
|---|---|---|
| `--navy-deep` | `#082c47` | Cabeçalho e painéis de destaque |
| `--title` / primary | `#0a3d62` | Títulos e ação principal (claro `#8fc7f0` no escuro) |
| `--verde` | `#27ae60` | Linha do cabeçalho, avatar, "concluído" |
| âmbar | `#f0b44f` | "Pendente" e ação a fazer (sobre fundo escuro) |
| `--c-err` | `#c0392b` | Só para erro real e estoque crítico |
| fundo | `#f0f4f8` | Papel de trabalho (escuro `#0e1a26`) |

Regra: **cor de série de gráfico nunca vira cor de status**. O número do KPI é neutro; o selo diz se a meta foi atingida.

**Tipografia.** Manrope 800 em títulos e números grandes; Segoe UI no texto; sentença normal em rótulos (sem caixa alta).

**Cartões.** Os de **conteúdo** (gráficos, tabelas) são planos, com borda fina; só os KPIs têm leve elevação; atalhos secundários não têm sombra. Hierarquia por peso, não por enfeite.

**Movimento.** Só o que responde a uma ação (foco, hover, barra de progresso). Esqueleto de carregamento no lugar de "Carregando…". Nada de entrada animada por seção.

## 4. Receita para o próximo ajuste

1. **Brief em 3 linhas:** assunto, quem usa (e em que aparelho), qual é a tarefa principal da tela.
2. **Plano de tokens antes do código:** 4 a 6 cores com nome e papel, as duas fontes, e um esboço em ASCII do layout. Confira contra a lista de vícios da seção 1: se parece o que você faria para qualquer sistema, mude.
3. **Escolha um elemento memorável** e deixe o resto quieto.
4. **Implemente com os tokens** (nada de cor ou tamanho solto nos componentes). Conferir também o tema escuro.
5. **Veja em navegador de verdade**, nos dois temas e em 390 px e 1280 px: `tools/visual/` (seção 5). Olhar o código não basta: foi olhando as capturas que apareceram o KPI vermelho com selo verde e a coluna de estoque escondida no celular.
6. **Rode os testes** (`tests/`) e o agente `ux-revisor` antes de publicar.
7. **Suba a versão** (`js/version.js` + CHANGELOG) e publique.

## 5. Ferramentas no repositório

| O quê | Como |
|---|---|
| Capturas de tela com servidor simulado e dados realistas | `cd tools/visual && npm install` (usa o Chrome já instalado, sem baixar navegador) e `node capturas.js ROTULO index,logistica claro,escuro 1280,390 admin,coordenador`. As imagens saem em `tools/visual/out/` (fora do git). |
| Testes do servidor (92 verificações) | `node tests/api.test.js` |
| Testes das telas (58 verificações) | `node tests/front.test.js` |

As capturas interceptam as chamadas à API e devolvem dados de exemplo, então não precisam de internet nem do Apps Script. Para testar uma tela nova, acrescente o caso no `responder()` de `tools/visual/capturas.js`.

## 6. Skills: o que usar e o que não

- **Usar:** `frontend-design` (oficial da Anthropic, já adotada em 15/10/2026) e o agente `ux-revisor`.
- **Disponível no repositório oficial** (`github.com/anthropics/skills`, conferido em 22/10/2026): `frontend-design`, `theme-factory`, `canvas-design`, `webapp-testing`, `web-artifacts-builder`. O que `webapp-testing` oferece (testar página em navegador de verdade) já está coberto por `tools/visual/`.
- **Não usar:** o pacote "UI/UX Pro Max" e derivados (`ui-ux-pro-max`, `design-system`, `ui-styling`, `banner-design`, `brand`, `slides`): descartados em 15/10/2026 por não terem repositório verificável (regra em `../_ux-design/agents/ux-revisor.md`). Se a equipe quiser rever essa regra, é decisão consciente, registrada em `../_ux-design/referencia/`.

## 7. Próximos passos de design

- Esqueleto de carregamento também na tela de usuários e no dashboard.
- Dashboard com dados reais, no mesmo padrão (um elemento memorável, KPIs neutros, selos de status).
- Filtro por unidade na tela inicial da coordenação (hoje o painel mostra todas as unidades).
- Impressão: definir o que sai na impressora (fechamento do mês) antes de alguém precisar.
