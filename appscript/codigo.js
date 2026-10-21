// ═══════════════════════════════════════════════════════════════
// Indicadores da Farmácia — API (Apps Script Web App)
//
// O site (GitHub Pages) chama esta API por POST com JSON:
//   { action: 'login' | 'sessao' | ..., token, ...dados }
// Resposta: { ok: true, dados } ou { ok: false, erro, codigo }
//
// Toda permissão é conferida AQUI, nunca só na tela.
// Passo a passo de implantação: docs/IMPLANTACAO.md
// ═══════════════════════════════════════════════════════════════

const TZ = 'America/Fortaleza';
const SESSAO_TTL = 21600;           // 6 h (máximo do CacheService)
const TENTATIVAS_MAX = 5;           // logins errados antes de bloquear
const BLOQUEIO_SEG = 900;           // 15 min de bloqueio
const ITERACOES_HASH = 1000;

const ABAS = {
  USUARIOS: 'Usuarios',
  UNIDADES: 'Unidades',
  METAS: 'Metas',
  LANC: 'Lancamentos',
  CONFIG: 'Config',
  LOG: 'Log',
};

const CABECALHOS = {
  Usuarios: ['login', 'nome', 'perfil', 'unidade', 'salt', 'hash', 'trocarSenha', 'ativo'],
  Unidades: ['id', 'nome', 'municipio', 'modelo', 'planilhaId', 'ativo'],
  Metas: ['unidade', 'indicador', 'valor', 'direcao', 'rotulo'],
  Lancamentos: null, // montado abaixo com CAMPOS
  Config: ['chave', 'valor', 'descricao'],
  Log: ['quando', 'usuario', 'acao', 'detalhe'],
};

// Campos do formulário "Lançar dados" (mesmos ids do site, sem o prefixo f-)
const CAMPOS = [
  'admissoes', 'conciliacoes', 'presc-atend', 'presc-anal', 'prm',
  'interv-total', 'interv-aceitas', 'altas-total', 'altas-real',
  'itens-pad', 'itens-falta', 'itens-venc', 'entregas', 'nc',
  'auditados', 'conformes', 'emergenciais',
];
CABECALHOS.Lancamentos = ['unidade', 'ano', 'mes'].concat(CAMPOS, ['lancadoPor', 'lancadoEm']);

// numerador não pode passar do denominador
const PARES = [
  ['conciliacoes', 'admissoes', 'Conciliações', 'admissões'],
  ['presc-anal', 'presc-atend', 'Prescrições analisadas', 'prescrições atendidas'],
  ['interv-aceitas', 'interv-total', 'Intervenções aceitas', 'intervenções realizadas'],
  ['altas-real', 'altas-total', 'Altas com orientação', 'altas totais'],
  ['itens-falta', 'itens-pad', 'Itens em falta', 'itens padronizados'],
  ['itens-venc', 'itens-pad', 'Itens vencidos', 'itens padronizados'],
  ['nc', 'entregas', 'Não conformidades', 'entregas'],
  ['emergenciais', 'entregas', 'Pedidos emergenciais', 'entregas'],
  ['conformes', 'auditados', 'Itens em conformidade', 'itens auditados'],
];

// Metas padrão: cada unidade nova nasce com estas (a Tereza ajusta depois)
const METAS_PADRAO = [
  ['conciliacoes', 80, 'min', 'Conciliações Medicamentosas (%)'],
  ['prescricoes', 80, 'min', 'Prescrições Analisadas (%)'],
  ['prm', 5, 'max', 'PRM Identificados (%)'],
  ['intervencoes', 75, 'min', 'Intervenções Aceitas (%)'],
  ['altas', 80, 'min', 'Altas Hospitalares (%)'],
  ['desabastecimento', 2, 'max', 'Desabastecimento (%)'],
  ['perdas', 5, 'max', 'Perdas por Validade (%)'],
  ['nconformidades', 10, 'max', 'Não Conformidades Entrega (%)'],
  ['estoque', 95, 'min', 'Conformidade de Estoque (%)'],
  ['emergenciais', 10, 'max', 'Pedidos Emergenciais (%)'],
];

