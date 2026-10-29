# Briefing — Indicadores da Farmácia

> Definido em reunião com a coordenadora farmacêutica do ISV (Tereza) em 2026-10-20.
> Documento de referência para o desenvolvimento. Mudanças de regra devem ser registradas aqui.
> Atualizado em 2026-10-28: piloto passou para Lavras da Mangabeira, 1.0.0 adiada e trabalho por etapas (seção "Decisões de 2026-10-28", no fim).

---

## Objetivo

Permitir que os coordenadores farmacêuticos das unidades de saúde lancem, todo mês, os indicadores da farmácia, e que a coordenadora farmacêutica do Instituto acompanhe todas as unidades num só lugar.

## Perfis

| Perfil | Quem é | O que faz |
|---|---|---|
| **Tereza** (administradora) | Coordenadora farmacêutica do Instituto | Acompanha todas as unidades, define as metas, cadastra usuários, atende pedidos de correção. **Não lança dados.** |
| **Coordenador** | Coordenador farmacêutico de uma unidade | Lança os dados da própria unidade e vê só a própria unidade. |

### Permissões

| Ação | Tereza | Coordenador |
|---|---|---|
| Lançar dados do mês | — | só a própria unidade |
| Ver dashboard | todas as unidades e consolidado | só a própria unidade |
| Ver metas e alertas | todas | **não** (v0.6.19) |
| Alterar metas | sim | não |
| Corrigir mês fechado | sim (a pedido) | não, só solicita |
| Cadastrar coordenadores (pela tela Usuários) | sim | não |
| Cadastrar unidades e contas da coordenação | via TI (editor do Apps Script) | não |

## Login

- **Usuário e senha criados pelo sistema** para todos (os coordenadores não têm e-mail institucional).
- A Tereza cadastra cada coordenador e a unidade dele, e pode redefinir senhas.
- Primeiro acesso obriga a troca da senha provisória.
- Senhas guardadas protegidas (hash), nunca em texto. A permissão é conferida no servidor a cada ação, não só na tela.

## Lançamento mensal

**Os dados lançados são sempre do mês que fechou.**

- Durante um mês, fica aberto para lançamento **apenas o mês anterior**.
  - Exemplo: em **outubro**, os coordenadores preenchem **setembro**.
  - Na virada para **novembro**, o sistema cria **outubro**, abre outubro para lançamento e **bloqueia setembro**.
- Meses bloqueados continuam **visíveis**, só não editáveis.
- A coluna do mês é criada automaticamente na virada do mês, sem depender de alguém lançar.
- Prazo: o mês inteiro seguinte. Perdeu a virada, o mês bloqueia e só a Tereza pode lançar ou corrigir.

### O que é lançado

Ao clicar em **Lançar dados**, o coordenador preenche duas partes:

1. **Clínica Geral** — conciliações, prescrições analisadas, PRM, intervenções aceitas, altas. Grava numa base central do Instituto.
2. **Logística Geral** — grava na **planilha da unidade** na nuvem (conta do Instituto), na coluna do mês.

### Correção

- Depois de salvo, o mês fica com o coordenador apenas até o bloqueio da virada. Mês bloqueado só muda **com pedido à Tereza**.
- O coordenador usa **Solicitar correção** com justificativa. A Tereza vê o pedido, corrige e o sistema registra quem alterou e quando.

## Metas

- Definidas pela Tereza, **uma por unidade**.
- Cada unidade nova nasce com as metas padrão atuais; a Tereza ajusta quando quiser.

## Unidades e planilhas

Lista oficial e apelidos em [`../../UNIDADES-ISV.md`](../../UNIDADES-ISV.md).

| Município | Unidade | Modelo de planilha | Fase |
|---|---|---|---|
| Caucaia | UPA Luiz Nerys (UPA Centro) | UPA | **inicial** |
| Caucaia | UPA Jurema | UPA | **inicial** |
| Caucaia | Hospital Municipal Abelardo Gadelha da Rocha (HMAGR) | Hospital | posterior |
| Caucaia | Hospital e Maternidade Santa Terezinha (HMST) | Maternidade | posterior |

**Atualização de 2026-10-28:** o piloto passou a ser **só Lavras da Mangabeira**, começando pelo **Hospital São Vicente Ferrer** (modelo Hospital; planilha ainda não recebida). As unidades de Caucaia servem de **dado de teste** até a planilha de Lavras chegar e depois ficam **arquivadas** até um possível retorno.

