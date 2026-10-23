// Auditoria de bordas: contraste da borda de cada elemento contra o fundo que realmente aparece atrás dele.
// Uso: com o preview rodando em http://localhost:5510 (ver docs/DESIGN.md), na pasta tools/visual:  node auditar-bordas.js
// Controles (botão, campo, seletor, aba) precisam de 3:1 (WCAG 1.4.11); cartões e divisórias são decorativos e só avisam abaixo de 1,3:1.
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://localhost:5510/';
const LIMITE_CONTROLE = Number(process.env.LIMITE_CONTROLE || 3);
const LIMITE_CARTAO = Number(process.env.LIMITE_CARTAO || 1.3);

(async () => {
  const b = await chromium.launch({ channel: 'chrome', headless: true });
  const achados = new Map();
  let paginasNoLogin = 0;
  for (const tema of ['light', 'dark']) {
    for (const [pag, perfil] of [['index.html', 'admin'], ['indicadores.html', 'admin'], ['logistica.html', 'coordenador'], ['usuarios.html', 'admin'], ['ajuda.html', 'admin']]) {
      const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
      await ctx.addInitScript(([s, t]) => { try { localStorage.setItem('farma_sessao', s); localStorage.setItem('farma_theme', t); } catch (e) {} }, [perfil, tema]);
      const p = await ctx.newPage();
      await p.goto(BASE + pag, { waitUntil: 'networkidle' }); await p.waitForTimeout(700);
      // sessão simulada recusada = a página caiu no login e a medição não valeria
      if (pag !== 'index.html' && pag !== 'ajuda.html' && /index\.html$/.test(p.url())) { paginasNoLogin++; console.log('AVISO: ' + pag + ' voltou para o login (' + tema + '): a medição desta tela foi ignorada'); await ctx.close(); continue; }
      const lista = await p.evaluate(({ limiteControle, limiteCartao }) => {
        const cor = s => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const [r, g, bl, a = 1] = m[1].split(',').map(x => parseFloat(x)); return { r, g, b: bl, a }; };
        const lum = c => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(c.r) + .7152 * f(c.g) + .0722 * f(c.b); };
        const mistura = (topo, base) => ({ r: topo.r * topo.a + base.r * (1 - topo.a), g: topo.g * topo.a + base.g * (1 - topo.a), b: topo.b * topo.a + base.b * (1 - topo.a), a: 1 });
        const raiz = cor(getComputedStyle(document.body).backgroundColor) || cor(getComputedStyle(document.documentElement).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 };
        const fundoDe = el => {
          const camadas = [];
          for (let e = el; e; e = e.parentElement) { const c = cor(getComputedStyle(e).backgroundColor); if (c && c.a > 0) { camadas.push(c); if (c.a >= 1) break; } }
          let base = { ...raiz, a: 1 };
          for (let i = camadas.length - 1; i >= 0; i--) base = mistura(camadas[i], base);
          return base;
        };
        const ehControle = el => /^(button|input|select|textarea)$/.test(el.tagName.toLowerCase()) || el.getAttribute('role') === 'tab' || /(^|\s)(btn|btn-sec|btn-ghost|log-tab|log-filtro|header-btn|nav-item)(\s|$)/.test(el.className || '');
        const LADOS = ['Top', 'Right', 'Bottom', 'Left'];
        const saida = [];
        document.querySelectorAll('body *').forEach(el => {
          const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
          if (cs.display === 'none' || cs.visibility === 'hidden' || r.width === 0 || r.height === 0) return;
          if (el.disabled) return; // controle desabilitado é isento (WCAG 1.4.11)
          if (el.closest('.fechamento')) return; // painel escuro com gradiente: o cálculo de fundo não enxerga o gradiente
          const controle = ehControle(el);
          if (!controle && (r.width < 60 || r.height < 28)) return; // só controles pequenos importam
          // vale o lado com a borda mais visível
          let melhor = null;
          LADOS.forEach(l => {
            if (parseFloat(cs['border' + l + 'Width']) < 1 || cs['border' + l + 'Style'] === 'none') return;
            const bc = cor(cs['border' + l + 'Color']); if (!bc || bc.a === 0) return;
            const fundoFora = fundoDe(el.parentElement || el);
            const borda = mistura(bc, fundoFora);
            const L1 = lum(borda), L2 = lum(fundoFora);
            const ratio = (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05);
            if (!melhor || ratio > melhor.ratio) melhor = { ratio, lado: l };
          });
          if (!melhor) return;
          const limite = controle ? limiteControle : limiteCartao;
          if (melhor.ratio < limite) saida.push({ sel: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''), ratio: +melhor.ratio.toFixed(2), w: Math.round(r.width), h: Math.round(r.height), controle });
        });
        return saida;
      }, { limiteControle: LIMITE_CONTROLE, limiteCartao: LIMITE_CARTAO });
      for (const x of lista) { const k = tema + ' · ' + pag + ' · ' + (x.controle ? 'CONTROLE ' : 'cartão ') + x.sel; if (!achados.has(k) || achados.get(k).ratio > x.ratio) achados.set(k, x); }
      await ctx.close();
    }
  }
  [...achados.entries()].sort((a, c) => a[1].ratio - c[1].ratio).forEach(([k, x]) => console.log(x.ratio.toFixed(2), k, `(${x.w}x${x.h})`));
  console.log('total:', achados.size, paginasNoLogin ? '| telas ignoradas por sessão recusada: ' + paginasNoLogin : '');
  await b.close();
  process.exitCode = achados.size || paginasNoLogin ? 1 : 0;
})();
