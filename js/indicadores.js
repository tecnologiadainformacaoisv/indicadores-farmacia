// ── State ──────────────────────────────────────────────────────
const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MONTHS_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const FIELDS = ['admissoes','conciliacoes','presc-atend','presc-anal','prm','interv-total','interv-aceitas','altas-total','altas-real','itens-pad','itens-falta','itens-venc','entregas','nc','auditados','conformes','emergenciais'];

let info = null;        // sessão: usuário, unidades visíveis, mês aberto
let unidadeSel = '';    // '' = todas as unidades (só coordenação do Instituto)
let data = [];          // lançamentos do ano do mês aberto, da seleção atual
let todosLanc = [];     // todos os lançamentos visíveis (para o modal)
let metas = {};         // metas da unidade selecionada (ou padrão, em "todas")

// chart instances
const charts = {};

// ── Helpers ────────────────────────────────────────────────────
const pct = (n, d) => d > 0 ? +(n / d * 100).toFixed(1) : null;

function calcRow(r) {
  return {
    conciliacoes:    pct(r.conciliacoes, r.admissoes),
    prescricoes:     pct(r['presc-anal'], r['presc-atend']),
    prm:             pct(r.prm, r['presc-anal']),
    intervencoes:    pct(r['interv-aceitas'], r['interv-total']),
    altas:           pct(r['altas-real'], r['altas-total']),
    desabastecimento:pct(r['itens-falta'], r['itens-pad']),
    perdas:          pct(r['itens-venc'], r['itens-pad']),
    nconformidades:  pct(r.nc, r.entregas),
    estoque:         pct(r.conformes, r.auditados),
    emergenciais:    pct(r.emergenciais, r.entregas),
  };
}

// cor da faixa do cartão = status da meta (a cor da série fica só no gráfico)
function corStatus(st) {
  return st === 'ok' ? '--c-ok' : st === 'warn' ? '--c-warn' : st === 'err' ? '--c-err' : '--bd';
}

function status(key, val) {
  const m = metas[key];
  if (val === null || !m) return 'na';
  if (m.dir === 'min') return val >= m.val ? 'ok' : val >= m.val * .8 ? 'warn' : 'err';
  else                 return val <= m.val ? 'ok' : val <= m.val * 1.3 ? 'warn' : 'err';
}

function fmtVal(v) {
  if (v === null) return '—';
  return v.toFixed(1) + '%';
}

function avg(arr) {
  const valid = arr.filter(v => v !== null);
  if (!valid.length) return null;
  return +(valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(1);
}

// ── Colour helpers ─────────────────────────────────────────────
const COL = {
  teal:   '#2e86c1', blue: '#17a2b8', amber: '#e0951a',
  rose:   '#d9534f', purple: '#8e6bbf', green: '#2eaf68',
  get txt2() { return themeVar('--chart-text'); },
  get bd()   { return themeVar('--chart-border'); },
};

function makeGrad(ctx, hex) {
  const g = ctx.createLinearGradient(0, 0, 0, 240);
  g.addColorStop(0, hex + '55'); g.addColorStop(1, hex + '00');
  return g;
}

const baseOpts = (yMax) => ({
  responsive: true,
  animation: { duration: 500 },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: themeVar('--chart-bg'), borderColor: themeVar('--chart-border'), borderWidth: 1,
      titleColor: themeVar('--chart-title'), bodyColor: themeVar('--chart-body'), padding: 10,
      callbacks: { label: ctx => ` ${ctx.raw !== null ? ctx.raw.toFixed(1) + '%' : '—'}` }
    }
  },
  scales: {
    x: { grid: { color: 'transparent' }, ticks: { color: COL.txt2, font: { size: 11 } }, border: { color: COL.bd } },
    y: {
      min: 0, // percentuais sempre a partir de zero (sem isso, valores iguais viravam um eixo de 92% a 110%)
      grid: { color: themeVar('--chart-grid') },
      ticks: { color: COL.txt2, font: { size: 11 }, callback: v => v > 100 ? '' : v + '%' },
      border: { dash: [3, 3], color: 'transparent' },
      ...(yMax !== undefined ? { max: yMax } : {})
    }
  }
});

function goalPlugin(metaKey, color) {
  return {
    id: 'goalLine_' + metaKey,
    // faixa suave do lado "bom" da meta, atrás dos dados
    beforeDatasetsDraw(chart) {
      const meta = metas[metaKey];
      if (!meta || !chart.scales.y || !isFinite(meta.val)) return;
      const { ctx, chartArea: { left, right, top, bottom }, scales: { y } } = chart;
      const yPos = Math.min(Math.max(y.getPixelForValue(meta.val), top), bottom);
      ctx.save();
      ctx.fillStyle = 'rgba(39, 174, 96, .08)';
      if (meta.dir === 'min') ctx.fillRect(left, top, right - left, yPos - top);
      else ctx.fillRect(left, yPos, right - left, bottom - yPos);
      ctx.restore();
    },
    afterDraw(chart) {
      const meta = metas[metaKey];
      if (!meta) return;
      const { ctx, chartArea: { left, right }, scales: { y } } = chart;
      const yPos = y.getPixelForValue(meta.val);
      if (yPos < y.top || yPos > y.bottom) return;
      ctx.save();
      ctx.beginPath();
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = COL.txt2 || (color + 'bb'); // meta em cinza: a cor da série não vira cor de status
      ctx.lineWidth = 1.5;
      ctx.moveTo(left, yPos); ctx.lineTo(right, yPos);
      ctx.stroke();
      ctx.fillStyle = COL.txt2 || (color + 'bb');
      ctx.font = '11px Segoe UI';
      ctx.fillText('Meta ' + meta.val + '%', right - 60, yPos - 4);
      ctx.restore();
    }
  };
}