const MESES = ['JANEIRO', 'FEVEREIRO', 'MARCO', 'ABRIL', 'MAIO', 'JUNHO',
  'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
const MESES_ROTULO = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
  'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];

// Abas da planilha de saídas no modelo UPA
const ABAS_LOGISTICA = ['MEDICAMENTOS', 'MATERIAIS'];

// ── Entrada ────────────────────────────────────────────────────

function doPost(e) {
  // cada requisição é uma execução nova no Apps Script; isto só garante o mesmo comportamento fora dele
  sistemaCache_ = null;
  tabelaCache_ = {};
  let req;
  try {
    req = JSON.parse(e.postData.contents);
  } catch (err) {
    return resposta_({ ok: false, erro: 'Requisição inválida.' });
  }
  const inicio = Date.now();
  try {
    const rota = Object.prototype.hasOwnProperty.call(ROTAS, req.action) ? ROTAS[req.action] : null;
    if (!rota) throw erro_('Ação desconhecida.');
    const usuario = rota.publica ? null : usuarioDaSessao_(req.token);
    // com senha provisória, só dá para ver a sessão, sair ou trocar a senha
    if (usuario && ativo_(usuario.trocarSenha) && !rota.semSenhaDefinitiva) {
      throw erro_('Troque a senha provisória antes de continuar.', 'senhaProvisoria');
    }
    const dados = rota.fn(req, usuario);
    return resposta_({ ok: true, dados: dados, ms: Date.now() - inicio });
  } catch (err) {
    if (err.codigo) return resposta_({ ok: false, erro: err.message, codigo: err.codigo });
    // erro inesperado: detalhe só no log do Apps Script, nunca para o cliente
    console.error(err.stack || err);
    return resposta_({ ok: false, erro: 'Erro inesperado no servidor. Tente de novo; se continuar, avise a TI.', codigo: 'erro' });
  }
}

function doGet() {
  return resposta_({ ok: true, dados: 'API Indicadores da Farmácia no ar.' });
}

const ROTAS = {
  'login':              { publica: true, fn: login_ },
  'sessao':             { fn: sessao_, semSenhaDefinitiva: true },
  'sair':               { fn: sair_, semSenhaDefinitiva: true },
  'trocarSenha':        { fn: trocarSenha_, semSenhaDefinitiva: true },
  'lancamentos.listar': { fn: listarLancamentos_ },
  'lancamentos.salvar': { fn: salvarLancamento_ },
  'indicadores.carregar': { fn: carregarIndicadores_ },
  'logistica.carregar': { fn: carregarLogistica_ },
  'metas.listar':       { fn: listarMetas_ },
  'metas.salvar':       { fn: salvarMetas_ },
  'logistica.ler':      { fn: lerLogistica_ },
  'logistica.salvar':   { fn: salvarLogistica_ },
  'usuarios.carregar':      { fn: carregarUsuarios_ },
  'usuarios.criar':         { fn: criarUsuarioApi_ },
  'usuarios.atualizar':     { fn: atualizarUsuarioApi_ },
  'usuarios.redefinirSenha': { fn: redefinirSenhaApi_ },
  'usuarios.definirAtivo':  { fn: definirAtivoApi_ },
};

function resposta_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function erro_(msg, codigo) {
  const e = new Error(msg);
  e.codigo = codigo || 'validacao';
  return e;
}

// ── Autenticação ───────────────────────────────────────────────

function login_(req) {
  const login = String(req.login || '').trim().toLowerCase();
  const senha = String(req.senha || '');
  if (!login || !senha) throw erro_('Informe usuário e senha.');

  const cache = CacheService.getScriptCache();
  const chaveTent = 'tent:' + login;
  const tentativas = +(cache.get(chaveTent) || 0);
  if (tentativas >= TENTATIVAS_MAX) {
    registrar_(login, 'login.bloqueado', '');
    throw erro_('Muitas tentativas. Aguarde 15 minutos ou peça à coordenação para redefinir a senha.');
  }

  const u = buscarUsuario_(login);
  const existe = !!u && ativo_(u.ativo);
  // calcula o hash mesmo sem usuário: o tempo de resposta não revela quais logins existem
  const hash = hashSenha_(senha, existe ? u.salt : 'sem-usuario');
  if (!existe || hash !== u.hash) {
    cache.put(chaveTent, String(tentativas + 1), BLOQUEIO_SEG);
    registrar_(login, 'login.falha', '');
    throw erro_('Usuário ou senha incorretos.');
  }
  cache.remove(chaveTent);

  registrar_(login, 'login', '');
  return { token: abrirSessao_(u) };
}

// A sessão guarda o salt da senha: trocar ou redefinir a senha derruba as sessões antigas.
function abrirSessao_(u) {
  const token = Utilities.getUuid();
  CacheService.getScriptCache().put('s:' + token, JSON.stringify({ login: String(u.login).trim().toLowerCase(), salt: u.salt }), SESSAO_TTL);
  return token;
}

function usuarioDaSessao_(token) {
  if (!token) throw erro_('Faça login para continuar.', 'sessao');
  const cache = CacheService.getScriptCache();
  const bruto = cache.get('s:' + token);
  if (!bruto) throw erro_('Sua sessão expirou. Entre novamente.', 'sessao');
  const s = JSON.parse(bruto);
  const u = buscarUsuario_(s.login);
  if (!u || !ativo_(u.ativo)) throw erro_('Usuário desativado.', 'sessao');
  if (u.salt !== s.salt) throw erro_('Sua senha foi alterada. Entre novamente.', 'sessao');
  cache.put('s:' + token, bruto, SESSAO_TTL); // renova a cada uso
  u.token = token;
  return u;
}

function sessao_(req, u) {
  return {
    usuario: publico_(u),
    unidades: unidadesVisiveis_(u).map(un => ({ id: un.id, nome: un.nome, municipio: un.municipio, modelo: un.modelo })),
    mesAberto: mesAberto_(),
  };
}

function sair_(req, u) {
  CacheService.getScriptCache().remove('s:' + u.token);
  return true;
}

function trocarSenha_(req, u) {
  const cache = CacheService.getScriptCache();
  const chaveTent = 'tsenha:' + u.login;
  const tentativas = +(cache.get(chaveTent) || 0);
  if (tentativas >= TENTATIVAS_MAX) throw erro_('Muitas tentativas. Aguarde 15 minutos.');
  const nova = String(req.novaSenha || '');
  if (hashSenha_(String(req.senhaAtual || ''), u.salt) !== u.hash) {
    cache.put(chaveTent, String(tentativas + 1), BLOQUEIO_SEG);
    throw erro_('Senha atual incorreta.');
  }
  if (nova.length < 8) throw erro_('A nova senha precisa ter pelo menos 8 caracteres.');
  if (nova === String(req.senhaAtual)) throw erro_('A nova senha precisa ser diferente da atual.');
  cache.remove(chaveTent);
  const salt = Utilities.getUuid();
  atualizarLinha_(ABAS.USUARIOS, u._linha, { salt: salt, hash: hashSenha_(nova, salt), trocarSenha: false });
  cache.remove('s:' + u.token);
  registrar_(u.login, 'trocarSenha', '');
  // as outras sessões caem (salt novo); esta recebe um token novo
  return { token: abrirSessao_({ login: u.login, salt: salt }) };
}

function hashSenha_(senha, salt) {
  let h = String(salt) + senha;
  for (let i = 0; i < ITERACOES_HASH; i++) {
    h = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h, Utilities.Charset.UTF_8));
  }
  return h;
}

function buscarUsuario_(login) {
  return lerTabela_(ABAS.USUARIOS).find(u => String(u.login).trim().toLowerCase() === login) || null;
}

function publico_(u) {
  return {
    login: u.login,
    nome: u.nome,
    perfil: u.perfil,
    unidade: u.unidade,
    trocarSenha: ativo_(u.trocarSenha),
  };
}