| Município | Unidade | Modelo de planilha | Fase |
|---|---|---|---|
| Lavras da Mangabeira | Hospital São Vicente Ferrer | Hospital | **piloto** (planilha recebida em 28/10) |
| Caucaia | UPA Luiz Nerys, UPA Jurema, Hospital Municipal, Hospital e Maternidade Santa Terezinha | UPA / Hospital / Maternidade | dados de teste; arquivadas depois |

Expansão: **Lavras da Mangabeira** (piloto) → demais equipamentos de Lavras → outros municípios (Caucaia, Maracanaú…).

## Arquitetura proposta

```
 Site (GitHub Pages)            Apps Script (API do sistema)        Google Drive do Instituto
 ────────────────────           ────────────────────────────        ─────────────────────────
 Login usuário/senha ─────────► confere senha, gera sessão ────────► [Config] Usuários
 Lançar dados                                                        [Config] Unidades
   • Clínica Geral ───────────► valida perfil, unidade e mês ──────► [Base Clínica]
   • Logística Geral ─────────► acha a planilha da unidade ────────► Planilha da unidade
                                e a coluna do mês                    (modelo UPA)
 Metas (só Tereza) ───────────► só administradora grava ───────────► [Config] Metas
 Dashboard ◄──────────────────── devolve só o que o perfil pode ver
                                Rotina no dia 1: cria a coluna do mês que fechou,
                                abre esse mês e bloqueia o anterior
```

## Roteiro

| Versão | Entrega |
|---|---|
| v0.3.0 ✔ | Login e perfis, Clínica Geral na nuvem, metas por unidade, planilha de saídas (modelo UPA), mês aberto e virada automática |
| v0.4.0 ✔ | Tela de usuários para a coordenação e backup diário |
| v0.5.0 | Pedidos de correção de mês fechado; dashboard com dados reais, filtrado por perfil |
| v1.0.0 | Piloto validado em Lavras da Mangabeira (Hospital São Vicente Ferrer). **Data indefinida** (antes 2/11/2026) |
| depois | Preços e relatórios de custos (só a Tereza); Modelo Maternidade; demais equipamentos de Lavras; outros municípios |

## Em aberto

- **Planilha do Hospital São Vicente Ferrer** (Lavras da Mangabeira): recebida em 28/10 e analisada. Falta a Tereza confirmar que a C-MÉDIA vale como CMM (a C-MEDIANA saiu) e três valores atípicos: AGULHA 40X12 (março, 2.428 contra cerca de 268 nos outros meses), FITA PARA HGT (jan e abr, cerca de 1.150 contra cerca de 385) e LENCOL DESCARTAVEL (jan, 1.000; os outros meses são zero).
- **Como o preço é definido e muda** (processo da Compras): aguardando a Tereza conseguir a informação. Até lá, preços só fictícios; a ideia de "preço por ata" foi descartada por não ter sido confirmada.
- **Clínica Geral:** a Tereza vai se reunir com a equipe para decidir; fora do foco por ora.
- **Nova data de implantação:** depende da planilha de Lavras e dos ajustes de dados.
- Mapear a planilha da UPA Centro (abas MEDICAMENTOS e MATERIAIS) para os campos de Logística Geral.
- Como a Tereza quer ser avisada dos pedidos de correção (só no sistema, ou também por e-mail).
- **Virada de ano nas planilhas de saídas.** A planilha não guarda o ano: em fevereiro de 2027 o mês aberto (janeiro) fica antes de dezembro, e o sistema recusa a gravação ("já passou de JANEIRO"). Definir com a Tereza: aba nova por ano, planilha nova por ano ou colunas com o ano no cabeçalho.
- **Logística no formulário.** O modal "Lançar dados" ainda tem 8 campos de logística digitados (itens padronizados, em falta, vencidos, entregas…). Confirmar se continuam ali ou se passam a sair da planilha de saídas.
- **Média de "Todas as unidades".** Hoje é a média simples dos percentuais de cada unidade; definir se vale o consolidado (somando numeradores e denominadores).
- **Regra do PRM.** Não há conferência de PRM × prescrições analisadas (pode haver mais de um PRM por prescrição).
- **Bloqueio de login.** O bloqueio de 15 minutos é por usuário, então alguém pode travar a conta de outra pessoa errando a senha de propósito. Revisar a política se virar problema.
- **Sessão em computador compartilhado.** O login fica guardado no navegador até "Sair". Avaliar sessão que termina ao fechar a aba.

## Estado de implementação (2026-10-28)

