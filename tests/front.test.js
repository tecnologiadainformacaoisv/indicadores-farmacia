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
    case 'logistica.carregar': if (req.unidade === 'invalida') throw new Error('Você não tem acesso a esta unidade.'); return {
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
  const corpos = [];
  const ctx = {
    console, setTimeout: (fn) => { try { fn(); } catch (e) { erros.push('timeout: ' + e.message); } }, clearTimeout() {}, Promise, JSON, Date, Math, Object, Array, Number, String, Map, Set, Error, isFinite, parseInt,
    localStorage: { getItem: k => armazenamento.has(k) ? armazenamento.get(k) : null, setItem: (k, v) => armazenamento.set(k, String(v)), removeItem: k => armazenamento.delete(k), get length() { return armazenamento.size; } },
    sessionStorage: { getItem: k => (opcoes.ss || semSS).has(k) ? (opcoes.ss || semSS).get(k) : null, setItem: (k, v) => (opcoes.ss || semSS).set(k, String(v)), removeItem: k => (opcoes.ss || semSS).delete(k) },
    location: { href: '', search: opcoes.search || '' }, URLSearchParams,
    confirm: () => true, history: { replaceState() {} },
    matchMedia: () => ({ matches: true }),
    themeVar: () => '#888888',
    Chart: class { constructor(el, cfg) { this.canvas = el; this.data = cfg.data; this.options = cfg.options; } destroy() {} update() {} },
    fetch: async (url, init) => {
      chamadas.push(JSON.parse(init.body).action);
      corpos.push(JSON.parse(init.body));
      if (opcoes.falhaRede || ctx.__falhar) throw new TypeError('Failed to fetch');
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
  return { ctx, els, chamadas, corpos, erros };
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
  // ordenar a cobertura com um clique: pior → melhor → melhor → pior → ordem da planilha
  {
    const v = visita('logistica.js', new Map([['farma_sessao', 'TOKEN1']]), 'coordenador');
    await pausa(80);
    const R = c => vm.runInContext(c, v.ctx);
    const aba = "({nome:'MEDICAMENTOS'})";
    const itens = "[{linha:1,produto:'A',cmm:10,estoque:30},{linha:2,produto:'B',cmm:10,estoque:0},{linha:3,produto:'C',cmm:10,estoque:5},{linha:4,produto:'D',cmm:0,estoque:9},{linha:5,produto:'E',cmm:10,estoque:null},{linha:6,produto:'F',cmm:10,estoque:100}]";
    const ordem = () => R("ordenarPorCobertura(" + itens + ", " + aba + ").map(x => x.produto).join('')");
    check('cobertura: sem clique mantém a ordem da planilha', ordem() === 'ABCDEF', ordem());
    R("alternarOrdemCob()");
    check('cobertura: 1º clique = pior primeiro (sem estoque), sem dado no fim', ordem() === 'BCAFDE', ordem());
    R("alternarOrdemCob()");
    check('cobertura: 2º clique = melhor primeiro, sem dado continua no fim', ordem() === 'FACBDE', ordem());
    R("alternarOrdemCob()");
    check('cobertura: 3º clique volta à ordem da planilha', ordem() === 'ABCDEF' && R('ordemCob') === '', ordem());
    check('cobertura: botão da barra ganha o texto do estado', v.els['btn-ordem-cob'].textContent === 'Ordenar por cobertura');
    check('cobertura: sem erro de execução', v.erros.length === 0, v.erros);
  }
  // rodapé, aviso de servidor lento e mensagens
  {
    const v = visita('logistica.js', new Map([['farma_sessao', 'TOKEN1']]), 'coordenador');
    await pausa(80);
    const R = c => vm.runInContext(c, v.ctx);
    const url = R("linkRelatar()");
    check('rodapé: link de relato é um mailto com assunto e versão', url.startsWith('mailto:tecnologiadainformacao@institutosaovicente.com.br?subject=') && decodeURIComponent(url).includes('Versão:'), url);
    check('aviso lento: nenhuma chamada pendente depois de terminar', R('chamadasPendentes') === 0 && R('avisoLentoEl') === null);
    R("chamadasPendentes = 1; mostrarAvisoLento();");
    check('aviso lento: aparece com chamada pendente', R('avisoLentoEl') !== null);
    R("chamadasPendentes = 0; esconderAvisoLento();");
    check('aviso lento: some quando não há chamada pendente', R('avisoLentoEl') === null);
    check('lote ajuda: sem erro de execução', v.erros.length === 0, v.erros);
  }
  // troca de unidade que falha não pode deixar as metas apontando para a unidade nova
  {
    const v = visita('indicadores.js', new Map([['farma_sessao', 'TOKEN1']]), 'admin');
    await pausa(80);
    const R = c => vm.runInContext(c, v.ctx);
    check('troca de unidade: começa em "todas"', R('unidadeSel') === '');
    const sel = v.els['unitSel'];
    v.ctx.__falhar = true;
    sel.value = 'upa-jurema';
    await sel.__ouvintes.change();
    await pausa(80);
    check('troca de unidade que falha: a unidade das metas continua a anterior', R('unidadeSel') === '', R('unidadeSel'));
    check('troca de unidade que falha: o seletor volta para a unidade anterior', sel.value === '', sel.value);
    check('troca de unidade que falha: aviso de erro na tela', /erro/.test(v.els['page-status'].className) && /anterior/.test(v.els['page-status'].textContent), v.els['page-status'].textContent);
    v.ctx.__falhar = false;
    sel.value = 'upa-jurema';
    await sel.__ouvintes.change();
    await pausa(80);
    check('troca de unidade que dá certo: passa a valer a unidade nova', R('unidadeSel') === 'upa-jurema', R('unidadeSel'));
  }
  // planilha: ?unidade= inválida cai na unidade padrão
  {
    const v = visita('logistica.js', new Map([['farma_sessao', 'TOKEN1']]), 'coordenador', { search: '?unidade=invalida' });
    await pausa(200);
    const pedidos = v.corpos.filter(c => c.action === 'logistica.carregar');
    check('planilha: unidade inválida do endereço é tentada uma vez e depois cai no padrão', pedidos.some(c => c.unidade === 'invalida') && pedidos[pedidos.length - 1].unidade === undefined, pedidos);
    check('planilha: depois do fallback a tabela carrega', vm.runInContext('planilha && planilha.unidade', v.ctx) === 'upa-centro', vm.runInContext('typeof planilha', v.ctx));
    check('planilha fallback: sem erro de execução', v.erros.length === 0, v.erros);
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
  // links da coordenação: unidade e selos já lançados abrem a tela da unidade; pendentes não
  check('painel da coordenação: nome da unidade abre o acompanhamento dela', listaA.includes('href="indicadores.html?unidade=upa-centro"') && listaA.includes('href="indicadores.html?unidade=upa-jurema"'), listaA.slice(0, 300));
  check('painel da coordenação: selos lançados viram link (clínica e saídas)', /<a class="fech-selo ok" href="indicadores.html\?unidade=upa-centro"[^>]*>Clínica lançada/.test(listaA) && /<a class="fech-selo" href="logistica.html\?unidade=upa-centro"[^>]*>Saídas/.test(listaA), listaA.slice(0, 600));
  check('painel da coordenação: selos pendentes ficam sem link', /<span class="fech-selo"[^>]*>Clínica pendente/.test(listaA) && /<span class="fech-selo"[^>]*>Saídas pendentes/.test(listaA) && !listaA.includes('logistica.html?unidade=upa-jurema'), listaA.slice(-500));
  {
    const vi = visita('indicadores.js', new Map([['farma_sessao', 'T']]), 'admin', { search: '?unidade=upa-jurema' });
    await pausa(80);
    check('indicadores: ?unidade= pede essa unidade ao servidor', vi.corpos.some(c => c.action === 'indicadores.carregar' && c.unidade === 'upa-jurema'), vi.corpos);
    const vl = visita('logistica.js', new Map([['farma_sessao', 'T']]), 'admin', { search: '?unidade=upa-jurema' });
    await pausa(80);
    check('planilha: ?unidade= pede essa unidade ao servidor', vl.corpos.some(c => c.action === 'logistica.carregar' && c.unidade === 'upa-jurema'), vl.corpos);
    const vx = visita('indicadores.js', new Map([['farma_sessao', 'T']]), 'admin', { search: '?unidade=../x;drop' });
    await pausa(80);
    check('indicadores: ?unidade= com texto estranho é ignorado', vx.corpos.every(c => c.unidade === undefined), vx.corpos);
  }
  check('painel da coordenação: selos-link dizem a unidade no nome acessível', /aria-label="Clínica lançada — UPA Centro"/.test(listaA) && /aria-label="Saídas [0-9]+% — UPA Centro"/.test(listaA), listaA.slice(0, 500));
  // rascunho de outra unidade sobrevive a abrir uma unidade diferente
  {
    const ss = new Map([['farma_rascunho', JSON.stringify({ login: 'coord.centro', unidade: 'upa-jurema', itens: [{ aba: 'MEDICAMENTOS', linha: 6, produto: 'DIPIRONA', saida: 5 }] })]]);
    const vr = visita('logistica.js', new Map([['farma_sessao', 'T']]), 'coordenador', { ss });
    await pausa(150);
    check('rascunho: de outra unidade não é apagado ao abrir esta', ss.has('farma_rascunho'), [...ss.keys()]);
    check('migalhas: link de volta sem unidade para coordenador', vr.els['mig-acomp'].href === 'indicadores.html', vr.els['mig-acomp'].href);
    const va2 = visita('logistica.js', new Map([['farma_sessao', 'T']]), 'admin', { search: '?unidade=upa-jurema' });
    await pausa(150);
    check('migalhas: coordenação volta ao acompanhamento da mesma unidade', va2.els['mig-acomp'].href === 'indicadores.html?unidade=upa-jurema', va2.els['mig-acomp'].href);
  }
  // saídas só concluem com as duas abas lançadas (aba nunca salva tem total 0)
  const soMed = vm.runInContext("saidasResumo({ saidas: { med: { preenchidos: 10, total: 10 }, mat: { preenchidos: 0, total: 0 }, por: 'a', em: 'b' } })", vc.ctx);
  check('saídas: só medicamentos lançados NÃO conclui', soMed.feito === false && soMed.pct <= 99 && soMed.texto.includes('Materiais: nenhum item lançado'), soMed);
  const ambas = vm.runInContext("saidasResumo({ saidas: { med: { preenchidos: 10, total: 10 }, mat: { preenchidos: 4, total: 4 }, por: 'a', em: 'b' } })", vc.ctx);
  check('saídas: as duas abas completas concluem', ambas.feito === true && ambas.pct === 100, ambas);
  check('painel: sem erro de execução', vc.erros.length === 0 && va.erros.length === 0, [vc.erros, va.erros]);
  console.log(`${ok} ok, ${falhas} falha(s)`);
})();