function ehAdmin_(u) { return u.perfil === 'admin'; }

function ativo_(v) { return v === true || String(v).toUpperCase() === 'TRUE' || String(v).toUpperCase() === 'SIM'; }

// ── Unidades e permissões ──────────────────────────────────────

function unidades_() {
  return lerTabela_(ABAS.UNIDADES).filter(un => ativo_(un.ativo));
}

function unidadesVisiveis_(u) {
  const todas = unidades_();
  return ehAdmin_(u) ? todas : todas.filter(un => un.id === u.unidade);
}

function exigirVisivel_(u, unidadeId) {
  const un = unidadesVisiveis_(u).find(x => x.id === unidadeId);
  if (!un) throw erro_('Você não tem acesso a esta unidade.', 'permissao');
  return un;
}

// Só o coordenador da própria unidade lança, e só no mês aberto.
function exigirLancamento_(u, unidadeId) {
  if (ehAdmin_(u)) throw erro_('O perfil de coordenação do Instituto acompanha, mas não lança dados.', 'permissao');
  if (u.unidade !== unidadeId) throw erro_('Você só pode lançar dados da sua unidade.', 'permissao');
  if (ativo_(u.trocarSenha)) throw erro_('Troque a senha provisória antes de lançar dados.', 'permissao');
  return exigirVisivel_(u, unidadeId);
}

// Mês de referência aberto para lançamento: sempre o mês que fechou.
// Config MES_ABERTO_TESTE (ex.: 2026-05) fixa um mês durante os testes.
function mesAberto_() {
  const teste = config_('MES_ABERTO_TESTE');
  if (teste) {
    if (teste instanceof Date) return { ano: teste.getFullYear(), mes: teste.getMonth(), teste: true };
    const p = String(teste).split(/[-/]/).map(Number);
    if (p.length === 2 && p[0] > 2000 && p[1] >= 1 && p[1] <= 12) return { ano: p[0], mes: p[1] - 1, teste: true };
  }
  const hoje = new Date();
  const ano = +Utilities.formatDate(hoje, TZ, 'yyyy');
  const mes = +Utilities.formatDate(hoje, TZ, 'M') - 1;
  return mes === 0 ? { ano: ano - 1, mes: 11, teste: false } : { ano: ano, mes: mes - 1, teste: false };
}

// ── Lançamentos (base central) ─────────────────────────────────

// O mês é sempre decidido aqui; o front só informa qual mês está exibindo.
// Se a virada do mês aconteceu com a página aberta, recusa em vez de gravar no mês novo.
function exigirMesAberto_(req, ref) {
  const r = req.ref || {};
  if (+r.ano !== ref.ano || +r.mes !== ref.mes) {
    throw erro_('O mês aberto para lançamento mudou. Recarregue a página para continuar.');
  }
}

function listarLancamentos_(req, u) {
  const ids = req.unidade ? [exigirVisivel_(u, req.unidade).id] : unidadesVisiveis_(u).map(un => un.id);
  return lerTabela_(ABAS.LANC)
    .filter(r => ids.indexOf(r.unidade) >= 0)
    .map(r => {
      const o = { unidade: r.unidade, ano: +r.ano, mes: +r.mes, lancadoPor: r.lancadoPor, lancadoEm: dataTexto_(r.lancadoEm) };
      CAMPOS.forEach(c => { o[c] = r[c] === '' ? null : +r[c]; });
      return o;
    });
}

function salvarLancamento_(req, u) {
  const un = exigirLancamento_(u, req.unidade);
  const ref = mesAberto_();
  exigirMesAberto_(req, ref);
  const dados = req.dados || {};

  const linha = { unidade: un.id, ano: ref.ano, mes: ref.mes, lancadoPor: u.login, lancadoEm: new Date() };
  const erros = [];
  CAMPOS.forEach(c => {
    const v = dados[c];
    if (v === null || v === undefined || v === '') { linha[c] = ''; return; }
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0) erros.push('"' + c + '" precisa ser um número inteiro maior ou igual a zero.');
    linha[c] = n;
  });
  PARES.forEach(([num, den, rNum, rDen]) => {
    if (linha[num] !== '' && linha[den] !== '' && linha[num] > linha[den]) {
      erros.push(rNum + ' (' + linha[num] + ') não pode ser maior que ' + rDen + ' (' + linha[den] + ').');
    }
  });
  if (CAMPOS.every(c => linha[c] === '')) erros.push('Preencha pelo menos um campo antes de salvar.');
  if (erros.length) throw erro_(erros.join('\n'));

  comTrava_(() => {
    const existente = lerTabela_(ABAS.LANC, true).find(r => r.unidade === un.id && +r.ano === ref.ano && +r.mes === ref.mes);
    if (existente) atualizarLinha_(ABAS.LANC, existente._linha, linha);
    else inserirLinha_(ABAS.LANC, linha);
  });
  registrar_(u.login, 'lancamentos.salvar', un.id + ' ' + (ref.mes + 1) + '/' + ref.ano);
  return { ano: ref.ano, mes: ref.mes };
}

// ── Usuários (só a coordenação do Instituto) ───────────────────
// A tela cadastra e mantém coordenadores. Contas da coordenação (admin) só pelo editor do Apps Script.

function exigirAdmin_(u) {
  if (!ehAdmin_(u)) throw erro_('Só a coordenação do Instituto gerencia usuários.', 'permissao');
}

function usuarioPublico_(x) {
  return {
    login: String(x.login), nome: String(x.nome), perfil: String(x.perfil), unidade: String(x.unidade || ''),
    ativo: ativo_(x.ativo), trocarSenha: ativo_(x.trocarSenha),
  };
}

function carregarUsuarios_(req, u) {
  exigirAdmin_(u);
  return { sessao: sessao_(req, u), usuarios: lerTabela_(ABAS.USUARIOS).map(usuarioPublico_) };
}

