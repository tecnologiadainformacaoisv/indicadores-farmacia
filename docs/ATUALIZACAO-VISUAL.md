# Atualização visual (guardada, não publicada)

Branch `atualizacao-visual`. Tudo é só de tela (HTML/CSS/JS); **nenhuma mudança no servidor** (Apps Script). A decisão da gestão é não entregar tudo de uma vez: o `main` continua na v0.5.1 e esta atualização fica guardada para entrar aos poucos.

Para ver: `node tools/visual/preview.js` e abrir `http://localhost:5510/` (dados simulados). Testes: `node tests/front.test.js` (95) e `node tests/api.test.js` (92).

Para ativar tudo: `git merge atualizacao-visual` no `main`, subir `js/version.js` (sugestão: v0.6.0) + `CHANGELOG.md`, tag e push.
Para ativar só parte: levar os arquivos/trechos do recurso desejado (tabela abaixo). Os recursos de **largura das telas** e **tela de Usuários** compartilham arquivos com outros recursos, então separar exige cuidado.

## Recursos

| Recurso | Onde | Arquivos principais |
|---|---|---|
| Largura das telas (menos rolagem): contêineres mais largos, gráficos em 3 colunas, listas em 2 | todas | `css/home.css`, `usuarios.css`, `indicadores.css`, `logistica.css`, `dashboard.css` |
| Formulário de usuário em uma faixa (campos + botão) | Usuários | `css/usuarios.css` |
| Saúde dos acessos (4 blocos que filtram), filtro por unidade, aviso de unidade sem coordenador | Usuários | `usuarios.html`, `js/usuarios.js`, `css/usuarios.css` |
| Boas-vindas por WhatsApp (a senha provisória vai na URL do `wa.me`: decidir com a TI) | Usuários | `js/usuarios.js`, `usuarios.html` |
| Desfazer ao desativar/reativar acesso | Usuários | `js/usuarios.js` |
| Tendência das saídas (mini gráfico por item) | Planilha de saídas | `js/logistica.js`, `css/logistica.css` |
| Ordenar por criticidade, filtro "Sem saída" | Planilha de saídas | `js/logistica.js`, `logistica.html` |
| Colar do Excel (várias células) | Planilha de saídas | `js/logistica.js` |
| Revisão antes de salvar (de → para, destaca fora do padrão) | Planilha de saídas | `js/logistica.js`, `logistica.html`, `css/logistica.css` |
| Mapa de calor das unidades (só coordenação, "Todas as unidades") | Indicadores | `js/indicadores.js`, `indicadores.html`, `css/indicadores.css` |
| Variação dos KPIs contra o mês anterior | Indicadores | `js/indicadores.js` |
| Frase de resumo do mês | Indicadores | `js/indicadores.js`, `indicadores.html` |
| Metas com o valor atual ao lado | Indicadores | `js/indicadores.js` |
| Formulário de lançamento: "mês anterior" sob cada campo e resultado ao vivo | Indicadores | `js/indicadores.js`, `indicadores.html`, `css/indicadores.css` |
| Faixa verde do lado bom da meta nos gráficos | Indicadores | `js/indicadores.js` |
| Botão Imprimir (CSS de impressão, sempre em cores claras) | Indicadores | `indicadores.html`, `css/isv.css` |
| Letra maior (botão A+) | todas | `js/theme.js`, `css/isv.css` |
| Atalho Ctrl+K / "/" para a busca | todas | `js/api.js` |
| Anel do painel pulsa ao concluir | Início | `js/index.js`, `css/home.css` |
| Gráficos em cor neutra (azul na Clínica, violeta na Logística), meta tracejada em cinza; status só nos selos e alertas | Indicadores | `js/indicadores.js` |
| Gráficos largos (Altas, Emergenciais) mais altos; curvas sem ultrapassar 100% (interpolação monotônica) | Indicadores, Dashboard | `js/indicadores.js`, `js/dashboard.js` |
| Fundo "painel de dados" (contornos fantasmas de KPI, barras, linha, rosca, tabela e mapa de calor, a 6,5%) + logo pequeno no canto | todas | `css/isv.css`, `assets/fundo-dados.svg` |
| Faixa de gráficos na entrada (área, barras e linha de meta; saudação por cima) | Início | `css/home.css`, `assets/hero-dados.svg` |
| Ferramentas de preview e capturas com servidor simulado | desenvolvimento | `tools/visual/` |
| Página de projeções para comparar fundos lado a lado (temporária, para decisão) | desenvolvimento | `tools/visual/projecao-fundo.html` |

