# Indicadores da Farmácia — ISV

> Arquivo de contexto para Claude Code. Leia este arquivo inteiro antes de qualquer tarefa.

---

## Visão geral do projeto

Sistema para os **coordenadores farmacêuticos das unidades de saúde** lançarem, todo mês, os indicadores da farmácia, e para a **coordenação farmacêutica do Instituto (Tereza)** acompanhar todas as unidades. Regras completas em [docs/BRIEFING.md](docs/BRIEFING.md).

- **Perfis:** `admin` (Tereza: vê tudo, define metas, não lança) e `coordenador` (lança e vê só a própria unidade).
- **Piloto:** Caucaia, começando pelas UPAs (modelo de planilha UPA). Unidades e apelidos em [`../UNIDADES-ISV.md`](../UNIDADES-ISV.md).
- **Mês de referência:** sempre o mês que fechou. Só ele fica aberto; os anteriores ficam visíveis e bloqueados.

**Stack:** front estático (HTML/CSS/JS vanilla + Chart.js 4.4.1, GitHub Pages) + API em **Google Apps Script** (Web App na conta da TI) + **Planilhas Google** como base.

---

## Estrutura de arquivos

```
projeto-indicadores-farmacia/
├── index.html              ← login, troca da senha provisória e menu inicial
├── indicadores.html        ← acompanhamento mensal (lançamento + metas + gráficos)
├── logistica.html          ← planilha de saídas: lançamento item por item
├── usuarios.html           ← cadastro de coordenadores (só admin)
├── ajuda.html              ← "Como usar": passo a passo curto (sem login)
├── dashboard.html          ← dashboard (só admin; dados de EXEMPLO fixos, ainda não ligado à base)
├── .clasp.json             ← ID do projeto Apps Script (a conta logada no clasp precisa ser a da TI)
├── appscript/
│   ├── appsscript.json     ← manifesto (Web App: executa como a TI, acesso anônimo)
│   └── codigo.js           ← API, regras de permissão e funções de administração
├── assets/logo-isv.png     ← cópia de ../shared/assets/
├── css/
│   ├── instituto.css       ← cópia de ../shared/styles/instituto.css (tokens ISV)
│   ├── isv.css             ← tema claro/escuro, cabeçalho, rodapé, login, avisos (comum)
│   └── home.css · dashboard.css · indicadores.css · logistica.css · usuarios.css · ajuda.css
├── js/
│   ├── version.js          ← ÚNICA fonte da versão exibida
│   ├── theme.js            ← tema claro/escuro (carregado no <head>)
│   ├── api.js              ← API_URL, chamadas à API, sessão, cabeçalho com usuário
│   └── index.js · indicadores.js · logistica.js · usuarios.js · dashboard.js
├── data/                   ← planilha-fonte local (fora do git)
├── tests/                  ← api.test.js (servidor) e front.test.js (telas): `node tests/api.test.js`
├── tools/visual/           ← capturas de tela em navegador real com servidor simulado (ver docs/DESIGN.md)
│                             (`auditar-bordas.js`: mede o contraste das bordas nas telas e nos dois temas)
└── docs/
    ├── BRIEFING.md         ← regras de negócio definidas com a Tereza
    ├── DESIGN.md           ← método e decisões de design, receita para repetir
    └── IMPLANTACAO.md      ← passo a passo clasp / Apps Script / Web App
```

---

## Ecossistema (ISV / Desenvolvimento)

Este projeto faz parte da pasta `Desenvolvimento/`, que reúne os sistemas do
**Instituto São Vicente (ISV)**. Padrões compartilhados ficam em:

- **Comandos e agentes:** `~/.claude/` — `/atualizar`, `/encerrar`, agente `revisor`
  (funcionam em qualquer projeto, independente da pasta aberta).
- **Assets/estilos/componentes comuns:** `../shared/`
- **UX/UI (revisão de interface):** `../_ux-design/` — agente `ux-revisor` + skill `frontend-design`
  (oficial da Anthropic) + tokens e lições do ISV. Rode o `ux-revisor` antes de implantar telas novas.
- **Referência de comandos:** `../COMANDOS-CLAUDE.md`
- **Unidades atendidas:** `../UNIDADES-ISV.md`

> ⚠️ **NÃO ler nem indexar as pastas dos outros projetos** (`projeto-*`, `pessoal-*`)
> a menos que explicitamente solicitado. Eles existem e compartilham padrões, mas
> estão fora do escopo desta sessão — ler para não pesar contexto/tokens à toa.

---

## Dados e persistência

Tudo na pasta **"Indicadores Farmácia"** do Drive da **conta da TI** (ID na propriedade de script `PASTA_ID`, fora do repositório, que é público), compartilhada com `institutosaovicente@gmail.com` (Tereza).

- **Planilha "Indicadores Farmácia — Sistema"** (criada por `configurarSistema()`; ID na propriedade de script `SISTEMA_ID`):
  - `Usuarios` (senha com salt + hash SHA-256 iterado; `trocarSenha` obriga troca no 1º acesso)
  - `Unidades` (`id`, nome, município, modelo, `planilhaId` da planilha de saídas)
  - `Metas` (uma linha por unidade × indicador; unidade nova recebe as metas padrão)
  - `Lancamentos` (1 linha por unidade/ano/mês, campos do formulário "Lançar dados")
  - `Config` (`MES_ABERTO_TESTE` fixa o mês aberto nos testes, ex. `2026-05`)
  - `Log` (quem fez o quê)
  - `Fechamento` (andamento da planilha de saídas por unidade/mês: itens com saída lançada; alimenta o painel da tela inicial; criada sozinha)
