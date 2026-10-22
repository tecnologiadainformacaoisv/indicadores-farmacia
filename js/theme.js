// Tema claro/escuro. Carregado no <head> para aplicar o tema antes da primeira pintura.
const THEME_KEY = 'farma_theme';

function themeVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function currentTheme() {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

// Recolore gráficos já criados (os novos já nascem com as cores do tema ativo).
function restyleCharts() {
  if (typeof Chart === 'undefined') return;
  Object.values(Chart.instances).forEach(chart => {
    const o = chart.options;
    Object.values(o.scales || {}).forEach(sc => {
      if (sc.ticks) sc.ticks.color = themeVar('--chart-text');
      if (sc.border && sc.border.color !== 'transparent') sc.border.color = themeVar('--chart-border');
      if (sc.grid && sc.grid.color !== 'transparent') sc.grid.color = themeVar('--chart-grid');
    });
    const p = o.plugins || {};
    if (p.legend && p.legend.labels) p.legend.labels.color = themeVar('--chart-text');
    if (p.tooltip) {
      p.tooltip.backgroundColor = themeVar('--chart-bg');
      p.tooltip.borderColor = themeVar('--chart-border');
      p.tooltip.titleColor = themeVar('--chart-title');
      p.tooltip.bodyColor = themeVar('--chart-body');
    }
    if (o.elements && o.elements.point) o.elements.point.borderColor = themeVar('--chart-bg');
    chart.data.datasets.forEach(ds => {
      if (ds.pointBorderColor) ds.pointBorderColor = themeVar('--chart-bg');
    });
    chart.update('none');
  });
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
    btn.setAttribute('aria-pressed', String(theme === 'dark'));
    // o nome acessível fica fixo ("Tema escuro") e o estado vai em aria-pressed; a dica visual diz a ação
    btn.title = theme === 'dark' ? 'Voltar ao tema claro' : 'Usar o tema escuro';
  });
}

(function initTheme() {
  let saved = null;
  try { saved = localStorage.getItem(THEME_KEY); } catch (e) { /* sem armazenamento: usa claro */ }
  document.documentElement.dataset.theme = saved === 'dark' ? 'dark' : 'light';
})();

// Letra maior: guarda a escolha e liga um botão "A+" ao lado do tema.
const FONTE_KEY = 'farma_fonte';
(function initFonte() {
  let v = null;
  try { v = localStorage.getItem(FONTE_KEY); } catch (e) { /* sem armazenamento */ }
  if (v === 'grande') document.documentElement.dataset.fonte = 'grande';
})();

function montarBotaoFonte() {
  const tema = document.querySelector('[data-theme-toggle]');
  if (!tema || document.querySelector('.fonte-toggle')) return;
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'header-btn fonte-toggle';
  b.textContent = 'A+';
  b.title = 'Letra maior (clique de novo para voltar)';
  const atual = () => document.documentElement.dataset.fonte === 'grande';
  b.setAttribute('aria-pressed', String(atual()));
  b.setAttribute('aria-label', 'Letra maior');
  b.addEventListener('click', () => {
    const grande = !atual();
    if (grande) document.documentElement.dataset.fonte = 'grande'; else delete document.documentElement.dataset.fonte;
    b.setAttribute('aria-pressed', String(grande));
    try { localStorage.setItem(FONTE_KEY, grande ? 'grande' : 'normal'); } catch (e) { /* ignora */ }
  });
  tema.parentNode.insertBefore(b, tema);
}

document.addEventListener('DOMContentLoaded', () => {
  montarBotaoFonte();
  applyTheme(currentTheme());
  document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
    btn.addEventListener('click', () => {
      const next = currentTheme() === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* ignora */ }
      restyleCharts();
    });
  });
});