function lineDS(label, data, color) {
  return {
    label, data,
    borderColor: color, borderWidth: 2.5,
    backgroundColor: ctx => makeGrad(ctx.chart.ctx, color),
    fill: true, tension: 0.4, cubicInterpolationMode: 'monotone',
    pointBackgroundColor: data.map(v => v === null ? 'transparent' : color),
    pointBorderColor: themeVar('--chart-bg'), pointBorderWidth: 2,
    pointRadius: data.map(v => v === null ? 0 : 4),
    pointHoverRadius: 7,
    spanGaps: false,
  };
}

function barDS(label, data, color) {
  return {
    label, data,
    backgroundColor: data.map(v => v === null ? 'transparent' : color + 'cc'),
    borderColor: data.map(v => v === null ? 'transparent' : color),
    borderWidth: 1.5, borderRadius: 4,
  };
}

function mkOrUpdate(id, type, cfg) {
  // os cards são recriados a cada render: gráfico preso a um canvas antigo é descartado
  if (charts[id] && charts[id].canvas !== document.getElementById(id)) {
    charts[id].destroy();
    delete charts[id];
  }
  if (charts[id]) {
    charts[id].data = cfg.data;
    charts[id].options = cfg.options;
    charts[id].update();
  } else {
    const el = document.getElementById(id);
    if (!el) return;
    charts[id] = new Chart(el, { type, ...cfg });
  }
}

// ── Render ─────────────────────────────────────────────────────
function renderAll() {
  ['kpi-clinica', 'kpi-logistica'].forEach(id => document.getElementById(id).removeAttribute('aria-busy'));
  renderClinica();
  renderLogistica();
  renderMapaCalor();
}

// ── Mapa de calor (só coordenação, com "Todas as unidades") ────
// Cada célula é o resultado do mês escolhido frente à meta; as metas usadas são as padrão
// (as metas por unidade só são carregadas quando uma unidade é escolhida).
const MAPA_COLUNAS = {
  Clínica: [['conciliacoes', 'Conciliações'], ['prescricoes', 'Prescrições'], ['prm', 'PRM'], ['intervencoes', 'Interv.'], ['altas', 'Altas']],
  Logística: [['desabastecimento', 'Desabast.'], ['perdas', 'Perdas'], ['nconformidades', 'Não conf.'], ['estoque', 'Estoque'], ['emergenciais', 'Emerg.']],
};
const MAPA_GLIFO = { ok: '✓', warn: '!', err: '✕', na: '—' };
const MAPA_TEXTO = { ok: 'dentro da meta', warn: 'atenção', err: 'fora da meta', na: 'sem lançamento' };

function renderMapaCalor() {
  const sec = document.getElementById('mapa-calor');
  const mostrar = info.usuario.perfil === 'admin' && unidadeSel === '' && info.unidades.length > 0;
  sec.hidden = !mostrar;
  if (!mostrar) return;
  const mes = +document.getElementById('monthSel').value;
  document.getElementById('mapa-sub').textContent = `${MONTHS_FULL[mes]} · resultado do mês frente à meta padrão de cada indicador`;
  const grupos = Object.entries(MAPA_COLUNAS);
  const topo = '<thead><tr><th rowspan="2" scope="col" class="mc-un">Unidade</th>' +
    grupos.map(([g, cols]) => `<th colspan="${cols.length}" scope="colgroup" class="mc-grupo">${g}</th>`).join('') + '</tr><tr>' +
    grupos.map(([, cols]) => cols.map(([, rot]) => `<th scope="col" class="mc-col">${esc(rot)}</th>`).join('')).join('') + '</tr></thead>';
  const linhas = info.unidades.map(un => {
    const reg = data.find(r => r.unidade === un.id && r.mes === mes);
    const calc = reg ? calcRow(reg) : null;
    const celulas = grupos.map(([, cols]) => cols.map(([key]) => {
      const val = calc ? calc[key] : null;
      const st = status(key, val);
      const meta = metas[key];
      const rotulo = `${un.nome}, ${meta ? meta.label : key}: ${val === null ? 'sem lançamento' : fmtVal(val) + ', ' + MAPA_TEXTO[st]}`;
      return `<td class="mc mc-${st}" title="${esc(meta ? 'Meta padrão ' + meta.val + '%' : '')}" aria-label="${esc(rotulo)}"><b>${val === null ? '—' : fmtVal(val)}</b><span aria-hidden="true">${MAPA_GLIFO[st]}</span></td>`;
    }).join('')).join('');
    return `<tr><th scope="row" class="mc-un">${esc(un.nome)}</th>${celulas}</tr>`;
  }).join('');
  document.getElementById('mapa-tabela').innerHTML = topo + '<tbody>' + linhas + '</tbody>';
}

function nomeUnidade(id) {
  const un = info.unidades.find(u => u.id === id);
  return un ? un.nome : id;
}

function byMonth(key) {
  const out = Array(12).fill(null);
  data.forEach(r => {
    const c = calcRow(r);
    if (c[key] !== null) {
      if (out[r.mes] === null) out[r.mes] = [];
      if (!Array.isArray(out[r.mes])) out[r.mes] = [out[r.mes]];
      out[r.mes].push(c[key]);
    }
  });
  return out.map(v => Array.isArray(v) ? avg(v) : v);
}

// ── CLÍNICA ────────────────────────────────────────────────────
// variação do KPI frente ao mês anterior (média das unidades visíveis); "melhora" depende da direção da meta
function deltaKpi(key, mes, val) {
  if (val === null || mes < 1) return '';
  const vals = data.filter(r => r.mes === mes - 1).map(r => calcRow(r)[key]).filter(v => v !== null);
  if (!vals.length) return '';
  const d = val - avg(vals);
  if (Math.abs(d) < 0.05) return '<span class="kpi-delta">= mês anterior</span>';
  const melhora = metas[key].dir === 'min' ? d > 0 : d < 0;
  return '<span class="kpi-delta ' + (melhora ? 'up' : 'down') + '">' + (d > 0 ? '↑ ' : '↓ ') + Math.abs(d).toFixed(1).replace('.', ',') + ' p.p. vs mês anterior</span>';
}