// Valida nome e unidade; devolve os valores limpos ou lança com todos os problemas.
function validarNomeUnidade_(req, erros) {
  const nome = String(req.nome || '').trim().replace(/\s+/g, ' ');
  const unidade = String(req.unidade || '').trim();
  if (nome.length < 2 || nome.length > 80) erros.push('Informe o nome (até 80 caracteres).');
  // texto que começa com = + - @ viraria fórmula na planilha
  if (/^[=+\-@]/.test(nome)) erros.push('O nome não pode começar com = + - ou @.');
  if (!unidades_().some(un => un.id === unidade)) erros.push('Escolha uma unidade válida.');
  return { nome: nome, unidade: unidade };
}

function criarUsuarioApi_(req, u) {
  exigirAdmin_(u);
  const login = String(req.login || '').trim().toLowerCase();
  const erros = [];
  if (!/^[a-z0-9._-]{3,30}$/.test(login)) erros.push('O usuário deve ter de 3 a 30 caracteres: letras minúsculas, números, ponto, hífen ou sublinhado.');
  const v = validarNomeUnidade_(req, erros);
  if (erros.length) throw erro_(erros.join('\n'));

  const senha = senhaProvisoria_();
  comTrava_(() => {
    if (lerTabela_(ABAS.USUARIOS, true).some(x => String(x.login).trim().toLowerCase() === login)) {
      throw erro_('Já existe um usuário com esse login.');
    }
    const salt = Utilities.getUuid();
    inserirLinha_(ABAS.USUARIOS, { login: login, nome: v.nome, perfil: 'coordenador', unidade: v.unidade, salt: salt, hash: hashSenha_(senha, salt), trocarSenha: true, ativo: true });
  });
  registrar_(u.login, 'usuarios.criar', login + ' · ' + v.unidade);
  // a senha provisória só existe nesta resposta: não fica guardada em lugar nenhum
  return { login: login, nome: v.nome, unidade: v.unidade, senhaProvisoria: senha };
}

// Só coordenadores: a conta da coordenação não pode ser alterada por aqui (evita trancar o sistema).
function alvoCoordenador_(login, fresco) {
  const alvo = lerTabela_(ABAS.USUARIOS, fresco).find(x => String(x.login).trim().toLowerCase() === String(login || '').trim().toLowerCase());
  if (!alvo) throw erro_('Usuário não encontrado.');
  if (alvo.perfil !== 'coordenador') throw erro_('Por esta tela só é possível gerenciar coordenadores. Para a coordenação, fale com a TI.', 'permissao');
  return alvo;
}

function atualizarUsuarioApi_(req, u) {
  exigirAdmin_(u);
  const erros = [];
  const v = validarNomeUnidade_(req, erros);
  if (erros.length) throw erro_(erros.join('\n'));
  let alvo;
  comTrava_(() => {
    alvo = alvoCoordenador_(req.login, true);
    atualizarLinha_(ABAS.USUARIOS, alvo._linha, { nome: v.nome, unidade: v.unidade });
  });
  registrar_(u.login, 'usuarios.atualizar', alvo.login + ' · ' + v.unidade);
  return true;
}

function redefinirSenhaApi_(req, u) {
  exigirAdmin_(u);
  const senha = senhaProvisoria_();
  let alvo;
  comTrava_(() => {
    alvo = alvoCoordenador_(req.login, true);
    const salt = Utilities.getUuid(); // salt novo derruba as sessões abertas dessa pessoa
    atualizarLinha_(ABAS.USUARIOS, alvo._linha, { salt: salt, hash: hashSenha_(senha, salt), trocarSenha: true });
  });
  CacheService.getScriptCache().remove('tent:' + String(alvo.login).trim().toLowerCase()); // libera bloqueio por tentativas
  registrar_(u.login, 'usuarios.redefinirSenha', alvo.login);
  return { login: String(alvo.login), nome: String(alvo.nome), senhaProvisoria: senha };
}

function definirAtivoApi_(req, u) {
  exigirAdmin_(u);
  const ativo = req.ativo === true;
  let alvo;
  comTrava_(() => {
    alvo = alvoCoordenador_(req.login, true);
    atualizarLinha_(ABAS.USUARIOS, alvo._linha, { ativo: ativo });
  });
  registrar_(u.login, ativo ? 'usuarios.ativar' : 'usuarios.desativar', alvo.login);
  return true;
}

// ── Cargas completas de tela ───────────────────────────────────
// Uma chamada traz sessão + dados: cada ida e volta ao Google custa 1 a 2 s, então a tela abre com uma só.

// unidade: indefinida = padrão do perfil (coordenação: todas; coordenador: a própria); '' = todas (só coordenação)
function carregarIndicadores_(req, u) {
  let unidade = req.unidade;
  if (unidade === undefined || (unidade === '' && !ehAdmin_(u))) unidade = ehAdmin_(u) ? '' : u.unidade;
  return {
    sessao: sessao_(req, u),
    unidade: unidade,
    lancamentos: listarLancamentos_({ unidade: unidade }, u),
    metas: listarMetas_({ unidade: unidade }, u),
  };
}

// unidade: indefinida = a primeira que o usuário enxerga
function carregarLogistica_(req, u) {
  const vis = unidadesVisiveis_(u);
  const unidade = req.unidade || (vis[0] && vis[0].id);
  if (!unidade) throw erro_('Nenhuma unidade disponível para o seu usuário.', 'permissao');
  return { sessao: sessao_(req, u), logistica: lerLogistica_({ unidade: unidade }, u) };
}

// ── Metas por unidade ──────────────────────────────────────────

function listarMetas_(req, u) {
  const padrao = {};
  METAS_PADRAO.forEach(([k, v, d, r]) => { padrao[k] = { val: v, dir: d, label: r }; });
  if (!req.unidade) return padrao; // "todas as unidades": referência padrão
  const un = exigirVisivel_(u, req.unidade);
  lerTabela_(ABAS.METAS).filter(m => m.unidade === un.id).forEach(m => {
    if (padrao[m.indicador]) padrao[m.indicador].val = Number(m.valor);
  });
  return padrao;
}

