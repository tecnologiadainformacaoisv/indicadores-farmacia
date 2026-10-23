// Planilha de saídas: lê a planilha da unidade na nuvem e grava, item por item,
// as saídas do mês aberto, o CMM e o estoque disponível.

const MESES_CURTO = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const MESES_ANTERIORES = 3;           // quantos meses fechados mostrar ao lado do mês aberto
const CAMPOS = ['saida', 'cmm', 'estoque'];

let info = null;
// atalho da tela inicial da coordenação: logistica.html?unidade=<id> abre direto a planilha de uma unidade
const unidadeDoEndereco = new URLSearchParams(location.search).get('unidade');
let unidadeSel = unidadeDoEndereco && /^[A-Za-z0-9_.-]+$/.test(unidadeDoEndereco) ? unidadeDoEndereco : '';
let tentouEndereco = false;   // o ?unidade= do endereço só é tentado uma vez
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

let avisoRascunho = '';   // "Recuperamos N alterações…", mantido enquanto houver alterações recuperadas

// Um único rascunho por aba do navegador, com o login e a unidade a que pertence:
// só volta para a mesma pessoa e a mesma unidade.
function salvarRascunho() {
  try {
    if (alteracoes.size) {
      sessionStorage.setItem(RASCUNHO_KEY, JSON.stringify({ login: info && info.usuario.login, unidade: unidadeSel, itens: [...alteracoes.values()] }));
    } else {
      const r = lerRascunho();
      if (!r || (r.login === (info && info.usuario.login) && r.unidade === unidadeSel)) sessionStorage.removeItem(RASCUNHO_KEY);
    }
  } catch (e) { /* sem armazenamento: segue sem rascunho */ }
}

function lerRascunho() {
  try { return JSON.parse(sessionStorage.getItem(RASCUNHO_KEY) || 'null'); } catch (e) { return null; }
}

