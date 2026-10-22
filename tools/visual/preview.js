// Prévia local do sistema com dados de exemplo, sem internet e sem Apps Script.
//   node tools/visual/preview.js   →   http://localhost:5510/preview.html
// Serve a pasta do projeto e responde à API em /api (o api.js é reescrito na hora; o arquivo do repositório não muda).
const http = require('http');
const fs = require('fs');
const path = require('path');
const { responder } = require('./mock');

const ROOT = path.resolve(__dirname, '..', '..');
const PORTA = Number(process.env.PORTA) || 5510;
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };

const PAGINA_ENTRADA = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Prévia · Indicadores da Farmácia</title>
<style>body{font:16px/1.5 Segoe UI,system-ui,sans-serif;max-width:520px;margin:48px auto;padding:0 20px;color:#2c3e50}
a{display:block;margin:10px 0;padding:14px 18px;border:1px solid #cdd9e5;border-radius:12px;text-decoration:none;color:#0a3d62;font-weight:700}
a small{display:block;font-weight:400;color:#64748b}</style>
<h1>Prévia com dados de exemplo</h1><p>Nada é gravado de verdade. Escolha com quem entrar:</p>
<a href="#" data-p="admin" data-t="light">Tereza (coordenação) · tema claro<small>vê todas as unidades</small></a>
<a href="#" data-p="coordenador" data-t="light">Coordenadora da UPA Centro · tema claro<small>vê só a própria unidade</small></a>
<a href="#" data-p="admin" data-t="dark">Tereza · tema escuro</a>
<a href="#" data-p="coordenador" data-t="dark">Coordenadora · tema escuro</a>
<script>document.querySelectorAll('a').forEach(a=>a.onclick=e=>{e.preventDefault();localStorage.setItem('farma_sessao',a.dataset.p);localStorage.setItem('farma_theme',a.dataset.t);location.href='index.html'})</script>`;

function api(corpo) {
  const req = JSON.parse(corpo || '{}');
  const perfil = ['admin', 'coordenador'].includes(req.token) ? req.token : null;
  if (req.action === 'login') return { ok: true, dados: { token: /tereza|admin/i.test(req.login) ? 'admin' : 'coordenador' } };
  if (!perfil) return { ok: false, erro: 'Sua sessão expirou. Entre novamente.', codigo: 'sessao' };
  const lido = responder(req, perfil);
  if (lido) return { ok: true, dados: lido };
  const gravacoes = {
    'lancamentos.salvar': { ano: 2026, mes: 4 },
    'logistica.salvar': { gravados: (req.itens || []).length },
    'metas.salvar': true, sair: true, trocarSenha: { token: perfil },
    'usuarios.criar': { login: req.login, nome: req.nome, unidade: req.unidade, senhaProvisoria: 'abc123xyz9' },
    'usuarios.redefinirSenha': { login: req.login, nome: 'Usuário', senhaProvisoria: 'nova456abc' },
    'usuarios.atualizar': true, 'usuarios.definirAtivo': true,
  };
  return req.action in gravacoes ? { ok: true, dados: gravacoes[req.action] } : { ok: false, erro: 'Ação não simulada na prévia: ' + req.action };
}

http.createServer((q, r) => {
  const url = decodeURIComponent(q.url.split('?')[0]);
  if (q.method === 'POST' && url === '/api') {
    let corpo = '';
    q.on('data', d => { corpo += d; });
    q.on('end', () => { r.writeHead(200, { 'Content-Type': 'application/json' }); r.end(JSON.stringify(api(corpo))); });
    return;
  }
  if (url === '/preview.html') { r.writeHead(200, { 'Content-Type': TIPOS['.html'] }); r.end(PAGINA_ENTRADA); return; }
  const f = path.join(ROOT, url === '/' ? 'index.html' : url);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end('não encontrado'); return; }
  r.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  if (url === '/js/api.js') r.end(fs.readFileSync(f, 'utf8').replace(/const API_URL = '[^']*';/, "const API_URL = '/api';"));
  else fs.createReadStream(f).pipe(r);
}).listen(PORTA, () => console.log('Prévia em http://localhost:' + PORTA + '/preview.html'));
