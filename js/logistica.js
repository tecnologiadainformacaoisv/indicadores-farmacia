// Planilha de saídas: lê a planilha da unidade na nuvem e grava, item por item,
// as saídas do mês aberto, o CMM e o estoque disponível.

const MESES_CURTO = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const MESES_ANTERIORES = 3;           // quantos meses fechados mostrar ao lado do mês aberto
const CAMPOS = ['saida', 'cmm', 'estoque'];

let info = null;
let unidadeSel = '';
let planilha = null;                  // resposta de logistica.ler
let abaAtual = '';
const alteracoes = new Map();         // "aba|linha" -> { aba, linha, produto, saida, cmm, estoque }

// ── Mensagens ──────────────────────────────────────────────────
function setStatus(texto, tipo) {
  const el = document.getElementById('log-status');
  el.textContent = texto || '';
  el.className = 'notice' + (tipo ? ' ' + tipo : '');
  el.hidden = !texto;
}

function normalizar(s) {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function fmt(v) {
  return v === null || v === undefined ? '—' : Number(v).toLocaleString('pt-BR');
}

// ── Rascunho ───────────────────────────────────────────────────
// Alterações não salvas ficam na aba do navegador: se a sessão expirar ou a página
// recarregar, voltam depois do login (só se a linha ainda for do mesmo produto).
let saindoDaSessao = false;

function chaveRascunho() { return 'farma_rascunho_' + unidadeSel; }

function salvarRascunho() {
  try {
    if (alteracoes.size) sessionStorage.setItem(chaveRascunho(), JSON.stringify([...alteracoes.values()]));
    else sessionStorage.removeItem(chaveRascunho());
  } catch (e) { /* sem armazenamento: segue sem rascunho */ }
}

function lerRascunho() {
  try { return JSON.parse(sessionStorage.getItem(chaveRascunho()) || '[]'); } catch (e) { return []; }
}

function restaurarRascunho(lista) {
  let n = 0;
  lista.forEach(alt => {
    const aba = planilha.abas.find(a => a.nome === alt.aba);
    const it = aba && aba.itens.find(x => x.linha === alt.linha);
    if (!it || it.produto !== alt.produto) return;
    alteracoes.set(alt.aba + '|' + alt.linha, alt);
    n++;
  });
  return n;
}

window.antesDeSairDaSessao = () => { salvarRascunho(); saindoDaSessao = true; };

// ── Leitura ────────────────────────────────────────────────────
let seletorPronto = false;

function montarSeletorUnidade() {
  if (seletorPronto) return;
  seletorPronto = true;
  const sel = document.getElementById('unitSel');
  if (info.usuario.perfil === 'admin') {
    sel.innerHTML = info.unidades.map(u => `<option value="${esc(u.id)}">${esc(u.nome)}</option>`).join('');
    sel.value = unidadeSel;
    sel.hidden = false;
    sel.addEventListener('change', async () => {
      const anterior = unidadeSel;
      unidadeSel = sel.value;
      if (!(await carregarPlanilha()) && alteracoes.size) { unidadeSel = anterior; sel.value = anterior; }
    });
  } else {
    const un = info.unidades.find(u => u.id === unidadeSel);
    document.getElementById('unitLabel').textContent = un ? un.nome : '';
  }
}

// Mostra uma carga (vinda do cache ou do servidor). Não mexe nas alterações já digitadas.
function exibirPlanilha(r, rascunho) {
  info = r.sessao;
  if (!validarSessao(info)) return false;
  planilha = r.logistica;
  unidadeSel = planilha.unidade;
  montarSeletorUnidade();
  const ref = planilha.mesAberto;
  document.getElementById('log-sub').textContent = planilha.editavel
    ? `Lance as saídas de ${nomeMes(ref)}, o CMM e o estoque disponível de cada item.`
    : `Consulta. Mês aberto para as unidades: ${nomeMes(ref)}.`;
  const avisos = [];
  if (ref.teste) avisos.push(`Ambiente de teste: o mês aberto está fixo em ${nomeMes(ref)}.`);
  if (!planilha.editavel && info.usuario.perfil !== 'admin') avisos.push('Somente leitura.');
  setStatus(avisos.join(' '), ref.teste ? 'warn' : '');

  if (!planilha.abas.length) { setStatus('A planilha da unidade não tem as abas MEDICAMENTOS e MATERIAIS.', 'erro'); return false; }
  if (!planilha.abas.some(a => a.nome === abaAtual)) abaAtual = planilha.abas[0].nome;
  if (planilha.editavel && rascunho.length) {
    const n = restaurarRascunho(rascunho);
    if (n) setStatus(`Recuperamos ${n} ${n === 1 ? 'alteração não salva' : 'alterações não salvas'} da sua última visita. Confira e clique em Salvar.`, 'warn');
    atualizarBarra();
  }
  const wrap = document.getElementById('log-wrap');
  const rolagem = wrap.scrollTop;
  montarAbas();
  render();
  wrap.scrollTop = rolagem;
  salvarRascunho(); // leitura ok: agora o rascunho reflete o que está na tela
  document.getElementById('log-toolbar').hidden = false;
  wrap.hidden = false;
  document.getElementById('log-dica').hidden = !planilha.editavel;
  document.getElementById('save-bar').hidden = !planilha.editavel;
  return true;
}

// Uma chamada traz sessão e planilha; a última carga aparece na hora enquanto a nova chega.
async function carregarPlanilha(restaurar) {
  if (alteracoes.size && !confirm('Há alterações não salvas. Descartar?')) return false;
  const rascunho = restaurar ? lerRascunho() : [];
  alteracoes.clear();
  atualizarBarra(false); // não regrava o rascunho ainda: se a leitura falhar, ele continua guardado

  const chave = 'log:' + (unidadeSel || 'inicial');
  const emCache = cacheLer(chave);
  let mostrouCache = false;
  if (emCache) {
    mostrouCache = exibirPlanilha(emCache.dados, rascunho);
    if (mostrouCache) setStatus('Atualizando…');
  }
  if (!mostrouCache) {
    setStatus('Carregando a planilha da unidade…');
    document.getElementById('log-wrap').hidden = true;
    document.getElementById('log-toolbar').hidden = true;
  }

  let r;
  try {
    r = await api('logistica.carregar', unidadeSel ? { unidade: unidadeSel } : {});
  } catch (e) {
    if (!mostrouCache) document.getElementById('log-sub').textContent = '';
    setStatus(e.message + (mostrouCache ? ' Mostrando os dados da última visita.' : ''), 'erro');
    return mostrouCache;
  }
  cacheGravar('log:' + r.logistica.unidade, r);
  if (!unidadeSel) cacheGravar('log:inicial', r);

  // não troca a tabela debaixo de quem já está digitando
  const ativo = document.activeElement;
  if (mostrouCache && ativo && ativo.classList && ativo.classList.contains('num-input')) {
    setStatus('Há uma versão mais nova da planilha. Salve o que digitou e recarregue a página para vê-la.', 'warn');
    return true;
  }
  return exibirPlanilha(r, mostrouCache ? [] : rascunho);
}

function montarAbas() {
  const tabs = document.getElementById('log-tabs');
  tabs.innerHTML = planilha.abas.map(a => `
    <button type="button" class="log-tab" role="tab" data-aba="${esc(a.nome)}" aria-selected="${a.nome === abaAtual}">
      ${esc(a.nome.charAt(0) + a.nome.slice(1).toLowerCase())} <span class="count">(${a.itens.length})</span>
    </button>`).join('');
}

// ── Tabela ─────────────────────────────────────────────────────
function render() {
  const aba = planilha.abas.find(a => a.nome === abaAtual);
  const ref = planilha.mesAberto;
  const idxAberto = aba.meses.findIndex(m => m.mes === ref.mes);
  // meses fechados mais recentes antes do mês aberto
  const anteriores = aba.meses
    .map((m, i) => ({ ...m, i }))
    .filter(m => m.mes < ref.mes)
    .slice(-MESES_ANTERIORES);

  document.getElementById('log-head').innerHTML = `<tr>
    <th scope="col">Produto</th>
    ${anteriores.map(m => `<th scope="col" class="mes-anterior">${MESES_CURTO[m.mes]}</th>`).join('')}
    <th scope="col" class="col-aberto">Saídas ${MESES_CURTO[ref.mes]}</th>
    <th scope="col" class="col-aberto">CMM</th>
    <th scope="col" class="col-aberto">Estoque disp.</th>
  </tr>`;

  const ed = planilha.editavel;
  const cel = (it, campo, valor) => {
    const alt = alteracoes.get(abaAtual + '|' + it.linha);
    const v = alt && alt[campo] !== undefined ? alt[campo] : valor;
    if (!ed) return `<td class="col-aberto">${fmt(v)}</td>`;
    const mudou = alt && alt[campo] !== undefined;
    return `<td class="col-aberto"><input class="num-input${mudou ? ' ' + classeMudanca(valor, alt[campo]) : ''}" type="number" min="0" step="1" inputmode="numeric" enterkeyhint="next"
      data-linha="${it.linha}" data-campo="${campo}" value="${v === null || v === undefined || v === '' ? '' : v}"
      aria-label="${campo === 'saida' ? 'Saídas' : campo === 'cmm' ? 'CMM' : 'Estoque disponível'} de ${esc(it.produto)}"></td>`;
  };

  document.getElementById('log-body').innerHTML = aba.itens.map(it => `
    <tr data-busca="${esc(normalizar(it.produto))}" data-linha="${it.linha}"${alteracoes.has(abaAtual + '|' + it.linha) ? ' class="alterado"' : ''}>
      <td class="produto">${esc(it.produto)}</td>
      ${anteriores.map(m => `<td class="mes-anterior">${fmt(it.valores[m.i])}</td>`).join('')}
      ${cel(it, 'saida', idxAberto >= 0 ? it.valores[idxAberto] : null)}
      ${cel(it, 'cmm', it.cmm)}
      ${cel(it, 'estoque', it.estoque)}
    </tr>`).join('');
  filtrar();
  atualizarBarra();
}

function filtrar() {
  const q = normalizar(document.getElementById('busca').value.trim());
  let visiveis = 0;
  document.querySelectorAll('#log-body tr').forEach(tr => {
    const ok = !q || tr.dataset.busca.includes(q);
    tr.hidden = !ok;
    if (ok) visiveis++;
  });
  document.getElementById('log-empty').hidden = visiveis > 0;
}

// ── Edição ─────────────────────────────────────────────────────
// Borda do campo: verde se o valor subiu, vermelha se desceu (apagar conta como descer).
function classeMudanca(orig, novo) {
  const o = orig === null || orig === undefined || orig === '' ? 0 : Number(orig);
  const n = novo === null || novo === undefined || novo === '' ? 0 : Number(novo);
  return n > o ? 'subiu' : 'desceu';
}

function valorOriginal(aba, it, campo) {
  if (campo === 'cmm') return it.cmm;
  if (campo === 'estoque') return it.estoque;
  const idx = aba.meses.findIndex(m => m.mes === planilha.mesAberto.mes);
  return idx >= 0 ? it.valores[idx] : null;
}

function aoEditar(input) {
  const aba = planilha.abas.find(a => a.nome === abaAtual);
  const linha = +input.dataset.linha;
  const campo = input.dataset.campo;
  const it = aba.itens.find(x => x.linha === linha);
  const txt = input.value.trim();
  const n = txt === '' ? null : Number(txt);
  const invalido = txt !== '' && (!isFinite(n) || n < 0);
  input.classList.toggle('invalido', invalido);

  const chave = abaAtual + '|' + linha;
  const alt = alteracoes.get(chave) || { aba: abaAtual, linha, produto: it.produto };
  const orig = valorOriginal(aba, it, campo);
  // valor inválido não entra nas alterações; a barra bloqueia o salvar até corrigir
  if (invalido || n === orig || (n === null && (orig === null || orig === undefined))) delete alt[campo];
  else alt[campo] = n;
  input.classList.remove('subiu', 'desceu');
  if (alt[campo] !== undefined) input.classList.add(classeMudanca(orig, alt[campo]));

  if (CAMPOS.some(c => alt[c] !== undefined)) alteracoes.set(chave, alt);
  else alteracoes.delete(chave);
  input.closest('tr').classList.toggle('alterado', alteracoes.has(chave));
  atualizarBarra();
}

let mensagemSalvo = '';   // "N itens salvos às hh:mm", exibida até a próxima alteração

function atualizarBarra(persistir = true) {
  const n = alteracoes.size;
  if (n) mensagemSalvo = '';
  const el = document.getElementById('save-info');
  const invalidos = document.querySelectorAll('.num-input.invalido').length;
  // resumo por aba: quem troca de aba vê que o que digitou na outra continua lá
  const porAba = {};
  alteracoes.forEach(a => { porAba[a.aba] = (porAba[a.aba] || 0) + 1; });
  const resumo = Object.entries(porAba).map(([aba, q]) => `${aba.charAt(0) + aba.slice(1).toLowerCase()}: ${q}`).join(' · ');
  el.textContent = invalidos
    ? `Corrija ${invalidos} valor(es) inválido(s) antes de salvar.`
    : n ? `${n} ${n === 1 ? 'item alterado' : 'itens alterados'}, ainda não salvo${n === 1 ? '' : 's'} (${resumo}).` : (mensagemSalvo || 'Nenhuma alteração.');
  el.className = n || invalidos ? 'pendente' : (mensagemSalvo ? 'salvo' : '');
  document.getElementById('btnSalvar').disabled = !n || invalidos > 0;
  if (persistir) salvarRascunho();
}

async function salvar() {
  const btn = document.getElementById('btnSalvar');
  btn.disabled = true;
  const porAba = {};
  alteracoes.forEach(alt => { (porAba[alt.aba] = porAba[alt.aba] || []).push(alt); });
  const salvas = [];
  try {
    let total = 0;
    for (const aba of Object.keys(porAba)) {
      setStatus(`Salvando ${aba.toLowerCase()}…`);
      const itens = porAba[aba].map(a => ({ linha: a.linha, produto: a.produto, saida: a.saida, cmm: a.cmm, estoque: a.estoque }));
      const r = await api('logistica.salvar', { unidade: unidadeSel, aba, itens, ref: { ano: planilha.mesAberto.ano, mes: planilha.mesAberto.mes } });
      total += r.gravados;
      // aba gravada sai das pendências: se a próxima falhar, só ela fica para salvar
      porAba[aba].forEach(a => alteracoes.delete(a.aba + "|" + a.linha));
      salvas.push(aba.toLowerCase());
    }
    alteracoes.clear();
    // a tabela já mostra o que foi gravado: atualiza o modelo local e redesenha, sem tela de carregamento
    aplicarSalvos(porAba);
    cacheRemover('log:inicial');
    cacheGravar('log:' + unidadeSel, { sessao: info, logistica: planilha });
    const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    mensagemSalvo = `${total} ${total === 1 ? 'item salvo' : 'itens salvos'} na planilha às ${hora}.`;
    setStatus(planilha.mesAberto.teste ? `Ambiente de teste: o mês aberto está fixo em ${nomeMes(planilha.mesAberto)}.` : '', planilha.mesAberto.teste ? 'warn' : '');
    render();
    atualizarEmSegundoPlano();
  } catch (e) {
    setStatus((salvas.length ? 'Salvo: ' + salvas.join(' e ') + '. Não salvo: ' : '') + e.message, 'erro');
    render();
    atualizarBarra();
  }
}

// Copia para o modelo local o que acabou de ser gravado (a planilha do servidor já tem esses valores).
function aplicarSalvos(porAba) {
  Object.keys(porAba).forEach(nomeAba => {
    const aba = planilha.abas.find(a => a.nome === nomeAba);
    if (!aba) return;
    const idx = aba.meses.findIndex(m => m.mes === planilha.mesAberto.mes);
    porAba[nomeAba].forEach(alt => {
      const it = aba.itens.find(x => x.linha === alt.linha);
      if (!it) return;
      if (alt.saida !== undefined && idx >= 0) it.valores[idx] = alt.saida;
      if (alt.cmm !== undefined) it.cmm = alt.cmm;
      if (alt.estoque !== undefined) it.estoque = alt.estoque;
    });
  });
}

// Confirma com o servidor sem esconder nada: se a coluna do mês acabou de ser criada, ou outra
// pessoa mexeu na planilha, a tela se corrige sozinha. Não interrompe quem voltou a digitar.
async function atualizarEmSegundoPlano() {
  try {
    const r = await api('logistica.carregar', { unidade: unidadeSel });
    cacheGravar('log:' + r.logistica.unidade, r);
    const ativo = document.activeElement;
    if (alteracoes.size || (ativo && ativo.classList && ativo.classList.contains('num-input'))) return;
    exibirPlanilha(r, []);
  } catch (e) { /* a tela já reflete o que foi salvo */ }
}

// ── Eventos ────────────────────────────────────────────────────
document.getElementById('log-body').addEventListener('input', e => {
  if (e.target.classList.contains('num-input')) aoEditar(e.target);
});

// Enter desce para o mesmo campo do próximo item visível (lançamento em sequência)
document.getElementById('log-body').addEventListener('keydown', e => {
  if (e.key !== 'Enter' || !e.target.classList.contains('num-input')) return;
  e.preventDefault();
  let tr = e.target.closest('tr').nextElementSibling;
  while (tr && tr.hidden) tr = tr.nextElementSibling;
  const prox = tr && tr.querySelector(`.num-input[data-campo="${e.target.dataset.campo}"]`);
  if (prox) { prox.focus(); prox.select(); }
});

document.getElementById('log-tabs').addEventListener('click', e => {
  const b = e.target.closest('.log-tab');
  if (!b) return;
  abaAtual = b.dataset.aba;
  document.querySelectorAll('.log-tab').forEach(t => t.setAttribute('aria-selected', String(t === b)));
  render();
});

document.getElementById('busca').addEventListener('input', filtrar);
document.getElementById('btnSalvar').addEventListener('click', salvar);

window.addEventListener('beforeunload', e => {
  if (alteracoes.size && !saindoDaSessao) { e.preventDefault(); e.returnValue = ''; }
});

// ── Init ───────────────────────────────────────────────────────
carregarPlanilha(true).catch(e => setStatus(e.message, 'erro'));
