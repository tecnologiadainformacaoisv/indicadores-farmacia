// Testes do servidor (Apps Script) com Google Sheets, Drive e Cache simulados em memória.
// Rodar: node tests/api.test.js
// Teste de fluxo da API com Apps Script simulado em memória.
const fs = require('fs');
const vm = require('vm');
const crypto = require('crypto');
const codigo = require('path').resolve(__dirname, '..', 'appscript', 'codigo.js');

// ── fakes ──
function mkSheet(nome, g = []) {
  const sh = {
    g, nome,
    getName: () => nome,
    setName: n => { nome = n; sh.nome = n; return sh; },
    getLastRow: () => g.length,
    getLastColumn: () => Math.max(1, ...g.filter(Boolean).map(r => r.length)),
    getDataRange: () => sh.getRange(1, 1, Math.max(1, g.length), sh.getLastColumn()),
    setFrozenRows: () => {},
    insertColumnAfter: c1 => g.forEach(r => r && r.splice(c1, 0, '')),
    getRange: (r, c, nr = 1, nc = 1) => {
      if (typeof r === 'string') return { setNumberFormat: () => {} };
      const get = () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => { const v = (g[r - 1 + i] || [])[c - 1 + j]; return v === undefined ? '' : v; }));
      return {
        getValues: get,
        getDisplayValues: () => get().map(l => l.map(String)),
        getFormulas: () => get().map(l => l.map(v => (typeof v === "string" && v.startsWith("=")) ? v : "")),
        setValues: vals => { vals.forEach((l, i) => l.forEach((v, j) => { (g[r - 1 + i] = g[r - 1 + i] || [])[c - 1 + j] = v; })); return { setFontWeight: () => {} }; },
        setValue: v => { (g[r - 1] = g[r - 1] || [])[c - 1] = v; },
        copyTo: () => {},
        setNumberFormat: () => {},
      };
    },
    appendRow: row => g.push(row.slice()),
  };
  return sh;
}
function mkSS(id, sheets) {
  return {
    getId: () => id, getUrl: () => 'url:' + id,
    sheets,
    getSheets: () => sheets,
    getSheetByName: n => sheets.find(s => s.getName() === n) || null,
    insertSheet: n => { const s = mkSheet(n); sheets.push(s); return s; },
  };
}
const planilhas = {};
// planilha da unidade: modelo reduzido igual ao real
const upa = () => mkSS('upa', [
  mkSheet('MEDICAMENTOS', [
    ['TITULO'], ['', '', 'UPA CENTRO'], [],
    ['', 'PRODUTO', '', 'SAÍDAS', '', '', '', 'CMM', ' ESTOQUE DISP.'],
    ['', '', 'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO'],
    ['', 'DIPIRONA', 10, 20, 30, 40, 50, 25, 100],
    ['', 'CAPTOPRIL', 1, 2, 3, 4, 5, 3, 9],
  ]),
  mkSheet('MATERIAIS', [
    ['TITULO'], [], [],
    ['', 'PRODUTO', '', 'SAÍDAS'],
    ['', '', 'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'CMM', 'ESTOQUE DISP.'],
    ['', 'AGULHA', 100, 200, 300, 400, 500, 250, 1000],
  ]),
]);
planilhas['ID-CENTRO'] = upa();
planilhas['ID-JUREMA'] = upa();

const mkPasta = nome => ({ nome, pastas: [], arquivos: [],
  getFoldersByName(n) { const l = this.pastas.filter(p => p.nome === n); let i = 0; return { hasNext: () => i < l.length, next: () => l[i++] }; },
  createFolder(n) { const p = mkPasta(n); this.pastas.push(p); return p; },
  getFilesByName(n) { const l = this.arquivos.filter(a => a.nome === n && !a.lixo); let i = 0; return { hasNext: () => i < l.length, next: () => l[i++] }; },
  getFiles() { const l = this.arquivos.filter(a => !a.lixo); let i = 0; return { hasNext: () => i < l.length, next: () => l[i++] }; },
});
const drive = { raiz: mkPasta('raiz') };
const cacheMap = new Map();
const props = {};
let logs = [];
const ctx = {
  console,
  Logger: { log: m => logs.push(String(m)) },
  SpreadsheetApp: {
    create: n => { const s = mkSS('SIS', [mkSheet('Sheet1')]); planilhas.SIS = s; return s; },
    openById: id => { if (!planilhas[id]) throw new Error('not found ' + id); return planilhas[id]; },
    flush: () => {},
    CopyPasteType: { PASTE_FORMAT: 1 },
  },
  DriveApp: {
    getFileById: id => ({ moveTo: () => {}, makeCopy: (nome, pasta) => { pasta.arquivos.push({ nome, id, lixo: false, getName() { return this.nome; }, setTrashed(v) { this.lixo = v; } }); } }),
    getFolderById: () => drive.raiz,
  },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] || null, setProperty: (k, v) => { props[k] = v; } }) },
  CacheService: { getScriptCache: () => ({ get: k => cacheMap.has(k) ? cacheMap.get(k) : null, put: (k, v) => cacheMap.set(k, v), remove: k => cacheMap.delete(k) }) },
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
  ContentService: { createTextOutput: t => ({ setMimeType: () => t }), MimeType: { JSON: 'json' } },
  Utilities: {
    getUuid: () => crypto.randomUUID(),
    computeDigest: (alg, s) => [...crypto.createHash('sha256').update(s, 'utf8').digest()].map(b => b > 127 ? b - 256 : b),
    base64Encode: bytes => Buffer.from(bytes.map(b => b & 255)).toString('base64'),
    formatDate: (d, tz, f) => f === 'yyyy' ? String(d.getFullYear()) : f === 'M' ? String(d.getMonth() + 1) : f === 'yyyy-MM-dd' ? d.toISOString().slice(0, 10) : d.toISOString(),
    DigestAlgorithm: { SHA_256: 1 }, Charset: { UTF_8: 1 }, sleep: () => {},
  },
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(codigo, 'utf8') + ';this.backupDiario=backupDiario;this.recalcularFechamento=recalcularFechamento;this.doPost=doPost;this.configurarSistema=configurarSistema;this.criarUsuario=criarUsuario;', ctx);