function salvarMetas_(req, u) {
  if (!ehAdmin_(u)) throw erro_('Só a coordenação do Instituto altera as metas.', 'permissao');
  const un = exigirVisivel_(u, req.unidade);
  const novas = req.metas || {};
  const erros = [];
  METAS_PADRAO.forEach(([k, , , r]) => {
    if (novas[k] === undefined) return;
    const n = Number(novas[k]);
    if (novas[k] === '' || !isFinite(n) || n < 0 || n > 100) erros.push('Meta de "' + r + '" deve ficar entre 0 e 100.');
  });
  if (erros.length) throw erro_(erros.join('\n'));

  comTrava_(() => {
    const atuais = lerTabela_(ABAS.METAS, true).filter(m => m.unidade === un.id);
    METAS_PADRAO.forEach(([k, v, d, r]) => {
      if (novas[k] === undefined) return;
      const atual = atuais.find(m => m.indicador === k);
      const linha = { unidade: un.id, indicador: k, valor: Number(novas[k]), direcao: d, rotulo: r };
      if (atual) atualizarLinha_(ABAS.METAS, atual._linha, linha);
      else inserirLinha_(ABAS.METAS, linha);
    });
  });
  registrar_(u.login, 'metas.salvar', un.id);
  return true;
}

// ── Logística: planilha de saídas da unidade (modelo UPA) ──────

function lerLogistica_(req, u) {
  const un = exigirVisivel_(u, req.unidade);
  const ss = planilhaDaUnidade_(un);
  const ref = mesAberto_();
  const editavel = !ehAdmin_(u) && u.unidade === un.id && !ativo_(u.trocarSenha);

  const abas = ABAS_LOGISTICA.map(nome => {
    const sh = ss.getSheetByName(nome);
    if (!sh) return null;
    const valores = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
    const est = estruturaAba_(sh, valores);
    return {
      nome: nome,
      meses: est.meses.map(m => ({ mes: m.mes, rotulo: MESES_ROTULO[m.mes] })),
      itens: est.itens.map(r => ({
        linha: r + 1,
        produto: String(valores[r][est.colProd]).trim(),
        valores: est.meses.map(m => numOuNulo_(valores[r][m.col])),
        cmm: est.colCmm >= 0 ? numOuNulo_(valores[r][est.colCmm]) : null,
        estoque: est.colEst >= 0 ? numOuNulo_(valores[r][est.colEst]) : null,
      })),
    };
  }).filter(Boolean);

  return { unidade: un.id, mesAberto: ref, editavel: editavel, abas: abas };
}

function salvarLogistica_(req, u) {
  const un = exigirLancamento_(u, req.unidade);
  if (ABAS_LOGISTICA.indexOf(req.aba) < 0) throw erro_('Aba inválida.');
  const itens = Array.isArray(req.itens) ? req.itens : [];
  if (!itens.length) throw erro_('Nenhuma alteração para salvar.');

  const ref = mesAberto_();
  exigirMesAberto_(req, ref);
  const campos = ['saida', 'cmm', 'estoque'];
  const erros = [];
  itens.forEach(it => campos.forEach(c => {
    const v = it[c];
    if (v === undefined || v === null || v === '') return;
    const n = Number(v);
    if (!isFinite(n) || n < 0) erros.push('Valor inválido em "' + it.produto + '".');
  }));
  if (erros.length) throw erro_(erros.slice(0, 10).join('\n'));

  let gravados = 0;
  comTrava_(() => {
    const sh = planilhaDaUnidade_(un).getSheetByName(req.aba);
    if (!sh) throw erro_('A planilha da unidade não tem a aba ' + req.aba + '.', 'configuracao');
    const est = garantirColunaDoMes_(sh, ref.mes);
    const colMes = est.meses.find(m => m.mes === ref.mes).col;
    const n = sh.getLastRow();
    const produtos = sh.getRange(1, est.colProd + 1, n, 1).getValues();
    const cols = { saida: colMes, cmm: est.colCmm, estoque: est.colEst };
    const nomes = { saida: 'saídas', cmm: 'CMM', estoque: 'estoque disponível' };
    const formulas = {};
    campos.forEach(c => { if (cols[c] >= 0) formulas[c] = sh.getRange(1, cols[c] + 1, n, 1).getFormulas(); });

    // valida tudo antes de escrever qualquer célula
    const escritas = [];
    itens.forEach(it => {
      const r = Number(it.linha) - 1;
      if (!(est.itens.indexOf(r) >= 0)) throw erro_('Linha inválida para "' + it.produto + '". Recarregue a página.');
      // proteção contra planilha alterada entre a leitura e a gravação
      if (String(produtos[r][0]).trim() !== String(it.produto).trim()) {
        throw erro_('A planilha mudou desde que você abriu a página ("' + it.produto + '"). Recarregue e lance de novo.');
      }
      campos.forEach(c => {
        if (it[c] === undefined) return;
        if (cols[c] < 0) throw erro_('A aba ' + req.aba + ' não tem a coluna de ' + nomes[c] + '. Avise a TI.', 'configuracao');
        if (formulas[c][r][0]) throw erro_('"' + it.produto + '": a célula de ' + nomes[c] + ' tem fórmula na planilha e não foi alterada. Avise a TI.');
        escritas.push([r + 1, cols[c] + 1, (it[c] === null || it[c] === '') ? '' : Number(it[c])]);
      });
      gravados++;
    });
    // grava só as células alteradas: linhas vizinhas da mesma coluna vão juntas (uma chamada por trecho),
    // e nada fora delas é reescrito
    const porColuna = {};
    escritas.forEach(([lin, col, v]) => { (porColuna[col] = porColuna[col] || []).push({ lin: lin, v: v }); });
    Object.keys(porColuna).forEach(col => {
      const cel = porColuna[col].sort((a, b) => a.lin - b.lin);
      let ini = 0;
      for (let i = 1; i <= cel.length; i++) {
        if (i < cel.length && cel[i].lin === cel[i - 1].lin + 1) continue;
        const trecho = cel.slice(ini, i);
        sh.getRange(trecho[0].lin, +col, trecho.length, 1).setValues(trecho.map(x => [x.v]));
        ini = i;
      }
    });
  });
  registrar_(u.login, 'logistica.salvar', un.id + ' ' + req.aba + ' ' + (ref.mes + 1) + '/' + ref.ano + ' (' + gravados + ' itens)');
  return { gravados: gravados };
}

