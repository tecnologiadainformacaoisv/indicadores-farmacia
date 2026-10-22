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

// ── dados simulados ──
const unidades = [
  { id: 'upa-centro', nome: 'UPA Luiz Nerys (UPA Centro)', municipio: 'Caucaia', modelo: 'UPA' },
  { id: 'upa-jurema', nome: 'UPA Jurema', municipio: 'Caucaia', modelo: 'UPA' },
];
const sessao = perfil => ({
  usuario: perfil === 'admin'
    ? { login: 'tereza', nome: 'Tereza Albuquerque', perfil: 'admin', unidade: '', trocarSenha: false }
    : { login: 'coord.centro', nome: 'Ana Beatriz Lima', perfil: 'coordenador', unidade: 'upa-centro', trocarSenha: false },
  unidades: perfil === 'admin' ? unidades : [unidades[0]],
  mesAberto: { ano: 2026, mes: 4, teste: false },
});
const METAS = {
  conciliacoes: { val: 80, dir: 'min', label: 'Conciliações Medicamentosas (%)' },
  prescricoes: { val: 80, dir: 'min', label: 'Prescrições Analisadas (%)' },
  prm: { val: 5, dir: 'max', label: 'PRM Identificados (%)' },
  intervencoes: { val: 75, dir: 'min', label: 'Intervenções Aceitas (%)' },
  altas: { val: 80, dir: 'min', label: 'Altas Hospitalares (%)' },
  desabastecimento: { val: 2, dir: 'max', label: 'Desabastecimento (%)' },
  perdas: { val: 5, dir: 'max', label: 'Perdas por Validade (%)' },
  nconformidades: { val: 10, dir: 'max', label: 'Não Conformidades Entrega (%)' },
  estoque: { val: 95, dir: 'min', label: 'Conformidade de Estoque (%)' },
  emergenciais: { val: 10, dir: 'max', label: 'Pedidos Emergenciais (%)' },
};
const L = (unidade, mes, o) => ({
  unidade, ano: 2026, mes, lancadoPor: 'coord.centro', lancadoEm: '05/0' + (mes + 2) + '/2026 10:12',
  admissoes: 120, conciliacoes: 98, 'presc-atend': 300, 'presc-anal': 276, prm: 11, 'interv-total': 22, 'interv-aceitas': 18,
  'altas-total': 40, 'altas-real': 34, 'itens-pad': 334, 'itens-falta': 4, 'itens-venc': 9, entregas: 30, nc: 2,
  auditados: 360, conformes: 352, emergenciais: 3, ...o,
});
const lancamentos = [
  L('upa-centro', 0, { conciliacoes: 84, prm: 14 }), L('upa-centro', 1, { conciliacoes: 90 }), L('upa-centro', 2, { conciliacoes: 95, prm: 9 }),
  L('upa-centro', 3, { conciliacoes: 101 > 120 ? 0 : 99, 'altas-real': 30 }), L('upa-centro', 4, {}),
  L('upa-jurema', 2, { conciliacoes: 70, prm: 22 }), L('upa-jurema', 3, { conciliacoes: 76 }),
];
const NOMES = [
  'ACIDO ACETILSALICILICO - 100 MG - Comprimidos', 'ACIDO ASCORBICO (VITAMINA C) - 100 MG/ML - Ampola', 'ADENOSINA - 3 MG/ML - Ampola',
  'AGUA DESTILADA ESTERIL E APIROGENICA - 500 ML - Tubo', 'ALCOOL LIQUIDO PARA ASSEPSIA DA PELE - 70 % - Frasco 1L', 'AMIODARONA CLORIDRATO - 50 MG/ML - Ampola',
  'ANLODIPINO BESILATO - 5 MG - Comprimidos', 'ATROPINA SULFATO - 0,25 MG/ML - Ampola', 'AZITROMICINA - 500 MG - Comprimidos',
  'BICARBONATO DE SODIO - 8,4 % - Ampola', 'CAPTOPRIL - 25 MG - Comprimidos', 'CEFTRIAXONA DISSODICA - 1 G - Frasco Ampola',
  'CLORETO DE SODIO - 0,9 % - Tubo 500ml', 'DEXAMETASONA FOSFATO DISSODICO - 4 MG/ML - Ampola', 'DIPIRONA SODICA - 500 MG/ML - Ampola',
  'DIAZEPAM - 5 MG/ML - Ampola', 'ENOXAPARINA SODICA - 40 MG - Seringa', 'FUROSEMIDA - 10 MG/ML - Ampola', 'HALOPERIDOL - 5 MG/ML - Ampola',
  'LOSARTANA POTASSICA - 50 MG - Comprimidos', 'MORFINA SULFATO - 10 MG/ML - Ampola', 'OMEPRAZOL - 40 MG - Frasco Ampola',
];
const itens = NOMES.map((n, i) => {
  const base = 40 + ((i * 37) % 300);
  const cmm = Math.round(base * 0.9);
  const estoque = [0, 12, 480, 90, 33, 210, 1500, 6, 75, 330][i % 10] * (i % 3 === 0 ? 1 : 2);
  return { linha: 6 + i, produto: n, valores: [base, base + 14, base - 9, base + 22, null], cmm, estoque };
});
const logistica = perfil => ({
  unidade: 'upa-centro', mesAberto: { ano: 2026, mes: 4, teste: false }, editavel: perfil !== 'admin',
  abas: [
    { nome: 'MEDICAMENTOS', meses: [0, 1, 2, 3, 4].map(m => ({ mes: m, rotulo: ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO'][m] })), itens },
    { nome: 'MATERIAIS', meses: [0, 1, 2, 3, 4].map(m => ({ mes: m, rotulo: ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO'][m] })), itens: itens.slice(0, 8).map(i => ({ ...i, produto: 'AGULHA HIPODERMICA 13 X 4,5 - ' + i.linha })) },
  ],
});
const usuarios = [
  { login: 'tereza', nome: 'Tereza Albuquerque', perfil: 'admin', unidade: '', ativo: true, trocarSenha: false },
  { login: 'ana.lima', nome: 'Ana Beatriz Lima', perfil: 'coordenador', unidade: 'upa-centro', ativo: true, trocarSenha: false },
  { login: 'carlos.souza', nome: 'Carlos Souza', perfil: 'coordenador', unidade: 'upa-jurema', ativo: true, trocarSenha: true },
  { login: 'maria.silva', nome: 'Maria da Silva', perfil: 'coordenador', unidade: 'upa-jurema', ativo: false, trocarSenha: false },
];

function responder(req, perfil) {
  switch (req.action) {
    case 'sessao': return sessao(perfil);
    case 'indicadores.carregar': return { sessao: sessao(perfil), unidade: perfil === 'admin' ? '' : 'upa-centro', lancamentos: perfil === 'admin' ? lancamentos : lancamentos.filter(l => l.unidade === 'upa-centro'), metas: METAS };
    case 'logistica.carregar': return { sessao: sessao(perfil), logistica: logistica(perfil) };
    case 'usuarios.carregar': return { sessao: sessao('admin'), usuarios };
    case 'painel.carregar': return painel(perfil);
    default: return null;
  }
}
function painel(perfil) {
  const centro = { id: 'upa-centro', nome: 'UPA Luiz Nerys (UPA Centro)', clinica: { lancado: true, por: 'ana.lima', em: '12/05/2026 10:12' }, saidas: { med: { preenchidos: 164, total: 169 }, mat: { preenchidos: 150, total: 156 }, por: 'ana.lima', em: '13/05/2026 16:40' } };
  const jurema = { id: 'upa-jurema', nome: 'UPA Jurema', clinica: { lancado: false }, saidas: null };
  return { sessao: sessao(perfil), mesAberto: { ano: 2026, mes: 4, teste: false }, unidades: perfil === 'admin' ? [centro, jurema] : [centro] };
}

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