## Recursos nomeados da tela inicial da rede (2026-10-27)

Cada recurso tem **tag**, arquivos próprios e um gancho mínimo em `index.html` e `js/index.js`, para poder ser trazido ao `main` sozinho (`git cherry-pick <tag>`; os conflitos esperados são só nos ganchos). Sem o script de um recurso, a tela usa o comportamento anterior.

| Tag | Recurso | Arquivos | Depende de |
|---|---|---|---|
| `visual-home-larga` | Tela inicial usa a largura toda (até 1680 px); unidades do fechamento em 2 colunas | `css/home-larga.css` | nada |
| `visual-atalhos-resumo` | Atalhos azul-marinho com número e mini gráfico só onde há dado real; Usuários sem número; Dashboard discreto | `js/atalhos-resumo.js`, `css/atalhos-resumo.css` | nada (ouve `rede:resumo` se houver o painel) |
| `visual-painel-rede` | Fechamento por município: cartão (botão) por município, quatro estados com formas distintas (tudo lançado, em andamento, nada lançado, **sem planilha ainda**), filtro por tipo, busca, lista por situação | `js/painel-rede.js`, `css/painel-rede.css`, `js/rede-catalogo.js` | nada |
| `visual-seletor-unidades` | Seletor no topo (só coordenação): janela modal acessível, filtro por município e equipamento, faixa de filtro ativo, folha em dois passos no celular; no celular os atalhos vêm antes dos municípios | `js/seletor-unidades.js`, `css/seletor-unidades.css` | `visual-painel-rede` |

Correções posteriores, a levar junto com o recurso (commits `fix(visual/<recurso>)`): `visual-painel-rede` ← "alvos de toque de 44 px nos filtros e na busca no celular"; `visual-atalhos-resumo` ← "divisor do atalho como sombra interna". Use `git log --oneline --grep="visual/<recurso>"` para listá-las.

Ordem para trazer ao `main`: `visual-home-larga`, `visual-atalhos-resumo`, `visual-painel-rede`, `visual-seletor-unidades`. Cada um sobe `js/version.js` e o `CHANGELOG.md` no `main`.

### Decisões e limites

- **Cadastro provisório.** `js/rede-catalogo.js` tem os 152 equipamentos em 12 municípios, extraídos de `../UNIDADES-ISV.md` (20/10/2026), com o tipo de cada um (Hospital, UPA, UBS, CAPS, Outros). O servidor ainda **não tem município nem tipo** na aba `Unidades`. Quando tiver, o painel passa a ler dali e o arquivo some.
- **Casamento com o painel pelo nome.** O painel (`painel.carregar`) não traz município; a unidade é achada pelo nome ou pelos apelidos (`a` no catálogo). Nome ambíguo não casa por engano: vira "Outras unidades". Hoje só as unidades de Caucaia têm planilha; os demais 148 aparecem como "Sem planilha ainda" (e não "Nada lançado"), para a contagem não ficar falsa.
- **Filtro.** Vale só na tela inicial (os atalhos "Ir para" recalculam com o recorte), fica guardado **só na sessão** (`sessionStorage`, por usuário) e é anunciado numa faixa em âmbar com o botão "Ver todas as unidades". O filtro é visual: a permissão continua no Apps Script.
- **Não feito (depende do servidor):** número de "acessos ativos" em Usuários (não existe contagem; o atalho ficou sem número), "Última atualização" por unidade e total de itens por unidade para o "em andamento" fino. Hospitais e UBS sem planilha só passam a ter dado quando as planilhas forem criadas.
- **Revisão de UX (27/10):** cartão do município é o controle acessível e os quadrados são só decoração; diálogo com `aria-modal`, foco na busca, Esc e foco devolvido; estado parcial nos municípios; alvos de 44 px; bordas de controle ≥ 3:1; âmbar (e não verde) para "filtro ativo".

