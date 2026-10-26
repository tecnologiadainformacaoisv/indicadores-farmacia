# Changelog – Indicadores da Farmácia

## v0.6.1 – 2026-10-26
### Ajustado
- "Relatório mensal" no menu lateral do acompanhamento (só a coordenação), abrindo na unidade que ela está vendo; `relatorios.html?unidade=` inválida abre a unidade padrão

## v0.6.0 – 2026-10-26
### Adicionado
- Nova tela **Relatórios** (só a coordenação do Instituto): escolhe a unidade e o mês, vê a prévia do relatório mensal de farmácia e imprime ou salva em PDF (papel timbrado do ISV, A4, cabeçalho e rodapé em todas as páginas)
- O relatório segue o modelo da Tereza (hospital de Pacatuba, setembro/2026): resumo executivo, saídas contra o mês anterior (maiores altas e quedas), situação do estoque por faixa de cobertura, itens zerados, cobertura crítica e baixa com reposição sugerida, excesso e itens sem saída, verificações do registro e anexo com todos os itens
- Os números vêm da planilha de saídas da unidade (mesma leitura da tela "Planilha de saídas"); nada é gravado e não há mudança no servidor
- Ficam de fora por enquanto: textos de análise e recomendações, Portaria 344 e vencidos (o sistema ainda não tem essas abas)
- Cartão "Relatórios" na tela inicial da coordenação

## v0.5.12 – 2026-10-26
### Corrigido
- Celular: a seta de voltar do cabeçalho tem área de toque de 44 px de largura
- Indicadores de limite máximo (PRM) dizem "Acima do limite" em vez de "Abaixo da meta"
- Alertas do acompanhamento com ponto colorido em vez de emoji

## v0.5.11 – 2026-10-23
### Corrigido
- Acompanhamento mensal: se a troca de unidade falhar (rede instável), a tela volta para a unidade anterior; antes "Salvar metas" podia gravar os valores de uma unidade na outra
- Acompanhamento mensal e planilha de saídas: os atalhos de um para o outro levam a unidade que a coordenação está vendo
- Planilha de saídas: `?unidade=` inválida ou de outra unidade abre a unidade padrão em vez de ficar sem tela

## v0.5.10 – 2026-10-23
### Corrigido
- Tema claro: bordas dos cartões, abas, filtros, botões e campos estavam quase invisíveis (contraste 1,1:1 a 1,5:1). Cartões e divisórias ficaram um pouco mais marcados e campos e botões chegaram a ~3:1 (WCAG 1.4.11), nos dois temas
- Nova auditoria automática de bordas (`tools/visual/auditar-bordas.js`): mede o contraste de cada borda em todas as telas e nos dois temas
- Tela inicial: cartões "Ir para" passam a ter fundo próprio e o aviso de ambiente de teste não encosta mais nos cartões
- Contraste de texto no tema claro: texto auxiliar, selos de atenção e de meta atingida, avatar, migalhas e "Dados de exemplo" passam de 4,5:1
- Botões desabilitados (Salvar alterações, filtros, Cadastrar) com cor própria em vez de transparência: o texto agora se lê
- Celular: botões do cabeçalho, links do rodapé, migalhas, selos clicáveis, abas do dashboard e botões de salvar com área de toque de 44 px
- Alertas do acompanhamento sem espaço antes dos dois pontos; ações da lista de usuários com largura igual; dica do usuário cabe numa linha

## v0.5.9 – 2026-10-22
### Corrigido
- Aviso de servidor lento com fundo opaco no tema escuro
- Página "Como usar" também recebe o link de relato no rodapé; itens da ajuda mostram "+" e "–" para indicar que abrem e fecham

## v0.5.8 – 2026-10-22
### Adicionado
- Rodapé: "Relatar problema ou sugestão" ligado ao e-mail da TI do Instituto

## v0.5.7 – 2026-10-22
### Adicionado
- Página "Como usar" (`ajuda.html`): passo a passo curto para o coordenador e para a coordenação, com problemas comuns; link no rodapé de todas as telas
- Rodapé: link "Relatar problema ou sugestão" (abre o e-mail da TI já com página e versão; só aparece quando `CONTATO_SUPORTE` em `js/api.js` está preenchido)
- Aviso "O servidor está demorando mais que o normal" quando uma chamada passa de 8 s
### Alterado
- Planilha de saídas: mensagens de lista vazia por situação (busca sem resultado, nenhum item crítico)
- Mensagem de falta de conexão mais clara