function planilhaDaUnidade_(un) {
  if (!un.planilhaId) throw erro_('A planilha de saídas de ' + un.nome + ' ainda não foi configurada.', 'configuracao');
  try {
    return repetir_(() => SpreadsheetApp.openById(String(un.planilhaId).trim()));
  } catch (e) {
    console.error(e);
    throw erro_('Não foi possível abrir a planilha de saídas de ' + un.nome + '. Avise a TI.', 'configuracao');
  }
}

// Localiza cabeçalho, colunas de mês, CMM, estoque e linhas de produto.
// O modelo tem linhas de título variáveis, então tudo é achado pelo texto.
function estruturaAba_(sh, matriz) {
  const nLin = sh.getLastRow();
  const nCol = sh.getLastColumn();
  if (!nLin || !nCol) throw erro_('A aba ' + sh.getName() + ' está vazia.', 'configuracao');
  // "matriz" (getValues já lido) evita ler a aba inteira outra vez; os testes de texto usam String()
  const txt = matriz || sh.getRange(1, 1, nLin, nCol).getDisplayValues();

  let hr = -1, colProd = -1;
  for (let r = 0; r < Math.min(nLin, 20) && hr < 0; r++) {
    const c = txt[r].findIndex(v => normalizar_(v) === 'PRODUTO');
    if (c >= 0) { hr = r; colProd = c; }
  }
  if (hr < 0) throw erro_('Não encontrei a coluna PRODUTO na aba ' + sh.getName() + '.', 'configuracao');

  const meses = [];
  let colCmm = -1, colEst = -1;
  let linhaMeses = -1; // linha (0-based) onde estão os nomes dos meses
  for (let c = 0; c < nCol; c++) {
    [hr, hr + 1].forEach(r => {
      if (r >= nLin) return;
      const t = normalizar_(txt[r][c]);
      const m = MESES.indexOf(t);
      if (m >= 0 && linhaMeses < 0) linhaMeses = r;
      if (m >= 0 && !meses.some(x => x.col === c)) meses.push({ mes: m, col: c });
      if (t === 'CMM' && colCmm < 0) colCmm = c;
      // "ESTOQUE DISP." / "ESTOQUE DISPONÍVEL"; não confundir com outros estoques
      if (t.indexOf('ESTOQUE DISP') === 0 && colEst < 0) colEst = c;
    });
  }
  meses.sort((a, b) => a.col - b.col);

  const primeira = hr + 2;
  const itens = [];
  for (let r = primeira; r < nLin; r++) {
    if (String(txt[r][colProd]).trim()) itens.push(r);
  }
  return { hr: hr, linhaMeses: linhaMeses >= 0 ? linhaMeses : hr + 1, colProd: colProd, meses: meses, colCmm: colCmm, colEst: colEst, primeira: primeira, itens: itens };
}

