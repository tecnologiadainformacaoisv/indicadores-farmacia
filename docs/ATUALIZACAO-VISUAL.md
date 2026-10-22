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
| Ferramentas de preview e capturas com servidor simulado | desenvolvimento | `tools/visual/` |

## Pendências conhecidas

- Janeiro: sem mês anterior para comparar; os cálculos não separam anos (depende da regra de virada de ano, em aberto no BRIEFING).
- Cor fixa da faixa verde dos gráficos no tema escuro; "— —" duplicado nas células vazias do mapa de calor.
- Mapa de calor usa as metas padrão (as metas por unidade não são carregadas na visão "todas").