## v0.5.6 – 2026-10-22
### Corrigido
- Planilha de saídas: abrir outra unidade (atalho da tela inicial ou seletor) não apaga mais o rascunho não salvo da unidade anterior
- `?unidade=` que não abre (unidade de outro coordenador ou inexistente): a tela cai na visão padrão com aviso, em vez de ficar só com o erro
- Migalhas da planilha mantêm a unidade que a coordenação estava vendo; o botão de ordenar a cobertura anuncia o estado para leitor de tela; selos-link do início dizem a unidade no nome acessível; área de toque maior no nome da unidade; ordenação tolera estoque ou CMM não numérico; ids de unidade com maiúscula, "_" ou "." também funcionam no endereço

## v0.5.5 – 2026-10-22
### Adicionado
- Tela inicial da coordenação: o nome da unidade abre o acompanhamento mensal já nela, e os selos "Clínica lançada" e "Saídas" (quando há lançamento) abrem o formulário da Clínica e a planilha de saídas daquela unidade. Selos pendentes continuam sem link
- Acompanhamento mensal e planilha de saídas aceitam `?unidade=<id>` no endereço

## v0.5.4 – 2026-10-22
### Adicionado
- Planilha de saídas: migalhas de pão (Início › Acompanhamento mensal › Planilha de saídas) para voltar ao menu lateral do acompanhamento

## v0.5.3 – 2026-10-22
### Alterado
- Planilha de saídas: a ordenação da cobertura fica só no botão da barra; o cabeçalho "Cobertura" voltou a ser texto simples

## v0.5.2 – 2026-10-22
### Adicionado
- Planilha de saídas: ordenar pela cobertura de estoque com um clique (botão na barra ou cabeçalho "Cobertura"): pior primeiro (sem estoque) → melhor primeiro → ordem da planilha. Itens sem dado de estoque ou CMM ficam sempre no fim.

## v0.5.1 – 2026-10-22
### Corrigido
- Fechamento: "Saídas" só conta como concluída com medicamentos **e** materiais lançados (antes bastava salvar só os medicamentos)
- Planilha de saídas: se a primeira carga falhar, o esqueleto some e fica só a mensagem de erro
- `?lancar=1` não reabre o formulário a cada recarregamento
- Faixa dos cartões de KPI segue o status da meta (verde, âmbar, vermelho), nunca a cor da série; no dashboard ela é neutra
- Selo dos gráficos diz "Média do ano" (o KPI mostra o mês escolhido)
- Cobertura baixa: texto âmbar legível, com a palavra "baixo"; estoque crítico anunciado para leitor de tela
- Menu do acompanhamento no celular quebra em duas linhas em vez de cortar "Planilha de saídas"; botões e seletores com 44 px no celular
- Planilha de saídas no celular: busca e abas fixas no topo ao rolar; rótulo "Saídas de maio" por extenso
- Painel da coordenação: selos dizem o estado em palavras ("Clínica pendente", "Saídas 97%"); anel de progresso ao lado do título no celular
- Contagem do andamento ignora célula só com espaços; aba `Fechamento` criada ao mesmo tempo por duas requisições não gera erro
- Foco por teclado visível dentro do painel escuro; botão de tema com nome fixo e estado em `aria-pressed`; esqueletos anunciados como "ocupado" para leitor de tela

