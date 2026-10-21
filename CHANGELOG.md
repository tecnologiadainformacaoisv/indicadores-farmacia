# Changelog – Indicadores da Farmácia UPA Centro

## Não lançado
### Adicionado
- API em Google Apps Script (`appscript/`): login com usuário e senha, perfis coordenação (admin) e coordenador, permissões conferidas no servidor
- Login, troca obrigatória da senha provisória e menu inicial conforme o perfil (`index.html`)
- Lançamentos e metas na nuvem (planilha "Sistema"), metas por unidade editáveis só pela coordenação
- Mês aberto definido pelo servidor (mês que fechou; fixo em maio/2026 durante os testes)
- Planilha de saídas (`logistica.html`): lançamento item por item de saídas, CMM e estoque, gravando na planilha da unidade
- Rotina de virada do mês que cria a coluna do mês nas planilhas das unidades
- Validações no lançamento (inteiros, sem negativos, numerador ≤ denominador)
- `docs/IMPLANTACAO.md` com o passo a passo de implantação
- Dashboard restrito à coordenação, com aviso de dados de exemplo
- Planilha de saídas: borda verde quando o valor sobe e vermelha quando desce; coluna do produto fixa ao rolar, celular só com os campos do mês aberto, resumo por aba, confirmação de "salvo às hh:mm" e rascunho recuperado se a sessão expirar
- Login: "Mostrar senha" e "Tentar de novo" em falha de rede (sem deslogar)
- Modais de lançamento e metas com semântica de diálogo, foco preso e aviso antes de descartar dados digitados

### Segurança
- Gravação na planilha da unidade escreve só as células alteradas e recusa sobrescrever fórmulas
- Senha provisória bloqueia todas as ações até ser trocada; trocar a senha encerra as outras sessões
- Limite de tentativas também na troca de senha; senha provisória gerada com aleatoriedade criptográfica
- Erros inesperados do servidor não expõem detalhes internos; ID da pasta do Drive fora do repositório

### Corrigido
- Gráficos que ficavam em branco ao trocar de mês ou salvar
- Tema escuro com botão de troca no cabeçalho das três telas (escolha salva no navegador)
- `docs/BRIEFING.md` com perfis, fluxo mensal, metas e roteiro definidos com a coordenação farmacêutica

### Alterado
- Cores das séries dos gráficos ajustadas para funcionar nos dois temas
- Ícone de engrenagem de volta no botão "Metas"

## v0.0.1 – 2026-10-20
### Adicionado
- Página inicial (`index.html`) com acesso ao acompanhamento mensal e ao dashboard
- Dashboard de indicadores (`dashboard.html`) com abas Clínica e Logística
- Tela de acompanhamento mensal com metas (`indicadores.html`), persistência em `localStorage`
- Botão "Voltar ao início" em todas as telas
- Versão visível no cabeçalho e no rodapé (fonte única em `js/version.js`)
- Cabeçalho com logo do ISV e rodapé institucional
- Planilha-fonte dos relatórios em `data/` (fora do git)

### Alterado
- Interface padronizada no visual ISV: tema claro, paleta institucional, Segoe UI e Manrope, foco visível, alvos de toque maiores
- Menu lateral do acompanhamento vira barra horizontal no celular
- Projeto reorganizado no padrão do setor: HTMLs renomeados, CSS e JS extraídos para `css/` e `js/`
- Adicionados `CLAUDE.md`, `README.md`, `CHANGELOG.md` e `.gitignore`

- Fluxo 
coordenador da farmacia