const callBruto = (action, dados = {}, token) => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify({ action, token, ...dados }) } }));
const call = (action, dados = {}, token) => {
  const unidade = dados.unidade;
  const extrai = (r, campo) => (r.ok ? { ok: true, dados: r.dados[campo] } : r);
  if (action === 'lancamentos.listar') return extrai(callBruto('indicadores.carregar', { unidade }, token), 'lancamentos');
  if (action === 'metas.listar') return extrai(callBruto('indicadores.carregar', { unidade }, token), 'metas');
  if (action === 'logistica.ler') return extrai(callBruto('logistica.carregar', { unidade }, token), 'logistica');
  return callBruto(action, dados, token);
};
const R = () => { const [a, m] = String(planilhas.SIS.getSheetByName('Config').g[1][1]).split('-').map(Number); return { ano: a, mes: m - 1 }; };
let ok = 0, falhas = 0;
function check(nome, cond, extra) { if (cond) ok++; else { falhas++; console.log('FALHOU:', nome, extra !== undefined ? JSON.stringify(extra) : ''); } }

// ── setup ──
props.PASTA_ID = "PASTA";
ctx.configurarSistema();
const senhaTereza = logs.join('\n').match(/tereza · senha provisória: (\S+)/)[1];
const sis = planilhas.SIS.getSheetByName('Unidades');
sis.g[1][4] = 'ID-CENTRO'; sis.g[2][4] = 'ID-JUREMA';
ctx.criarUsuario('coord.centro', 'Ana', 'coordenador', 'upa-centro', 'provisoria1');
ctx.criarUsuario('coord.jurema', 'Bia', 'coordenador', 'upa-jurema', 'provisoria2');

// ── login ──
check('senha errada', call('login', { login: 'tereza', senha: 'x' }).ok === false);
let r = call('login', { login: 'TEREZA', senha: senhaTereza });
check('login tereza', r.ok, r);
const tT = r.dados.token;
r = call('sessao', {}, tT);
check('sessao tereza admin, 2 unidades, trocarSenha', r.ok && r.dados.usuario.perfil === 'admin' && r.dados.unidades.length === 2 && r.dados.usuario.trocarSenha, r);
check('mes aberto teste maio/2026', r.dados.mesAberto.ano === 2026 && r.dados.mesAberto.mes === 4 && r.dados.mesAberto.teste, r.dados.mesAberto);
check('sem token', call('sessao').codigo === 'sessao');

