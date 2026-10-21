# Implantação — versão de teste

Passo a passo para ligar o site (GitHub Pages) à nuvem (Apps Script + Planilhas Google na conta da TI).
Rodar uma vez. Depois disso, mudanças no código seguem com `clasp push` e nova versão da implantação.

## Como as peças se encaixam

```
site (GitHub Pages) ──POST──► Apps Script (Web App, conta da TI) ──► Planilhas na pasta "Indicadores Farmácia"
                                                                    • Indicadores Farmácia — Sistema (criada pelo script)
                                                                    • planilha de saídas de cada unidade (modelo UPA)
```

- O Apps Script roda **como a conta da TI**. Os coordenadores não precisam de acesso às planilhas: o sistema grava por eles.
- A pasta fica compartilhada como **editor** com `institutosaovicente@gmail.com` (Tereza).
- Toda permissão (perfil, unidade, mês aberto) é conferida no Apps Script, não só na tela.

## 1. Planilhas das unidades

1. Na pasta `Indicadores Farmácia` do Drive da TI, confira se a planilha é **Planilhas Google** (ícone verde, sem ".xlsx" no nome). Se for .xlsx: abrir → **Arquivo → Salvar como Planilhas Google**.
2. Faça uma cópia para a **UPA Jurema** (mesmo modelo).
3. **Para o teste, use cópias**: o lançamento de teste sobrescreve a coluna de MAIO.
4. Anote o ID de cada uma (o trecho entre `/d/` e `/edit` no link).

## 2. Criar o projeto Apps Script

Na pasta do projeto, logado na **conta da TI**:

```bash
clasp logout
clasp login                      # escolher a conta da TI
clasp create --type standalone --title "Indicadores Farmácia — API" --rootDir appscript
clasp push
```

> O `clasp create` grava o `.clasp.json` na raiz. Se ele perguntar se sobrescreve o `appsscript.json`, responda **não**.

## 3. Configurar o sistema (editor do Apps Script)

`clasp open-script` abre o editor.

Antes de tudo, em **Configurações do projeto (engrenagem) → Propriedades do script**, adicione:

| Propriedade | Valor |
|---|---|
| `PASTA_ID` | ID da pasta "Indicadores Farmácia" (o trecho final do link da pasta) |

> O ID fica fora do código porque o repositório é público.

Rode, nesta ordem (menu de funções no topo → **Executar**):

1. **`configurarSistema`** — autorize os acessos quando pedir. Cria a planilha **"Indicadores Farmácia — Sistema"** na pasta, com as abas `Usuarios`, `Unidades`, `Metas`, `Lancamentos`, `Config`, `Log`, as duas UPAs e o usuário `tereza`. **A senha provisória da Tereza aparece no registro de execução.**
2. Na planilha Sistema, aba **Unidades**, cole o ID de cada planilha na coluna `planilhaId`.
3. **`diagnosticarPlanilhas`** — confere o que o sistema enxerga. Esperado, no modelo de maio:
   `upa-centro / MEDICAMENTOS: 169 produtos · meses JANEIRO, FEVEREIRO, MARÇO, ABRIL, MAIO · CMM col 8 · estoque col 9`
4. Coordenadores (um por unidade), editando a última linha do arquivo e executando **`criarUsuario`**. Por exemplo:
   ```js
   criarUsuario('coord.centro', 'Nome do coordenador', 'coordenador', 'upa-centro')
   criarUsuario('coord.jurema', 'Nome do coordenador', 'coordenador', 'upa-jurema')
   ```
   Mais simples: criar uma função temporária que chama as duas linhas e executá-la. A senha provisória sai no registro.
5. **`instalarGatilhos`** — agenda a virada do mês (dia 1, de madrugada).

## 4. Publicar a API

No editor: **Implantar → Nova implantação → Tipo: App da Web**

- Executar como: **Eu** (conta da TI)
- Quem pode acessar: **Qualquer pessoa**

Copie a **URL do app da Web** e cole em `js/api.js`:

```js
const API_URL = 'https://script.google.com/macros/s/…/exec';
```

Commit + push → o GitHub Pages atualiza.

> Mudou o `codigo.js` depois? `clasp push` e **Implantar → Gerenciar implantações → editar → Nova versão** (mantém a mesma URL).

## 5. Teste do fluxo

| Quem | O que testar |
|---|---|
| Coordenador | Entrar com a senha provisória → criar a própria senha → ver só a sua unidade |
| Coordenador | Acompanhamento → **+ Lançar dados** (mês fixo em Maio/2026) → salvar → ver os gráficos |
| Coordenador | Planilha de saídas → lançar alguns itens → salvar → conferir na planilha da unidade, coluna MAIO |
| Tereza | Ver as duas unidades, alternar no seletor, sem botão de lançar |
| Tereza | Metas → escolher uma unidade → alterar → salvar; o coordenador vê a nova meta |
| Tereza | Planilha de saídas → consultar as duas unidades (somente leitura) |

## ⚠️ Antes de liberar para uso real

- [ ] Na aba `Config`, **apagar o valor de `MES_ABERTO_TESTE`**. Enquanto ele existir, todo lançamento cai em maio/2026 (a tela mostra a faixa amarela "Ambiente de teste").
- [ ] Trocar as planilhas de teste pelas versões atualizadas e corrigir o `planilhaId` na aba `Unidades`.
- [ ] Apagar da aba `Lancamentos` os lançamentos de teste.
- [ ] Conferir que a pasta e as planilhas **não** estão com "Qualquer pessoa com o link".
- [ ] Senhas provisórias aparecem no registro de execução do Apps Script: entregar a cada pessoa por canal privado.

## Observações de operação

- **Gatilho da virada do mês e modo de teste:** com `MES_ABERTO_TESTE` preenchido, o gatilho `virarMes` só recria a coluna do mês de teste.
- **Virada de ano:** a planilha de saídas não guarda o ano; em fevereiro de 2027 a gravação é recusada até definirmos o formato (ver "Em aberto" no BRIEFING).
- **Depois de mudar o código:** `clasp push`, `clasp create-version "descrição"` e `clasp update-deployment <id> --versionNumber N` mantêm a mesma URL. O gatilho já instalado continua valendo; não é preciso rodar `instalarGatilhos` de novo.
- **Ao mudar o formato dos campos ou da API:** o site envia o mês exibido (`ref`) em cada lançamento; páginas abertas antes da atualização pedem para recarregar.

## Operação

| Situação | Como fazer (editor do Apps Script) |
|---|---|
| Esqueceu a senha | `redefinirSenha('login')` → senha provisória no registro |
| Desativar usuário | aba `Usuarios`, coluna `ativo` = `FALSE` |
| Sair do modo de teste | aba `Config`, apagar o valor de `MES_ABERTO_TESTE` → passa a valer o mês que fechou |
| Ver quem fez o quê | aba `Log` da planilha Sistema |
