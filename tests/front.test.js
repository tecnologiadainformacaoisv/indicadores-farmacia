// Testes de fumaça das telas com DOM, fetch e localStorage simulados.
// Rodar: node tests/front.test.js
// Teste de fumaça das telas: DOM de mentira + fetch simulado + localStorage compartilhado entre "visitas".
const fs = require('fs');
const vm = require('vm');
const root = require('path').resolve(__dirname, '..', 'js') + '/';

const METAS = {};
['conciliacoes', 'prescricoes', 'prm', 'intervencoes', 'altas', 'desabastecimento', 'perdas', 'nconformidades', 'estoque', 'emergenciais']
  .forEach(k => { METAS[k] = { val: 50, dir: 'min', label: k }; });
const sessao = (perfil) => ({
  usuario: { login: perfil === 'admin' ? 'tereza' : 'coord.centro', nome: 'Fulana', perfil, unidade: perfil === 'admin' ? '' : 'upa-centro', trocarSenha: false },
  unidades: [{ id: 'upa-centro', nome: 'UPA Centro', municipio: 'Caucaia', modelo: 'UPA' }, { id: 'upa-jurema', nome: 'UPA Jurema', municipio: 'Caucaia', modelo: 'UPA' }]
    .filter(u => perfil === 'admin' || u.id === 'upa-centro'),
  mesAberto: { ano: 2026, mes: 4, teste: true },
});
const lanc = { unidade: 'upa-centro', ano: 2026, mes: 4, lancadoPor: 'coord.centro', lancadoEm: '21/10/2026 10:00', admissoes: 10, conciliacoes: 8 };
['presc-atend', 'presc-anal', 'prm', 'interv-total', 'interv-aceitas', 'altas-total', 'altas-real', 'itens-pad', 'itens-falta', 'itens-venc', 'entregas', 'nc', 'auditados', 'conformes', 'emergenciais'].forEach(c => { lanc[c] = null; });

const usuariosSim = [{ login: 'tereza', nome: 'Tereza', perfil: 'admin', unidade: '', ativo: true, trocarSenha: false }, { login: 'ana.c', nome: 'Ana', perfil: 'coordenador', unidade: 'upa-centro', ativo: true, trocarSenha: true }];
const estadoItem = { valores: [40, 50], cmm: 25, estoque: 100 }; // planilha simulada: guarda o que é salvo
function respostaServidor(body, perfil) {
  const req = JSON.parse(body);
  switch (req.action) {
    case 'sessao': return sessao(perfil);
    case 'indicadores.carregar': return { sessao: sessao(perfil), unidade: req.unidade === undefined ? (perfil === 'admin' ? '' : 'upa-centro') : req.unidade, lancamentos: [lanc], metas: METAS };
    case 'logistica.carregar': return {
      sessao: sessao(perfil),
      logistica: {
        unidade: req.unidade || 'upa-centro', mesAberto: { ano: 2026, mes: 4, teste: true }, editavel: perfil !== 'admin',
        abas: [{ nome: 'MEDICAMENTOS', meses: [{ mes: 3, rotulo: 'ABRIL' }, { mes: 4, rotulo: 'MAIO' }], itens: [{ linha: 6, produto: 'DIPIRONA', valores: estadoItem.valores.slice(), cmm: estadoItem.cmm, estoque: estadoItem.estoque }] }],
      },
    };
    case 'painel.carregar': return {
      sessao: sessao(perfil), mesAberto: { ano: 2026, mes: 4, teste: false },
      unidades: [{ id: 'upa-centro', nome: 'UPA Centro', clinica: { lancado: true, por: 'ana.c', em: '12/05/2026 10:12' }, saidas: { med: { preenchidos: 5, total: 10 }, mat: { preenchidos: 0, total: 4 }, por: 'ana.c', em: '13/05/2026 09:00' } },
        ...(perfil === 'admin' ? [{ id: 'upa-jurema', nome: 'UPA Jurema', clinica: { lancado: false }, saidas: null }] : [])],
    };
    case 'usuarios.carregar': return { sessao: sessao('admin'), usuarios: usuariosSim.map(u => ({ ...u })) };
    case 'usuarios.criar': usuariosSim.push({ login: req.login, nome: req.nome, perfil: 'coordenador', unidade: req.unidade, ativo: true, trocarSenha: true }); return { login: req.login, nome: req.nome, unidade: req.unidade, senhaProvisoria: 'abc123xyz9' };
    case 'usuarios.redefinirSenha': return { login: req.login, nome: 'Alguém', senhaProvisoria: 'nova456abc' };
    case 'usuarios.definirAtivo': usuariosSim.find(u => u.login === req.login).ativo = req.ativo; return true;
    case 'usuarios.atualizar': Object.assign(usuariosSim.find(u => u.login === req.login), { nome: req.nome, unidade: req.unidade }); return true;
    case 'logistica.salvar': req.itens.forEach(i => { if (i.saida !== undefined) estadoItem.valores[1] = i.saida; if (i.cmm !== undefined) estadoItem.cmm = i.cmm; if (i.estoque !== undefined) estadoItem.estoque = i.estoque; }); return { gravados: req.itens.length };
    default: throw new Error('ação não simulada: ' + req.action);
  }
}

