// ────────────────────────────────────────────────────────────────
// Config
// ────────────────────────────────────────────────────────────────
const C = {
  teal:   '#2e86c1',
  blue:   '#17a2b8',
  amber:  '#e0951a',
  rose:   '#d9534f',
  purple: '#8e6bbf',
  green:  '#2eaf68',
  // cores de interface seguem o tema (tokens --chart-* em isv.css)
  neutro: '#94a3b8', // cinza-azulado que serve nos dois temas (barras de total)
  get text()   { return themeVar('--chart-text'); },
  get border() { return themeVar('--chart-border'); },
  get grid()   { return themeVar('--chart-grid'); },
  get bg()     { return themeVar('--chart-bg'); },
};

const baseOpts = (yMax) => ({
  responsive: true,
  animation: { duration: 600, easing: 'easeOutQuart' },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: themeVar('--chart-bg'),
      borderColor: themeVar('--chart-border'),
      borderWidth: 1,
      titleColor: themeVar('--chart-title'),
      bodyColor: themeVar('--chart-body'),
      padding: 10,
      callbacks: { label: ctx => ` ${ctx.parsed.y?.toFixed(1)}%` }
    }
  },
  scales: {
    x: {
      grid: { color: 'transparent' },
      ticks: { color: C.text, font: { size: 11, family: 'Segoe UI' } },
      border: { color: C.border }
    },
    y: {
      min: 0, // percentuais a partir de zero
      grid: { color: themeVar('--chart-grid') },
      ticks: {
        color: C.text,
        font: { size: 11 },
        callback: v => v + '%'
      },
      border: { dash: [3, 3], color: 'transparent' },
      ...(yMax ? { max: yMax } : {})
    }
  }
});

const lineOpts = (yMax, color) => ({
  ...baseOpts(yMax),
  elements: {
    point: { radius: 4, hoverRadius: 6, backgroundColor: color, borderColor: themeVar('--chart-bg'), borderWidth: 2 }
  }
});

function makeGrad(ctx, color) {
  const g = ctx.createLinearGradient(0, 0, 0, 220);
  g.addColorStop(0, color + '55');
  g.addColorStop(1, color + '00');
  return g;
}

function lineDataset(label, data, color) {
  return {
    label, data,
    borderColor: color, borderWidth: 2.5,
    backgroundColor: ctx => makeGrad(ctx.chart.ctx, color),
    fill: true, tension: 0.4, cubicInterpolationMode: 'monotone',
    pointBackgroundColor: color,
    pointBorderColor: themeVar('--chart-bg'),
    pointBorderWidth: 2,
    pointRadius: 4, pointHoverRadius: 7
  };
}

function barDataset(label, data, color) {
  return {
    label, data,
    backgroundColor: color + 'cc',
    borderColor: color,
    borderWidth: 1.5,
    borderRadius: 4,
    hoverBackgroundColor: color
  };
}

const MONTHS_ALL = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

// ────────────────────────────────────────────────────────────────
// CLÍNICA · UPA Jurema
// ────────────────────────────────────────────────────────────────
const mJurema = ['Jan','Fev','Mar','Abr','Mai','Ago'];

new Chart(document.getElementById('chartConcJurema'), {
  type:'line',
  data: { labels: mJurema, datasets: [lineDataset('Conciliações (%)', [100,100,100,100,100,null], C.teal)] },
  options: lineOpts(120, C.teal)
});

new Chart(document.getElementById('chartPrescJurema'), {
  type:'line',
  data: { labels: mJurema, datasets: [lineDataset('Prescrições Analisadas (%)', [100,100,100,100,100,0], C.blue)] },
  options: lineOpts(120, C.blue)
});

new Chart(document.getElementById('chartPrmJurema'), {
  type:'bar',
  data: { labels: mJurema, datasets: [barDataset('PRM (%)', [16.7, 100, 91.7, 3.7, 2.8, null], C.amber)] },
  options: baseOpts()
});

new Chart(document.getElementById('chartIntervJurema'), {
  type:'line',
  data: { labels: ['Jan','Fev','Mar','Abr','Mai'], datasets: [lineDataset('Aceitas (%)', [100,100,63.6,100,100], C.rose)] },
  options: lineOpts(120, C.rose)
});