// ── coordenador ──
let tC = call('login', { login: 'coord.centro', senha: 'provisoria1' }).dados.token;
r = call('lancamentos.salvar', { ref: R(), unidade: 'upa-centro', dados: { admissoes: 10 } }, tC);
check('bloqueia lançar antes de trocar senha', !r.ok && r.codigo === 'senhaProvisoria', r);
check('troca senha curta', !call('trocarSenha', { senhaAtual: 'provisoria1', novaSenha: '123' }, tC).ok);
const tAntigo = tC;
r = call('lancamentos.listar', {}, tC);
check('senha provisória bloqueia leitura', !r.ok && r.codigo === 'senhaProvisoria', r);
r = call('trocarSenha', { senhaAtual: 'provisoria1', novaSenha: 'senhaNova123' }, tC);
check('troca senha devolve token novo', r.ok && r.dados.token && r.dados.token !== tAntigo, r);
check('token antigo cai após troca', call('sessao', {}, tAntigo).codigo === 'sessao');
check('token novo vale', call('sessao', {}, r.dados.token).ok);
check('login com senha antiga falha', !call('login', { login: 'coord.centro', senha: 'provisoria1' }).ok);
tC = call('login', { login: 'coord.centro', senha: 'senhaNova123' }).dados.token;
r = call('sessao', {}, tC);
check('coord vê só a sua unidade', r.dados.unidades.length === 1 && r.dados.unidades[0].id === 'upa-centro', r.dados.unidades);

r = call('lancamentos.salvar', { ref: R(), unidade: 'upa-centro', dados: { admissoes: 10, conciliacoes: 12 } }, tC);
check('valida numerador > denominador', !r.ok && /Conciliações/.test(r.erro), r);
r = call('lancamentos.salvar', { ref: R(), unidade: 'upa-centro', dados: { admissoes: 10, conciliacoes: -1 } }, tC);
check('valida negativo', !r.ok, r);
r = call('lancamentos.salvar', { ref: R(), unidade: 'upa-centro', dados: { admissoes: 10, conciliacoes: 8, prm: null } }, tC);
check('salva lançamento', r.ok && r.dados.mes === 4, r);
r = call('lancamentos.salvar', { ref: R(), unidade: 'upa-centro', dados: { admissoes: 20, conciliacoes: 18 } }, tC);
check('regrava mesmo mês (upsert)', r.ok);
r = call('lancamentos.listar', { unidade: '' }, tC);
check('lista 1 lançamento atualizado', r.ok && r.dados.length === 1 && r.dados[0].admissoes === 20 && r.dados[0].prm === null, r.dados);
r = call('lancamentos.salvar', { ref: R(), unidade: 'upa-jurema', dados: { admissoes: 1 } }, tC);
check('coord não lança em outra unidade', !r.ok && r.codigo === 'permissao', r);
r = call('lancamentos.listar', { unidade: 'upa-jurema' }, tC);
check('coord não lê outra unidade', !r.ok && r.codigo === 'permissao', r);

// novas regras
r = call('lancamentos.salvar', { ref: { ano: 2026, mes: 3 }, unidade: 'upa-centro', dados: { admissoes: 5 } }, tC);
check('recusa mês diferente do aberto', !r.ok && /mudou/.test(r.erro), r);
r = call('lancamentos.salvar', { unidade: 'upa-centro', dados: { admissoes: 5 } }, tC);
check('recusa sem ref', !r.ok && /mudou/.test(r.erro), r);
r = call('lancamentos.salvar', { ref: R(), unidade: 'upa-centro', dados: {} }, tC);
check('recusa formulário vazio', !r.ok && /pelo menos um campo/.test(r.erro), r);
r = call('lancamentos.salvar', { ref: R(), unidade: 'upa-centro', dados: { entregas: 10, emergenciais: 11 } }, tC);
check('emergenciais maior que entregas', !r.ok && /emergenciais/i.test(r.erro), r);
check('ação herdada do protótipo', call('constructor', {}, tC).ok === false);