function elemento() {
  const ouvintes = {};
  const base = { options: [], __ouvintes: ouvintes, dataset: {}, style: { setProperty() {} }, hidden: false, innerHTML: '', textContent: '', value: '', className: '', scrollTop: 0, labels: [] };
  const lista = new Set();
  base.classList = { add: c => lista.add(c), remove: c => lista.delete(c), toggle: (c, on) => (on === undefined ? (lista.has(c) ? lista.delete(c) : lista.add(c)) : (on ? lista.add(c) : lista.delete(c))), contains: c => lista.has(c) };
  return new Proxy(base, {
    get(t, p) {
      if (p in t) return t[p];
      if (typeof p === 'symbol') return undefined;
      if (['querySelectorAll'].includes(p)) return () => [];
      if (p === 'addEventListener') return (tipo, fn) => { ouvintes[tipo] = fn; };
      if (['reset', 'setAttribute', 'removeAttribute', 'scrollIntoView', 'focus', 'select', 'prepend', 'after', 'appendChild', 'remove', 'scrollTo'].includes(p)) return () => {};
      if (['querySelector', 'closest'].includes(p)) return () => elemento();
      return undefined;
    },
    set(t, p, v) { t[p] = v; return true; },
  });
}

const semSS = new Map();
function visita(script, armazenamento, perfil, opcoes = {}) {
  const els = {};
  const chamadas = [];
  const ctx = {
    console, setTimeout: (fn) => { try { fn(); } catch (e) { erros.push('timeout: ' + e.message); } }, clearTimeout() {}, Promise, JSON, Date, Math, Object, Array, Number, String, Map, Set, Error, isFinite, parseInt,
    localStorage: { getItem: k => armazenamento.has(k) ? armazenamento.get(k) : null, setItem: (k, v) => armazenamento.set(k, String(v)), removeItem: k => armazenamento.delete(k), get length() { return armazenamento.size; } },
    sessionStorage: { getItem: k => (opcoes.ss || semSS).has(k) ? (opcoes.ss || semSS).get(k) : null, setItem: (k, v) => (opcoes.ss || semSS).set(k, String(v)), removeItem: k => (opcoes.ss || semSS).delete(k) },
    location: { href: '', search: '' }, URLSearchParams,
    confirm: () => true,
    matchMedia: () => ({ matches: true }),
    themeVar: () => '#888888',
    Chart: class { constructor(el, cfg) { this.canvas = el; this.data = cfg.data; this.options = cfg.options; } destroy() {} update() {} },
    fetch: async (url, init) => {
      chamadas.push(JSON.parse(init.body).action);
      if (opcoes.falhaRede) throw new TypeError('Failed to fetch');
      const dados = respostaServidor(init.body, perfil);
      return { json: async () => ({ ok: true, dados }) };
    },
    document: {
      getElementById: id => els[id] || (els[id] = elemento()),
      querySelector: () => elemento(), querySelectorAll: () => [], addEventListener() {}, createElement: () => elemento(),
      activeElement: elemento(), body: elemento(),
    },
    window: { matchMedia: () => ({ matches: true }), addEventListener() {}, removeEventListener() {}, getSelection: () => ({ removeAllRanges() {}, addRange() {} }), scrollY: 0, scrollTo() {} }, addEventListener() {}, scrollTo() {},
  };
  // Object.keys(localStorage) precisa enxergar as chaves guardadas
  ctx.localStorage = new Proxy(ctx.localStorage, { ownKeys: () => [...armazenamento.keys()], getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }) });
  vm.createContext(ctx);
  const erros = [];
  const codigo = ['api.js', script].map(f => fs.readFileSync(root + f, 'utf8')).join('\n');
  try { vm.runInContext(codigo, ctx); } catch (e) { erros.push('carga: ' + e.stack.split('\n').slice(0, 3).join(' | ')); }
  return { ctx, els, chamadas, erros };
}