// Cria a coluna do mês (depois do último mês, antes do CMM) se ainda não existir.
// Se faltarem meses no meio, cria os intermediários também, para nenhum mês ser pulado.
// A planilha não guarda o ano: a virada de ano ainda precisa ser definida (docs/BRIEFING.md).
function garantirColunaDoMes_(sh, mes) {
  let est = estruturaAba_(sh);
  if (est.meses.some(m => m.mes === mes)) return est;
  if (!est.meses.length) throw erro_('A aba ' + sh.getName() + ' não tem colunas de mês.', 'configuracao');

  const ultima = est.meses[est.meses.length - 1];
  if (mes < ultima.mes) {
    throw erro_('A aba ' + sh.getName() + ' já passou de ' + MESES_ROTULO[mes] + '. Verifique a planilha (virada de ano?).', 'configuracao');
  }
  for (let m = ultima.mes + 1; m <= mes; m++) {
    const atual = estruturaAba_(sh);
    const col1 = atual.meses[atual.meses.length - 1].col + 1; // 1-based da última coluna de mês
    sh.insertColumnAfter(col1);
    const nLin = sh.getLastRow();
    sh.getRange(1, col1, nLin, 1).copyTo(sh.getRange(1, col1 + 1, nLin, 1), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
    sh.getRange(atual.linhaMeses + 1, col1 + 1).setValue(MESES_ROTULO[m]);
  }
  return estruturaAba_(sh);
}

// Rotina da virada do mês: cria a coluna do mês aberto em todas as planilhas.
function virarMes() {
  const ref = mesAberto_();
  unidades_().forEach(un => {
    if (!un.planilhaId) return;
    try {
      const ss = planilhaDaUnidade_(un);
      comTrava_(() => ABAS_LOGISTICA.forEach(nome => {
        const sh = ss.getSheetByName(nome);
        if (sh) garantirColunaDoMes_(sh, ref.mes);
      }));
      registrar_('sistema', 'virarMes', un.id + ' ' + (ref.mes + 1) + '/' + ref.ano);
    } catch (err) {
      registrar_('sistema', 'virarMes.erro', un.id + ': ' + err.message);
    }
  });
}

// ── Utilitários de planilha ────────────────────────────────────

let sistemaCache_ = null; // uma abertura por execução

// Os serviços do Google falham de forma intermitente ("INTERNAL"). Só para LEITURAS:
// repete com pausa curta antes de desistir. Nunca usar em gravação (poderia duplicar).
function repetir_(fn) {
  let ultimo;
  for (let i = 0; i < 3; i++) {
    try { return fn(); } catch (e) {
      ultimo = e;
      if (e.codigo) throw e; // erro de regra do sistema não é falha do Google
      if (i < 2) Utilities.sleep(400 * (i + 1));
    }
  }
  throw ultimo;
}

function sistema_() {
  if (sistemaCache_) return sistemaCache_;
  const id = repetir_(() => PropertiesService.getScriptProperties().getProperty('SISTEMA_ID'));
  if (!id) throw erro_('Sistema não configurado. Rode configurarSistema() no editor.', 'configuracao');
  sistemaCache_ = repetir_(() => SpreadsheetApp.openById(id));
  return sistemaCache_;
}

let tabelaCache_ = {}; // tabelas do Sistema lidas nesta execução

// "fresco" ignora o cache: use dentro de comTrava_, para ver o que outro usuário acabou de gravar.
function lerTabela_(nome, fresco) {
  if (!fresco && tabelaCache_[nome]) return tabelaCache_[nome];
  const sh = sistema_().getSheetByName(nome);
  const v = repetir_(() => sh.getDataRange().getValues());
  const cab = v[0].map(String);
  const linhas = v.slice(1).map((linha, i) => {
    const o = { _linha: i + 2 };
    cab.forEach((c, j) => { o[c] = linha[j]; });
    return o;
  }).filter(o => cab.some(c => o[c] !== ''));
  tabelaCache_[nome] = linhas;
  return linhas;
}

function inserirLinha_(nome, obj) {
  const sh = sistema_().getSheetByName(nome);
  const cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  sh.appendRow(cab.map(c => obj[c] === undefined ? '' : obj[c]));
  tabelaCache_ = {};
}

function atualizarLinha_(nome, linha, obj) {
  const sh = sistema_().getSheetByName(nome);
  const cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  const atual = sh.getRange(linha, 1, 1, cab.length).getValues()[0];
  sh.getRange(linha, 1, 1, cab.length).setValues([cab.map((c, j) => obj[c] === undefined ? atual[j] : obj[c])]);
  tabelaCache_ = {};
}

function config_(chave) {
  const c = lerTabela_(ABAS.CONFIG).find(x => x.chave === chave);
  return c ? c.valor : '';
}

function registrar_(usuario, acao, detalhe) {
  try { inserirLinha_(ABAS.LOG, { quando: new Date(), usuario: usuario, acao: acao, detalhe: detalhe }); } catch (e) { console.error(e); }
}

function comTrava_(fn) {
  const trava = LockService.getScriptLock();
  if (!trava.tryLock(20000)) throw erro_('O sistema está ocupado. Tente de novo em alguns segundos.');
  try { fn(); SpreadsheetApp.flush(); } finally { trava.releaseLock(); }
}

function normalizar_(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase();
}

function numOuNulo_(v) {
  return (v === '' || v === null || v === undefined || isNaN(Number(v))) ? null : Number(v);
}

function dataTexto_(d) {
  return d instanceof Date ? Utilities.formatDate(d, TZ, 'dd/MM/yyyy HH:mm') : String(d || '');
}

// ═══════════════════════════════════════════════════════════════
// Funções de administração — rodar pelo editor do Apps Script
// ═══════════════════════════════════════════════════════════════

// 1x: cria a planilha "Sistema" na pasta, com abas, unidades, metas e admin.
// Antes, defina a propriedade de script PASTA_ID (ID da pasta "Indicadores Farmácia").
function configurarSistema() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('SISTEMA_ID')) throw new Error('Já configurado: ' + props.getProperty('SISTEMA_ID'));
  const pastaId = props.getProperty('PASTA_ID');
  if (!pastaId) throw new Error('Defina a propriedade de script PASTA_ID (Configurações do projeto → Propriedades do script).');

  const ss = SpreadsheetApp.create('Indicadores Farmácia — Sistema');
  DriveApp.getFileById(ss.getId()).moveTo(DriveApp.getFolderById(pastaId));
  Object.keys(CABECALHOS).forEach((nome, i) => {
    const sh = i === 0 ? ss.getSheets()[0].setName(nome) : ss.insertSheet(nome);
    sh.getRange(1, 1, 1, CABECALHOS[nome].length).setValues([CABECALHOS[nome]]).setFontWeight('bold');
    sh.setFrozenRows(1);
  });
  // texto puro, para o Sheets não converter "2026-05" em data
  ss.getSheetByName(ABAS.CONFIG).getRange('B:B').setNumberFormat('@');
  props.setProperty('SISTEMA_ID', ss.getId());
  sistemaCache_ = ss;

  inserirLinha_(ABAS.CONFIG, { chave: 'MES_ABERTO_TESTE', valor: '2026-05', descricao: 'Fixa o mês aberto durante os testes (AAAA-MM). Apague o valor para usar o mês que fechou.' });
  [
    ['upa-centro', 'UPA Luiz Nerys (UPA Centro)', 'Caucaia', 'UPA'],
    ['upa-jurema', 'UPA Jurema', 'Caucaia', 'UPA'],
  ].forEach(([id, nome, municipio, modelo]) => criarUnidade(id, nome, municipio, modelo, ''));

  const senha = senhaProvisoria_();
  criarUsuario('tereza', 'Tereza', 'admin', '', senha);
  Logger.log('Planilha do sistema: ' + ss.getUrl());
  Logger.log('Usuário admin: tereza · senha provisória: ' + senha);
  Logger.log('Próximo passo: preencher planilhaId das unidades na aba Unidades.');
}

// Cadastra unidade e já copia as metas padrão para ela.
function criarUnidade(id, nome, municipio, modelo, planilhaId) {
  inserirLinha_(ABAS.UNIDADES, { id: id, nome: nome, municipio: municipio, modelo: modelo, planilhaId: planilhaId || '', ativo: true });
  METAS_PADRAO.forEach(([k, v, d, r]) => inserirLinha_(ABAS.METAS, { unidade: id, indicador: k, valor: v, direcao: d, rotulo: r }));
}

