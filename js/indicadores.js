// ── State ──────────────────────────────────────────────────────
const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MONTHS_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

let data = JSON.parse(localStorage.getItem('farma_data') || '[]');

let metas = JSON.parse(localStorage.getItem('farma_metas') || 'null') || {
  conciliacoes:   { val: 80,  dir: 'min', label: 'Conciliações Medicamentosas (%)' },
  prescricoes:    { val: 80,  dir: 'min', label: 'Prescrições Analisadas (%)' },
  prm:            { val: 5,   dir: 'max', label: 'PRM Identificados (%)' },
  intervencoes:   { val: 75,  dir: 'min', label: 'Intervenções Aceitas (%)' },
  altas:          { val: 80,  dir: 'min', label: 'Altas Hospitalares (%)' },
  desabastecimento:{ val: 2,  dir: 'max', label: 'Desabastecimento (%)' },
  perdas:         { val: 5,   dir: 'max', label: 'Perdas por Validade (%)' },
  nconformidades: { val: 10,  dir: 'max', label: 'Não Conformidades Entrega (%)' },
  estoque:        { val: 95,  dir: 'min', label: 'Conformidade de Estoque (%)' },
  emergenciais:   { val: 10,  dir: 'max', label: 'Pedidos Emergenciais (%)' },
};

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

function status(key, val) {
  if (val === null) return 'na';
  const m = metas[key];
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
  teal:   '#00c9b1', blue: '#4a7cff', amber: '#f59e0b',
  rose:   '#f43f5e', purple: '#8b5cf6', green: '#10b981',
  txt2:   '#7a8599', bd: '#2a3250',
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
      backgroundColor: '#1c2235', borderColor: '#2a3250', borderWidth: 1,
      titleColor: '#e2e8f4', bodyColor: '#7a8599', padding: 10,
      callbacks: { label: ctx => ` ${ctx.raw !== null ? ctx.raw.toFixed(1) + '%' : '—'}` }
    }
  },
  scales: {
    x: { grid: { color: 'transparent' }, ticks: { color: COL.txt2, font: { size: 11 } }, border: { color: COL.bd } },
    y: {
      grid: { color: 'rgba(42,50,80,.5)' },
      ticks: { color: COL.txt2, font: { size: 11 }, callback: v => v + '%' },
      border: { dash: [3, 3], color: 'transparent' },
      ...(yMax !== undefined ? { max: yMax } : {})
    }
  }
});

