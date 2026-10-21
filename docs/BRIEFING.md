# Briefing — Indicadores da Farmácia

> Definido em reunião com a coordenadora farmacêutica do ISV (Tereza) em 2026-10-20.
> Documento de referência para o desenvolvimento. Mudanças de regra devem ser registradas aqui.

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
| Ver metas | todas | da própria unidade |
| Alterar metas | sim | não |
| Corrigir mês fechado | sim (a pedido) | não, só solicita |
| Cadastrar usuários e unidades | sim | não |

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

Expansão: **Caucaia** (piloto) → **Maracanaú** → demais municípios.

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
| v0.1.0 | Login com usuário e senha, perfis e unidades; tela muda conforme o perfil |
| v0.2.0 | Clínica Geral grava na nuvem; metas por unidade, editáveis só pela Tereza |
| v0.3.0 | Logística grava na planilha da unidade (modelo UPA); abertura e bloqueio automáticos do mês |
| v0.4.0 | Dashboard com dados reais, filtrado por perfil; pedidos de correção |
| v1.0.0 | Piloto validado em Caucaia (UPAs) |
| depois | Modelos Hospital e Maternidade; Maracanaú; demais municípios |

## Em aberto

- Mapear a planilha da UPA Centro (abas MEDICAMENTOS e MATERIAIS) para os campos de Logística Geral.
- Como a Tereza quer ser avisada dos pedidos de correção (só no sistema, ou também por e-mail).
- **Virada de ano nas planilhas de saídas.** A planilha não guarda o ano: em fevereiro de 2027 o mês aberto (janeiro) fica antes de dezembro, e o sistema recusa a gravação ("já passou de JANEIRO"). Definir com a Tereza: aba nova por ano, planilha nova por ano ou colunas com o ano no cabeçalho.
- **Logística no formulário.** O modal "Lançar dados" ainda tem 8 campos de logística digitados (itens padronizados, em falta, vencidos, entregas…). Confirmar se continuam ali ou se passam a sair da planilha de saídas.
- **Média de "Todas as unidades".** Hoje é a média simples dos percentuais de cada unidade; definir se vale o consolidado (somando numeradores e denominadores).
- **Regra do PRM.** Não há conferência de PRM × prescrições analisadas (pode haver mais de um PRM por prescrição).
- **Bloqueio de login.** O bloqueio de 15 minutos é por usuário, então alguém pode travar a conta de outra pessoa errando a senha de propósito. Revisar a política se virar problema.
- **Sessão em computador compartilhado.** O login fica guardado no navegador até "Sair". Avaliar sessão que termina ao fechar a aba.

## Estado de implementação (2026-10-21)

Este documento descreve a regra-alvo. Ainda **não** implementado: pedidos de correção de mês fechado (hoje o administrador não lança em nenhum caso) e dashboard com dados reais (usa dados de exemplo). Implementado: login e perfis, lançamento da Clínica Geral na nuvem, metas por unidade, planilha de saídas item por item, mês aberto e virada automática do mês, cadastro de coordenadores pela tela e backup diário.

## Anotações soltas do desenvolvedor (movidas do CHANGELOG)

- Fluxo
  coordenador da farmácia
