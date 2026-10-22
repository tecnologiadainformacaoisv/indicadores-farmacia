// Usuários: a coordenação cadastra coordenadores, redefine senhas e desativa acessos.
// Toda regra é conferida no servidor; esta tela só monta a interface.

let info = null;
let usuarios = [];
let editando = null;          // login em edição (null = cadastrando)
let loginTocado = false;      // se a pessoa já digitou o usuário, para de sugerir
let filtroSit = 'todos';      // todos | ativos | semsenha | desativados
let filtroUn = '';            // id da unidade ('' = todas)

function situacaoDe(u) {
  if (u.perfil === 'admin') return 'admin';
  if (!u.ativo) return 'desativados';
  return u.trocarSenha ? 'semsenha' : 'ativos';
}

// Painel de situação: números por categoria (também são os filtros) e aviso de unidade sem coordenador.
function renderSaude() {
  const coords = usuarios.filter(u => u.perfil === 'coordenador');
  const conta = s => coords.filter(u => situacaoDe(u) === s).length;
  $('s-todos').textContent = coords.length;
  $('s-ativos').textContent = conta('ativos');
  $('s-semsenha').textContent = conta('semsenha');
  $('s-desativados').textContent = conta('desativados');
  document.querySelectorAll('#saude-itens [data-filtro]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.filtro === filtroSit)));
  const sem = info.unidades.filter(un => !coords.some(c => c.ativo && c.unidade === un.id));
  const aviso = $('saude-aviso');
  aviso.hidden = !sem.length;
  aviso.textContent = sem.length ? 'Sem coordenador ativo: ' + sem.map(un => un.nome).join(', ') + '.' : '';
}

const $ = id => document.getElementById(id);

function setStatus(texto, tipo) {
  const el = $('usr-status');
  el.textContent = texto || '';
  el.className = 'notice' + (tipo ? ' ' + tipo : '');
  el.hidden = !texto;
  $('usr-retry').hidden = true;
  if (texto && tipo) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); // quem clicou lá embaixo vê o resultado
}

function setMsg(texto, tipo) {
  const el = $('form-msg');
  el.textContent = texto || '';
  el.className = 'form-msg' + (tipo ? ' ' + tipo : '');
}

function nomeUnidade(id) {
  const un = info && info.unidades.find(u => u.id === id);
  return un ? un.nome : id || '—';
}