## v0.5.0 – 2026-10-22
### Adicionado
- **Fechamento do mês** na tela inicial: painel que mostra o que falta lançar. O coordenador vê as tarefas (indicadores da Clínica Geral e planilha de saídas) com o andamento e o botão para continuar; a coordenação vê cada unidade com selos de Clínica e Saídas e o andamento em %
- Atalho "Lançar indicadores" abre direto o formulário do mês aberto (`indicadores.html?lancar=1`)
- Servidor: rota `painel.carregar` e aba `Fechamento` (criada sozinha), atualizada a cada salvamento da planilha de saídas; função `recalcularFechamento` para preencher o andamento a partir das planilhas
- Planilha de saídas: **cobertura de estoque** por item (quantos meses o estoque dura no ritmo do CMM) com barra e cor, ponto vermelho nos críticos, botão "Só os críticos" e atualização ao digitar
- Planilha de saídas no celular: cada item vira um bloco (nome, três campos e cobertura), sem rolagem lateral
- Esqueleto de carregamento na tela inicial, nos indicadores e na planilha de saídas
- `docs/DESIGN.md` (método, decisões e receita), testes em `tests/` (92 do servidor e 58 das telas) e capturas de tela em navegador real em `tools/visual/`

### Alterado
- Cabeçalho mais enxuto: versão ao lado do título, botão de tema só com ícone, usuário com iniciais, botão "Início" curto; ocupa bem menos tela no celular
- Número dos KPIs neutro (a cor da série lia como alarme: 81,8% atingindo a meta aparecia em vermelho); o status fica no selo
- Cartões de conteúdo planos (borda fina); atalhos da tela inicial sem sombra e sem "Abrir →"
- Eixo dos gráficos de percentual começa em zero e não mostra o 110% de folga

### Corrigido
- Gráfico de prescrições com eixo de 92% a 110% quando os valores eram iguais
- Espaço vazio entre o aviso e os indicadores quando não há alertas; sublinhado indevido em um item do menu lateral

## v0.4.1 – 2026-10-22
### Corrigido
- Planilha de saídas: o rascunho de alterações não salvas agora volta depois de recarregar ou de a sessão expirar (antes procurava a chave errada); só volta para a mesma pessoa e unidade, e o aviso "Recuperamos N alterações" não some quando a carga do servidor chega
- Salvar não apaga mais o que foi digitado durante o envio (a tabela fica bloqueada até terminar) e, se uma das abas falhar, a outra já gravada aparece com o valor novo
- Alterações recuperadas que não batem mais com a planilha (produto mudou de linha) são descartadas com aviso
- Criar usuário e redefinir senha não são repetidos automaticamente em falha de rede (a senha provisória da primeira tentativa ficaria perdida)
- Tela de Usuários: aviso de resultado visível perto da ação e botão "Tentar de novo"; texto copiado com o endereço do sistema; instrução de copiar que serve no celular; botões de 44px; textos sem gênero; item em edição destacado; contraste dos itens desativados e do selo "Ativo"; estados vazios que orientam; unidade inativa visível ao editar; coordenador que abre a página por URL volta ao início
- Início: Dashboard com selo "Dados de exemplo" e cartões secundários mais discretos; login sem autocorreção do teclado e com orientação de senha esquecida
- Leitura da planilha de saídas repete em falha do Google e avisa claramente quando a aba está vazia
- Login recusa usuário/senha de tamanho absurdo (derrubava o servidor)

### Segurança
- O cache da última carga expira em 24 h e é apagado ao entrar com outra sessão; sair do sistema também apaga o rascunho
- Removidas as rotas `lancamentos.listar`, `metas.listar` e `logistica.ler` (nenhuma tela as usa mais; as cargas completas fazem o mesmo com a mesma conferência de permissão)

### Documentação
- BRIEFING (roteiro e permissões), IMPLANTACAO (backup, usuários, gatilhos, testes), README e CLAUDE.md atualizados

## v0.4.0 – 2026-10-21
### Adicionado
- Tela de **Usuários** (só coordenação): cadastrar coordenadores, editar nome e unidade, redefinir senha e desativar/reativar acessos
- A senha provisória aparece uma única vez, com botão de copiar, e não fica guardada em lugar nenhum
- **Backup automático** diário (2h) da planilha do Sistema e das planilhas de saídas de cada unidade, na pasta "Backup", mantendo 30 dias; `backupAgora()` para rodar à mão

### Segurança
- Rotas de usuários exigem perfil de coordenação no servidor; a conta da coordenação não é alterada por essa tela (evita trancar o sistema)
- Redefinir a senha ou desativar derruba as sessões abertas da pessoa
- Nomes que começam com = + - @ são recusados (virariam fórmula na planilha)