// frase de resumo acima dos cartões: quantos indicadores do mês estão dentro da meta
function resumoMes(id, kpiKeys, calcs) {
  const el = document.getElementById(id);
  if (!el) return;
  const sts = kpiKeys.map(k => {
    const vals = calcs.map(c => c[k.key]).filter(v => v !== null);
    return vals.length ? { k, st: status(k.key, avg(vals)) } : null;
  }).filter(Boolean);
  if (!sts.length) { el.textContent = 'Sem lançamentos neste mês.'; el.className = 'resumo'; return; }
  const ok = sts.filter(x => x.st === 'ok').length;
  const fora = sts.filter(x => x.st === 'err').map(x => x.k.label);
  el.className = 'resumo ' + (fora.length ? 'err' : ok === sts.length ? 'ok' : 'warn');
  el.textContent = ok + ' de ' + sts.length + ' indicadores dentro da meta' + (fora.length ? ' · fora: ' + fora.join(', ') : '') + '.';
}

function renderClinica() {
  const month = +document.getElementById('monthSel').value;
  const rows = data.filter(r => r.mes === month);
  const calcs = rows.map(r => ({ ...calcRow(r), unidade: r.unidade }));

  // KPIs
  const kpiKeys = [
    { key: 'conciliacoes', label: 'Conciliações', color: '--teal' },
    { key: 'prescricoes',  label: 'Prescrições Analisadas', color: '--blue' },
    { key: 'prm',          label: 'PRM Identificados', color: '--amber' },
    { key: 'intervencoes', label: 'Intervenções Aceitas', color: '--rose' },
    { key: 'altas',        label: 'Altas Farmacêuticas', color: '--purple' },
  ];

  const kpiDiv = document.getElementById('kpi-clinica');
  kpiDiv.innerHTML = '';
  kpiKeys.forEach(k => {
    const vals = calcs.map(c => c[k.key]).filter(v => v !== null);
    const val = vals.length ? avg(vals) : null;
    const st = status(k.key, val);
    const m = metas[k.key];
    kpiDiv.innerHTML += `
      <div class="kpi-card" style="--c:var(${corStatus(st)})">
        <div class="kpi-label">${k.label}</div>
        <div class="kpi-val">${fmtVal(val)}</div>
        <div class="kpi-sub">Meta: ${m.val}% · ${m.dir === 'min' ? '↑ mínimo' : '↓ máximo'}</div>
        ${deltaKpi(k.key, month, val)}
        ${val !== null ? `<span class="kpi-badge ${st}">${st === 'ok' ? '✓ Meta atingida' : st === 'warn' ? '⚠ Atenção' : (m.dir === 'max' ? '✗ Acima do limite' : '✗ Abaixo da meta')}</span>` : '<span class="kpi-badge warn">Sem dados</span>'}
      </div>`;
  });

  resumoMes('resumo-clinica', kpiKeys, calcs);

  // Alerts
  const alertsDiv = document.getElementById('alerts-clinica');
  alertsDiv.innerHTML = '';
  kpiKeys.forEach(k => {
    const vals = calcs.map(c => c[k.key]).filter(v => v !== null);
    const val = vals.length ? avg(vals) : null;
    const st = status(k.key, val);
    if (st === 'err') alertsDiv.innerHTML += `<div class="alert-item err"><span class="alert-icon" aria-hidden="true"></span><span><b>${k.label}</b>: ${fmtVal(val)} — ${metas[k.key].dir === 'max' ? 'acima do limite' : 'abaixo da meta'} de ${metas[k.key].val}% em ${MONTHS_FULL[month]}. Verificar ação corretiva.</span></div>`;
    else if (st === 'warn') alertsDiv.innerHTML += `<div class="alert-item warn"><span class="alert-icon" aria-hidden="true"></span><span><b>${k.label}</b>: ${fmtVal(val)} — próximo ao limite da meta (${metas[k.key].val}%).</span></div>`;
  });

  // Charts by month trend
  const labels = MONTHS;
  const cg = document.getElementById('charts-clinica');
  cg.innerHTML = `
    <div class="card"><div class="card-header"><div><div class="card-title">Conciliações Medicamentosas</div><div class="card-sub">% sobre admissões · linha de meta</div></div><span class="badge ${status('conciliacoes', avg(byMonth('conciliacoes').filter(v=>v!==null)))}">Média do ano ${fmtVal(avg(byMonth('conciliacoes').filter(v=>v!==null)))}</span></div><canvas id="c-conc" height="190"></canvas></div>
    <div class="card"><div class="card-header"><div><div class="card-title">Prescrições Analisadas</div><div class="card-sub">% sobre prescrições atendidas</div></div><span class="badge ${status('prescricoes', avg(byMonth('prescricoes').filter(v=>v!==null)))}">Média do ano ${fmtVal(avg(byMonth('prescricoes').filter(v=>v!==null)))}</span></div><canvas id="c-presc" height="190"></canvas></div>
    <div class="card"><div class="card-header"><div><div class="card-title">PRM Identificados</div><div class="card-sub">% sobre prescrições analisadas</div></div><span class="badge ${status('prm', avg(byMonth('prm').filter(v=>v!==null)))}">Média do ano ${fmtVal(avg(byMonth('prm').filter(v=>v!==null)))}</span></div><canvas id="c-prm" height="190"></canvas></div>
    <div class="card"><div class="card-header"><div><div class="card-title">Intervenções Farmacêuticas Aceitas</div><div class="card-sub">% sobre intervenções realizadas</div></div><span class="badge ${status('intervencoes', avg(byMonth('intervencoes').filter(v=>v!==null)))}">Média do ano ${fmtVal(avg(byMonth('intervencoes').filter(v=>v!==null)))}</span></div><canvas id="c-interv" height="190"></canvas></div>
    <div class="card span2"><div class="card-header"><div><div class="card-title">Altas Hospitalares com Orientação Farmacêutica</div><div class="card-sub">% do total de altas · todos os meses</div></div></div><canvas id="c-altas" height="110"></canvas></div>
  `;

  setTimeout(() => {
    mkOrUpdate('c-conc',  'line', { data: { labels, datasets: [lineDS('Conc.', byMonth('conciliacoes'), COL.teal)]  }, options: baseOpts(110), plugins: [goalPlugin('conciliacoes', COL.teal)] });
    mkOrUpdate('c-presc', 'line', { data: { labels, datasets: [lineDS('Presc.', byMonth('prescricoes'), COL.teal)] }, options: baseOpts(110), plugins: [goalPlugin('prescricoes', COL.teal)] });
    mkOrUpdate('c-prm',   'bar',  { data: { labels, datasets: [barDS('PRM', byMonth('prm'), COL.teal)]            }, options: baseOpts(),    plugins: [goalPlugin('prm', COL.teal)] });
    mkOrUpdate('c-interv','line', { data: { labels, datasets: [lineDS('Interv.', byMonth('intervencoes'), COL.teal)]}, options: baseOpts(110),plugins: [goalPlugin('intervencoes', COL.teal)] });
    mkOrUpdate('c-altas', 'bar',  { data: { labels, datasets: [barDS('Altas', byMonth('altas'), COL.teal)]       }, options: { ...baseOpts(110), aspectRatio: window.innerWidth < 640 ? 1.8 : 4 }, plugins: [goalPlugin('altas', COL.teal)] });
  }, 30);

  // Table
  const tbody = document.querySelector('#table-clinica tbody');
  tbody.innerHTML = '';
  const sorted = [...data].sort((a, b) => a.mes - b.mes || nomeUnidade(a.unidade).localeCompare(nomeUnidade(b.unidade)));
  sorted.forEach(r => {
    const c = calcRow(r);
    tbody.innerHTML += `<tr>
      <td>${MONTHS[r.mes]}</td>
      <td>${esc(nomeUnidade(r.unidade))}</td>
      <td class="mono ${status('conciliacoes', c.conciliacoes) === 'ok' ? 'c-ok' : status('conciliacoes', c.conciliacoes) === 'warn' ? 'c-warn' : c.conciliacoes !== null ? 'c-err' : 'c-na'}">${fmtVal(c.conciliacoes)}</td>
      <td class="mono ${statusClass('prescricoes', c.prescricoes)}">${fmtVal(c.prescricoes)}</td>
      <td class="mono ${statusClass('prm', c.prm)}">${fmtVal(c.prm)}</td>
      <td class="mono ${statusClass('intervencoes', c.intervencoes)}">${fmtVal(c.intervencoes)}</td>
      <td class="mono ${statusClass('altas', c.altas)}">${fmtVal(c.altas)}</td>
    </tr>`;
  });
  if (!sorted.length) tbody.innerHTML = `<tr><td colspan="7" class="c-na vazio">${textoVazio()}</td></tr>`;
}