// ── metas ──
r = call('metas.salvar', { unidade: 'upa-centro', metas: { prm: 3 } }, tC);
check('coord não altera metas', !r.ok && r.codigo === 'permissao');
r = call('metas.salvar', { unidade: 'upa-centro', metas: { prm: 3 } }, tT);
check('admin com senha provisória não altera metas', !r.ok && r.codigo === 'senhaProvisoria', r);
const tT2 = call('trocarSenha', { senhaAtual: senhaTereza, novaSenha: 'terezaSenha1' }, tT).dados.token;
r = call('metas.salvar', { unidade: 'upa-centro', metas: { prm: 3, conciliacoes: 150 } }, tT2);
check('valida meta > 100', !r.ok, r);
r = call('metas.salvar', { unidade: 'upa-centro', metas: { prm: 3 } }, tT2);
check('tereza altera meta', r.ok, r);
r = call('metas.listar', { unidade: 'upa-centro' }, tC);
check('coordenador não recebe metas (só a coordenação vê metas e alertas)', r.ok && Object.keys(r.dados).length === 0, r.dados);
r = call('metas.listar', { unidade: 'upa-centro' }, tT2);
check('Tereza vê a meta nova da unidade', r.ok && r.dados.prm.val === 3 && r.dados.conciliacoes.val === 80, r.dados.prm);
r = call('metas.listar', { unidade: 'upa-jurema' }, tT2);
check('outra unidade mantém padrão', r.dados.prm.val === 5);
r = call('lancamentos.salvar', { ref: R(), unidade: 'upa-centro', dados: { admissoes: 1 } }, tT2);
check('tereza não lança', !r.ok && r.codigo === 'permissao', r);

// ── logística ──
r = call('logistica.ler', { unidade: 'upa-centro' }, tC);
check('lê planilha', r.ok && r.dados.editavel && r.dados.abas.length === 2, r);
const med = r.dados.abas[0];
check('itens e valores', med.itens.length === 2 && med.itens[0].produto === 'DIPIRONA' && med.itens[0].valores[4] === 50 && med.itens[0].cmm === 25 && med.itens[0].estoque === 100, med.itens[0]);
r = call('logistica.salvar', { ref: R(), unidade: 'upa-centro', aba: 'MEDICAMENTOS', itens: [{ linha: 6, produto: 'DIPIRONA', saida: 77, estoque: 90 }] }, tC);
check('salva item', r.ok && r.dados.gravados === 1, r);
const g = planilhas['ID-CENTRO'].getSheetByName('MEDICAMENTOS').g;
check('gravou na coluna MAIO e estoque; CMM recalculado (trimestral: mar a mai)', g[5][6] === 77 && g[5][8] === 90 && g[5][7] === 49, g[5]);
r = call('logistica.salvar', { ref: R(), unidade: 'upa-centro', aba: 'MEDICAMENTOS', itens: [{ linha: 6, produto: 'DIPIRONA', saida: 77, cmm: 999 }] }, tC);
check('CMM enviado pelo cliente é ignorado (o servidor calcula)', r.ok && g[5][7] === 49, g[5]);
r = call('logistica.salvar', { ref: R(), unidade: 'upa-centro', aba: 'MEDICAMENTOS', itens: [{ linha: 6, produto: 'OUTRO', saida: 1 }] }, tC);
check('protege contra linha trocada', !r.ok, r);
r = call('logistica.salvar', { ref: R(), unidade: 'upa-centro', aba: 'MEDICAMENTOS', itens: [{ linha: 2, produto: 'UPA CENTRO', saida: 1 }] }, tC);
check('não grava em linha de cabeçalho', !r.ok, r);
{
  const gs = planilhas['ID-CENTRO'].getSheetByName('MEDICAMENTOS').g;
  const antes = [gs[5][7], gs[5][8]];
  gs[5][7] = '*'; gs[5][8] = ' ';
  const lido = call('logistica.ler', { unidade: 'upa-centro' }, tT2).dados.abas.find(x => x.nome === 'MEDICAMENTOS').itens[0];
  check('"*" e célula em branco na planilha viram sem dados (null)', lido.cmm === null && lido.estoque === null, lido);
  gs[5][7] = antes[0]; gs[5][8] = antes[1];
}
{
  // "*" na coluna de saída = item sem saída: vale zero e entra no CMM trimestral
  const gs = planilhas['ID-CENTRO'].getSheetByName('MEDICAMENTOS').g;
  const ant = gs[5][5];
  gs[5][5] = '*';
  const lido = call('logistica.ler', { unidade: 'upa-centro' }, tT2).dados.abas.find(x => x.nome === 'MEDICAMENTOS').itens[0];
  check('"*" na saída vira zero (e não "sem dado")', lido.valores[3] === 0, lido.valores);
  r = call('logistica.salvar', { ref: R(), unidade: 'upa-centro', aba: 'MEDICAMENTOS', itens: [{ linha: 6, produto: 'DIPIRONA', saida: 60 }] }, tC);
  check('CMM trimestral conta o "*" como zero (mar 30, abr 0, mai 60 = 30)', r.ok && gs[5][7] === 30, gs[5]);
  gs[5][5] = ant;
}
r = call('logistica.ler', { unidade: 'upa-jurema' }, tT2);
check('tereza lê outra unidade sem editar', r.ok && r.dados.editavel === false);
r = call('logistica.salvar', { ref: R(), unidade: 'upa-centro', aba: 'MEDICAMENTOS', itens: [{ linha: 6, produto: 'DIPIRONA', saida: 1 }] }, tT2);
check('tereza não grava planilha', !r.ok);