new Chart(document.getElementById('chartAltasJurema'), {
  type:'bar',
  data: {
    labels: ['Jan','Fev','Mar','Abr','Mai','Ago'],
    datasets: [
      barDataset('Total de Altas', [3,9,4,5,3,5], C.neutro),
      barDataset('Altas Realizadas', [3,9,4,5,3,0], C.teal),
    ]
  },
  options: {
    ...baseOpts(),
    plugins: {
      ...baseOpts().plugins,
      legend: { display: true, labels: { color: C.text, font: { size: 11 }, boxWidth: 12, padding: 16 } },
      tooltip: { ...baseOpts().plugins.tooltip, callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y}` } }
    }
  }
});

// ────────────────────────────────────────────────────────────────
// CLÍNICA · Municipal
// ────────────────────────────────────────────────────────────────
const mMun = ['Jul','Out','Nov','Dez'];

new Chart(document.getElementById('chartPrescMun'), {
  type:'line',
  data: { labels: mMun, datasets: [lineDataset('Prescrições Analisadas (%)', [37.5,30.7,42.6,40.1], C.blue)] },
  options: lineOpts(60, C.blue)
});

new Chart(document.getElementById('chartPrmMun'), {
  type:'bar',
  data: { labels: mMun, datasets: [barDataset('PRM (%)', [1.98, 4.75, 3.22, 3.17], C.amber)] },
  options: baseOpts(8)
});

new Chart(document.getElementById('chartIntervMun'), {
  type:'bar',
  data: {
    labels: mMun,
    datasets: [
      barDataset('Realizadas', [73,91,86,102], C.neutro),
      barDataset('Aceitas', [70,66,68,78], C.rose),
    ]
  },
  options: {
    ...baseOpts(),
    plugins: {
      ...baseOpts().plugins,
      legend: { display: true, labels: { color: C.text, font: { size: 11 }, boxWidth: 12, padding: 16 } },
      tooltip: { ...baseOpts().plugins.tooltip, callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y}` } }
    }
  }
});

new Chart(document.getElementById('chartAltasMun'), {
  type:'bar',
  data: {
    labels: ['Jul','Nov'],
    datasets: [barDataset('Taxa Altas Realizadas (%)', [2.7, 51.3], C.purple)]
  },
  options: baseOpts(60)
});