function textoVazio() {
  return info.usuario.perfil === 'admin'
    ? `Nenhum lançamento em ${info.mesAberto.ano} ainda. Os coordenadores das unidades lançam os dados do mês.`
    : `Nenhum lançamento em ${info.mesAberto.ano} ainda. Use "+ Lançar dados" para lançar ${nomeMes(info.mesAberto)}.`;
}

function statusClass(key, val) {
  const st = status(key, val);
  return st === 'ok' ? 'c-ok' : st === 'warn' ? 'c-warn' : val !== null ? 'c-err' : 'c-na';
}

// ── LOGÍSTICA ──────────────────────────────────────────────────
function renderLogistica() {
  const month = +document.getElementById('monthSel').value;
  const rows = data.filter(r => r.mes === month);
  const calcs = rows.map(r => ({ ...calcRow(r), unidade: r.unidade }));

  const kpiKeys = [
    { key: 'desabastecimento', label: 'Desabastecimento', color: '--teal' },
    { key: 'perdas',           label: 'Perdas por Validade', color: '--rose' },
    { key: 'nconformidades',   label: 'Não Conformidades', color: '--amber' },
    { key: 'estoque',          label: 'Conformidade Estoque', color: '--blue' },
    { key: 'emergenciais',     label: 'Pedidos Emergenciais', color: '--purple' },
  ];

  const kpiDiv = document.getElementById('kpi-logistica');
  kpiDiv.innerHTML = '';
  kpiKeys.forEach(k => {
    const vals = calcs.map(c => c[k.key]).filter(v => v !== null);
    const val = vals.length ? avg(vals) : null;
    const st = status(k.key, val);
    const m = metas[k.key];
    kpiDiv.innerHTML += `
      <div class="kpi-card" style="--c:var(${corStatus(st)})">
        <div class="kpi-label">${k.label}</div>
        <div class="kpi-val">${fmtVal(val)}</div>
        <div class="kpi-sub">Meta: ${m.val}% · ${m.dir === 'min' ? '↑ mínimo' : '↓ máximo'}</div>
        ${deltaKpi(k.key, month, val)}
        ${val !== null ? `<span class="kpi-badge ${st}">${st === 'ok' ? '✓ OK' : st === 'warn' ? '⚠ Atenção' : '✗ Fora da meta'}</span>` : '<span class="kpi-badge warn">Sem dados</span>'}
      </div>`;
  });

  resumoMes('resumo-logistica', kpiKeys, calcs);

  const alertsDiv = document.getElementById('alerts-logistica');
  alertsDiv.innerHTML = '';
  kpiKeys.forEach(k => {
    const vals = calcs.map(c => c[k.key]).filter(v => v !== null);
    const val = vals.length ? avg(vals) : null;
    const st = status(k.key, val);
    if (st === 'err') alertsDiv.innerHTML += `<div class="alert-item err"><span class="alert-icon" aria-hidden="true"></span><span><b>${k.label}</b>: ${fmtVal(val)} — fora da meta de ${metas[k.key].val}% em ${MONTHS_FULL[month]}.</span></div>`;
    else if (st === 'warn') alertsDiv.innerHTML += `<div class="alert-item warn"><span class="alert-icon" aria-hidden="true"></span><span><b>${k.label}</b>: ${fmtVal(val)} — próximo ao limite (meta: ${metas[k.key].val}%).</span></div>`;
  });

  const labels = MONTHS;
  const cg = document.getElementById('charts-logistica');
  cg.innerHTML = `
    <div class="card"><div class="card-header"><div><div class="card-title">Desabastecimento</div><div class="card-sub">% itens em falta / padronizados</div></div></div><canvas id="l-desab" height="190"></canvas></div>
    <div class="card"><div class="card-header"><div><div class="card-title">Perdas por Validade</div><div class="card-sub">% itens vencidos / padronizados</div></div></div><canvas id="l-perdas" height="190"></canvas></div>
    <div class="card"><div class="card-header"><div><div class="card-title">Não Conformidades na Entrega</div><div class="card-sub">% sobre total de entregas</div></div></div><canvas id="l-nc" height="190"></canvas></div>
    <div class="card"><div class="card-header"><div><div class="card-title">Conformidade de Estoque</div><div class="card-sub">% itens conformes / auditados</div></div></div><canvas id="l-estoque" height="190"></canvas></div>
    <div class="card span2"><div class="card-header"><div><div class="card-title">Pedidos Emergenciais</div><div class="card-sub">% sobre total de entregas · todos os meses</div></div></div><canvas id="l-emerg" height="110"></canvas></div>
  `;

  setTimeout(() => {
    mkOrUpdate('l-desab',  'line', { data: { labels, datasets: [lineDS('Desab.', byMonth('desabastecimento'), COL.purple)]   }, options: baseOpts(), plugins: [goalPlugin('desabastecimento', COL.purple)] });
    mkOrUpdate('l-perdas', 'bar',  { data: { labels, datasets: [barDS('Perdas', byMonth('perdas'), COL.purple)]              }, options: baseOpts(), plugins: [goalPlugin('perdas', COL.purple)] });
    mkOrUpdate('l-nc',     'line', { data: { labels, datasets: [lineDS('NC', byMonth('nconformidades'), COL.purple)]        }, options: baseOpts(), plugins: [goalPlugin('nconformidades', COL.purple)] });
    mkOrUpdate('l-estoque','line', { data: { labels, datasets: [lineDS('Estoque', byMonth('estoque'), COL.purple)]           }, options: baseOpts(105), plugins: [goalPlugin('estoque', COL.purple)] });
    mkOrUpdate('l-emerg',  'bar',  { data: { labels, datasets: [barDS('Emerg.', byMonth('emergenciais'), COL.purple)]      }, options: { ...baseOpts(), aspectRatio: window.innerWidth < 640 ? 1.8 : 4 }, plugins: [goalPlugin('emergenciais', COL.purple)] });
  }, 30);

  const tbody = document.querySelector('#table-logistica tbody');
  tbody.innerHTML = '';
  const sorted = [...data].sort((a, b) => a.mes - b.mes || nomeUnidade(a.unidade).localeCompare(nomeUnidade(b.unidade)));
  sorted.forEach(r => {
    const c = calcRow(r);
    tbody.innerHTML += `<tr>
      <td>${MONTHS[r.mes]}</td>
      <td>${esc(nomeUnidade(r.unidade))}</td>
      <td class="mono ${statusClass('desabastecimento', c.desabastecimento)}">${fmtVal(c.desabastecimento)}</td>
      <td class="mono ${statusClass('perdas', c.perdas)}">${fmtVal(c.perdas)}</td>
      <td class="mono ${statusClass('nconformidades', c.nconformidades)}">${fmtVal(c.nconformidades)}</td>
      <td class="mono ${statusClass('estoque', c.estoque)}">${fmtVal(c.estoque)}</td>
      <td class="mono ${statusClass('emergenciais', c.emergenciais)}">${fmtVal(c.emergenciais)}</td>
    </tr>`;
  });
  if (!sorted.length) tbody.innerHTML = `<tr><td colspan="7" class="c-na vazio">${textoVazio()}</td></tr>`;
}