// mês aberto em junho: cria coluna
planilhas.SIS.getSheetByName('Config').g[1][1] = '2026-06';
r = call('logistica.salvar', { ref: R(), unidade: 'upa-centro', aba: 'MATERIAIS', itens: [{ linha: 6, produto: 'AGULHA', saida: 600 }] }, tC);
const gm = planilhas['ID-CENTRO'].getSheetByName('MATERIAIS').g;
check('cria coluna JUNHO antes do CMM e grava', r.ok && gm[4][7] === 'JUNHO' && gm[5][7] === 600 && gm[4][8] === 'CMM' && gm[5][8] === 500, gm[4].concat(gm[5]));

// fórmula na célula: estoque com fórmula é recusado; CMM com fórmula não é tocado (o salvamento segue)
const gMed = planilhas['ID-CENTRO'].getSheetByName('MEDICAMENTOS').g;
call('logistica.salvar', { ref: R(), unidade: 'upa-centro', aba: 'MEDICAMENTOS', itens: [{ linha: 7, produto: 'CAPTOPRIL', saida: 4 }] }, tC);   // cria a coluna de junho antes de pôr as fórmulas
gMed[6][9] = '=MEDIA(C7:G7)';
r = call('logistica.salvar', { ref: R(), unidade: 'upa-centro', aba: 'MEDICAMENTOS', itens: [{ linha: 7, produto: 'CAPTOPRIL', estoque: 9 }] }, tC);
check('recusa sobrescrever fórmula', !r.ok && /rmula/.test(r.erro) && gMed[6][9] === '=MEDIA(C7:G7)', r);
gMed[6][9] = 9; gMed[6][8] = '=MEDIA(C7:F7)';
r = call('logistica.salvar', { ref: R(), unidade: 'upa-centro', aba: 'MEDICAMENTOS', itens: [{ linha: 7, produto: 'CAPTOPRIL', saida: 5 }] }, tC);
check('CMM com fórmula na planilha não é sobrescrito pelo cálculo', r.ok && gMed[6][8] === '=MEDIA(C7:F7)', gMed[6]);
// meses pulados: aberto em agosto com planilha até junho cria julho e agosto
planilhas.SIS.getSheetByName('Config').g[1][1] = '2026-08';
r = call('logistica.salvar', { ref: R(), unidade: 'upa-centro', aba: 'MATERIAIS', itens: [{ linha: 6, produto: 'AGULHA', saida: 800 }] }, tC);
check('cria meses intermediários', r.ok && gm[4][8] === 'JULHO' && gm[4][9] === 'AGOSTO' && gm[5][9] === 800 && gm[4][10] === 'CMM', gm[4]);
// erro inesperado não vaza detalhe
ctx.ROTAS_TESTE = true;

