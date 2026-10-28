// Dashboard comparativo (só coordenação): lançamentos reais de todas as unidades, indicador por indicador.
// A lógica fica em funções puras (testadas em tests/front.test.js); a tela está no bloco do final.

const GRUPOS = {
  clinica: ['conciliacoes', 'prescricoes', 'prm', 'intervencoes', 'altas'],
  logistica: ['desabastecimento', 'perdas', 'nconformidades', 'estoque', 'emergenciais'],
};
const MES_CURTO = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
// uma cor por unidade, igual em todos os gráficos; cor de série nunca indica status (o status vai em texto)
const CORES_UNIDADE = ['#2e86c1', '#e0951a', '#8e6bbf', '#2eaf68', '#d9534f', '#17a2b8'];

const pct = (n, d) => (n !== null && n !== undefined && d > 0 ? +(n / d * 100).toFixed(1) : null);

// mesmas contas da tela de acompanhamento mensal (js/indicadores.js)
function calcRow(r) {
  return {
    conciliacoes: pct(r.conciliacoes, r.admissoes),
    prescricoes: pct(r['presc-anal'], r['presc-atend']),
    prm: pct(r.prm, r['presc-anal']),
    intervencoes: pct(r['interv-aceitas'], r['interv-total']),
    altas: pct(r['altas-real'], r['altas-total']),
    desabastecimento: pct(r['itens-falta'], r['itens-pad']),
    perdas: pct(r['itens-venc'], r['itens-pad']),
    nconformidades: pct(r.nc, r.entregas),
    estoque: pct(r.conformes, r.auditados),
    emergenciais: pct(r.emergenciais, r.entregas),
  };
}

// mesma regra de faixas do acompanhamento: dentro da meta, atenção (até 20% abaixo / 30% acima), fora da meta
function situacao(meta, val) {
  if (val === null || val === undefined || !meta) return 'na';
  if (meta.dir === 'min') return val >= meta.val ? 'ok' : val >= meta.val * .8 ? 'warn' : 'err';
  return val <= meta.val ? 'ok' : val <= meta.val * 1.3 ? 'warn' : 'err';
}
const ROTULO_SITUACAO = { ok: 'Dentro da meta', warn: 'Atenção', err: 'Fora da meta', na: 'Sem dado' };

function media(lista) {
  const v = lista.filter(x => x !== null && x !== undefined);
  return v.length ? +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : null;
}

function nomeIndicador(metas, key) {
  for (const id of Object.keys(metas)) if (metas[id] && metas[id][key]) return String(metas[id][key].label).replace(/\s*\(%\)\s*$/, '');
  return key;
}

// Monta os números de um indicador para o mês escolhido.
// dados = { sessao, lancamentos, metas } de 'dashboard.carregar'; retorna uma linha por unidade e a média das unidades.
function montarIndicador(dados, key, mes) {
  const ano = dados.sessao.mesAberto.ano;
  const unidades = dados.sessao.unidades;
  const linhas = unidades.map((un, i) => {
    const meta = (dados.metas[un.id] || {})[key] || null;
    const serie = Array(12).fill(null);
    dados.lancamentos.filter(l => l.unidade === un.id && l.ano === ano).forEach(l => { serie[l.mes] = calcRow(l)[key]; });
    return { id: un.id, nome: un.nome, cor: CORES_UNIDADE[i % CORES_UNIDADE.length], meta, serie, valor: serie[mes], sit: situacao(meta, serie[mes]) };
  });
  const metas = linhas.map(l => l.meta).filter(Boolean);
  const metaUnica = metas.length && metas.every(m => m.val === metas[0].val && m.dir === metas[0].dir) ? metas[0] : null;
  const valorMedia = media(linhas.map(l => l.valor));
  return {
    key, nome: nomeIndicador(dados.metas, key), linhas, metaUnica,
    media: { valor: valorMedia, sit: metaUnica ? situacao(metaUnica, valorMedia) : 'na', n: linhas.filter(l => l.valor !== null).length },
    temDado: linhas.some(l => l.serie.some(v => v !== null)),
  };
}