// ── Navigation ─────────────────────────────────────────────────
function goPage(page, el) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  el.classList.add('active');
  const titles = { clinica: ['Indicadores Clínicos', 'Farmácia clínica · acompanhamento mensal'], logistica: ['Indicadores Logísticos', 'Estoque & entregas · acompanhamento mensal'] };
  document.getElementById('page-title').textContent = titles[page][0];
  document.getElementById('page-sub').textContent   = titles[page][1];
}

// ── Entry modal ────────────────────────────────────────────────
// Só o coordenador da unidade lança, e sempre no mês aberto (definido pelo servidor).
// ── Formulário de lançamento: contexto do mês anterior e resultado ao vivo ──
const ENTRADA_INDICADORES = ['conciliacoes', 'prescricoes', 'prm', 'intervencoes', 'altas', 'desabastecimento', 'perdas', 'nconformidades', 'estoque', 'emergenciais'];
// numerador que não pode passar do total (o servidor confere de novo)
const ENTRADA_PARES = [
  ['conciliacoes', 'admissoes'], ['presc-anal', 'presc-atend'], ['interv-aceitas', 'interv-total'], ['altas-real', 'altas-total'],
  ['itens-falta', 'itens-pad'], ['itens-venc', 'itens-pad'], ['nc', 'entregas'], ['conformes', 'auditados'], ['emergenciais', 'entregas'],
];

