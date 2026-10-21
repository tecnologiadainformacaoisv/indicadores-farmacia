// Usuários: a coordenação cadastra coordenadores, redefine senhas e desativa acessos.
// Toda regra é conferida no servidor; esta tela só monta a interface.

let info = null;
let usuarios = [];
let editando = null;          // login em edição (null = cadastrando)
let loginTocado = false;      // se a pessoa já digitou o usuário, para de sugerir

const $ = id => document.getElementById(id);

function setStatus(texto, tipo) {
  const el = $('usr-status');
  el.textContent = texto || '';
  el.className = 'notice' + (tipo ? ' ' + tipo : '');
  el.hidden = !texto;
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
  const visiveis = ordem.filter(u => !q || normalizar([u.nome, u.login, nomeUnidade(u.unidade)].join(' ')).includes(q));

  $('contagem').textContent = `(${usuarios.length})`;
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
         <button type="button" class="btn-sec ${u.ativo ? 'perigo' : ''}" data-acao="${u.ativo ? 'desativar' : 'ativar'}" data-login="${esc(u.login)}">${u.ativo ? 'Desativar' : 'Reativar'}</button>`;
    return `<li class="usr-item${u.ativo ? '' : ' inativo'}">
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
    setStatus(e.message, 'erro');
    return false;
  }
  info = r.sessao;
  if (!validarSessao(info)) return false;
  usuarios = r.usuarios;
  if (!$('f-unidade').options.length) {
    $('f-unidade').innerHTML = info.unidades.map(u => `<option value="${esc(u.id)}">${esc(u.nome)}</option>`).join('');
  }
  setStatus('');
  render();
  return true;
}

// ── Senha provisória (mostrada uma única vez) ──────────────────
function mostrarCredencial(titulo, login, senha) {
  $('cred-titulo').textContent = titulo;
  $('cred-login').textContent = login;
  $('cred-senha').textContent = senha;
  $('cred-msg').textContent = '';
  $('cred').hidden = false;
  $('cred').scrollIntoView({ behavior: 'smooth', block: 'center' });
  $('cred-copiar').focus();
}

function fecharCredencial() {
  $('cred').hidden = true;
  $('cred-login').textContent = '';
  $('cred-senha').textContent = ''; // não deixa a senha na tela nem na página
}

async function copiarCredencial() {
  const texto = `Usuário: ${$('cred-login').textContent}\nSenha provisória: ${$('cred-senha').textContent}`;
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
    $('cred-msg').textContent = 'Selecionada: use Ctrl+C para copiar.';
  }
}

// ── Formulário ─────────────────────────────────────────────────
function modoCadastro() {
  editando = null;
  loginTocado = false;
  $('form-usuario').reset();
  $('f-login').readOnly = false;
  $('form-titulo').textContent = 'Novo coordenador';
  $('btn-salvar').textContent = 'Cadastrar coordenador';
  $('btn-cancelar').hidden = true;
  setMsg('');
}

function modoEdicao(u) {
  editando = u.login;
  $('f-nome').value = u.nome;
  $('f-login').value = u.login;
  $('f-login').readOnly = true;
  $('f-unidade').value = u.unidade;
  $('form-titulo').textContent = 'Editar ' + u.nome;
  $('btn-salvar').textContent = 'Salvar alterações';
  $('btn-cancelar').hidden = false;
  setMsg('');
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
      setStatus('Dados atualizados.', '');
    } else {
      const r = await api('usuarios.criar', { login, nome, unidade });
      modoCadastro();
      mostrarCredencial('Coordenador cadastrado: ' + r.nome, r.login, r.senhaProvisoria);
      await carregar();
    }
  } catch (e) {
    setMsg(e.message, 'erro');
  } finally {
    btn.disabled = false;
  }
});

// ── Ações da lista ─────────────────────────────────────────────
$('lista').addEventListener('click', async ev => {
  const b = ev.target.closest('button[data-acao]');
  if (!b) return;
  const u = usuarios.find(x => x.login === b.dataset.login);
  if (!u) return;
  const acao = b.dataset.acao;

  if (acao === 'editar') { modoEdicao(u); return; }

  const textos = {
    senha: `Redefinir a senha de ${u.nome}? A senha atual deixa de valer e a pessoa será desconectada.`,
    desativar: `Desativar ${u.nome}? Ela não conseguirá mais entrar. Os lançamentos já feitos continuam.`,
    ativar: `Reativar ${u.nome}?`,
  };
  if (!confirm(textos[acao])) return;

  b.disabled = true;
  try {
    if (acao === 'senha') {
      const r = await api('usuarios.redefinirSenha', { login: u.login });
      mostrarCredencial('Nova senha provisória de ' + r.nome, r.login, r.senhaProvisoria);
      await carregar();
    } else {
      await api('usuarios.definirAtivo', { login: u.login, ativo: acao === 'ativar' });
      await carregar();
      setStatus(`${u.nome} ${acao === 'ativar' ? 'reativado(a)' : 'desativado(a)'}.`, '');
    }
  } catch (e) {
    setStatus(e.message, 'erro');
    b.disabled = false;
  }
});

carregar();