// gravação em trechos contíguos: 2 itens vizinhos = 1 chamada por coluna (saída e estoque)
planilhas.SIS.getSheetByName('Config').g[1][1] = '2026-05';
const shM = planilhas['ID-CENTRO'].getSheetByName('MEDICAMENTOS');
shM.g[6][7] = 3; shM.g[6][8] = 9;
const grOrig = shM.getRange; const chamadas = [];
shM.getRange = (a, b, c, d) => { const o = grOrig(a, b, c, d); const sv = o.setValues; if (sv) o.setValues = v => { chamadas.push([a, b, c]); return sv(v); }; return o; };
r = call('logistica.salvar', { ref: R(), unidade: 'upa-centro', aba: 'MEDICAMENTOS', itens: [{ linha: 6, produto: 'DIPIRONA', saida: 1, estoque: 2 }, { linha: 7, produto: 'CAPTOPRIL', saida: 3, estoque: 4 }] }, tC);
check('grava 2 itens vizinhos em 1 bloco por coluna (saída, estoque e CMM)', r.ok && chamadas.length === 3 && chamadas.every(c => c[2] === 2), { r, chamadas });
check('valores corretos nos dois itens', shM.g[5][6] === 1 && shM.g[6][6] === 3 && shM.g[5][9] === 2 && shM.g[6][9] === 4 && shM.g[5][8] === 24, [shM.g[5], shM.g[6]]);
shM.getRange = grOrig;
// gravação em trechos contíguos: itens 6 e 7 juntos, sem tocar na célula de fórmula do CMM
planilhas.SIS.getSheetByName('Config').g[1][1] = '2026-05';
const gm5 = planilhas['ID-JUREMA'].getSheetByName('MEDICAMENTOS').g;
gm5[6][8] = 9; gm5[6][7] = 3;
let tJ = call('login', { login: 'coord.jurema', senha: 'provisoria2' }).dados;
check('login jurema (antes do bloqueio)', !!tJ);
// cargas completas de tela (uma chamada = sessão + dados)
planilhas.SIS.getSheetByName('Config').g[1][1] = '2026-05';
r = call('indicadores.carregar', {}, tC);
check('indicadores.carregar do coordenador', r.ok && r.dados.unidade === 'upa-centro' && r.dados.sessao.usuario.login === 'coord.centro' && Array.isArray(r.dados.lancamentos) && Object.keys(r.dados.metas).length === 0, r);
r = call('indicadores.carregar', { unidade: '' }, tC);
check('coordenador pedindo todas continua na sua unidade', r.ok && r.dados.unidade === 'upa-centro' && Object.keys(r.dados.metas).length === 0, r.dados && r.dados.unidade);
r = call('indicadores.carregar', { unidade: 'upa-jurema' }, tC);
check('coordenador não carrega outra unidade', !r.ok && r.codigo === 'permissao', r);
r = call('indicadores.carregar', {}, tT2);
check('admin: padrão é todas', r.ok && r.dados.unidade === '' && r.dados.sessao.unidades.length === 2, r.dados && r.dados.unidade);
r = call('indicadores.carregar', { unidade: 'upa-jurema' }, tT2);
check('admin escolhe uma unidade', r.ok && r.dados.unidade === 'upa-jurema' && r.dados.metas.prm.val === 5, r);
r = call('dashboard.carregar', {}, tT2);
check('dashboard.carregar do admin: lançamentos de todas as unidades e metas de cada uma', r.ok && Array.isArray(r.dados.lancamentos) && r.dados.sessao.unidades.length === 2 && r.dados.metas['upa-centro'].prm.val === 3 && r.dados.metas['upa-jurema'].prm.val === 5 && r.dados.metas['upa-jurema'].conciliacoes.dir === 'min', r);
r = call('dashboard.carregar', {}, tC);
check('dashboard.carregar recusa coordenador', !r.ok && r.codigo === 'permissao', r);
r = call('logistica.carregar', {}, tC);
check('logistica.carregar do coordenador', r.ok && r.dados.logistica.unidade === 'upa-centro' && r.dados.logistica.editavel && r.dados.logistica.abas.length === 2 && r.dados.sessao.mesAberto.mes === 4, r);
r = call('logistica.carregar', {}, tT2);
check('logistica.carregar do admin: primeira unidade, só leitura', r.ok && r.dados.logistica.unidade === 'upa-centro' && r.dados.logistica.editavel === false, r);
r = call('logistica.carregar', { unidade: 'upa-jurema' }, tC);
check('coordenador não carrega logística de outra unidade', !r.ok && r.codigo === 'permissao', r);

