// Bateria de testes visuais em navegador real: todas as telas × perfis × temas × larguras.
// Mede erro de página, rolagem horizontal, alvos de toque (celular) e contraste de texto, e salva capturas.
//
// Uso (na pasta tools/visual, com o comparador ou o preview rodando):
//   node bateria-visual.js http://localhost:5600/a/ http://localhost:5600/b/
//   node bateria-visual.js http://localhost:5510/
// Cada endereço vira um "lado" no relatório (A, B, ...). Capturas em out/bateria/.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASES = process.argv.slice(2).length ? process.argv.slice(2) : ['http://localhost:5510/'];
const PAGINAS = ['index.html', 'indicadores.html', 'logistica.html', 'usuarios.html', 'dashboard.html', 'ajuda.html'];
const PERFIS = ['admin', 'coordenador'];
const TEMAS = ['light', 'dark'];
const LARGURAS = [390, 1280];
const SAIDA = path.join(__dirname, 'out', 'bateria');
fs.mkdirSync(SAIDA, { recursive: true });

// roda dentro da página: alvos pequenos e texto com pouco contraste (só sobre fundo liso)
function medir(largura) {
  const cor = s => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const [r, g, b, a = 1] = m[1].split(',').map(parseFloat); return { r, g, b, a }; };
  const lum = c => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(c.r) + .7152 * f(c.g) + .0722 * f(c.b); };
  const mistura = (t, b) => ({ r: t.r * t.a + b.r * (1 - t.a), g: t.g * t.a + b.g * (1 - t.a), b: t.b * t.a + b.b * (1 - t.a), a: 1 });
  const raiz = cor(getComputedStyle(document.body).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 };
  const fundo = el => {
    const camadas = [];
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return null; // gradiente ou imagem: não dá para medir
      const c = cor(cs.backgroundColor); if (c && c.a > 0) { camadas.push(c); if (c.a >= 1) break; }
    }
    let base = { ...raiz, a: 1 }; for (let i = camadas.length - 1; i >= 0; i--) base = mistura(camadas[i], base); return base;
  };
  const visivel = el => { const r = el.getBoundingClientRect(), cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !el.closest('[hidden],[aria-hidden="true"]'); };
  const nome = el => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/)[0] : '');
  const pequenos = [];
  if (largura < 640) {
    document.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, [role=tab], summary').forEach(el => {
      if (!visivel(el) || el.disabled) return;
      if (el.tagName === 'A' && el.closest('p, li') && !el.closest('nav, .fech-lista, .rodape-links')) return; // link dentro de texto corrido
      const r = el.getBoundingClientRect();
      if (el.matches('a.fech-selo')) return; // área de toque ampliada por ::after (o retângulo medido é só o visual)
      if (Math.round(r.height) < 44 || Math.round(r.width) < 24) pequenos.push(nome(el) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
    });
  }
  const contraste = [];
  document.querySelectorAll('body *').forEach(el => {
    if (!visivel(el) || el.children.length && ![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) return;
    const texto = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join(' ').trim();
    if (!texto) return;
    const cs = getComputedStyle(el); const bg = fundo(el); if (!bg) return;
    const fg = cor(cs.color); if (!fg) return;
    const L1 = lum(mistura(fg, bg)), L2 = lum(bg);
    const ratio = (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05);
    const grande = parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.66 && +cs.fontWeight >= 700);
    if (ratio < (grande ? 3 : 4.5) && !el.closest('button:disabled, [disabled]')) contraste.push(ratio.toFixed(2) + ' ' + nome(el) + ' "' + texto.slice(0, 30) + '"');
  });
  return { rolagemHorizontal: document.documentElement.scrollWidth - innerWidth > 1, pequenos: [...new Set(pequenos)], contraste: [...new Set(contraste)] };
}

(async () => {
  const b = await chromium.launch({ channel: 'chrome', headless: true });
  const resumo = [];
  for (const [i, base] of BASES.entries()) {
    const lado = String.fromCharCode(65 + i);
    const linhas = [];
    let totais = { telas: 0, erros: 0, rolagem: 0, pequenos: 0, contraste: 0 };
    for (const pag of PAGINAS) for (const perfil of PERFIS) for (const tema of TEMAS) for (const w of LARGURAS) {
      if (pag === 'usuarios.html' && perfil !== 'admin') continue; // tela só da coordenação
      const ctx = await b.newContext({ viewport: { width: w, height: 900 } });
      await ctx.addInitScript(([s, t]) => { try { localStorage.setItem('farma_sessao', s); localStorage.setItem('farma_theme', t); } catch (e) {} }, [perfil, tema]);
      const p = await ctx.newPage(); const erros = []; p.on('pageerror', e => erros.push(e.message));
      await p.goto(base + pag, { waitUntil: 'networkidle' }); await p.waitForTimeout(700);
      const m = await p.evaluate(medir, w);
      const id = [lado, pag.replace('.html', ''), perfil, tema, w].join('_');
      await p.screenshot({ path: path.join(SAIDA, id + '.png'), fullPage: true });
      totais.telas++; totais.erros += erros.length; totais.rolagem += m.rolagemHorizontal ? 1 : 0; totais.pequenos += m.pequenos.length; totais.contraste += m.contraste.length;
      if (erros.length || m.rolagemHorizontal || m.pequenos.length || m.contraste.length) {
        linhas.push('## ' + id + (m.rolagemHorizontal ? '  ROLAGEM HORIZONTAL' : ''));
        erros.forEach(e => linhas.push('  ERRO: ' + e));
        if (m.pequenos.length) linhas.push('  alvo < 44px: ' + m.pequenos.join(' ; '));
        m.contraste.forEach(c => linhas.push('  contraste: ' + c));
      }
      await ctx.close();
    }
    fs.writeFileSync(path.join(SAIDA, 'relatorio-' + lado + '.txt'), base + '\n' + JSON.stringify(totais) + '\n\n' + linhas.join('\n'));
    resumo.push(lado + ' ' + base + '  telas ' + totais.telas + ' · erros de página ' + totais.erros + ' · rolagem horizontal ' + totais.rolagem + ' · alvos pequenos ' + totais.pequenos + ' · contraste ' + totais.contraste);
  }
  console.log(resumo.join('\n'));
  console.log('Detalhes e capturas: ' + SAIDA);
  await b.close();
})();
