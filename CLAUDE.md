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
├── dashboard.html          ← dashboard (só admin; dados de EXEMPLO fixos, ainda não ligado à base)
├── appscript/
│   ├── appsscript.json     ← manifesto (Web App: executa como a TI, acesso anônimo)
│   └── codigo.js           ← API, regras de permissão e funções de administração
├── assets/logo-isv.png     ← cópia de ../shared/assets/
├── css/
│   ├── instituto.css       ← cópia de ../shared/styles/instituto.css (tokens ISV)
│   ├── isv.css             ← tema claro/escuro, cabeçalho, rodapé, login, avisos (comum)
│   └── dashboard.css · indicadores.css · logistica.css
├── js/
│   ├── version.js          ← ÚNICA fonte da versão exibida
│   ├── theme.js            ← tema claro/escuro (carregado no <head>)
│   ├── api.js              ← API_URL, chamadas à API, sessão, cabeçalho com usuário
│   └── index.js · indicadores.js · logistica.js · dashboard.js
├── data/                   ← planilha-fonte local (fora do git)
└── docs/
    ├── BRIEFING.md         ← regras de negócio definidas com a Tereza
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
- **Planilha de saídas de cada unidade** (modelo UPA): abas `MEDICAMENTOS` e `MATERIAIS`; produto · colunas de mês · CMM · estoque. O script acha cabeçalho/colunas pelo texto (`estruturaAba_`) e cria a coluna do mês antes do CMM (`garantirColunaDoMes_`). CMM e estoque são digitados (sem fórmula), como na planilha original.
- Sessão: token no `localStorage` (`farma_sessao`), validado no servidor (CacheService, 6 h). Tema: `farma_theme`.

---

## Padrões de desenvolvimento

- **Permissão é sempre conferida no Apps Script** (`exigirVisivel_`, `exigirLancamento_`). A tela só esconde botões.
- O mês de lançamento vem do servidor (`mesAberto_`); o front nunca escolhe o mês nem a unidade do lançamento.
- Gravação na planilha da unidade confere o nome do produto na linha antes de escrever (proteção contra planilha alterada).
- Mantém-se vanilla (sem framework/build); não introduzir dependências sem alinhamento.
- CSS em `css/` e JS em `js/`, um arquivo por página — não embutir inline nos HTMLs.
- Interface no padrão ISV (`../_ux-design/referencia/tokens-isv.md`), tema claro padrão + escuro; cores sempre via tokens de `isv.css`. Páginas publicadas não enxergam `../shared`: ao mudar o padrão lá, recopie `instituto.css` e o logo.
- Ao subir a versão, altere `js/version.js` e o `CHANGELOG.md` juntos.
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

> Última atualização: 2026-10-21

- **Versão publicada:** v0.0.1 (visual). **Em desenvolvimento:** versão de teste para a Tereza validar o fluxo (ver "Não lançado" no CHANGELOG).
- Código da versão de teste pronto: API (`appscript/codigo.js`), login, acompanhamento na nuvem, planilha de saídas item por item.
- Validado localmente com Apps Script simulado (fluxo de login, permissões, lançamento, metas, gravação na planilha e criação de coluna) e com a estrutura real da planilha de maio (169 medicamentos, 156 materiais).
- **Falta implantar** (docs/IMPLANTACAO.md): `clasp create/push` na conta da TI, `configurarSistema`, IDs das planilhas, usuários, Web App e `API_URL` em `js/api.js`.
- Os testes usam a planilha com dados até **maio/2026** (`MES_ABERTO_TESTE = 2026-05`). A versão atualizada só sobe depois da validação da Tereza.

## Próximos passos

1. Implantar e testar o fluxo com a Tereza (docs/IMPLANTACAO.md → "Teste do fluxo").
2. Pedidos de correção de mês fechado (aguardando a Tereza definir o aviso).
3. Dashboard lendo os lançamentos reais, filtrado por perfil.
4. Indicadores de logística: confirmar se continuam no formulário ou se saem da planilha de saídas.
5. Importação de arquivo na planilha de saídas (depois do item por item validado).
6. Modelos Hospital e Maternidade; Maracanaú; demais municípios.
7. Tela de cadastro de usuários para a Tereza (hoje é pelo editor do Apps Script).