function restaurarRascunho(rascunho) {
  if (!rascunho || rascunho.login !== info.usuario.login || rascunho.unidade !== planilha.unidade) return 0;
  let n = 0;
  rascunho.itens.forEach(alt => {
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
  // o caminho de volta mantém a unidade que a coordenação estava vendo
  document.getElementById('mig-acomp').href = 'indicadores.html' + (info.usuario.perfil === 'admin' && unidadeSel ? '?unidade=' + encodeURIComponent(unidadeSel) : '');
  montarSeletorUnidade();
  const ref = planilha.mesAberto;
  document.getElementById('log-sub').textContent = planilha.editavel
    ? `Lance as saídas de ${nomeMes(ref)}, o CMM e o estoque disponível de cada item.`
    : `Consulta. Mês aberto para as unidades: ${nomeMes(ref)}.`;

  // alterações digitadas que não batem com a planilha nova (produto mudou de linha) são descartadas com aviso
  let descartadas = 0;
  [...alteracoes.entries()].forEach(([chave, alt]) => {
    const aba = planilha.abas.find(a => a.nome === alt.aba);
    const it = aba && aba.itens.find(x => x.linha === alt.linha);
    if (!it || it.produto !== alt.produto) { alteracoes.delete(chave); descartadas++; }
  });
  if (planilha.editavel && rascunho) {
    const n = restaurarRascunho(rascunho);
    if (n) avisoRascunho = `Recuperamos ${n} ${n === 1 ? 'alteração não salva' : 'alterações não salvas'} da sua última visita. Confira e clique em Salvar.`;
  }

  const avisos = [];
  if (ref.teste) avisos.push(`Ambiente de teste: o mês aberto está fixo em ${nomeMes(ref)}.`);
  if (!planilha.editavel && info.usuario.perfil !== 'admin') avisos.push('Somente leitura.');
  if (avisoRascunho && alteracoes.size) avisos.push(avisoRascunho);
  if (descartadas) avisos.push(`${descartadas} ${descartadas === 1 ? 'alteração foi descartada' : 'alterações foram descartadas'} porque a planilha mudou.`);
  setStatus(avisos.join(' '), ref.teste || (avisoRascunho && alteracoes.size) || descartadas ? 'warn' : '');

  if (!planilha.abas.length) { setStatus('A planilha da unidade não tem as abas MEDICAMENTOS e MATERIAIS.', 'erro'); return false; }
  if (!planilha.abas.some(a => a.nome === abaAtual)) abaAtual = planilha.abas[0].nome;
  const wrap = document.getElementById('log-wrap');
  wrap.removeAttribute('aria-busy');
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
  const rascunho = restaurar ? lerRascunho() : null;
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
    setStatus('');
    esqueletoTabela();
    document.getElementById('log-wrap').hidden = false;
    document.getElementById('log-toolbar').hidden = true;
  }

  let r;
  try {
    r = await api('logistica.carregar', unidadeSel ? { unidade: unidadeSel } : {});
  } catch (e) {
    if (unidadeDoEndereco && unidadeSel === unidadeDoEndereco && !tentouEndereco) {
      // unidade do endereço inválida ou de outra pessoa: volta para a unidade padrão
      tentouEndereco = true;
      unidadeSel = '';
      history.replaceState(null, '', location.pathname);
      return carregarPlanilha(restaurar);
    }
    if (!mostrouCache) {
      document.getElementById('log-sub').textContent = '';
      document.getElementById('log-body').innerHTML = '';   // tira o esqueleto: o erro já explica
      document.getElementById('log-wrap').hidden = true;
      document.getElementById('log-wrap').removeAttribute('aria-busy');
    }
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
  return exibirPlanilha(r, mostrouCache ? null : rascunho);
}

function montarAbas() {
  const tabs = document.getElementById('log-tabs');
  tabs.innerHTML = planilha.abas.map(a => `
    <button type="button" class="log-tab" role="tab" data-aba="${esc(a.nome)}" aria-selected="${a.nome === abaAtual}">
      ${esc(a.nome.charAt(0) + a.nome.slice(1).toLowerCase())} <span class="count">(${a.itens.length})</span>
    </button>`).join('');
}

// ── Tendência das saídas ───────────────────────────────────────
// Mini linha dos meses anteriores + variação contra a média: dá para ver, enquanto digita,
// se o valor está fora do padrão do próprio item.
const MESES_TENDENCIA = 6;
const LIMITE_FORA_PADRAO = 40; // % de diferença para a média que merece atenção

function linhaSpark(serie, temAtual) {
  const W = 76, H = 24, P = 3;
  const min = Math.min(...serie), max = Math.max(...serie);
  const x = i => P + (serie.length === 1 ? 0 : i * (W - 2 * P) / (serie.length - 1));
  const y = v => max === min ? H / 2 : H - P - (v - min) * (H - 2 * P) / (max - min);
  const pontos = serie.map((v, i) => x(i).toFixed(1) + ',' + y(v).toFixed(1)).join(' ');
  const ult = serie.length - 1;
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true"><polyline points="${pontos}"/><circle cx="${x(ult).toFixed(1)}" cy="${y(serie[ult]).toFixed(1)}" r="3" class="${temAtual ? 'atual' : 'ultimo'}"/></svg>`;
}

function tendencia(aba, it, atual) {
  const ref = planilha.mesAberto;
  const prev = aba.meses
    .map((m, i) => ({ mes: m.mes, v: it.valores[i] }))
    .filter(m => m.mes < ref.mes && m.v !== null && m.v !== undefined)
    .slice(-MESES_TENDENCIA).map(m => m.v);
  const cur = atual === null || atual === undefined || atual === '' ? null : Number(atual);
  if (prev.length < 2 && cur === null) return '<span class="tend-txt na">sem histórico</span>';
  const serie = cur === null ? prev : prev.concat([cur]);
  const media = prev.length ? prev.reduce((a, b) => a + b, 0) / prev.length : null;
  let texto, cls = '';
  if (cur === null) {
    texto = 'média ' + fmt(Math.round(media));
  } else if (!media) {
    texto = 'sem média anterior'; cls = 'na';
  } else {
    const d = (cur - media) / media * 100;
    const fora = Math.abs(d) >= LIMITE_FORA_PADRAO;
    texto = (d >= 0 ? '↑ ' : '↓ ') + Math.abs(Math.round(d)) + '% vs média' + (fora ? ' · fora do padrão' : '');
    cls = fora ? 'fora' : '';
  }
  return `<span class="tend">${linhaSpark(serie, cur !== null)}<span class="tend-txt ${cls}">${esc(texto)}</span></span>`;
}

function saidaAtualDaLinha(aba, it) {
  const alt = alteracoes.get(aba.nome + '|' + it.linha) || {};
  if (alt.saida !== undefined) return alt.saida;
  return valorOriginal(aba, it, 'saida');
}

// ── Cobertura de estoque ───────────────────────────────────────
// Quantos meses o estoque dura no ritmo do CMM. Sem estoque e abaixo de 1 mês são os casos críticos.
const COBERTURA_MAX = 3; // a barra enche com 3 meses ou mais

function cobertura(estoque, cmm) {
  const e = estoque === null || estoque === undefined || estoque === '' ? null : Number(estoque);
  const c = cmm === null || cmm === undefined || cmm === '' ? null : Number(cmm);
  if (e === null) return { cls: 'na', texto: '—', pct: 0, critico: false };
  if (e === 0) return { cls: 'bad', texto: 'Sem estoque', pct: 0, critico: true };
  if (!c) return { cls: 'na', texto: 'Sem CMM', pct: 0, critico: false };
  const meses = e / c;
  const pct = Math.min(100, Math.round(meses / COBERTURA_MAX * 100));
  const texto = (meses < 10 ? meses.toFixed(1) : Math.round(meses)).toString().replace('.', ',') + (Math.abs(meses - 1) < 0.05 ? ' mês' : ' meses');
  if (meses < 1) return { cls: 'warn', texto: texto + ' · baixo', pct, critico: true };
  return { cls: 'ok', texto, pct, critico: false };
}

// Ordenação por cobertura, num clique: pior primeiro (sem estoque) → melhor; de novo: melhor → pior; de novo: ordem da planilha.
let ordemCob = '';   // '' | 'asc' | 'desc'

// meses de estoque para ordenar: sem estoque = -1; sem dado (estoque vazio ou sem CMM) fica sempre no fim
function chaveCobertura(v) {
  const e = v.estoque === null || v.estoque === undefined || v.estoque === '' ? null : Number(v.estoque);
  const c = v.cmm === null || v.cmm === undefined || v.cmm === '' ? null : Number(v.cmm);
  if (e === null || !isFinite(e)) return null;
  if (e === 0) return -1;
  if (!c || !isFinite(c)) return null;
  return e / c;
}

function ordenarPorCobertura(itens, aba) {
  if (!ordemCob) return itens;
  const dir = ordemCob === 'asc' ? 1 : -1;
  return itens
    .map((it, i) => ({ it, i, k: chaveCobertura(valoresDaLinha(aba, it)) }))
    .sort((a, b) => (a.k === null) - (b.k === null) || (a.k === null ? 0 : (a.k - b.k) * dir) || a.i - b.i)
    .map(x => x.it);
}

function textoOrdemCob() {
  return ordemCob === 'asc' ? 'Cobertura: pior primeiro ↑' : ordemCob === 'desc' ? 'Cobertura: melhor primeiro ↓' : 'Ordenar por cobertura';
}

function alternarOrdemCob() {
  ordemCob = ordemCob === '' ? 'asc' : ordemCob === 'asc' ? 'desc' : '';
  render();
  document.getElementById('ordem-live').textContent = ordemCob === 'asc' ? 'Ordenado por cobertura, pior primeiro.' : ordemCob === 'desc' ? 'Ordenado por cobertura, melhor primeiro.' : 'Ordem da planilha.';
}

function celulaCobertura(c) {
  return `<span class="cob-txt">${esc(c.texto)}</span><span class="cob-barra"><i style="--w:${c.pct}"></i></span>`;
}

let soCriticos = false;
let soParados = false;      // itens com estoque e sem nenhuma saída nos últimos meses
const CRIT_SR = '<span class="sr-only">Estoque crítico: </span>'; // o ponto vermelho não pode ser só cor

// valores exibidos no momento (o que foi digitado vale mais que o que veio da planilha)
function valoresDaLinha(aba, it) {
  const alt = alteracoes.get(aba.nome + '|' + it.linha) || {};
  return { cmm: alt.cmm !== undefined ? alt.cmm : it.cmm, estoque: alt.estoque !== undefined ? alt.estoque : it.estoque };
}

// "parado": tem estoque, mas nenhuma saída nos meses fechados mostrados nem no mês aberto
function parado(aba, it) {
  const ref = planilha.mesAberto;
  const prev = aba.meses.map((m, i) => ({ mes: m.mes, v: it.valores[i] })).filter(m => m.mes < ref.mes).slice(-MESES_ANTERIORES);
  if (!prev.length) return false;
  const atual = saidaAtualDaLinha(aba, it);
  const semSaida = v => v === null || v === undefined || v === '' || Number(v) === 0;
  const est = valoresDaLinha(aba, it).estoque;
  return prev.every(m => semSaida(m.v)) && semSaida(atual) && est !== null && est !== undefined && est !== '' && Number(est) > 0;
}

// variação (%) da saída frente à média dos meses anteriores; null se não dá para comparar
function desvioMedia(aba, it, cur) {
  const ref = planilha.mesAberto;
  const prev = aba.meses.map((m, i) => ({ mes: m.mes, v: it.valores[i] }))
    .filter(m => m.mes < ref.mes && m.v !== null && m.v !== undefined).slice(-MESES_TENDENCIA).map(m => m.v);
  const media = prev.length ? prev.reduce((a, b) => a + b, 0) / prev.length : 0;
  if (!media || cur === null || cur === undefined || cur === '') return null;
  return (Number(cur) - media) / media * 100;
}

function atualizarParados() {
  const aba = planilha.abas.find(a => a.nome === abaAtual);
  const n = aba.itens.filter(it => parado(aba, it)).length;
  document.getElementById('n-parados').textContent = n ? '(' + n + ')' : '';
  const btn = document.getElementById('btn-parados');
  btn.disabled = n === 0 && !soParados;
  btn.title = btn.disabled ? 'Nenhum item com estoque e sem saída nos meses anteriores' : 'Têm estoque e nenhuma saída nos últimos meses';
  btn.setAttribute('aria-pressed', String(soParados));
}

function atualizarCriticos() {
  const aba = planilha.abas.find(a => a.nome === abaAtual);
  const n = aba.itens.filter(it => { const v = valoresDaLinha(aba, it); return cobertura(v.estoque, v.cmm).critico; }).length;
  document.getElementById('n-criticos').textContent = n ? '(' + n + ')' : '';
  const btn = document.getElementById('btn-criticos');
  btn.disabled = n === 0 && !soCriticos;
  btn.setAttribute('aria-pressed', String(soCriticos));
}

function esqueletoTabela() {
  document.getElementById('log-wrap').setAttribute('aria-busy', 'true');
  document.getElementById('log-head').innerHTML = '';
  document.getElementById('log-body').innerHTML = Array.from({ length: 9 }, () =>
    '<tr class="esqueleto"><td colspan="7"><span class="skeleton" style="height:20px"></span></td></tr>').join('');
  document.getElementById('log-empty').hidden = true;
}

// ── Tabela ─────────────────────────────────────────────────────
function render() {
  esconderRevisao();
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
    <th scope="col" class="col-cob"${ordemCob ? ' aria-sort="' + (ordemCob === 'asc' ? 'ascending' : 'descending') + '"' : ''}>Cobertura</th>
    <th scope="col" class="col-tend">Tendência das saídas</th>
  </tr>`;

  const ed = planilha.editavel;
  const cel = (it, campo, valor) => {
    const alt = alteracoes.get(abaAtual + '|' + it.linha);
    const v = alt && alt[campo] !== undefined ? alt[campo] : valor;
    const rotulo = campo === 'saida' ? 'Saídas de ' + MESES_NOME[planilha.mesAberto.mes].toLowerCase() : campo === 'cmm' ? 'CMM' : 'Estoque';
    if (!ed) return `<td class="col-aberto" data-label="${rotulo}">${fmt(v)}</td>`;
    const mudou = alt && alt[campo] !== undefined;
    return `<td class="col-aberto" data-label="${rotulo}"><input class="num-input${mudou ? ' ' + classeMudanca(valor, alt[campo]) : ''}" type="number" min="0" step="1" inputmode="numeric" enterkeyhint="next"
      data-linha="${it.linha}" data-campo="${campo}" value="${v === null || v === undefined || v === '' ? '' : v}"
      aria-label="${campo === 'saida' ? 'Saídas' : campo === 'cmm' ? 'CMM' : 'Estoque disponível'} de ${esc(it.produto)}"></td>`;
  };

  const btnOrdem = document.getElementById('btn-ordem-cob');
  btnOrdem.textContent = textoOrdemCob();
  btnOrdem.classList.toggle('ativo', ordemCob !== '');
  document.getElementById('log-body').innerHTML = ordenarPorCobertura(aba.itens, aba).map(it => {
    const v = valoresDaLinha(aba, it);
    const cob = cobertura(v.estoque, v.cmm);
    return `
    <tr data-busca="${esc(normalizar(it.produto))}" data-linha="${it.linha}" data-critico="${cob.critico ? 1 : 0}" data-parado="${parado(aba, it) ? 1 : 0}"${alteracoes.has(abaAtual + '|' + it.linha) ? ' class="alterado"' : ''}>
      <td class="produto">${cob.critico ? CRIT_SR : ''}${esc(it.produto)}</td>
      ${anteriores.map(m => `<td class="mes-anterior">${fmt(it.valores[m.i])}</td>`).join('')}
      ${cel(it, 'saida', idxAberto >= 0 ? it.valores[idxAberto] : null)}
      ${cel(it, 'cmm', it.cmm)}
      ${cel(it, 'estoque', it.estoque)}
      <td class="col-cob cob ${cob.cls}" data-label="Cobertura">${celulaCobertura(cob)}</td>
      <td class="col-tend" data-label="Tendência das saídas">${tendencia(aba, it, saidaAtualDaLinha(aba, it))}</td>
    </tr>`;
  }).join('');
  filtrar();
  atualizarCriticos();
  atualizarParados();
  atualizarBarra();
}

function filtrar() {
  const q = normalizar(document.getElementById('busca').value.trim());
  let visiveis = 0;
  document.querySelectorAll('#log-body tr').forEach(tr => {
    const ok = (!q || tr.dataset.busca.includes(q)) && (!soCriticos || tr.dataset.critico === '1') && (!soParados || tr.dataset.parado === '1');
    tr.hidden = !ok;
    if (ok) visiveis++;
  });
  const vazio = document.getElementById('log-empty');
  const busca = document.getElementById('busca').value.trim();
  vazio.textContent = busca ? 'Nenhum produto encontrado para "' + busca + '".'
    : soCriticos ? 'Nenhum item crítico nesta aba. Estoque sem alertas.'
    : 'Nenhum produto encontrado.';
  vazio.hidden = visiveis > 0;
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

function aoEditar(input, adiar) {
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
  const tr = input.closest('tr');
  tr.classList.toggle('alterado', alteracoes.has(chave));
  const v = valoresDaLinha(aba, it);
  const cob = cobertura(v.estoque, v.cmm);
  tr.dataset.critico = cob.critico ? '1' : '0';
  tr.dataset.parado = parado(aba, it) ? '1' : '0';
  esconderRevisao();
  const tdProd = tr.querySelector('.produto');
  const sr = tdProd.querySelector('.sr-only');
  if (cob.critico && !sr) tdProd.insertAdjacentHTML('afterbegin', CRIT_SR);
  else if (!cob.critico && sr) sr.remove();
  const tdCob = tr.querySelector('.cob');
  tdCob.className = 'col-cob cob ' + cob.cls;
  tdCob.innerHTML = celulaCobertura(cob);
  tr.querySelector('.col-tend').innerHTML = tendencia(aba, it, saidaAtualDaLinha(aba, it));
  if (adiar) return;
  atualizarCriticos();
  atualizarParados();
  atualizarBarra();
}

let mensagemSalvo = '';   // "N itens salvos às hh:mm", exibida até a próxima alteração

function atualizarBarra(persistir = true) {
  const n = alteracoes.size;
  if (n) mensagemSalvo = '';
  else avisoRascunho = '';
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
  const salvasPorAba = {};
  const wrapSalvar = document.getElementById('log-wrap');
  wrapSalvar.inert = true; // ninguém digita durante o envio (o que fosse digitado seria descartado ao terminar)
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
      salvasPorAba[aba] = porAba[aba];
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
    aplicarSalvos(salvasPorAba); // o que já foi gravado aparece com o valor novo, não com o antigo
    setStatus((salvas.length ? 'Salvo: ' + salvas.join(' e ') + '. Não salvo: ' : '') + e.message, 'erro');
    render();
    atualizarBarra();
  } finally {
    wrapSalvar.inert = false;
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
    exibirPlanilha(r, null);
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

document.getElementById('btn-ordem-cob').addEventListener('click', alternarOrdemCob);

document.getElementById('log-tabs').addEventListener('click', e => {
  const b = e.target.closest('.log-tab');
  if (!b) return;
  abaAtual = b.dataset.aba;
  document.querySelectorAll('.log-tab').forEach(t => t.setAttribute('aria-selected', String(t === b)));
  render();
});

document.getElementById('busca').addEventListener('input', filtrar);
document.getElementById('btn-criticos').addEventListener('click', () => {
  soCriticos = !soCriticos;
  filtrar();
  atualizarCriticos();
});
// ── Revisão antes de salvar ────────────────────────────────────
// O botão não grava na hora: mostra o que vai mudar (de → para) e só então confirma.
const ROTULO_CAMPO = { saida: 'Saídas', cmm: 'CMM', estoque: 'Estoque' };
const REVISAO_LINHAS = 6;

function esconderRevisao(voltarFoco) {
  const rev = document.getElementById('rev');
  if (!rev.hidden) {
    rev.hidden = true;
    document.getElementById('save-info').hidden = false;
    document.getElementById('btnSalvar').hidden = false;
    if (voltarFoco) document.getElementById('btnSalvar').focus();
  }
}

function mostrarRevisao() {
  const itens = [];
  let fora = 0;
  alteracoes.forEach(alt => {
    const aba = planilha.abas.find(a => a.nome === alt.aba);
    const it = aba.itens.find(x => x.linha === alt.linha);
    const partes = [];
    let aviso = '';
    CAMPOS.forEach(c => {
      if (alt[c] === undefined) return;
      partes.push(ROTULO_CAMPO[c] + ' ' + fmt(valorOriginal(aba, it, c)) + ' → ' + fmt(alt[c]));
      if (c === 'saida') {
        const d = desvioMedia(aba, it, alt[c]);
        if (d !== null && Math.abs(d) >= LIMITE_FORA_PADRAO) aviso = ' (' + (d > 0 ? '+' : '') + Math.round(d) + '% vs média)';
      }
    });
    if (aviso) fora++;
    itens.push({ produto: alt.produto, texto: partes.join(' · '), aviso });
  });
  // quem está fora do padrão aparece primeiro
  itens.sort((x, y) => (y.aviso ? 1 : 0) - (x.aviso ? 1 : 0));
  const n = itens.length;
  document.getElementById('rev-resumo').textContent = 'Revisar ' + n + (n === 1 ? ' item' : ' itens') + ' antes de gravar' + (fora ? ' · ' + fora + ' fora do padrão' : '');
  document.getElementById('rev-lista').innerHTML = itens.slice(0, REVISAO_LINHAS).map(l =>
    '<li' + (l.aviso ? ' class="aviso"' : '') + '><b>' + esc(l.produto) + '</b> <span>' + esc(l.texto + l.aviso) + '</span></li>').join('') +
    (n > REVISAO_LINHAS ? '<li class="mais">+ ' + (n - REVISAO_LINHAS) + ' itens</li>' : '');
  document.getElementById('rev').hidden = false;
  document.getElementById('save-info').hidden = true;
  document.getElementById('btnSalvar').hidden = true;
  document.getElementById('rev-ok').focus();
}

document.getElementById('btnSalvar').addEventListener('click', mostrarRevisao);
document.getElementById('rev-voltar').addEventListener('click', () => esconderRevisao(true));
document.addEventListener('keydown', e => { if (e.key === 'Escape') esconderRevisao(true); });
document.getElementById('rev-ok').addEventListener('click', () => { esconderRevisao(true); salvar(); });

// ── Colar do Excel ─────────────────────────────────────────────
// Colar várias células (linhas e colunas) a partir do campo em foco: preenche para baixo, nos itens visíveis.
function numeroColado(txt) {
  let t = String(txt).trim().replace(/\s/g, '');
  if (t === '') return null;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  const n = Number(t);
  return isFinite(n) && n >= 0 && Number.isInteger(n) ? String(n) : null; // vazio, decimal e texto não entram
}

document.getElementById('log-body').addEventListener('paste', e => {
  const alvo = e.target;
  if (!alvo.classList || !alvo.classList.contains('num-input')) return;
  const texto = (e.clipboardData || window.clipboardData).getData('text');
  if (!/[\t\n]/.test(texto.replace(/[\t\n\r]+$/, ''))) return; // uma célula só: cola normal
  e.preventDefault();
  const grade = texto.replace(/\r/g, '').replace(/\n+$/, '').split('\n').map(l => l.split('\t'));
  const c0 = CAMPOS.indexOf(alvo.dataset.campo);
  let tr = alvo.closest('tr');
  let colados = 0, ignorados = 0;
  grade.forEach(linha => {
    while (tr && tr.hidden) tr = tr.nextElementSibling;
    if (!tr) return;
    linha.forEach((cel, j) => {
      const campo = CAMPOS[c0 + j];
      const input = campo && tr.querySelector('.num-input[data-campo="' + campo + '"]');
      if (!input) return;
      const v = numeroColado(cel);
      if (v === null) { ignorados++; return; }
      input.value = v;
      aoEditar(input, true);
      colados++;
    });
    tr = tr.nextElementSibling;
  });
  if (colados) { atualizarCriticos(); atualizarParados(); atualizarBarra(); }
  setStatus(colados + (colados === 1 ? ' valor colado' : ' valores colados') + (ignorados ? ' · ' + ignorados + ' ignorado(s): célula vazia, decimal ou texto' : '') + '. Revise e salve.', ignorados ? 'warn' : '');
});

document.getElementById('btn-parados').addEventListener('click', () => {
  soParados = !soParados;
  filtrar();
  atualizarParados();
});

window.addEventListener('beforeunload', e => {
  if (alteracoes.size && !saindoDaSessao) { e.preventDefault(); e.returnValue = ''; }
});

// ── Init ───────────────────────────────────────────────────────
carregarPlanilha(true).catch(e => setStatus(e.message, 'erro'));
