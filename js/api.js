// Cliente da API (Apps Script) e sessão do usuário. Usado por todas as telas.

// URL do Web App (Apps Script → Implantar → App da Web). Ver docs/IMPLANTACAO.md.
const API_URL = 'https://script.google.com/macros/s/AKfycbyXW2DjopCrX4Xa_Kwdd7fSblDptfisk2Usa0ZmEBuL7bCFY3DbZhory-VbaqXQrzA6/exec';

const SESSAO_KEY = 'farma_sessao';
const MESES_NOME = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function lerToken() {
  try { return localStorage.getItem(SESSAO_KEY); } catch (e) { return null; }
}

function gravarToken(token) {
  try { localStorage.setItem(SESSAO_KEY, token); } catch (e) { /* sem armazenamento: sessão só nesta página */ }
}

function limparToken() {
  try { localStorage.removeItem(SESSAO_KEY); } catch (e) { /* ignora */ }
}

// O Apps Script falha de forma intermitente: às vezes devolve uma página de erro 500
// (sem cabeçalho CORS, então o navegador vê "falha de rede"). Repetir a chamada resolve.
// Todas as ações aceitam repetição, menos a troca de senha (a 2ª tentativa viria com a senha antiga).
const TENTATIVAS_REDE = 3;
const SEM_REPETICAO = ['trocarSenha'];

async function chamar(action, dados) {
  const res = await fetch(API_URL, {
    method: 'POST',
    // text/plain evita o preflight de CORS, que o Apps Script não responde
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, token: lerToken(), ...(dados || {}) }),
    redirect: 'follow',
  });
  return res.json();
}

async function api(action, dados) {
  if (!API_URL) throw new Error('O sistema ainda não está ligado ao servidor. Avise a TI.');
  const max = SEM_REPETICAO.includes(action) ? 1 : TENTATIVAS_REDE;
  let json;
  let falhou = null;
  for (let i = 1; i <= max; i++) {
    try {
      json = await chamar(action, dados);
      falhou = null;
      break;
    } catch (e) {
      falhou = e;
      if (i < max) await new Promise(r => setTimeout(r, 700 * i));
    }
  }
  if (falhou) {
    throw new Error(falhou instanceof SyntaxError
      ? 'O servidor respondeu de forma inesperada. Tente de novo em instantes; se continuar, avise a TI.'
      : 'Sem conexão com o servidor. Verifique a internet e tente de novo.');
  }
  if (!json.ok) {
    if (action !== 'login' && (json.codigo === 'sessao' || json.codigo === 'senhaProvisoria')) {
      if (json.codigo === 'sessao') {
        limparToken();
        try { sessionStorage.setItem('farma_aviso', json.erro); } catch (e) { /* sem armazenamento: sem aviso */ }
      }
      // a tela pode guardar o que estava sendo digitado antes de sair (ver logistica.js)
      if (typeof window.antesDeSairDaSessao === 'function') window.antesDeSairDaSessao();
      location.href = 'index.html';
    }
    throw new Error(json.erro || 'Erro no servidor.');
  }
  return json.dados;
}

// Use no início de cada tela protegida. Sem sessão, volta para o login.
async function exigirSessao() {
  if (!lerToken()) {
    location.href = 'index.html';
    return new Promise(() => {});
  }
  const info = await api('sessao');
  if (info.usuario.trocarSenha) {
    location.href = 'index.html';
    return new Promise(() => {});
  }
  mostrarUsuario(info.usuario);
  return info;
}

async function sair() {
  try { await api('sair'); } catch (e) { /* sai mesmo sem resposta */ }
  limparToken();
  location.href = 'index.html';
}

function rotuloPerfil(u) {
  return u.perfil === 'admin' ? 'Coordenação farmacêutica' : 'Coordenador da unidade';
}

// Nome do usuário e botão Sair no cabeçalho, antes do selo de versão.
function mostrarUsuario(u) {
  const acoes = document.querySelector('.page-header__actions');
  if (!acoes || acoes.querySelector('.user-chip')) return;
  const chip = document.createElement('span');
  chip.className = 'user-chip';
  chip.innerHTML = `<b>${esc(u.nome)}</b><small>${esc(rotuloPerfil(u))}</small>`;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'header-btn';
  btn.textContent = 'Sair';
  btn.addEventListener('click', sair);
  acoes.prepend(chip, btn);
}

function nomeMes(ref) {
  return MESES_NOME[ref.mes] + '/' + ref.ano;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
