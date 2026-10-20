# Indicadores da Farmácia — UPA Centro

Painéis web do **Instituto São Vicente (ISV)** para acompanhamento mensal dos indicadores clínicos e de logística da Farmácia da UPA Centro.

- `dashboard.html` — visualização com gráficos e KPIs
- `indicadores.html` — entrada mensal de dados e definição de metas (salvos no navegador)

**Stack:** HTML5 + CSS3 + JavaScript vanilla + Chart.js (CDN). Sem build.

## Estrutura

```
projeto-indicadores-farmacia/
├── README.md
├── CHANGELOG.md
├── CLAUDE.md          ← contexto para o Claude Code
├── dashboard.html
├── indicadores.html
├── css/               ← estilos por página
├── js/                ← lógica por página
├── data/              ← planilha-fonte (não versionada)
└── docs/
```

## Como usar

Projeto estático — basta servir a pasta:

```bash
python -m http.server 8000
# http://localhost:8000/dashboard.html
# http://localhost:8000/indicadores.html
```

> Os dados de `indicadores.html` ficam no `localStorage` do navegador (chaves `farma_data` e `farma_metas`).

---

Versionamento: [Semantic Versioning](https://semver.org/lang/pt-BR/) · Commits: [Conventional Commits](https://www.conventionalcommits.org/pt-br/)