Este documento descreve a regra-alvo. Ainda **não** implementado: pedidos de correção de mês fechado (hoje o administrador não lança em nenhum caso); dashboard com dados reais (usa dados de exemplo, por decisão); preços e valores; virada de ano nas planilhas. Implementado: login e perfis, lançamento da Clínica Geral na nuvem, metas por unidade, planilha de saídas item por item, mês aberto e virada automática do mês, cadastro de coordenadores pela tela e backup diário.

## Anotações soltas do desenvolvedor (movidas do CHANGELOG)

- Fluxo
  coordenador da farmácia

## Respostas da Tereza sobre as planilhas de setembro (2026-10-27)

- **"*" na planilha** (UPA Jurema) = item sem saída. Na coluna de saída vale zero.
- **Maternidade** não tem CMM nem estoque por um processo específico da unidade: é normal, o relatório sai sem a parte de estoque.
- **Hospital Municipal:** julho não existe (fica vazio, sem comparação); setembro dos materiais existe e será enviado.
- **CMM** = média, **trimestral** (últimos 3 meses; regra fechada em 2026-10-29: os 3 últimos meses **com dado**). Na virada do ano continua mostrando os 3 últimos meses do ano anterior, com os anos separados.
- **UPA Centro:** os itens com estoque zero são medicamentos muito específicos (ex.: tuberculose) que não tiveram saída: zero esperado.
- **Texto de análise, Portaria 344 e vencidos:** seguem o fluxo normal trimestral e anual, não o relatório mensal.
- **Piloto:** (superado em 2026-10-28: ver "Decisões de 2026-10-28") a planilha antiga da UPA Centro (até maio) continua sem valer.

## Decisões de 2026-10-28

**Escopo e datas**
- Piloto **só em Lavras da Mangabeira** (Hospital São Vicente Ferrer). Enquanto a planilha dele não chega, os testes usam Caucaia; depois Caucaia fica arquivada.
- **Versão 1.0.0 e entrada em produção em 2/11/2026: adiadas por tempo indeterminado.** Nova data só depois de ajustar os dados.
- **Clínica Geral** fora do foco até a reunião da Tereza com a equipe.
- Dashboard continua com **dados de exemplo**.

**Método**
- Desenvolvimento **por etapas**, sem fugir da etapa em curso e sem ramificar. Etapas em `CLAUDE.md` ("Etapas").

**Permissões**
- **Metas e alertas só aparecem para a gestora (Tereza)**, que também define as metas. O coordenador da unidade não vê meta, selo de status nem alerta (v0.6.19, decisão de 2026-10-28).
- **Preços: só a Tereza vê.** Coordenadores não veem preço nem valor.

**Preços (etapa depois do piloto)**
- Preço **por município**, igual para todas as unidades do município, vindo da **Compras**. Como ele é definido e muda ainda **não é conhecido** (aguardando a Compras); tudo é fictício até lá.
- Unidade de medida igual à das planilhas de saídas; nome do item igual ao das planilhas, ou com código para casar.
- **Dados internos, sem mostrar em tela:** período da variação de preço, registro trimestral dos últimos preços por fornecedor e, na troca de fornecedor, o último fornecedor com os seus 3 últimos meses. Formato (chaves internas ou XML) e formas de exportação ficam para averiguar depois.
- Prévia da tela (colunas Preço un. e Valor e faixa de total) feita só localmente, sem commit.

**Relatórios**
- Só a gestora vê. É preciso poder **baixar** (ela pode rodar o relatório de novo no Claude).
- Nova **seção de valores** no relatório mensal (no padrão atual); **relatórios de custos** e outros a discutir. Catálogo de ideias levantado (consumo, tempo de estoque, abrangência, recomendação, com filtros).

**Ideias só registradas**
- Dashboard de preenchimento para acompanhar o prazo (até o dia 5), com barras e datas.

## Decisões de 2026-10-29

- **Regra do CMM:** média das saídas dos **3 últimos meses com dado**, do mês aberto para trás. Mês sem valor é pulado (não conta como zero); enquanto o mês aberto está vazio, continua valendo o trimestre anterior. Mínimo de 2 meses com dado, senão fica o CMM que já estava na planilha.
- **Planilha de Lavras:** a coluna **C-MÉDIA** é tratada como **CMM**; a **C-MEDIANA** é removida. As fórmulas de média viram valores (o sistema passa a calcular).
- **Números escritos como texto** (16 células em Lavras, ex.: "1.020" = 1020): são lidos no formato brasileiro; o ideal é a Tereza corrigir na origem para o problema não voltar.
- **Metas e alertas** só para a Tereza (v0.6.19), também no servidor.
- Servidor e site publicados juntos (v0.6.22); a data da entrada em produção continua sem definição.