// Ex.: criarUsuario('maria.jurema', 'Maria', 'coordenador', 'upa-jurema')
// Sem senha informada, gera uma provisória e mostra no log de execução.
function criarUsuario(login, nome, perfil, unidade, senha) {
  login = String(login).trim().toLowerCase();
  if (['admin', 'coordenador'].indexOf(perfil) < 0) throw new Error('Perfil deve ser admin ou coordenador.');
  if (perfil === 'coordenador' && !unidades_().some(un => un.id === unidade)) throw new Error('Unidade inexistente: ' + unidade);
  if (buscarUsuario_(login)) throw new Error('Login já existe: ' + login);
  senha = senha || senhaProvisoria_();
  const salt = Utilities.getUuid();
  inserirLinha_(ABAS.USUARIOS, { login: login, nome: nome, perfil: perfil, unidade: unidade || '', salt: salt, hash: hashSenha_(senha, salt), trocarSenha: true, ativo: true });
  Logger.log('Usuário ' + login + ' criado · senha provisória: ' + senha);
}

// Redefine a senha e obriga a troca no próximo acesso.
function redefinirSenha(login) {
  const u = buscarUsuario_(String(login).trim().toLowerCase());
  if (!u) throw new Error('Usuário não encontrado: ' + login);
  const senha = senhaProvisoria_();
  const salt = Utilities.getUuid();
  atualizarLinha_(ABAS.USUARIOS, u._linha, { salt: salt, hash: hashSenha_(senha, salt), trocarSenha: true });
  Logger.log('Nova senha provisória de ' + u.login + ': ' + senha);
}

// aleatoriedade do UUID (criptográfica), sem caracteres ambíguos
function senhaProvisoria_() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + Utilities.getUuid());
  let s = '';
  for (let i = 0; i < 10; i++) s += chars[(bytes[i] + 256) % chars.length];
  return s;
}

// 1x: agenda a virada do mês para o dia 1, de madrugada.
function instalarGatilhos() {
  ScriptApp.getProjectTriggers()
    .filter(t => ['virarMes', 'backupDiario'].indexOf(t.getHandlerFunction()) >= 0)
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('virarMes').timeBased().onMonthDay(1).atHour(1).create();
  ScriptApp.newTrigger('backupDiario').timeBased().everyDays(1).atHour(2).create();
  Logger.log('Gatilhos instalados: virada do mês (dia 1, 1h) e backup diário (2h).');
}

// ── Backup ─────────────────────────────────────────────────────
// Copia a planilha do Sistema e a planilha de saídas de cada unidade para a pasta "Backup"
// (dentro da pasta do projeto), uma cópia por dia, e apaga as cópias com mais de 30 dias.
const BACKUP_DIAS = 30;

function pastaBackup_() {
  const pastaId = PropertiesService.getScriptProperties().getProperty('PASTA_ID');
  if (!pastaId) throw new Error('Defina a propriedade de script PASTA_ID.');
  const raiz = DriveApp.getFolderById(pastaId);
  const achadas = raiz.getFoldersByName('Backup');
  return achadas.hasNext() ? achadas.next() : raiz.createFolder('Backup');
}

// Data (AAAA-MM-DD) no fim do nome da cópia, ou null se o arquivo não for uma cópia nossa.
function dataDoBackup_(nome) {
  const m = / — (\d{4}-\d{2}-\d{2})$/.exec(String(nome));
  return m ? m[1] : null;
}

function backupDiario() {
  const pasta = pastaBackup_();
  const hoje = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  const alvos = [{ nome: 'Sistema', id: PropertiesService.getScriptProperties().getProperty('SISTEMA_ID') }];
  unidades_().forEach(un => { if (un.planilhaId) alvos.push({ nome: 'Saídas ' + un.id, id: String(un.planilhaId).trim() }); });

  let feitos = 0;
  alvos.forEach(a => {
    const nomeCopia = a.nome + ' — ' + hoje;
    try {
      if (pasta.getFilesByName(nomeCopia).hasNext()) return; // já feito hoje
      DriveApp.getFileById(a.id).makeCopy(nomeCopia, pasta);
      feitos++;
    } catch (err) {
      registrar_('sistema', 'backup.erro', a.nome + ': ' + err.message);
    }
  });

  // retenção: só mexe em arquivos com o padrão "nome — AAAA-MM-DD"
  const limite = Utilities.formatDate(new Date(Date.now() - BACKUP_DIAS * 86400000), TZ, 'yyyy-MM-dd');
  let apagados = 0;
  const arquivos = pasta.getFiles();
  while (arquivos.hasNext()) {
    const arq = arquivos.next();
    const dia = dataDoBackup_(arq.getName());
    if (dia && dia < limite) { arq.setTrashed(true); apagados++; }
  }
  registrar_('sistema', 'backup', feitos + ' cópia(s) feita(s), ' + apagados + ' antiga(s) removida(s)');
}

// Para rodar à mão no editor (testar o backup sem esperar o gatilho).
function backupAgora() {
  backupDiario();
  Logger.log('Backup concluído. Veja a pasta "Backup" dentro da pasta do projeto e a aba Log.');
}

// Diagnóstico: mostra o que o sistema enxerga na planilha de cada unidade.
function diagnosticarPlanilhas() {
  unidades_().forEach(un => {
    if (!un.planilhaId) { Logger.log(un.id + ': sem planilhaId'); return; }
    const ss = planilhaDaUnidade_(un);
    ABAS_LOGISTICA.forEach(nome => {
      const sh = ss.getSheetByName(nome);
      if (!sh) { Logger.log(un.id + ' / ' + nome + ': aba não encontrada'); return; }
      const est = estruturaAba_(sh);
      Logger.log(un.id + ' / ' + nome + ': ' + est.itens.length + ' produtos · meses ' +
        est.meses.map(m => MESES_ROTULO[m.mes]).join(', ') + ' · CMM col ' + (est.colCmm + 1) + ' · estoque col ' + (est.colEst + 1));
    });
  });
}