function goalPlugin(metaKey, color) {
  return {
    id: 'goalLine_' + metaKey,
    afterDraw(chart) {
      const meta = metas[metaKey];
      if (!meta) return;
      const { ctx, chartArea: { left, right }, scales: { y } } = chart;
      const yPos = y.getPixelForValue(meta.val);
      if (yPos < y.top || yPos > y.bottom) return;
      ctx.save();
      ctx.beginPath();
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = color + 'bb';
      ctx.lineWidth = 1.5;
      ctx.moveTo(left, yPos); ctx.lineTo(right, yPos);
      ctx.stroke();
      ctx.fillStyle = color + 'bb';
      ctx.font = '10px Inter';
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
    fill: true, tension: 0.4,
    pointBackgroundColor: data.map(v => v === null ? 'transparent' : color),
    pointBorderColor: '#0d1117', pointBorderWidth: 2,
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
  renderClinica();
  renderLogistica();
}

function dataForKey(key, monthFilter = null) {
  const rows = monthFilter !== null
    ? data.filter(r => r.mes === monthFilter)
    : data;
  return rows.map(r => ({ ...calcRow(r), mes: r.mes, unidade: r.unidade }));
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
      <div class="kpi-card" style="--c:var(${k.color})">
        <div class="kpi-label">${k.label}</div>
        <div class="kpi-val">${fmtVal(val)}</div>
        <div class="kpi-sub">Meta: ${m.val}% · ${m.dir === 'min' ? '↑ mínimo' : '↓ máximo'}</div>
        ${val !== null ? `<span class="kpi-badge ${st}">${st === 'ok' ? '✓ Meta atingida' : st === 'warn' ? '⚠ Atenção' : '✗ Abaixo da meta'}</span>` : '<span class="kpi-badge warn">Sem dados</span>'}
      </div>`;
  });

  // Alerts
  const alertsDiv = document.getElementById('alerts-clinica');
  alertsDiv.innerHTML = '';
  kpiKeys.forEach(k => {
    const vals = calcs.map(c => c[k.key]).filter(v => v !== null);
    const val = vals.length ? avg(vals) : null;
    const st = status(k.key, val);
    if (st === 'err') alertsDiv.innerHTML += `<div class="alert-item err"><span class="alert-icon">🔴</span><b>${k.label}</b>: ${fmtVal(val)} — abaixo da meta de ${metas[k.key].val}% em ${MONTHS_FULL[month]}. Verificar ação corretiva.</div>`;
    else if (st === 'warn') alertsDiv.innerHTML += `<div class="alert-item warn"><span class="alert-icon">🟡</span><b>${k.label}</b>: ${fmtVal(val)} — próximo ao limite da meta (${metas[k.key].val}%).</div>`;
  });

  // Charts by month trend
  const labels = MONTHS;
  const cg = document.getElementById('charts-clinica');
  cg.innerHTML = `
    <div class="card"><div class="card-header"><div><div class="card-title">Conciliações Medicamentosas</div><div class="card-sub">% sobre admissões · linha de meta</div></div><span class="badge ${status('conciliacoes', avg(byMonth('conciliacoes').filter(v=>v!==null)))}">${fmtVal(avg(byMonth('conciliacoes').filter(v=>v!==null)))}</span></div><canvas id="c-conc" height="190"></canvas></div>
    <div class="card"><div class="card-header"><div><div class="card-title">Prescrições Analisadas</div><div class="card-sub">% sobre prescrições atendidas</div></div><span class="badge ${status('prescricoes', avg(byMonth('prescricoes').filter(v=>v!==null)))}">${fmtVal(avg(byMonth('prescricoes').filter(v=>v!==null)))}</span></div><canvas id="c-presc" height="190"></canvas></div>
    <div class="card"><div class="card-header"><div><div class="card-title">PRM Identificados</div><div class="card-sub">% sobre prescrições analisadas</div></div><span class="badge ${status('prm', avg(byMonth('prm').filter(v=>v!==null)))}">${fmtVal(avg(byMonth('prm').filter(v=>v!==null)))}</span></div><canvas id="c-prm" height="190"></canvas></div>
    <div class="card"><div class="card-header"><div><div class="card-title">Intervenções Farmacêuticas Aceitas</div><div class="card-sub">% sobre intervenções realizadas</div></div><span class="badge ${status('intervencoes', avg(byMonth('intervencoes').filter(v=>v!==null)))}">${fmtVal(avg(byMonth('intervencoes').filter(v=>v!==null)))}</span></div><canvas id="c-interv" height="190"></canvas></div>
    <div class="card span2"><div class="card-header"><div><div class="card-title">Altas Hospitalares com Orientação Farmacêutica</div><div class="card-sub">% do total de altas · todos os meses</div></div></div><canvas id="c-altas" height="110"></canvas></div>
  `;

  setTimeout(() => {
    const opts = baseOpts(110);
    mkOrUpdate('c-conc',  'line', { data: { labels, datasets: [lineDS('Conc.', byMonth('conciliacoes'), COL.teal)]  }, options: { ...baseOpts(110), plugins: { ...baseOpts(110).plugins, ...{} } }, plugins: [goalPlugin('conciliacoes', COL.teal)] });
    mkOrUpdate('c-presc', 'line', { data: { labels, datasets: [lineDS('Presc.', byMonth('prescricoes'), COL.blue)] }, options: baseOpts(110), plugins: [goalPlugin('prescricoes', COL.blue)] });
    mkOrUpdate('c-prm',   'bar',  { data: { labels, datasets: [barDS('PRM', byMonth('prm'), COL.amber)]            }, options: baseOpts(),    plugins: [goalPlugin('prm', COL.amber)] });
    mkOrUpdate('c-interv','line', { data: { labels, datasets: [lineDS('Interv.', byMonth('intervencoes'), COL.rose)]}, options: baseOpts(110),plugins: [goalPlugin('intervencoes', COL.rose)] });
    mkOrUpdate('c-altas', 'bar',  { data: { labels, datasets: [barDS('Altas', byMonth('altas'), COL.purple)]       }, options: baseOpts(110), plugins: [goalPlugin('altas', COL.purple)] });
  }, 30);

  // Table
  const tbody = document.querySelector('#table-clinica tbody');
  tbody.innerHTML = '';
  const sorted = [...data].sort((a, b) => a.mes - b.mes);
  sorted.forEach(r => {
    const c = calcRow(r);
    tbody.innerHTML += `<tr>
      <td>${MONTHS[r.mes]}</td>
      <td>${r.unidade}</td>
      <td class="mono ${status('conciliacoes', c.conciliacoes) === 'ok' ? 'c-ok' : status('conciliacoes', c.conciliacoes) === 'warn' ? 'c-warn' : c.conciliacoes !== null ? 'c-err' : 'c-na'}">${fmtVal(c.conciliacoes)}</td>
      <td class="mono ${statusClass('prescricoes', c.prescricoes)}">${fmtVal(c.prescricoes)}</td>
      <td class="mono ${statusClass('prm', c.prm)}">${fmtVal(c.prm)}</td>
      <td class="mono ${statusClass('intervencoes', c.intervencoes)}">${fmtVal(c.intervencoes)}</td>
      <td class="mono ${statusClass('altas', c.altas)}">${fmtVal(c.altas)}</td>
    </tr>`;
  });
  if (!sorted.length) tbody.innerHTML = '<tr><td colspan="7" class="c-na" style="text-align:center;padding:20px">Nenhum dado lançado ainda. Use "+ Lançar dados" para começar.</td></tr>';
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
      <div class="kpi-card" style="--c:var(${k.color})">
        <div class="kpi-label">${k.label}</div>
        <div class="kpi-val">${fmtVal(val)}</div>
        <div class="kpi-sub">Meta: ${m.val}% · ${m.dir === 'min' ? '↑ mínimo' : '↓ máximo'}</div>
        ${val !== null ? `<span class="kpi-badge ${st}">${st === 'ok' ? '✓ OK' : st === 'warn' ? '⚠ Atenção' : '✗ Fora da meta'}</span>` : '<span class="kpi-badge warn">Sem dados</span>'}
      </div>`;
  });

  const alertsDiv = document.getElementById('alerts-logistica');
  alertsDiv.innerHTML = '';
  kpiKeys.forEach(k => {
    const vals = calcs.map(c => c[k.key]).filter(v => v !== null);
    const val = vals.length ? avg(vals) : null;
    const st = status(k.key, val);
    if (st === 'err') alertsDiv.innerHTML += `<div class="alert-item err"><span class="alert-icon">🔴</span><b>${k.label}</b>: ${fmtVal(val)} — fora da meta de ${metas[k.key].val}% em ${MONTHS_FULL[month]}.</div>`;
    else if (st === 'warn') alertsDiv.innerHTML += `<div class="alert-item warn"><span class="alert-icon">🟡</span><b>${k.label}</b>: ${fmtVal(val)} — próximo ao limite (meta: ${metas[k.key].val}%).</div>`;
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
    mkOrUpdate('l-desab',  'line', { data: { labels, datasets: [lineDS('Desab.', byMonth('desabastecimento'), COL.teal)]   }, options: baseOpts(), plugins: [goalPlugin('desabastecimento', COL.teal)] });
    mkOrUpdate('l-perdas', 'bar',  { data: { labels, datasets: [barDS('Perdas', byMonth('perdas'), COL.rose)]              }, options: baseOpts(), plugins: [goalPlugin('perdas', COL.rose)] });
    mkOrUpdate('l-nc',     'line', { data: { labels, datasets: [lineDS('NC', byMonth('nconformidades'), COL.amber)]        }, options: baseOpts(), plugins: [goalPlugin('nconformidades', COL.amber)] });
    mkOrUpdate('l-estoque','line', { data: { labels, datasets: [lineDS('Estoque', byMonth('estoque'), COL.blue)]           }, options: baseOpts(105), plugins: [goalPlugin('estoque', COL.blue)] });
    mkOrUpdate('l-emerg',  'bar',  { data: { labels, datasets: [barDS('Emerg.', byMonth('emergenciais'), COL.purple)]      }, options: baseOpts(), plugins: [goalPlugin('emergenciais', COL.purple)] });
  }, 30);

  const tbody = document.querySelector('#table-logistica tbody');
  tbody.innerHTML = '';
  const sorted = [...data].sort((a, b) => a.mes - b.mes);
  sorted.forEach(r => {
    const c = calcRow(r);
    tbody.innerHTML += `<tr>
      <td>${MONTHS[r.mes]}</td>
      <td>${r.unidade}</td>
      <td class="mono ${statusClass('desabastecimento', c.desabastecimento)}">${fmtVal(c.desabastecimento)}</td>
      <td class="mono ${statusClass('perdas', c.perdas)}">${fmtVal(c.perdas)}</td>
      <td class="mono ${statusClass('nconformidades', c.nconformidades)}">${fmtVal(c.nconformidades)}</td>
      <td class="mono ${statusClass('estoque', c.estoque)}">${fmtVal(c.estoque)}</td>
      <td class="mono ${statusClass('emergenciais', c.emergenciais)}">${fmtVal(c.emergenciais)}</td>
    </tr>`;
  });
  if (!sorted.length) tbody.innerHTML = '<tr><td colspan="7" class="c-na" style="text-align:center;padding:20px">Nenhum dado lançado ainda.</td></tr>';
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
function openEntry() {
  document.getElementById('f-mes').value = document.getElementById('monthSel').value;
  document.getElementById('overlay-entry').classList.add('open');
}
function closeEntry() { document.getElementById('overlay-entry').classList.remove('open'); }

function saveEntry() {
  const fields = ['admissoes','conciliacoes','presc-atend','presc-anal','prm','interv-total','interv-aceitas','altas-total','altas-real','itens-pad','itens-falta','itens-venc','entregas','nc','auditados','conformes','emergenciais'];
  const row = {
    mes: +document.getElementById('f-mes').value,
    unidade: document.getElementById('f-unidade').value,
  };
  fields.forEach(f => {
    const v = document.getElementById('f-' + f).value;
    row[f] = v !== '' ? +v : null;
  });
  // Remove existing entry for same month + unit
  data = data.filter(r => !(r.mes === row.mes && r.unidade === row.unidade));
  data.push(row);
  localStorage.setItem('farma_data', JSON.stringify(data));
  closeEntry();
  // Reset fields
  fields.forEach(f => { document.getElementById('f-' + f).value = ''; });
  renderAll();
}

// ── Metas modal ────────────────────────────────────────────────
function openMetas() {
  const list = document.getElementById('metas-list');
  list.innerHTML = Object.entries(metas).map(([key, m]) => `
    <div class="meta-row">
      <span class="meta-label">${m.label}</span>
      <input class="meta-input" id="meta-${key}" type="number" value="${m.val}" min="0" max="100" step="0.5">
      <span class="meta-unit">%</span>
      <span class="meta-dir">${m.dir === 'min' ? '↑ mínimo' : '↓ máximo'}</span>
    </div>`).join('');
  document.getElementById('overlay-metas').classList.add('open');
}
function closeMetas() { document.getElementById('overlay-metas').classList.remove('open'); }
function saveMetas() {
  Object.keys(metas).forEach(key => {
    const el = document.getElementById('meta-' + key);
    if (el) metas[key].val = +el.value;
  });
  localStorage.setItem('farma_metas', JSON.stringify(metas));
  closeMetas();
  renderAll();
}

// ── Init ───────────────────────────────────────────────────────
// Set current month
const now = new Date();
document.getElementById('monthSel').value = now.getMonth();
document.getElementById('f-mes').value    = now.getMonth();

renderAll();