function normalizar(s) {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// "Maria da Silva" -> "maria.silva"
function sugerirLogin(nome) {
  const partes = normalizar(nome).replace(/[^a-z\s]/g, '').split(/\s+/).filter(p => p && !['da', 'de', 'do', 'das', 'dos', 'e'].includes(p));
  if (!partes.length) return '';
  return partes.length === 1 ? partes[0] : partes[0] + '.' + partes[partes.length - 1];
}

// ── Lista ──────────────────────────────────────────────────────
function render() {
  const q = normalizar($('busca').value.trim());
  const ordem = [...usuarios].sort((a, b) =>
    (a.perfil === 'admin') - (b.perfil === 'admin') ||
    nomeUnidade(a.unidade).localeCompare(nomeUnidade(b.unidade)) || a.nome.localeCompare(b.nome));
  renderSaude();
  const visiveis = ordem.filter(u =>
    (!q || normalizar([u.nome, u.login, nomeUnidade(u.unidade)].join(' ')).includes(q)) &&
    (u.perfil === 'admin' ? filtroSit === 'todos' && !filtroUn : (filtroSit === 'todos' || situacaoDe(u) === filtroSit) && (!filtroUn || u.unidade === filtroUn)));

  const filtrando = !!q || filtroSit !== 'todos' || !!filtroUn;
  $('contagem').textContent = filtrando ? `(${visiveis.length} de ${usuarios.length})` : `(${usuarios.length})`;
  $('vazio').textContent = filtrando
    ? 'Nenhum resultado com a busca e os filtros atuais.'
    : 'Nenhum usuário cadastrado ainda. Use o formulário acima para cadastrar o primeiro coordenador.';
  $('lista').innerHTML = visiveis.map(u => {
    const admin = u.perfil === 'admin';
    const selos = [
      admin ? '<span class="usr-sel">Coordenação do Instituto</span>' : '',
      u.ativo ? '<span class="usr-sel ok">Ativo</span>' : '<span class="usr-sel off">Desativado</span>',
      u.ativo && u.trocarSenha ? '<span class="usr-sel aviso">Ainda não criou a própria senha</span>' : '',
    ].join('');
    const acoes = admin
      ? '<span class="usr-item__meta">Conta gerenciada pela TI</span>'
      : `<button type="button" class="btn-sec" data-acao="editar" data-login="${esc(u.login)}">Editar</button>
         <button type="button" class="btn-sec" data-acao="senha" data-login="${esc(u.login)}">Redefinir senha</button>
         <button type="button" class="btn-sec ${u.ativo ? 'perigo' : ''}" data-acao="${u.ativo ? 'desativar' : 'ativar'}" data-login="${esc(u.login)}">${u.ativo ? 'Desativar acesso' : 'Reativar acesso'}</button>`;
    return `<li class="usr-item${u.ativo ? '' : ' inativo'}${u.login === editando ? ' editando' : ''}">
      <div>
        <div class="usr-item__nome">${esc(u.nome)}</div>
        <div class="usr-item__meta">${esc(u.login)}${admin ? '' : ' · ' + esc(nomeUnidade(u.unidade))}</div>
        <div class="usr-item__sel">${selos}</div>
      </div>
      <div class="usr-item__acoes">${acoes}</div>
    </li>`;
  }).join('');
  $('vazio').hidden = visiveis.length > 0;
}

async function carregar() {
  setStatus('Carregando os usuários…');
  let r;
  try {
    r = await api('usuarios.carregar');
  } catch (e) {
    if (e.codigo === 'permissao') { location.href = 'index.html'; return false; }
    setStatus(e.message, 'erro');
    $('usr-retry').hidden = false;
    return false;
  }
  info = r.sessao;
  if (!validarSessao(info)) return false;
  usuarios = r.usuarios;
  if (!$('f-unidade').options.length) montarSelectUnidades();
  if (!$('filtro-unidade').options.length) {
    $('filtro-unidade').innerHTML = '<option value="">Todas as unidades</option>' + info.unidades.map(u => `<option value="${esc(u.id)}">${esc(u.nome)}</option>`).join('');
  }
  setStatus('');
  render();
  return true;
}

// ── Senha provisória (mostrada uma única vez) ──────────────────
function mostrarCredencial(titulo, login, senha, nome) {
  $('cred').dataset.nome = nome || '';
  $('cred-titulo').textContent = titulo;
  $('cred-login').textContent = login;
  $('cred-senha').textContent = senha;
  $('cred-msg').textContent = '';
  $('cred').hidden = false;
  window.addEventListener('beforeunload', avisarSaida); // a senha só aparece uma vez: não deixa perder sem querer
  $('cred').scrollIntoView({ behavior: 'smooth', block: 'center' });
  $('cred-copiar').focus();
}

function fecharCredencial() {
  window.removeEventListener('beforeunload', avisarSaida);
  $('cred').hidden = true;
  $('cred-login').textContent = '';
  $('cred-senha').textContent = ''; // não deixa a senha na tela nem na página
  delete $('cred').dataset.nome;
}

function avisarSaida(e) { e.preventDefault(); e.returnValue = ''; }

function textoBoasVindas() {
  const endereco = location.origin + location.pathname.replace(/usuarios\.html$/, 'index.html');
  const nome = $('cred').dataset.nome;
  return (nome ? `Olá, ${nome.split(' ')[0]}! ` : '') +
    `Seu acesso ao sistema Indicadores da Farmácia (ISV):\nEndereço: ${endereco}\nUsuário: ${$('cred-login').textContent}\nSenha provisória: ${$('cred-senha').textContent}\nAo entrar, crie a sua própria senha.`;
}

// abre o WhatsApp com a mensagem pronta; a pessoa escolhe o contato
function enviarWhats() {
  window.open('https://wa.me/?text=' + encodeURIComponent(textoBoasVindas()), '_blank', 'noopener');
}

async function copiarCredencial() {
  const texto = textoBoasVindas();
  try {
    await navigator.clipboard.writeText(texto);
    $('cred-msg').textContent = 'Copiado!';
  } catch (e) {
    // sem permissão de área de transferência: seleciona a senha para copiar à mão
    const r = document.createRange();
    r.selectNodeContents($('cred-senha'));
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
    $('cred-msg').textContent = 'Senha selecionada. Toque e segure (ou use Ctrl+C) para copiar.';
  }
}

// ── Formulário ─────────────────────────────────────────────────
// "extra" mantém visível a unidade de quem está sendo editado, mesmo que ela tenha sido inativada.
function montarSelectUnidades(extra) {
  const opcoes = info.unidades.map(u => `<option value="${esc(u.id)}">${esc(u.nome)}</option>`);
  if (extra && !info.unidades.some(u => u.id === extra)) opcoes.push(`<option value="${esc(extra)}">${esc(extra)} (unidade inativa)</option>`);
  $('f-unidade').innerHTML = opcoes.join('');
}

function modoCadastro() {
  editando = null;
  filtroSit = 'todos'; filtroUn = '';
  if ($('filtro-unidade')) $('filtro-unidade').value = '';
  if (info) montarSelectUnidades();
  loginTocado = false;
  $('form-usuario').reset();
  $('f-login').readOnly = false;
  $('form-titulo').textContent = 'Novo coordenador';
  $('f-login-dica').textContent = 'Minúsculas, números, ponto ou hífen. Ex.: maria.silva';
  $('btn-salvar').textContent = 'Cadastrar coordenador';
  $('btn-cancelar').hidden = true;
  setMsg('');
  if (info) render();
}

function modoEdicao(u) {
  editando = u.login;
  montarSelectUnidades(u.unidade);
  $('f-nome').value = u.nome;
  $('f-login').value = u.login;
  $('f-login').readOnly = true;
  $('f-unidade').value = u.unidade;
  $('form-titulo').textContent = 'Editar ' + u.nome;
  $('f-login-dica').textContent = 'O usuário não pode ser alterado.';
  $('btn-salvar').textContent = 'Salvar alterações';
  $('btn-cancelar').hidden = false;
  setMsg('');
  render();
  $('form-usuario').scrollIntoView({ behavior: 'smooth', block: 'start' });
  $('f-nome').focus();
}

$('f-nome').addEventListener('input', () => {
  if (editando || loginTocado) return;
  $('f-login').value = sugerirLogin($('f-nome').value);
});
$('f-login').addEventListener('input', () => { loginTocado = true; });
$('btn-cancelar').addEventListener('click', modoCadastro);
$('cred-copiar').addEventListener('click', copiarCredencial);
$('cred-whats').addEventListener('click', enviarWhats);
$('saude-itens').addEventListener('click', e => {
  const b = e.target.closest('[data-filtro]');
  if (!b) return;
  filtroSit = b.dataset.filtro;
  render();
});
$('filtro-unidade').addEventListener('change', e => { filtroUn = e.target.value; render(); });
$('cred-fechar').addEventListener('click', fecharCredencial);
$('busca').addEventListener('input', render);

$('form-usuario').addEventListener('submit', async ev => {
  ev.preventDefault();
  const nome = $('f-nome').value.trim();
  const login = $('f-login').value.trim().toLowerCase();
  const unidade = $('f-unidade').value;
  if (nome.length < 2) { setMsg('Informe o nome.', 'erro'); $('f-nome').focus(); return; }
  if (!editando && !/^[a-z0-9._-]{3,30}$/.test(login)) {
    setMsg('O usuário deve ter de 3 a 30 caracteres: minúsculas, números, ponto, hífen ou sublinhado.', 'erro');
    $('f-login').focus();
    return;
  }
  const btn = $('btn-salvar');
  btn.disabled = true;
  setMsg('Salvando…');
  try {
    if (editando) {
      await api('usuarios.atualizar', { login: editando, nome, unidade });
      modoCadastro();
      await carregar();
      setStatus('Dados atualizados.', 'ok');
    } else {
      const r = await api('usuarios.criar', { login, nome, unidade });
      modoCadastro();
      mostrarCredencial('Coordenador cadastrado: ' + r.nome, r.login, r.senhaProvisoria, r.nome);
      await carregar();
    }
  } catch (e) {
    setMsg(e.message, 'erro');
  } finally {
    btn.disabled = false;
  }
});

// ── Ações da lista ─────────────────────────────────────────────
// depois de desativar/reativar, um botão no aviso desfaz sem pedir confirmação de novo
function oferecerDesfazer(u, eraAtivar) {
  const el = $('usr-status');
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'btn-sec desfazer';
  b.textContent = 'Desfazer';
  b.addEventListener('click', async () => {
    b.disabled = true;
    try {
      await api('usuarios.definirAtivo', { login: u.login, ativo: !eraAtivar });
      await carregar();
      setStatus('Acesso de ' + u.nome + ' ' + (eraAtivar ? 'desativado' : 'reativado') + ' de novo.', 'ok');
    } catch (e) { setStatus(e.message, 'erro'); oferecerDesfazer(u, eraAtivar); }
  });
  el.append(' ', b);
}

$('lista').addEventListener('click', async ev => {
  const b = ev.target.closest('button[data-acao]');
  if (!b) return;
  const u = usuarios.find(x => x.login === b.dataset.login);
  if (!u) return;
  const acao = b.dataset.acao;

  if (acao === 'editar') { modoEdicao(u); return; }

  const textos = {
    senha: `Redefinir a senha de ${u.nome}? A senha atual deixa de valer e a pessoa será desconectada.`,
    desativar: `Desativar o acesso de ${u.nome}? A pessoa não conseguirá mais entrar. Os lançamentos já feitos continuam.`,
    ativar: `Reativar o acesso de ${u.nome}?`,
  };
  if (!confirm(textos[acao])) return;

  b.disabled = true;
  try {
    if (acao === 'senha') {
      const r = await api('usuarios.redefinirSenha', { login: u.login });
      mostrarCredencial('Nova senha provisória de ' + r.nome, r.login, r.senhaProvisoria, r.nome);
      await carregar();
    } else {
      await api('usuarios.definirAtivo', { login: u.login, ativo: acao === 'ativar' });
      await carregar();
      setStatus(`Acesso de ${u.nome} ${acao === 'ativar' ? 'reativado' : 'desativado'}.`, 'ok');
      oferecerDesfazer(u, acao === 'ativar');
    }
  } catch (e) {
    setStatus(e.message, 'erro');
    b.disabled = false;
  }
});

$('usr-retry').addEventListener('click', carregar);
carregar();