// ── usuários (tela da coordenação) ──
planilhas.SIS.getSheetByName('Config').g[1][1] = '2026-05';
r = call('usuarios.carregar', {}, tC);
check('coordenador não vê usuários', !r.ok && r.codigo === 'permissao', r);
r = call('usuarios.criar', { login: 'x.y', nome: 'X', unidade: 'upa-centro' }, tC);
check('coordenador não cria usuário', !r.ok && r.codigo === 'permissao', r);
r = call('usuarios.carregar', {}, tT2);
check('admin lista usuários sem segredos', r.ok && r.dados.usuarios.length >= 3 && !JSON.stringify(r.dados).match(/salt|hash/i), r.dados && r.dados.usuarios);
r = call('usuarios.criar', { login: 'Maria Silva', nome: 'Maria', unidade: 'upa-centro' }, tT2);
check('login inválido recusado', !r.ok && /3 a 30/.test(r.erro), r);
r = call('usuarios.criar', { login: 'maria.s', nome: '=1+1', unidade: 'upa-centro' }, tT2);
check('nome que viraria fórmula recusado', !r.ok && /começar com/.test(r.erro), r);
r = call('usuarios.criar', { login: 'maria.s', nome: 'Maria', unidade: 'nao-existe' }, tT2);
check('unidade inexistente recusada', !r.ok && /unidade válida/.test(r.erro), r);
r = call('usuarios.criar', { login: 'maria.s', nome: '  Maria   da  Silva ', unidade: 'upa-jurema' }, tT2);
check('admin cria coordenador', r.ok && r.dados.login === 'maria.s' && r.dados.nome === 'Maria da Silva' && r.dados.senhaProvisoria.length === 10, r);
const senhaMaria = r.dados.senhaProvisoria;
r = call('usuarios.criar', { login: 'MARIA.S', nome: 'Outra', unidade: 'upa-jurema' }, tT2);
check('login duplicado recusado', !r.ok && /Já existe/.test(r.erro), r);
r = call('login', { login: 'maria.s', senha: senhaMaria });
check('novo coordenador entra com a senha provisória', r.ok, r);
let tMaria = r.dados.token;
r = call('sessao', {}, tMaria);
check('entra como coordenador da unidade certa, com troca pendente', r.ok && r.dados.usuario.perfil === 'coordenador' && r.dados.usuario.unidade === 'upa-jurema' && r.dados.usuario.trocarSenha, r);
r = call('usuarios.atualizar', { login: 'maria.s', nome: 'Maria S.', unidade: 'upa-centro' }, tT2);
check('admin atualiza nome e unidade', r.ok, r);
r = call('sessao', {}, tMaria);
check('atualização vale na próxima requisição', r.ok && r.dados.usuario.nome === 'Maria S.' && r.dados.usuario.unidade === 'upa-centro', r);
r = call('usuarios.redefinirSenha', { login: 'maria.s' }, tT2);
check('admin redefine a senha', r.ok && r.dados.senhaProvisoria && r.dados.senhaProvisoria !== senhaMaria, r);
const senhaNova = r.dados.senhaProvisoria;
check('redefinir derruba a sessão aberta', call('sessao', {}, tMaria).codigo === 'sessao');
check('senha antiga não vale mais', !call('login', { login: 'maria.s', senha: senhaMaria }).ok);
check('senha nova vale', call('login', { login: 'maria.s', senha: senhaNova }).ok);
r = call('usuarios.definirAtivo', { login: 'maria.s', ativo: false }, tT2);
check('admin desativa', r.ok, r);
check('desativado não entra', !call('login', { login: 'maria.s', senha: senhaNova }).ok);
r = call('usuarios.carregar', {}, tT2);
check('lista mostra inativo', r.dados.usuarios.find(x => x.login === 'maria.s').ativo === false);
r = call('usuarios.definirAtivo', { login: 'maria.s', ativo: true }, tT2);
check('admin reativa', r.ok && call('login', { login: 'maria.s', senha: senhaNova }).ok, r);
r = call('usuarios.redefinirSenha', { login: 'tereza' }, tT2);
check('conta da coordenação não é alterada pela tela', !r.ok && r.codigo === 'permissao', r);
r = call('usuarios.definirAtivo', { login: 'tereza', ativo: false }, tT2);
check('coordenação não se desativa pela tela', !r.ok && r.codigo === 'permissao', r);
r = call('usuarios.redefinirSenha', { login: 'fantasma' }, tT2);
check('usuário inexistente', !r.ok && /não encontrado/.test(r.erro), r);