function lancamentoAnterior() {
  const ref = info.mesAberto;
  const mes = ref.mes === 0 ? 11 : ref.mes - 1;
  const ano = ref.mes === 0 ? ref.ano - 1 : ref.ano;
  return todosLanc.find(r => r.unidade === info.usuario.unidade && r.ano === ano && r.mes === mes) || null;
}

function lerEntrada() {
  const row = {};
  FIELDS.forEach(f => { const v = document.getElementById('f-' + f).value.trim(); row[f] = v === '' ? null : Number(v); });
  return row;
}

// campo numerador -> indicador que ele alimenta (o resultado aparece ao lado do campo e na lista final)
const ENTRADA_NUM_INDICADOR = {
  conciliacoes: 'conciliacoes', 'presc-anal': 'prescricoes', prm: 'prm', 'interv-aceitas': 'intervencoes', 'altas-real': 'altas',
  'itens-falta': 'desabastecimento', 'itens-venc': 'perdas', nc: 'nconformidades', conformes: 'estoque', emergenciais: 'emergenciais',
};

function atualizarEntradaAoVivo() {
  const row = lerEntrada();
  const prev = lancamentoAnterior();
  const calc = calcRow(row);
  const calcPrev = prev ? calcRow(prev) : null;

  // pares inválidos (numerador maior que o total): o resultado desses indicadores não vale
  const invalidos = new Set();
  ENTRADA_PARES.forEach(([num, den]) => {
    if (row[num] !== null && row[den] !== null && row[num] > row[den]) invalidos.add(num);
  });

  // dica de cada campo: mês anterior; no numerador, também o resultado de agora frente à meta
  FIELDS.forEach(f => {
    const el = document.getElementById('f-' + f);
    const dica = document.getElementById('d-' + f);
    if (!dica) return;
    const ant = prev && prev[f] !== null && prev[f] !== undefined ? prev[f] : '—';
    const erro = invalidos.has(f);
    el.setAttribute('aria-invalid', String(erro));
    dica.className = 'dica';
    if (erro) {
      const den = ENTRADA_PARES.find(p => p[0] === f)[1];
      dica.textContent = 'Maior que o total informado (' + row[den] + ')';
      return;
    }
    let texto = 'Mês anterior: ' + ant;
    const key = ENTRADA_NUM_INDICADOR[f];
    if (key && calc[key] !== null) {
      const st = status(key, calc[key]);
      texto += ' · resultado ' + fmtVal(calc[key]);
      dica.className = 'dica st-' + st;
    }
    dica.textContent = texto;
  });

  document.getElementById('ao-vivo').innerHTML = ENTRADA_INDICADORES.map(key => {
    const numero = Object.keys(ENTRADA_NUM_INDICADOR).find(k => ENTRADA_NUM_INDICADOR[k] === key);
    const invalido = invalidos.has(numero);
    const val = invalido ? null : calc[key];
    const st = invalido ? 'err' : status(key, val);
    const m = metas[key];
    const ant = calcPrev ? calcPrev[key] : null;
    const delta = invalido ? 'Confira os números digitados.' : val !== null && ant !== null
      ? (val >= ant ? '↑ ' : '↓ ') + Math.abs(val - ant).toFixed(1).replace('.', ',') + ' p.p. vs mês anterior'
      : (ant !== null ? 'mês anterior ' + fmtVal(ant) : '');
    const rotulo = invalido ? 'Números inválidos' : st === 'ok' ? 'Dentro da meta' : st === 'warn' ? 'Atenção' : st === 'err' ? 'Fora da meta' : 'Sem dados';
    return `<li><span class="av-nome">${esc(m.label.replace(' (%)', ''))}<small>Meta ${m.val}% · ${m.dir === 'min' ? 'mínimo' : 'máximo'}</small></span><b class="av-val">${val === null ? '—' : fmtVal(val)}</b><span class="badge ${st === 'na' ? 'warn' : st}">${rotulo}</span><small class="av-delta">${esc(delta)}</small></li>`;
  }).join('');
}

function openEntry() {
  const ref = info.mesAberto;
  const unidade = info.usuario.unidade;
  const atual = todosLanc.find(r => r.unidade === unidade && r.ano === ref.ano && r.mes === ref.mes);
  document.getElementById('entry-ref').textContent =
    `${nomeUnidade(unidade)} · mês de referência: ${nomeMes(ref)}` +
    (atual ? ` · já lançado por ${atual.lancadoPor} em ${atual.lancadoEm} (salvar substitui)` : '');
  FIELDS.forEach(f => {
    const v = atual ? atual[f] : null;
    document.getElementById('f-' + f).value = v === null || v === undefined ? '' : v;
  });
  entradaInicial = valoresEntrada();
  setMsg('entry-msg', '');
  atualizarEntradaAoVivo();
  abrirModal('overlay-entry', 'f-admissoes');
}

let entradaInicial = '';
function valoresEntrada() { return FIELDS.map(f => document.getElementById('f-' + f).value).join('|'); }

// fechar sem salvar pede confirmação se algo foi digitado
function closeEntry(confirmar) {
  const ov = document.getElementById('overlay-entry');
  if (!ov.classList.contains('open')) return;
  if (confirmar && valoresEntrada() !== entradaInicial && !confirm('Descartar os dados digitados?')) return;
  fecharModal('overlay-entry');
}

