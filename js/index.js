// Tela inicial: login, troca da senha provisória e menu.

const views = ['login', 'senha', 'home'];

function mostrar(view) {
  views.forEach(v => { document.getElementById('view-' + v).hidden = v !== view; });
  document.getElementById('btn-retry').hidden = true;
  // no celular, focar abriria o teclado e esconderia o formulário
  const primeiro = document.querySelector('#view-' + view + ' input');
  if (primeiro && window.matchMedia('(min-width: 768px)').matches) primeiro.focus();
}

function status(msg, tipo) {
  const el = document.getElementById('index-status');
  el.textContent = msg || '';
  el.className = 'notice' + (tipo ? ' ' + tipo : '');
  el.hidden = !msg;
}

function msg(id, texto, tipo) {
  const el = document.getElementById(id);
  el.textContent = texto || '';
  el.className = 'form-msg' + (tipo ? ' ' + tipo : '');
}

async function carregar() {
  if (!lerToken()) {
    mostrar('login');
    // motivo do retorno ao login (ex.: sessão expirada em outra tela)
    try {
      const aviso = sessionStorage.getItem('farma_aviso');
      if (aviso) { sessionStorage.removeItem('farma_aviso'); msg('login-msg', aviso, 'erro'); }
    } catch (e) { /* ignora */ }
    return;
  }
  // abre na hora com o que foi carregado da última vez e atualiza por trás
  const emCache = cacheLer('sessao');
  const mostrouCache = !!emCache && !emCache.dados.usuario.trocarSenha;
  if (mostrouCache) montarHome(emCache.dados);
  else status('Carregando…');
  try {
    const info = await api('sessao');
    cacheGravar('sessao', info);
    status('');
    if (info.usuario.trocarSenha) { mostrarUsuario(info.usuario); mostrar('senha'); return; }
    montarHome(info);
  } catch (e) {
    if (mostrouCache && lerToken()) {   // falha ao atualizar: mantém o que já está na tela
      status(e.message + ' Mostrando os dados da última visita.', 'warn');
      return;
    }
    if (!lerToken()) {          // sessão inválida: volta ao login
      status('');
      mostrar('login');
      msg('login-msg', e.message, 'erro');
      return;
    }
    // falha de rede/servidor com sessão válida: não desloga, oferece tentar de novo
    views.forEach(v => { document.getElementById('view-' + v).hidden = true; });
    status(e.message, 'erro');
    document.getElementById('btn-retry').hidden = false;
  }
}

document.getElementById('btn-retry').addEventListener('click', carregar);

document.querySelectorAll('[data-mostrar-senha]').forEach(chk => {
  chk.addEventListener('change', () => {
    chk.closest('form').querySelectorAll('input[type=password], input[data-era-senha]').forEach(inp => {
      inp.dataset.eraSenha = '1';
      inp.type = chk.checked ? 'text' : 'password';
    });
  });
});

function montarHome(info) {
  const u = info.usuario;
  mostrarUsuario(u);
  const admin = u.perfil === 'admin';
  const unidade = info.unidades[0];
  document.getElementById('home-ola').textContent = 'Olá, ' + u.nome;
  document.getElementById('home-intro').textContent = admin
    ? 'Acompanhe os lançamentos de todas as unidades e defina as metas.'
    : `${unidade ? unidade.nome : 'Sua unidade'} · mês aberto para lançamento: ${nomeMes(info.mesAberto)}.`;
  document.getElementById('card-indicadores').textContent = admin
    ? 'Indicadores de todas as unidades, metas e alertas.'
    : 'Lance os indicadores clínicos e de logística do mês.';
  document.getElementById('card-logistica').textContent = admin
    ? 'Consulte as saídas de medicamentos e materiais de cada unidade.'
    : 'Lance as saídas, o CMM e o estoque de cada item.';
  document.getElementById('card-dashboard').hidden = !admin;
  if (info.mesAberto.teste) status('Ambiente de teste: o mês aberto está fixo em ' + nomeMes(info.mesAberto) + '.', 'warn');
  mostrar('home');
}

document.getElementById('form-login').addEventListener('submit', async ev => {
  ev.preventDefault();
  const btn = ev.target.querySelector('button[type=submit]');
  const login = document.getElementById('login-usuario').value.trim();
  const senha = document.getElementById('login-senha').value;
  if (!login || !senha) { msg('login-msg', 'Informe usuário e senha.', 'erro'); return; }
  btn.disabled = true;
  msg('login-msg', 'Entrando…');
  try {
    const r = await api('login', { login, senha });
    gravarToken(r.token);
    document.getElementById('login-senha').value = '';
    msg('login-msg', '');
    await carregar();
  } catch (e) {
    msg('login-msg', e.message, 'erro');
  } finally {
    btn.disabled = false;
  }
});

document.getElementById('form-senha').addEventListener('submit', async ev => {
  ev.preventDefault();
  const btn = ev.target.querySelector('button[type=submit]');
  const senhaAtual = document.getElementById('senha-atual').value;
  const novaSenha = document.getElementById('senha-nova').value;
  const conf = document.getElementById('senha-conf').value;
  if (novaSenha.length < 8) { msg('senha-msg', 'A nova senha precisa ter pelo menos 8 caracteres.', 'erro'); return; }
  if (novaSenha !== conf) { msg('senha-msg', 'As duas senhas novas não são iguais.', 'erro'); return; }
  btn.disabled = true;
  try {
    const r = await api('trocarSenha', { senhaAtual, novaSenha });
    gravarToken(r.token); // a troca encerra as sessões antigas; esta segue com token novo
    ev.target.reset();
    msg('senha-msg', '');
    await carregar();
  } catch (e) {
    msg('senha-msg', e.message, 'erro');
  } finally {
    btn.disabled = false;
  }
});

carregar();