## v0.3.3 – 2026-10-21
### Corrigido
- Planilha de saídas: depois de salvar, a tabela se atualiza no lugar, sem a tela vazia de "Carregando…"; a confirmação com o servidor acontece em segundo plano
- A mensagem "N itens salvos às hh:mm" permanece até a próxima alteração

## v0.3.2 – 2026-10-21
### Alterado
- Telas abrem mais rápido: uma única chamada ao servidor traz sessão e dados (antes eram duas ou três em sequência)
- A última carga fica guardada no navegador e aparece na hora enquanto a atualização chega por trás; sair do sistema apaga esse cache
- Se a atualização falhar, a tela mantém os dados da última visita e avisa

## v0.3.1 – 2026-10-21
### Corrigido
- Planilha de saídas carrega mais rápido: cada aba é lida uma vez só no servidor
- A resposta da API informa o tempo gasto no servidor (`ms`), para diagnosticar lentidão

## v0.3.0 – 2026-10-21
### Adicionado
- API em Google Apps Script (`appscript/`): login com usuário e senha, perfis coordenação (admin) e coordenador, permissões conferidas no servidor
- Login, troca obrigatória da senha provisória e menu inicial conforme o perfil (`index.html`)
- Lançamentos e metas na nuvem (planilha "Sistema"), metas por unidade editáveis só pela coordenação
- Mês aberto definido pelo servidor (mês que fechou; fixo em maio/2026 durante os testes); o servidor recusa o lançamento se a virada do mês aconteceu com a página aberta
- Planilha de saídas (`logistica.html`): lançamento item por item de saídas, CMM e estoque, gravando na planilha da unidade
- Rotina de virada do mês que cria a coluna do mês nas planilhas das unidades
- Validações no lançamento (inteiros, sem negativos, numerador ≤ denominador, emergenciais ≤ entregas, formulário não pode ir vazio)
- `docs/IMPLANTACAO.md` com o passo a passo de implantação
- Dashboard restrito à coordenação, com aviso de dados de exemplo
- Tema escuro com botão de troca no cabeçalho das três telas (escolha salva no navegador)
- `docs/BRIEFING.md` com perfis, fluxo mensal, metas e roteiro definidos com a coordenação farmacêutica
- Planilha de saídas: borda verde quando o valor sobe e vermelha quando desce; coluna do produto fixa ao rolar, celular só com os campos do mês aberto, resumo por aba, confirmação de "salvo às hh:mm" e rascunho recuperado se a sessão expirar
- Login: "Mostrar senha", "Tentar de novo" em falha de rede (sem deslogar) e aviso de sessão expirada
- Modais de lançamento e metas com semântica de diálogo, foco preso e aviso antes de descartar dados digitados

### Segurança
- Gravação na planilha da unidade escreve só as células alteradas (em trechos contíguos) e recusa sobrescrever fórmulas
- Senha provisória bloqueia todas as ações até ser trocada; trocar a senha encerra as outras sessões
- Limite de tentativas também na troca de senha; senha provisória gerada com aleatoriedade criptográfica
- Login com tempo de resposta igual para usuário inexistente; falhas e bloqueios registrados no Log
- Erros inesperados do servidor não expõem detalhes internos; ID da pasta do Drive fora do repositório

### Corrigido
- Gráficos que ficavam em branco ao trocar de mês ou salvar
- Chamadas à API e leituras do Google repetidas automaticamente em falhas intermitentes (erro 500 / "INTERNAL")
- Rascunho da planilha de saídas não é mais apagado quando a leitura da planilha falha
- Barra de salvar da planilha de saídas refletia valores inválidos já descartados ao trocar de aba
- Erro de atualização da tela depois de salvar não ficava visível (modal já fechado)
- Rótulo do mês novo gravado na linha onde a planilha guarda os meses
- Barras de total do dashboard com cor ilegível ao trocar o tema

### Alterado
- Cores das séries dos gráficos ajustadas para funcionar nos dois temas (tons mais claros nos valores de KPI do tema escuro)
- Servidor lê cada tabela do sistema uma vez por requisição (resposta mais rápida)
- Ícone de engrenagem de volta no botão "Metas"
- Removido CSS sem uso

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