// ── Modais: foco entra no diálogo, fica preso nele e volta ao botão de origem ──
let focoAntes = null;

function abrirModal(id, focarId) {
  focoAntes = document.activeElement;
  document.getElementById(id).classList.add('open');
  document.getElementById(focarId).focus();
}

function fecharModal(id) {
  document.getElementById(id).classList.remove('open');
  if (focoAntes && focoAntes.focus) focoAntes.focus();
  focoAntes = null;
}

document.getElementById('overlay-entry').addEventListener('input', atualizarEntradaAoVivo);

document.addEventListener('keydown', e => {
  const ov = document.querySelector('.overlay.open');
  if (!ov) return;
  if (e.key === 'Escape') {
    if (ov.id === 'overlay-entry') closeEntry(true);
    else closeMetas();
    return;
  }
  if (e.key !== 'Tab') return;
  const focaveis = [...ov.querySelectorAll('button, input, select')].filter(el => !el.disabled && !el.hidden && el.offsetParent !== null);
  if (!focaveis.length) return;
  const primeiro = focaveis[0], ultimo = focaveis[focaveis.length - 1];
  if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
  else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
});

async function saveEntry() {
  const dados = {};
  const invalidos = [];
  FIELDS.forEach(f => {
    const el = document.getElementById('f-' + f);
    const v = el.value.trim();
    if (v === '') { dados[f] = null; return; }
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0) invalidos.push(el.labels[0] ? el.labels[0].textContent : f);
    dados[f] = n;
  });
  if (invalidos.length) {
    setMsg('entry-msg', 'Use números inteiros, sem negativos: ' + invalidos.join(', ') + '.', 'erro');
    return;
  }
  if (FIELDS.every(f => dados[f] === null)) {
    setMsg('entry-msg', 'Preencha pelo menos um campo antes de salvar.', 'erro');
    return;
  }
  const btn = document.getElementById('btnSaveEntry');
  btn.disabled = true;
  setMsg('entry-msg', 'Salvando…');
  try {
    await api('lancamentos.salvar', { unidade: info.usuario.unidade, dados, ref: { ano: info.mesAberto.ano, mes: info.mesAberto.mes } });
  } catch (e) {
    setMsg('entry-msg', e.message, 'erro');
    btn.disabled = false;
    return;
  }
  // salvou: fecha o modal e atualiza; se só a atualização falhar, avisa na página (o modal já fechou)
  btn.disabled = false;
  fecharModal('overlay-entry');
  try {
    cacheRemover('ind:'); // o que está guardado ficou velho
    await carregarDados(unidadeSel);
    setStatus('Lançamento de ' + nomeMes(info.mesAberto) + ' salvo.', '');
  } catch (e) {
    setStatus('Lançamento salvo, mas não consegui atualizar a tela: ' + e.message + ' Recarregue a página.', 'erro');
  }
}

// ── Metas modal ────────────────────────────────────────────────
// Todos veem; só a coordenação do Instituto altera, e sempre de uma unidade específica.
function podeEditarMetas() {
  return info.usuario.perfil === 'admin' && unidadeSel !== '';
}

function openMetas() {
  const editavel = podeEditarMetas();
  const intro = info.usuario.perfil !== 'admin'
    ? 'Metas da sua unidade, definidas pela coordenação farmacêutica do Instituto.'
    : editavel
      ? `Metas de ${nomeUnidade(unidadeSel)}. O sistema alerta quando o valor fica abaixo (ou acima) da meta.`
      : 'Metas de referência. Para alterar, escolha uma unidade no topo da página.';
  document.getElementById('metas-intro').textContent = intro;
  // valor atual de cada indicador (mês selecionado), para comparar com a meta enquanto edita
  const mesSel = +document.getElementById('monthSel').value;
  const calcsMes = data.filter(r => r.mes === mesSel).map(r => calcRow(r));
  const atual = key => { const v = calcsMes.map(c => c[key]).filter(x => x !== null); return v.length ? avg(v) : null; };
  document.getElementById('metas-list').innerHTML = Object.entries(metas).map(([key, m]) => `
    <div class="meta-row">
      <label class="meta-label" for="meta-${key}">${esc(m.label)}</label>
      <input class="meta-input" id="meta-${key}" type="number" value="${m.val}" min="0" max="100" step="0.5" ${editavel ? '' : 'disabled'}>
      <span class="meta-unit">%</span>
      <span class="meta-dir">${m.dir === 'min' ? '↑ mínimo' : '↓ máximo'}</span>
      <span class="meta-atual st-${status(key, atual(key))}">atual ${fmtVal(atual(key))}</span>
    </div>`).join('');
  document.getElementById('btnSaveMetas').hidden = !editavel;
  setMsg('metas-msg', '');
  abrirModal('overlay-metas', editavel ? 'meta-' + Object.keys(metas)[0] : 'metas-fechar');
}
function closeMetas() {
  if (document.getElementById('overlay-metas').classList.contains('open')) fecharModal('overlay-metas');
}

async function saveMetas() {
  const novas = {};
  Object.keys(metas).forEach(key => {
    const el = document.getElementById('meta-' + key);
    if (el) novas[key] = el.value === '' ? '' : +el.value;
  });
  const btn = document.getElementById('btnSaveMetas');
  btn.disabled = true;
  setMsg('metas-msg', 'Salvando…');
  try {
    await api('metas.salvar', { unidade: unidadeSel, metas: novas });
  } catch (e) {
    setMsg('metas-msg', e.message, 'erro');
    btn.disabled = false;
    return;
  }
  btn.disabled = false;
  closeMetas();
  try {
    cacheRemover('ind:');
    await carregarDados(unidadeSel);
    setStatus('Metas de ' + nomeUnidade(unidadeSel) + ' salvas.', '');
  } catch (e) {
    setStatus('Metas salvas, mas não consegui atualizar a tela: ' + e.message + ' Recarregue a página.', 'erro');
  }
}