// ── backup ──
ctx.backupDiario();
const bkp = drive.raiz.pastas.find(p => p.nome === 'Backup');
check('backup cria a pasta Backup', !!bkp);
check('backup copia Sistema e as duas unidades', bkp && bkp.arquivos.length === 3 && bkp.arquivos.some(a => /^Sistema — [0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(a.nome)) && bkp.arquivos.some(a => /^Saídas upa-centro — /.test(a.nome)), bkp && bkp.arquivos.map(a => a.nome));
ctx.backupDiario();
check('backup no mesmo dia não duplica', bkp.arquivos.length === 3, bkp.arquivos.map(a => a.nome));
const velho = new Date(Date.now() - 45 * 86400000).toISOString().slice(0, 10);
bkp.arquivos.push({ nome: 'Sistema — ' + velho, lixo: false, getName() { return this.nome; }, setTrashed(v) { this.lixo = v; } });
bkp.arquivos.push({ nome: 'Anotações da Tereza', lixo: false, getName() { return this.nome; }, setTrashed(v) { this.lixo = v; } });
ctx.backupDiario();
check('backup apaga só cópia antiga com o padrão de nome', bkp.arquivos.find(a => a.nome === 'Sistema — ' + velho).lixo === true && bkp.arquivos.find(a => a.nome === 'Anotações da Tereza').lixo === false && bkp.arquivos.filter(a => a.lixo).length === 1, bkp.arquivos.map(a => [a.nome, a.lixo]));

// rotas antigas removidas e limites novos
check('rota antiga removida', callBruto('logistica.ler', { unidade: 'upa-centro' }, tC).ok === false && /desconhecida/.test(callBruto('logistica.ler', {}, tC).erro));
check('login com texto enorme não derruba o servidor', /incorretos/.test(callBruto('login', { login: 'a'.repeat(500), senha: 'x' }).erro));
// ── painel do fechamento ──
planilhas.SIS.getSheetByName('Config').g[1][1] = '2026-05';
r = call('painel.carregar', {}, tC);
check('painel do coordenador: só a unidade dele', r.ok && r.dados.unidades.length === 1 && r.dados.unidades[0].id === 'upa-centro' && r.dados.mesAberto.mes === 4, r);
check('painel: clínica lançada aparece com quem e quando', r.ok && r.dados.unidades[0].clinica.lancado === true && r.dados.unidades[0].clinica.por === 'coord.centro' && !!r.dados.unidades[0].clinica.em, r.dados && r.dados.unidades[0].clinica);
check('painel: saídas com contagem (a planilha de teste tem 2 itens com saída no mês)', r.ok && r.dados.unidades[0].saidas && r.dados.unidades[0].saidas.med.total === 2 && r.dados.unidades[0].saidas.med.preenchidos === 2, r.dados && r.dados.unidades[0].saidas);
r = call('painel.carregar', {}, tT2);
check('painel da coordenação: todas as unidades', r.ok && r.dados.unidades.length === 2, r);
check('painel: unidade sem lançamento aparece pendente', r.dados.unidades.find(u => u.id === 'upa-jurema').clinica.lancado === false && r.dados.unidades.find(u => u.id === 'upa-jurema').saidas === null, r.dados.unidades);
// senha provisória: o painel só devolve a sessão, sem dados de unidades
ctx.criarUsuario('provisorio', 'Prov', 'coordenador', 'upa-centro', 'provisoria3');
const tProv = callBruto('login', { login: 'provisorio', senha: 'provisoria3' }).dados.token;
r = callBruto('painel.carregar', {}, tProv);
check('painel com senha provisória: só a sessão, sem unidades', r.ok && r.dados.sessao.usuario.trocarSenha === true && r.dados.unidades.length === 0, r);
r = callBruto('indicadores.carregar', {}, tProv);
check('demais rotas continuam bloqueadas com senha provisória', !r.ok && r.codigo === 'senhaProvisoria', r);

// força bruta
for (let i = 0; i < 5; i++) call('login', { login: 'coord.jurema', senha: 'errada' });
r = call('login', { login: 'coord.jurema', senha: 'provisoria2' });
check('bloqueio após 5 tentativas', !r.ok && /tentativas/.test(r.erro), r);

check('log registrou ações', planilhas.SIS.getSheetByName('Log').g.length > 5);
console.log(`\n${ok} ok, ${falhas} falha(s)`);
