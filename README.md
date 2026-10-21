# Indicadores da Farmácia — ISV

Sistema do **Instituto São Vicente (ISV)** para os coordenadores farmacêuticos das unidades de saúde lançarem os indicadores mensais da farmácia, e para a coordenação farmacêutica do Instituto acompanhar todas as unidades.

- `index.html` — login e menu
- `indicadores.html` — acompanhamento mensal: lançamento, metas, gráficos
- `logistica.html` — planilha de saídas: medicamentos e materiais, item por item
- `dashboard.html` — visão geral (coordenação; dados de exemplo nesta fase)

**Stack:** HTML5 + CSS3 + JavaScript vanilla + Chart.js (GitHub Pages) · API em Google Apps Script · dados em Planilhas Google.

## Estrutura

```
projeto-indicadores-farmacia/
├── README.md · CHANGELOG.md · CLAUDE.md
├── index.html · indicadores.html · logistica.html · dashboard.html
├── appscript/         ← API (Apps Script, publicada com clasp)
├── assets/            ← logo ISV
├── css/               ← tema ISV + estilos por página
├── js/                ← API/sessão, tema, versão e lógica por página
├── data/              ← planilha-fonte local (não versionada)
└── docs/              ← briefing e implantação
```

## Como usar

- Regras do sistema: [docs/BRIEFING.md](docs/BRIEFING.md)
- Implantação (Apps Script, usuários, Web App): [docs/IMPLANTACAO.md](docs/IMPLANTACAO.md)

Para ver as telas localmente, sirva a pasta (Live Server ou `python -m http.server 8000`). Sem a `API_URL` configurada em `js/api.js`, o login avisa que o sistema ainda não está ligado ao servidor.

---

Versão atual: **v0.0.1** · Versionamento: [Semantic Versioning](https://semver.org/lang/pt-BR/) · Commits: [Conventional Commits](https://www.conventionalcommits.org/pt-br/)
