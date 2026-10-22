// Capturas das telas com servidor simulado: node shots.js <rotulo> [paginas] [temas] [larguras]
// Ex.: node shots.js antes index,logistica claro,escuro 1280,390
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });

const [rotulo = 'x', paginasArg = 'index,indicadores,logistica,usuarios', temasArg = 'claro', largArg = '1280,390', perfisArg = 'admin,coordenador'] = process.argv.slice(2);
const PAGINAS = paginasArg.split(',');
const TEMAS = temasArg.split(',');
const LARGURAS = largArg.split(',').map(Number);
const PERFIS = perfisArg.split(',');

const { responder } = require('./mock');

// ── servidor estático ──
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };
const srv = http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(r);
});

(async () => {
  await new Promise(ok => srv.listen(8099, ok));
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  for (const perfil of PERFIS) for (const tema of TEMAS) for (const w of LARGURAS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: w > 600 ? 820 : 844 }, deviceScaleFactor: 1 });
    await ctx.addInitScript(([t]) => {
      try { localStorage.setItem('farma_sessao', 'TOKEN'); localStorage.setItem('farma_theme', t === 'escuro' ? 'dark' : 'light'); } catch (e) { /* about:blank */ }
    }, [tema]);
    await ctx.route('**/script.google.com/**', async route => {
      const req = JSON.parse(route.request().postData() || '{}');
      const dados = responder(req, perfil);
      await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(dados ? { ok: true, dados } : { ok: false, erro: 'não simulado: ' + req.action }) });
    });
    await ctx.route('**/fonts.g*/**', route => route.continue());
    for (const pg of PAGINAS) {
      if (pg === 'usuarios' && perfil !== 'admin') continue;
      const page = await ctx.newPage();
      const erros = [];
      page.on('pageerror', e => erros.push(e.message));
      await page.goto(`http://localhost:8099/${pg}.html`, { waitUntil: 'networkidle' }).catch(() => {});
      await page.waitForTimeout(900);
      const nome = `${rotulo}_${pg}_${perfil}_${tema}_${w}.png`;
      await page.screenshot({ path: path.join(OUT, nome), fullPage: pg === 'index' ? false : false });
      console.log(nome, erros.length ? 'ERROS: ' + erros.join(' | ') : 'ok');
      await page.close();
    }
    await ctx.close();
  }
  await browser.close();
  srv.close();
})();