new Chart(document.getElementById('chartConcMun'), {
  type:'bar',
  data: {
    labels: ['Jul','Nov'],
    datasets: [
      barDataset('Admissões', [3000, 990], C.neutro),
      barDataset('Conciliações', [1900, 536], C.teal),
    ]
  },
  options: {
    ...baseOpts(),
    plugins: {
      ...baseOpts().plugins,
      legend: { display: true, labels: { color: C.text, font: { size: 11 }, boxWidth: 12, padding: 16 } },
      tooltip: { ...baseOpts().plugins.tooltip, callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y}` } }
    }
  }
});

// ────────────────────────────────────────────────────────────────
// LOGÍSTICA · Maternidade
// ────────────────────────────────────────────────────────────────
const mMat = ['Jan','Fev','Ago','Set','Out','Nov','Dez'];

new Chart(document.getElementById('chartDesabMat'), {
  type:'line',
  data: { labels: mMat, datasets: [lineDataset('Desabastecimento (%)', [0,0,1.50,0.90,0.90,0.60,0.90], C.teal)] },
  options: lineOpts(3, C.teal)
});

new Chart(document.getElementById('chartValMat'), {
  type:'bar',
  data: { labels: mMat, datasets: [barDataset('Perdas por Validade (%)', [0,0,18.86,7.78,11.38,5.69,6.29], C.rose)] },
  options: baseOpts(25)
});

new Chart(document.getElementById('chartNcMat'), {
  type:'line',
  data: { labels: mMat, datasets: [lineDataset('Não Conformidades (%)', [25,25,18.18,31.58,44.44,18.18,30], C.amber)] },
  options: lineOpts(55, C.amber)
});

new Chart(document.getElementById('chartEmergMat'), {
  type:'bar',
  data: { labels: mMat, datasets: [barDataset('Pedidos Emergenciais (%)', [6.25,0,12.12,5.26,11.11,0,10], C.purple)] },
  options: baseOpts(18)
});

// ────────────────────────────────────────────────────────────────
// LOGÍSTICA · Municipal
// ────────────────────────────────────────────────────────────────
const mMunLog = ['Jul','Ago','Set','Out','Nov','Dez'];

new Chart(document.getElementById('chartDesabMun'), {
  type:'line',
  data: { labels: mMunLog, datasets: [lineDataset('Desabastecimento (%)', [1.98,0.76,1.06,1.22,0.76,0.30], C.teal)] },
  options: lineOpts(3, C.teal)
});

new Chart(document.getElementById('chartValMun'), {
  type:'bar',
  data: { labels: mMunLog, datasets: [barDataset('Perdas por Validade (%)', [2.58,0,2.28,2.89,2.13,1.67], C.rose)] },
  options: baseOpts(5)
});

new Chart(document.getElementById('chartNcMun'), {
  type:'line',
  data: { labels: ['Jul','Ago','Set','Out','Nov'], datasets: [lineDataset('Não Conformidades (%)', [7.41,3.45,7.14,6.82,14.29], C.amber)] },
  options: lineOpts(20, C.amber)
});

new Chart(document.getElementById('chartConfMun'), {
  type:'line',
  data: { labels: ['Jul','Set','Out','Nov','Dez'], datasets: [lineDataset('Conformidade Estoque (%)', [98.24,98.24,93.53,91.87,91.40], C.blue)] },
  options: lineOpts(102, C.blue)
});

// ────────────────────────────────────────────────────────────────
// LOGÍSTICA · UPA Centro
// ────────────────────────────────────────────────────────────────
const mUpaC = ['Jan','Fev','Mar','Abr','Mai','Ago','Set','Out','Nov','Dez'];

new Chart(document.getElementById('chartDesabUpaC'), {
  type:'line',
  data: { labels: mUpaC, datasets: [lineDataset('Desabastecimento (%)', [0,0.30,0,0.61,0,1.52,0.91,0.30,0,0], C.teal)] },
  options: lineOpts(3, C.teal)
});

new Chart(document.getElementById('chartValUpaC'), {
  type:'bar',
  data: { labels: mUpaC, datasets: [barDataset('Perdas por Validade (%)', [0.30,0.30,0,0.61,1.52,0,0.61,0.30,0,0.61], C.rose)] },
  options: baseOpts(3)
});

new Chart(document.getElementById('chartNcUpaC'), {
  type:'line',
  data: { labels: mUpaC, datasets: [lineDataset('Não Conformidades (%)', [0,11.11,6.67,8.33,6.67,12.5,15,12.5,7.14,0], C.amber)] },
  options: lineOpts(20, C.amber)
});

new Chart(document.getElementById('chartEmergUpaC'), {
  type:'bar',
  data: { labels: mUpaC, datasets: [barDataset('Pedidos Emergenciais (%)', [5.56,11.11,0,8.33,3.33,12.5,0,0,7.14,0], C.purple)] },
  options: baseOpts(18)
});

// ────────────────────────────────────────────────────────────────
// LOGÍSTICA · UPA Jurema
// ────────────────────────────────────────────────────────────────
const mUpaJ = ['Ago','Set','Out','Nov','Dez'];

new Chart(document.getElementById('chartDesabUpaJ'), {
  type:'line',
  data: { labels: mUpaJ, datasets: [lineDataset('Desabastecimento (%)', [2.13,0.91,0.61,0.61,0.30], C.teal)] },
  options: lineOpts(3, C.teal)
});

new Chart(document.getElementById('chartValUpaJ'), {
  type:'bar',
  data: { labels: mUpaJ, datasets: [barDataset('Perdas por Validade (%)', [null,null,null,null,null], C.rose)] },
  options: baseOpts(5)
});

// ────────────────────────────────────────────────────────────────
// Comparativo logístico
// ────────────────────────────────────────────────────────────────
new Chart(document.getElementById('chartComparativo'), {
  type: 'bar',
  data: {
    labels: ['Maternidade','Municipal','UPA Centro','UPA Jurema'],
    datasets: [
      barDataset('Desabastecimento (%)', [0.68, 1.01, 0.36, 0.71], C.teal),
      barDataset('Perdas por Validade (%)', [7.14, 1.93, 0.43, 1.80], C.rose),
      barDataset('Não Conformidades (%)', [27.0, 7.04, 8.18, null], C.amber),
    ]
  },
  options: {
    ...baseOpts(),
    plugins: {
      ...baseOpts().plugins,
      legend: { display: true, labels: { color: C.text, font: { size: 12 }, boxWidth: 12, padding: 20 } },
      tooltip: { ...baseOpts().plugins.tooltip, callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y?.toFixed(2)}%` } }
    }
  }
});

// ────────────────────────────────────────────────────────────────
// Navegação
// ────────────────────────────────────────────────────────────────
function switchTab(tab, btn) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  btn.classList.add('active');
}

function switchUnit(unit, btn) {
  document.querySelectorAll('[id^="unit-"]').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.unit-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('unit-' + unit).style.display = 'block';
  btn.classList.add('active');
}

function switchLogUnit(unit, btn) {
  document.querySelectorAll('[id^="log-"]').forEach(el => el.style.display = 'none');
  document.querySelectorAll('#tab-logistica .unit-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('log-' + unit).style.display = 'block';
  btn.classList.add('active');
}

// Acesso: só a coordenação do Instituto, enquanto os dados desta tela são de exemplo
exigirSessao()
  .then(sessao => {
    if (sessao.usuario.perfil !== 'admin') location.href = 'indicadores.html';
    else document.body.classList.remove('aguardando-sessao');
  })
  .catch(e => {
    // sessão inválida já redireciona em api(); aqui é falha de rede ou do servidor: avisa em vez de deslogar
    const aviso = document.createElement('p');
    aviso.className = 'notice erro';
    aviso.style.margin = '16px';
    aviso.textContent = 'Não foi possível confirmar o seu acesso: ' + e.message + ' Recarregue a página para tentar de novo.';
    document.querySelector('header').after(aviso);
  });