function textoMeta(m) {
  return m ? (m.dir === 'min' ? 'Meta: pelo menos ' : 'Meta: no máximo ') + String(m.val).replace('.', ',') + '%' : 'Metas diferentes por unidade';
}
const fmtPct = v => (v === null || v === undefined ? '—' : v.toFixed(1).replace('.', ',') + '%');

// meses (0..11) que têm algum lançamento no ano, até o mês aberto
function mesesComDado(dados) {
  const ano = dados.sessao.mesAberto.ano, ate = dados.sessao.mesAberto.mes;
  const set = new Set(dados.lancamentos.filter(l => l.ano === ano && l.mes <= ate).map(l => l.mes));
  return Array.from(set).sort((a, b) => a - b);
}

function htmlCartao(ind, mes, mesRotulo) {
  const linhas = ind.linhas.map(l => `<tr><td class="db-un"><i class="db-cor" style="--c:${l.cor}" aria-hidden="true"></i>${esc(l.nome)}</td>` +
    `<td class="n">${fmtPct(l.valor)}</td><td class="n db-meta">${l.meta ? (l.meta.dir === 'min' ? '≥ ' : '≤ ') + String(l.meta.val).replace('.', ',') + '%' : '—'}</td>` +
    `<td><span class="db-sit db-sit--${l.sit}">${ROTULO_SITUACAO[l.sit]}</span></td></tr>`).join('');
  const m = ind.media;
  return `<article class="db-card" data-ind="${esc(ind.key)}">
    <header><h3>${esc(ind.nome)}</h3><p>${esc(textoMeta(ind.metaUnica))}</p></header>
    <table class="db-tab"><caption class="sr-only">${esc(ind.nome)} em ${esc(mesRotulo)}, por unidade</caption>
      <thead><tr><th scope="col">Unidade</th><th scope="col" class="n">${esc(mesRotulo)}</th><th scope="col" class="n">Meta</th><th scope="col">Situação</th></tr></thead>
      <tbody>${linhas}</tbody>
      ${ind.linhas.length > 1 ? `<tfoot><tr><td>Média das unidades</td><td class="n">${fmtPct(m.valor)}</td><td class="n db-meta">${ind.metaUnica ? (ind.metaUnica.dir === 'min' ? '≥ ' : '≤ ') + String(ind.metaUnica.val).replace('.', ',') + '%' : '—'}</td><td><span class="db-sit db-sit--${m.sit}">${ROTULO_SITUACAO[m.sit]}</span></td></tr></tfoot>` : ''}
    </table>
    <div class="db-grafico"><canvas id="g-${esc(ind.key)}" role="img" aria-label="${esc(ind.nome)} mês a mês, uma linha por unidade"></canvas></div>
  </article>`;
}

// ── Tela ───────────────────────────────────────────────────────

