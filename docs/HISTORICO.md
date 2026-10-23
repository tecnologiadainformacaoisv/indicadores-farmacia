# Histórico de decisões e entregas

Registro cronológico do que foi decidido e entregue, para quem retomar o projeto. Detalhes técnicos de cada versão estão no `CHANGELOG.md`.

## 2026-10-22

### Decisões da gestão
- **Não entregar tudo de primeira.** O lote de melhorias visuais ficou guardado no branch `atualizacao-visual` (chamado pelo usuário de **"atualização visual"**); o `main` só recebe, por enquanto, o que é pequeno e resolve atrito real. Lista dos recursos guardados e de como ativar: `docs/ATUALIZACAO-VISUAL.md` (no branch).
- **Precisamos saber o fluxo da Tereza antes de mexer no back.** Por isso as entregas do dia foram só de tela e documentação. Perguntas formais de decisão para a Tereza foram descartadas pelo usuário ("as perguntas não dão certo").
- **CMM continua digitado à mão**, sem fórmula nem aviso de divergência com a média das saídas. Exemplo visto: CMM 140 contra média real 363 (item com CMM baixo faz o estoque parecer durar mais). Se a Tereza trouxer uma regra oficial, retomar.
- **Preferência de layout:** visual simples e bem encaixado, sem botões enormes nem espaço vago, aproveitando a largura da tela (registrado em `../_ux-design/referencia/tokens-isv.md`).
- **Fundo da interface:** descartadas marca d'água grande do logo, padrão de ícones de saúde ("muito simples"), ilustração de profissionais e fotos de pessoas. Escolhido (só no branch visual): fundo "painel de dados" + faixa de gráficos na entrada.

### Entregas no main (publicadas)
| Versão | O que entrou |
|---|---|
| v0.5.2 | Ordenar a cobertura de estoque com um clique (pior → melhor → melhor → pior → ordem da planilha) |
| v0.5.3 | Cabeçalho "Cobertura" volta a ser texto; ordenação só no botão da barra |
| v0.5.4 | Migalhas de pão na planilha (Início › Acompanhamento mensal › Planilha de saídas) |
| v0.5.5 | Tela inicial da coordenação: nome da unidade e selos já lançados viram links; `?unidade=<id>` no acompanhamento e na planilha |
| v0.5.6 | Correções da revisão (rascunho de outra unidade preservado, `?unidade=` inválida cai na visão padrão, acessibilidade) |
| v0.5.7 | Página "Como usar", link de relato no rodapé, aviso de servidor lento, mensagens de lista vazia |
| v0.5.8 | "Relatar problema ou sugestão" ligado ao e-mail da TI |
| v0.5.9 | Correções da revisão da v0.5.7/0.5.8: aviso de servidor lento opaco no tema escuro, rodapé e indicador "+/–" na página de ajuda |
| v0.5.10 | Bordas visíveis no tema claro, contraste de texto, botões desabilitados legíveis e alvos de toque de 44 px no celular (revisão de UX); auditoria automática de bordas |

### Guardado no branch `atualizacao-visual` (não publicado)
Largura das telas, Usuários (saúde dos acessos, filtros, WhatsApp, desfazer), planilha (tendência, ordenar, sem saída, colar do Excel, revisão antes de salvar), indicadores (mapa de calor, variação, resumo, metas com valor atual, resultado ao vivo, imprimir), letra maior (A+), Ctrl+K, anel do painel, fundo painel de dados e faixa de gráficos. Testes do branch: 95 (front) e 92 (API).

### Como o fluxo funciona hoje
- **Coordenador:** login → troca da senha provisória → painel de fechamento → lança a Clínica Geral (formulário) e a planilha de saídas (item por item) do mês que fechou; vê só a própria unidade.
- **Tereza (coordenação):** login → painel com todas as unidades (selos) → acompanhamento (gráficos, metas por unidade) → planilha de cada unidade em consulta → usuários (cadastrar, redefinir senha, desativar). Não lança dados.
- **Automático:** virada do mês no dia 1 (cria a coluna do novo mês) e backup diário às 2h (30 dias).

### Pendências
- Aguardando o retorno da Tereza sobre a estrutura; depois, trocar para as planilhas reais (checklist em `docs/IMPLANTACAO.md`).
- Decisões em aberto: virada de ano, regra de "crítico" da cobertura, logística no formulário, pedidos de correção de mês fechado, regra oficial do CMM.
- Mapa de calor e demais itens do branch visual: aguardam a decisão de quais ativar.