const pausa = ms => new Promise(r => setTimeout(r, ms));
let ok = 0, falhas = 0;
const check = (nome, c, extra) => { if (c) ok++; else { falhas++; console.log('FALHOU:', nome, extra !== undefined ? JSON.stringify(extra) : ''); } };

(async () => {
  for (const [tela, script] of [['indicadores', 'indicadores.js'], ['logistica', 'logistica.js']]) {
    const prefixo = tela === 'indicadores' ? 'farma_cache_ind:' : 'farma_cache_log:';
    for (const perfil of ['coordenador', 'admin']) {
      const arm = new Map([['farma_sessao', 'TOKEN1']]);
      // 1ª visita: sem cache
      let v = visita(script, arm, perfil);
      await pausa(80);
      check(`${tela}/${perfil}: 1ª visita sem erro de execução`, v.erros.length === 0, v.erros);
      check(`${tela}/${perfil}: 1ª visita fez uma chamada só`, v.chamadas.length === 1 && v.chamadas[0] === (tela === 'indicadores' ? 'indicadores.carregar' : 'logistica.carregar'), v.chamadas);
      const chavesCache = [...arm.keys()].filter(k => k.startsWith(prefixo));
      check(`${tela}/${perfil}: guardou cache`, chavesCache.length >= 1, [...arm.keys()]);
      const statusId = tela === 'indicadores' ? 'page-status' : 'log-status';
      check(`${tela}/${perfil}: sem mensagem de erro`, !/erro/.test(v.els[statusId].className), v.els[statusId].textContent);
      // 2ª visita: com cache (e servidor fora do ar → deve mostrar o cache e avisar)
      v = visita(script, arm, perfil, { falhaRede: true });
      await pausa(300);
      check(`${tela}/${perfil}: 2ª visita sem erro de execução`, v.erros.length === 0, v.erros);
      const msgStatus = v.els[statusId].textContent;
      check(`${tela}/${perfil}: sem rede, mostra dados da última visita`, /última visita/.test(msgStatus), msgStatus);
      // cache de outro login não vale
      const arm2 = new Map(arm); arm2.set('farma_sessao', 'TOKEN2');
      v = visita(script, arm2, perfil);
      await pausa(80);
      check(`${tela}/${perfil}: cache de outra sessão é ignorado (chamou o servidor antes de exibir)`, v.chamadas.length === 1 && !/Atualizando/.test(v.els[statusId].textContent || ''), v.els[statusId].textContent);
    }
  }
  // salvar na planilha de saídas: a tabela não pode sumir nem voltar para "Carregando"
  {
    const arm = new Map([['farma_sessao', 'TOKEN1']]);
    const v = visita('logistica.js', arm, 'coordenador');
    await pausa(80);
    const esconderam = [];
    const wrap = v.els['log-wrap'];
    let escondida = false;
    Object.defineProperty(wrap, 'hidden', { get: () => escondida, set: x => { if (x) esconderam.push(1); escondida = x; }, configurable: true });
    v.chamadas.length = 0;
    vm.runInContext("alteracoes.set('MEDICAMENTOS|6', { aba: 'MEDICAMENTOS', linha: 6, produto: 'DIPIRONA', saida: 99, cmm: 30 }); salvar();", v.ctx);
    await pausa(200);
    check('salvar: tabela nunca foi escondida', esconderam.length === 0, esconderam);
    check('salvar: gravou e confirmou em segundo plano', v.chamadas[0] === 'logistica.salvar' && v.chamadas.includes('logistica.carregar'), v.chamadas);
    const it = vm.runInContext("JSON.stringify(planilha.abas[0].itens[0])", v.ctx);
    check('salvar: modelo local atualizado', it.includes('"valores":[40,99]') && /"cmm":30/.test(it), it);
    check('salvar: tabela liberada depois de salvar (inert)', v.els['log-wrap'].inert === false, v.els['log-wrap'].inert);
    check('salvar: sem erro', v.erros.length === 0 && !/erro/.test(v.els['log-status'].className), v.els['log-status'].textContent);
    check('salvar: mensagem de salvo permanece', /salvo/.test(v.els['save-info'].textContent), v.els['save-info'].textContent);
  }
  // tela de usuários
  {
    const arm = new Map([['farma_sessao', 'TOKEN1']]);
    const v = visita('usuarios.js', arm, 'admin');
    await pausa(80);
    check('usuarios: carrega sem erro', v.erros.length === 0 && v.chamadas[0] === 'usuarios.carregar', [v.erros, v.chamadas]);
    const html = v.els['lista'].innerHTML;
    check('usuarios: lista mostra coordenador com ações e coordenação sem ações', html.includes('data-acao="senha"') && html.includes('Conta gerenciada pela TI') && html.includes('Ainda não criou a própria senha'), html.slice(0, 200));
    check('usuarios: select de unidades montado', v.els['f-unidade'].innerHTML.includes('upa-centro'));
    // cadastrar: preenche o formulário e dispara o submit registrado pela tela
    v.els['f-nome'].value = 'Beatriz Souza'; v.els['f-login'].value = 'beatriz.s'; v.els['f-unidade'].value = 'upa-jurema';
    v.chamadas.length = 0;
    await v.els['form-usuario'].__ouvintes.submit({ preventDefault() {}, target: v.els['form-usuario'] });
    await pausa(80);
    check('usuarios: cadastro chama criar e recarrega a lista', v.chamadas[0] === 'usuarios.criar' && v.chamadas.includes('usuarios.carregar'), v.chamadas);
    check('usuarios: senha provisória aparece', v.els['cred'].hidden === false && v.els['cred-senha'].textContent === 'abc123xyz9' && v.els['cred-login'].textContent === 'beatriz.s', [v.els['cred'].hidden, v.els['cred-senha'].textContent]);
    check('usuarios: lista inclui o novo', v.els['lista'].innerHTML.includes('Beatriz Souza'));
    // fechar a credencial apaga a senha da página
    v.els['cred-fechar'].__ouvintes.click();
    check('usuarios: fechar apaga a senha da tela', v.els['cred'].hidden === true && v.els['cred-senha'].textContent === '');
    // redefinir senha e desativar via cliques na lista
    const clique = (acao, login) => v.els['lista'].__ouvintes.click({ target: { closest: () => ({ dataset: { acao, login }, disabled: false }) } });
    v.chamadas.length = 0;
    await clique('senha', 'ana.c'); await pausa(80);
    check('usuarios: redefinir senha mostra a nova senha', v.chamadas[0] === 'usuarios.redefinirSenha' && v.els['cred-senha'].textContent === 'nova456abc', [v.chamadas, v.els['cred-senha'].textContent]);
    v.chamadas.length = 0;
    await clique('desativar', 'ana.c'); await pausa(80);
    check('usuarios: desativar chama o servidor e recarrega', v.chamadas[0] === 'usuarios.definirAtivo' && v.chamadas.includes('usuarios.carregar'), v.chamadas);
    check('usuarios: lista mostra desativado', v.els['lista'].innerHTML.includes('Desativado'));
    check('usuarios: sem erro de execução no fluxo', v.erros.length === 0, v.erros);
  }
  // rascunho: volta depois de recarregar, só para a mesma pessoa e unidade
  {
    const arm = new Map([['farma_sessao', 'TOKEN1']]); const ss = new Map();
    let v = visita('logistica.js', arm, 'coordenador', { ss });
    await pausa(80);
    vm.runInContext("alteracoes.set('MEDICAMENTOS|6', { aba: 'MEDICAMENTOS', linha: 6, produto: 'DIPIRONA', saida: 77 }); atualizarBarra();", v.ctx);
    const rasc = JSON.parse(ss.get('farma_rascunho') || 'null');
    check('rascunho: gravado com login e unidade', rasc && rasc.login === 'coord.centro' && rasc.unidade === 'upa-centro' && rasc.itens.length === 1, rasc);
    v = visita('logistica.js', arm, 'coordenador', { ss });
    await pausa(300);
    check('rascunho: recuperado depois de recarregar (cache + servidor)', vm.runInContext('alteracoes.size', v.ctx) === 1, vm.runInContext('alteracoes.size', v.ctx));
    check('rascunho: aviso continua depois da carga do servidor', /Recuperamos/.test(v.els['log-status'].textContent), v.els['log-status'].textContent);
    ss.set('farma_rascunho', JSON.stringify({ login: 'outra.pessoa', unidade: 'upa-centro', itens: [{ aba: 'MEDICAMENTOS', linha: 6, produto: 'DIPIRONA', saida: 5 }] }));
    v = visita('logistica.js', arm, 'coordenador', { ss });
    await pausa(300);
    check('rascunho: de outra pessoa é ignorado', vm.runInContext('alteracoes.size', v.ctx) === 0, vm.runInContext('alteracoes.size', v.ctx));
    ss.set('farma_rascunho', JSON.stringify({ login: 'coord.centro', unidade: 'upa-centro', itens: [{ aba: 'MEDICAMENTOS', linha: 6, produto: 'PRODUTO-QUE-MUDOU', saida: 5 }] }));
    v = visita('logistica.js', arm, 'coordenador', { ss });
    await pausa(300);
    check('rascunho: linha que não bate com a planilha é descartada', vm.runInContext('alteracoes.size', v.ctx) === 0, v.els['log-status'].textContent);
    // sair apaga o rascunho (limparToken)
    ss.set('farma_rascunho', '{}');
    vm.runInContext('limparToken()', v.ctx);
    check('rascunho: sair do sistema apaga', !ss.has('farma_rascunho'));
    check('cache: sair do sistema apaga', ![...arm.keys()].some(k => k.startsWith('farma_cache_')), [...arm.keys()]);
  }
  // início: cache da sessão
  const arm = new Map([['farma_sessao', 'T']]);
  let v = visita('index.js', arm, 'coordenador'); // index.js precisa de elementos; só confere que carrega
  await pausa(80);
  check('index: executa sem erro', v.erros.length === 0, v.erros);
  check('index: guardou cache do painel', arm.has('farma_cache_painel'), [...arm.keys()]);
  const vc = visita('index.js', new Map([['farma_sessao', 'T']]), 'coordenador');
  await pausa(80);
  const listaC = vc.els['fech-lista'].innerHTML;
  check('painel do coordenador: tarefas com atalho para lançar', listaC.includes('indicadores.html?lancar=1') && listaC.includes('Continuar lançamento') && listaC.includes('Medicamentos 5 de 10'), listaC.slice(0, 200));
  check('painel do coordenador: anel 1/2 e título do mês', vc.els['fech-ring-txt'].textContent === '1/2' && vc.els['fech-titulo'].textContent.includes('Maio/2026'), [vc.els['fech-ring-txt'].textContent, vc.els['fech-titulo'].textContent]);
  const va = visita('index.js', new Map([['farma_sessao', 'T']]), 'admin');
  await pausa(80);
  const listaA = va.els['fech-lista'].innerHTML;
  check('painel da coordenação: todas as unidades com selos', listaA.includes('UPA Centro') && listaA.includes('UPA Jurema') && listaA.includes('fech-selo') && va.els['fech-ring-txt'].textContent === '0/2', va.els['fech-ring-txt'].textContent);
  check('painel: sem erro de execução', vc.erros.length === 0 && va.erros.length === 0, [vc.erros, va.erros]);
  console.log(`${ok} ok, ${falhas} falha(s)`);
})();
