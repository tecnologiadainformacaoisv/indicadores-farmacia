# Indicadores da Farmácia — UPA Centro — ISV

> Arquivo de contexto para Claude Code. Leia este arquivo inteiro antes de qualquer tarefa.

---

## Visão geral do projeto

Painéis web para acompanhamento dos **indicadores da Farmácia da UPA Centro** (Instituto São Vicente). São duas telas independentes, com abas de **Indicadores Clínicos** e **Indicadores de Logística**:

- `dashboard.html` — dashboard de visualização (gráficos, KPIs).
- `indicadores.html` — acompanhamento mensal: o usuário insere os dados e define metas; persistência em `localStorage`.

**Objetivo:** dar à coordenação da farmácia uma visão mensal dos indicadores clínicos e logísticos frente às metas.

**Stack:** HTML5 + CSS3 + JavaScript vanilla + Chart.js 4.4.1 (CDN). Sem build tool.

---

## Estrutura de arquivos

```
projeto-indicadores-farmacia/
├── CLAUDE.md
├── README.md
├── CHANGELOG.md
├── .gitignore
├── index.html              ← página inicial (links para as telas)
├── dashboard.html          ← dashboard de visualização
├── indicadores.html        ← acompanhamento mensal (entrada de dados + metas)
├── assets/
│   └── logo-isv.png        ← logo oficial (cópia de ../shared/assets/)
├── css/
│   ├── instituto.css       ← cópia de ../shared/styles/instituto.css (tokens ISV)
│   ├── isv.css             ← cabeçalho, rodapé, versão, foco (comum às 3 telas)
│   ├── dashboard.css
│   └── indicadores.css
├── js/
│   ├── version.js          ← ÚNICA fonte da versão exibida (cabeçalho e rodapé)
│   ├── dashboard.js
│   └── indicadores.js
├── data/
│   └── relatorios-farmacia-upa-centro.xlsx   ← planilha-fonte (abas MEDICAMENTOS e MATERIAIS); fora do git
└── docs/                   ← documentação complementar
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

> ⚠️ **NÃO ler nem indexar as pastas dos outros projetos** (`projeto-*`, `pessoal-*`)
> a menos que explicitamente solicitado. Eles existem e compartilham padrões, mas
> estão fora do escopo desta sessão — ler para não pesar contexto/tokens à toa.

---

## Dados e persistência

- `indicadores.html` guarda dados e metas no navegador: chaves `localStorage` `farma_data` e `farma_metas`.
- `dashboard.html` ainda **não** lê `farma_data` (conteúdo estático) — integração é item de backlog.
- A planilha em `data/` é a fonte original dos relatórios e **não é lida pelo código**.

---

## Padrões de desenvolvimento

- Mantém-se vanilla (sem framework/build); não introduzir dependências sem alinhamento.
- CSS em `css/` e JS em `js/`, um arquivo por página — não voltar a embutir inline nos HTMLs.
- Metas (`farma_metas`) têm direção `min`/`max`; preservar o formato ao alterar.
- Interface no padrão ISV (`../_ux-design/referencia/tokens-isv.md`): tema claro, azul `#0a3d62`, Segoe UI + Manrope nos títulos, cabeçalho com logo e versão, rodapé com versão. Páginas publicadas não enxergam `../shared`: ao mudar o padrão lá, recopie `instituto.css` e o logo.
- Ao subir a versão, altere `js/version.js` e o `CHANGELOG.md` juntos.
- Versionamento: **Semantic Versioning** (`MAJOR.MINOR.PATCH`); `MAJOR` = 0 em pré-produção.
- Commits no padrão **Conventional Commits** (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`).
- Dados da planilha podem conter informações de pacientes/insumos: não versionar `.xlsx` (LGPD).

---

## Contexto organizacional

- **Organização:** Instituto São Vicente (ISV)
- **Unidade:** UPA Centro — Farmácia
- **Responsável de TI:** Henrique (TI — ISV)

---

## Estado atual do desenvolvimento

> Última atualização: 2026-10-20

- **Versão:** v0.0.1 — protótipos reorganizados na estrutura padrão do setor e interface padronizada no visual ISV.
- Os dois HTMLs funcionam isolados; a lógica dos indicadores não foi alterada (só cores dos gráficos).
- Revisão estrutural (2026-10-20) apontou melhorias ainda não feitas: backup/validação de dados, dashboard lendo `farma_data`, filtros por unidade/ano, acessibilidade dos modais. Aguardam definição com a usuária final.

## Próximos passos

1. Fazer o `dashboard.html` consumir os dados de `farma_data` (ou de uma fonte única).
2. Definir a fonte oficial dos dados (planilha → importação? backend?).
3. Rodar o agente `ux-revisor` nas duas telas e alinhar com `../_ux-design/tokens-isv.md`.
4. Decidir hospedagem (GitHub Pages, como outros projetos).