- **Pasta "Backup"** (dentro da pasta do projeto): `backupDiario` (gatilho das 2h; `backupAgora` à mão) copia a planilha Sistema e as planilhas de saídas das unidades, uma cópia por dia com nome "nome — AAAA-MM-DD", e apaga as com mais de 30 dias. As cópias da planilha Sistema contêm os hashes de senha: a pasta não pode estar com "qualquer pessoa com o link".
- **Planilha de saídas de cada unidade** (modelo UPA): abas `MEDICAMENTOS` e `MATERIAIS`; produto · colunas de mês · CMM · estoque. O script acha cabeçalho/colunas pelo texto (`estruturaAba_`) e cria a coluna do mês antes do CMM (`garantirColunaDoMes_`). CMM e estoque são digitados (sem fórmula), como na planilha original.
- Sessão: token no `localStorage` (`farma_sessao`), validado no servidor (CacheService, 6 h). Tema: `farma_theme`.

---

## Padrões de desenvolvimento

- **Design:** siga `docs/DESIGN.md` (um elemento memorável por tela, cor de série nunca vira cor de status, cartões de conteúdo planos, esqueleto no lugar de "Carregando…"). Confira em navegador real, nos dois temas, em 390 e 1280 px.

- **Permissão é sempre conferida no Apps Script** (`exigirVisivel_`, `exigirLancamento_`). A tela só esconde botões.
- O mês de lançamento vem do servidor (`mesAberto_`); o front nunca escolhe o mês nem a unidade do lançamento.
- Gravação na planilha da unidade confere o nome do produto na linha antes de escrever (proteção contra planilha alterada).
- Mantém-se vanilla (sem framework/build); não introduzir dependências sem alinhamento.
- CSS em `css/` e JS em `js/`, um arquivo por página — não embutir inline nos HTMLs.
- Interface no padrão ISV (`../_ux-design/referencia/tokens-isv.md`), tema claro padrão + escuro; cores sempre via tokens de `isv.css`. Páginas publicadas não enxergam `../shared`: ao mudar o padrão lá, recopie `instituto.css` e o logo.
- **Cada mudança sobe a versão**: altere `js/version.js` e o `CHANGELOG.md` juntos, no mesmo commit, e crie a tag `vX.Y.Z`. PATCH = correções e ajustes; MINOR = nova etapa do fluxo.
- Versionamento: **Semantic Versioning**; `MAJOR` = 0 em pré-produção. Commits em **Conventional Commits**.
- Planilhas com dados reais não vão para o git (`data/*.xlsx` ignorado).

---

## Contexto organizacional

- **Organização:** Instituto São Vicente (ISV)
- **Usuária gestora:** Tereza — coordenação farmacêutica do Instituto
- **Responsável de TI:** Henrique (TI — ISV)
- **Contas Google:** TI (dona do Apps Script e das planilhas) · `institutosaovicente@gmail.com` (Tereza). O clasp desta máquina pode estar logado em outra conta: conferir com `clasp show-authorized-user`.

---

## Estado atual do desenvolvimento

> Última atualização: 2026-10-22 (histórico do dia em `docs/HISTORICO.md`)

- **Painel de fechamento:** tela inicial mostra o andamento do mês (rota `painel.carregar`, aba `Fechamento`); depois de publicar versões com ele, rode `recalcularFechamento` no editor.
- **Versão:** v0.5.8 (`js/version.js`), em teste com a Tereza. **Regra: toda mudança sobe a versão** (PATCH para correções e ajustes, MINOR para nova etapa do fluxo), alterando `js/version.js` e o `CHANGELOG.md` no mesmo commit, com tag `vX.Y.Z`.
- **Implantado e em teste:** API (Web App na conta da TI), planilha "Sistema", usuário `tereza` e usuários de teste de coordenador, login, Clínica Geral na nuvem, metas por unidade e planilha de saídas item por item. `API_URL` já está em `js/api.js`.
- Os testes usam a planilha com dados até **maio/2026** (`MES_ABERTO_TESTE = 2026-05` na aba `Config`). A versão atualizada só entra depois da validação da Tereza; antes de uso real, seguir o checklist de `docs/IMPLANTACAO.md`.
- Validação automatizada em `tests/`: servidor com Apps Script simulado (92 verificações: login, permissões, mês aberto, lançamentos, metas, usuários, backup, painel, planilha, fórmulas, colunas) e telas com DOM simulado (58). Rode os dois antes de publicar. Design validado em navegador real com `tools/visual/`.
- Para publicar mudanças no servidor: `clasp push` + nova versão + `clasp update-deployment` (a URL do Web App não muda). Antes, `clasp show-authorized-user` deve mostrar a conta da TI.
- **"Atualização visual":** lote grande de melhorias de tela guardado no branch `atualizacao-visual` por decisão da gestão (não entregar tudo de primeira). Não publicar nem juntar ao `main` sem o usuário escolher o que entra; lista em `docs/ATUALIZACAO-VISUAL.md` (no branch).
- Telas de apoio: `ajuda.html` ("Como usar", sem login) e link "Relatar problema ou sugestão" no rodapé (e-mail da TI em `CONTATO_SUPORTE`, `js/api.js`).

## Próximos passos

1. Rodada de testes com a Tereza e os coordenadores (docs/IMPLANTACAO.md → "Teste do fluxo").
2. Decisões em aberto de negócio, listadas em docs/BRIEFING.md → "Em aberto" (virada de ano, logística no formulário, média das unidades, pedidos de correção).
3. Pedidos de correção de mês fechado.
4. Dashboard lendo os lançamentos reais, filtrado por perfil.
5. Importação de arquivo na planilha de saídas (depois do item por item validado).
6. Modelos Hospital e Maternidade; Maracanaú; demais municípios.