// ── Mensagens ──────────────────────────────────────────────────
function setMsg(id, texto, tipo) {
  const el = document.getElementById(id);
  el.textContent = texto || '';
  el.className = 'form-msg' + (tipo ? ' ' + tipo : '');
}

function setStatus(texto, tipo) {
  const el = document.getElementById('page-status');
  el.textContent = texto || '';
  el.className = 'notice' + (tipo ? ' ' + tipo : '');
  el.hidden = !texto;
}

// ── Dados ──────────────────────────────────────────────────────
let unidadesProntas = false;
let cargaId = 0;                       // descarta resposta antiga se o usuário já trocou de unidade

function aplicarCarga(r) {
  info = r.sessao;
  unidadeSel = r.unidade;
  todosLanc = r.lancamentos;
  data = r.lancamentos.filter(x => x.ano === info.mesAberto.ano);
  metas = r.metas;
}

function exibirCarga(r) {
  aplicarCarga(r);
  if (!validarSessao(info)) return;
  const q = info.usuario.perfil === 'admin' && unidadeSel ? '?unidade=' + encodeURIComponent(unidadeSel) : '';
  document.querySelectorAll('a[href^="logistica.html"]').forEach(a => { a.href = 'logistica.html' + q; });
  if (!unidadesProntas) {
    unidadesProntas = true;
    document.getElementById('monthSel').value = info.mesAberto.mes;
    montarUnidades();
  }
  renderAll();
}

// unidadeReq: indefinida = padrão do perfil; '' = todas (coordenação); id = uma unidade.
// Uma chamada traz sessão, lançamentos e metas; a última resposta aparece na hora enquanto a nova chega.
async function carregarDados(unidadeReq) {
  const minhaCarga = ++cargaId;
  const chave = 'ind:' + (unidadeReq === undefined ? 'inicial' : (unidadeReq || 'todas'));
  const emCache = cacheLer(chave);
  if (emCache) {
    exibirCarga(emCache.dados);
    setStatus('Atualizando…');
  }
  let r;
  try {
    r = await api('indicadores.carregar', unidadeReq === undefined ? {} : { unidade: unidadeReq });
  } catch (e) {
    if (emCache) e.message += ' Mostrando os dados da última visita.';
    throw e;
  }
  cacheGravar('ind:' + (r.unidade || 'todas'), r);
  if (unidadeReq === undefined) cacheGravar('ind:inicial', r);
  if (minhaCarga !== cargaId) return;  // chegou uma carga mais nova
  exibirCarga(r);
}

function montarUnidades() {
  const admin = info.usuario.perfil === 'admin';
  const sel = document.getElementById('unitSel');
  const label = document.getElementById('unitLabel');
  if (admin) {
    sel.innerHTML = '<option value="">Todas as unidades</option>' +
      info.unidades.map(u => `<option value="${esc(u.id)}">${esc(u.nome)}</option>`).join('');
    sel.value = unidadeSel;
    sel.hidden = false;
    sel.addEventListener('change', async () => {
      setStatus('Carregando…');
      try { await carregarDados(sel.value); setStatus(''); } catch (e) { sel.value = unidadeSel; setStatus(e.message + ' Continua a unidade anterior.', 'erro'); }
    });
  } else {
    label.textContent = nomeUnidade(unidadeSel);
  }
  document.getElementById('btnAdd').hidden = admin;
}

// ── Init ───────────────────────────────────────────────────────
// esqueleto dos indicadores enquanto a primeira carga não chega
function esqueletoKpis() {
  const html = Array.from({ length: 5 }, () => '<div class="kpi-card"><span class="skeleton" style="height:14px;width:60%"></span><span class="skeleton" style="height:28px;width:45%;margin-top:12px"></span><span class="skeleton" style="height:14px;width:75%;margin-top:12px"></span></div>').join('');
  ['kpi-clinica', 'kpi-logistica'].forEach(id => {
    const el = document.getElementById(id);
    el.innerHTML = html;
    el.setAttribute('aria-busy', 'true');
  });
}

// atalho da tela inicial da coordenação: indicadores.html?unidade=<id> abre direto uma unidade
function unidadePedida() {
  const u = new URLSearchParams(location.search).get('unidade');
  return u && /^[A-Za-z0-9_.-]+$/.test(u) ? u : undefined;
}

(async function init() {
  if (!cacheLer('ind:inicial')) esqueletoKpis();
  try {
    await carregarDados(unidadePedida());
    const avisos = [];
    if (info.mesAberto.teste) avisos.push(`Ambiente de teste: o mês aberto para lançamento está fixo em ${nomeMes(info.mesAberto)}.`);
    if (info.usuario.perfil === 'admin') avisos.push('Os coordenadores de cada unidade fazem os lançamentos; aqui você acompanha e define as metas.');
    setStatus(avisos.join(' '), info.mesAberto.teste ? 'warn' : '');
    // atalho da tela inicial ("Lançar indicadores"): abre o formulário do mês aberto
    if (info.usuario.perfil !== 'admin' && new URLSearchParams(location.search).has('lancar')) {
      openEntry();
      history.replaceState(null, '', location.pathname); // F5 ou "voltar" não reabrem o formulário
    }
  } catch (e) {
    // unidade pedida no endereço que não abriu: cai na visão padrão em vez de deixar a tela sem saída
    if (unidadePedida()) {
      history.replaceState(null, '', location.pathname);
      try {
        await carregarDados();
        setStatus('Não foi possível abrir a unidade pedida (' + e.message + ') Mostrando a visão padrão.', 'warn');
        return;
      } catch (e2) { e = e2; }
    }
    setStatus(e.message, 'erro');
  }
})();