Login novo (proposta, commit 249747e): `js/login-previa.js`, `js/login-seletor.js` (painel temporário de interruptores, só aparece na tela de login) e `css/home.css`. Falta escolher os itens e remover o seletor temporário antes de levar ao `main`.

## Pendências conhecidas

- Janeiro: sem mês anterior para comparar; os cálculos não separam anos (depende da regra de virada de ano, em aberto no BRIEFING).
- Cor fixa da faixa verde dos gráficos no tema escuro; "— —" duplicado nas células vazias do mapa de calor.
- Mapa de calor usa as metas padrão (as metas por unidade não são carregadas na visão "todas").

## Decisões de fundo (2026-10-22)

Escolhido para a atualização visual: fundo "painel de dados" + faixa de gráficos na entrada (opção 2 da página `tools/visual/projecao-fundo.html`; a opção 3 é só a faixa, a 1 é só o fundo). Cada parte é independente e pode ser ligada ou desligada removendo o bloco de CSS correspondente (comentado no arquivo).

Descartados ao longo da conversa: marca d'água grande do logo (commit 2541e17, v0.5.9 não publicada), padrão de ícones de saúde (comprimidos, cruz, estetoscópio: "muito simples"), ilustração de profissionais com tablets e fotos de pessoas (decisão de não usar fotos de pessoas; o tema é indicadores, planilhas e gestão).

Observações: o logo tem 256 px (um SVG ficaria mais nítido); a faixa soma ~70 px de altura na tela inicial.

## Fora desta atualização (já publicado no main)

v0.5.2 a v0.5.8: ordenar cobertura com um clique, migalhas de pão na planilha, links da unidade e dos selos na tela inicial da coordenação (`?unidade=<id>`), correções da revisão, página "Como usar", link "Relatar problema ou sugestão" (e-mail da TI), aviso de servidor lento e mensagens de lista vazia. O main até a v0.6.9 já foi trazido para este branch (merge de 2026-10-27); a ordenação da planilha ficou a do main ("Ordenar por cobertura").

Observações da revisão: a máscara do fundo só é aplicada onde o navegador a suporta (`@supports`); `tools/visual/projecao-fundo.html` grava a sessão simulada no `localStorage` do domínio onde for servida, então só use no preview local; ao juntar ao main, subir `js/version.js` e o `CHANGELOG.md`. O rodapé da página de ajuda e o aviso de servidor lento (v0.5.9 do main) já estão no main.

## Revisão de 2026-10-23 (código + UX com a skill frontend-design)
Corrigido no branch: A+ escondido no celular (o zoom não vale ali) e cartões de KPI sem sobra 4+1 com letra maior; gráficos largos com proporção própria no celular; faixa de gráficos com véu sob o texto e, no celular, só o texto (o painel de fechamento é o destaque da tela); mapa de calor com a coluna da unidade fixa e dica de arrastar no celular; fundo de dados mais discreto (4,5%); legenda e símbolos do mapa mais legíveis; "Acima do limite" em indicadores de limite máximo (PRM); ponto em CSS no lugar de emoji nos alertas; Ctrl+K resistente a teclas sem nome; resumo da revisão antes de salvar anunciado a leitores de tela.
Ainda em aberto: virada de ano (mês anterior de janeiro) na variação, tendência e "sem saída".