if (typeof document !== 'undefined' && typeof module === 'undefined') (function () {
  const $ = id => document.getElementById(id);
  let dados = null, grupo = 'clinica', mes = 0;
  const graficos = {};

  function setStatus(texto, tipo) {
    const el = $('db-status');
    el.textContent = texto || '';
    el.className = 'notice' + (tipo ? ' ' + tipo : '');
    el.hidden = !texto;
  }

  function opcoes(ind) {
    return {
      responsive: true, maintainAspectRatio: false, animation: { duration: 400 },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: ind.linhas.length > 1, position: 'bottom', labels: { color: themeVar('--chart-text'), boxWidth: 12, font: { size: 11 } } },
        tooltip: {
          backgroundColor: themeVar('--chart-bg'), borderColor: themeVar('--chart-border'), borderWidth: 1,
          titleColor: themeVar('--chart-title'), bodyColor: themeVar('--chart-body'),
          callbacks: { label: c => ` ${c.dataset.label}: ${c.parsed.y === null ? '—' : c.parsed.y.toFixed(1).replace('.', ',') + '%'}` },
        },
      },
      scales: {
        x: { grid: { color: 'transparent' }, ticks: { color: themeVar('--chart-text'), font: { size: 11 } }, border: { color: themeVar('--chart-border') } },
        y: { min: 0, grid: { color: themeVar('--chart-grid') }, ticks: { color: themeVar('--chart-text'), font: { size: 11 }, callback: v => v + '%' }, border: { color: 'transparent' } },
      },
    };
  }

  function desenharGrafico(ind, ate) {
    const canvas = $('g-' + ind.key);
    if (!canvas || typeof Chart === 'undefined') return;
    if (graficos[ind.key]) graficos[ind.key].destroy();
    const rotulos = MES_CURTO.slice(0, ate + 1);
    const datasets = ind.linhas.map(l => ({
      label: l.nome, data: l.serie.slice(0, ate + 1), borderColor: l.cor, backgroundColor: l.cor, borderWidth: 2.2, tension: .3,
      pointRadius: 3.5, pointHoverRadius: 6, pointBackgroundColor: l.cor, pointBorderColor: themeVar('--chart-bg'), pointBorderWidth: 2, spanGaps: true,
    }));
    if (ind.metaUnica) {
      datasets.push({ label: 'Meta', data: rotulos.map(() => ind.metaUnica.val), borderColor: themeVar('--chart-text'), borderDash: [6, 5], borderWidth: 1.5, pointRadius: 0, fill: false, order: 99 });
    }
    graficos[ind.key] = new Chart(canvas, { type: 'line', data: { labels: rotulos, datasets }, options: opcoes(ind) });
  }

  function desenhar() {
    const ate = dados.sessao.mesAberto.mes;
    const rotuloMes = MES_CURTO[mes] + '/' + dados.sessao.mesAberto.ano;
    const inds = GRUPOS[grupo].map(k => montarIndicador(dados, k, mes));
    Object.keys(graficos).forEach(k => { graficos[k].destroy(); delete graficos[k]; });
    $('db-conteudo').innerHTML = inds.map(i => htmlCartao(i, mes, rotuloMes)).join('');
    $('db-conteudo').removeAttribute('aria-busy');
    inds.forEach(i => desenharGrafico(i, ate));
    $('db-vazio').hidden = inds.some(i => i.temDado);
  }

  function montarMeses() {
    const sel = $('mesSel');
    const meses = mesesComDado(dados);
    const aberto = dados.sessao.mesAberto.mes;
    const lista = meses.length ? meses : [aberto];
    sel.innerHTML = lista.map(m => `<option value="${m}">${esc(MESES_NOME[m])}/${dados.sessao.mesAberto.ano}</option>`).join('');
    mes = lista.indexOf(aberto) >= 0 ? aberto : lista[lista.length - 1];
    sel.value = String(mes);
  }

  async function carregar() {
    setStatus('');
    try {
      const sessao = await exigirSessao();
      if (sessao.usuario.perfil !== 'admin') { location.href = 'indicadores.html'; return; }
      document.body.classList.remove('aguardando-sessao');
      dados = await api('dashboard.carregar');
      document.querySelector('.page-header__subtitle').textContent = 'Dashboard · comparativo entre unidades · ' + dados.sessao.mesAberto.ano;
      montarMeses();
      desenhar();
    } catch (e) {
      // sessão inválida já redireciona em api(); aqui é falha de rede ou do servidor: avisa em vez de deslogar
      $('db-conteudo').innerHTML = '';
      $('db-conteudo').removeAttribute('aria-busy');
      setStatus('Não foi possível carregar o dashboard: ' + e.message + ' Recarregue a página para tentar de novo.', 'erro');
    }
  }

  document.querySelectorAll('.tabbar button').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('.tabbar button').forEach(x => { x.classList.toggle('active', x === b); x.setAttribute('aria-selected', String(x === b)); });
    grupo = b.dataset.grupo;
    if (dados) desenhar();
  }));
  $('mesSel').addEventListener('change', () => { mes = +$('mesSel').value; desenhar(); });
  carregar();
})();

if (typeof module !== 'undefined') module.exports = { calcRow, situacao, montarIndicador, htmlCartao, mesesComDado, textoMeta, GRUPOS };
