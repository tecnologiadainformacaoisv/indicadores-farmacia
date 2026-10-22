// Cliente da API (Apps Script) e sessão do usuário. Usado por todas as telas.

// URL do Web App (Apps Script → Implantar → App da Web). Ver docs/IMPLANTACAO.md.
const API_URL = 'https://script.google.com/macros/s/AKfycbyXW2DjopCrX4Xa_Kwdd7fSblDptfisk2Usa0ZmEBuL7bCFY3DbZhory-VbaqXQrzA6/exec';

const SESSAO_KEY = 'farma_sessao';
const MESES_NOME = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function lerToken() {
  try { return localStorage.getItem(SESSAO_KEY); } catch (e) { return null; }
}

const RASCUNHO_KEY = 'farma_rascunho'; // alterações não salvas da planilha de saídas (sessionStorage)

function gravarToken(token) {
  cacheRemover(''); // entrou alguém: nada guardado de sessão anterior vale
  try { localStorage.setItem(SESSAO_KEY, token); } catch (e) { /* sem armazenamento: sessão só nesta página */ }
}

function limparToken() {
  try { localStorage.removeItem(SESSAO_KEY); } catch (e) { /* ignora */ }
  try { sessionStorage.removeItem(RASCUNHO_KEY); } catch (e) { /* ignora */ }
  cacheRemover('');
}

// ── Cache da última resposta ──
// A tela abre na hora com o que foi carregado da última vez e atualiza por trás.
// Cada item guarda o token da sessão: outra pessoa (outro login) nunca enxerga o cache alheio,
// e sair do sistema apaga tudo.
const CACHE_PREFIXO = 'farma_cache_';

function cacheLer(chave) {
  try {
    const o = JSON.parse(localStorage.getItem(CACHE_PREFIXO + chave));
    if (o && o.token && o.token === lerToken() && Date.now() - o.ts < 24 * 3600 * 1000) return o;
  } catch (e) { /* cache ilegível: ignora */ }
  return null;
}

function cacheGravar(chave, dados) {
  try { localStorage.setItem(CACHE_PREFIXO + chave, JSON.stringify({ token: lerToken(), ts: Date.now(), dados })); } catch (e) { /* sem espaço: segue sem cache */ }
}

// Remove os itens cujo nome começa com o prefixo ('' apaga todos).
function cacheRemover(prefixo) {
  try {
    Object.keys(localStorage)
      .filter(k => k.startsWith(CACHE_PREFIXO + prefixo))
      .forEach(k => localStorage.removeItem(k));
  } catch (e) { /* ignora */ }
}

// Confere a sessão devolvida pela API; senha provisória volta para a tela inicial.
function validarSessao(info) {
  if (info.usuario.trocarSenha) {
    location.href = 'index.html';
    return false;
  }
  mostrarUsuario(info.usuario);
  return true;
}

// O Apps Script falha de forma intermitente: às vezes devolve uma página de erro 500
// (sem cabeçalho CORS, então o navegador vê "falha de rede"). Repetir a chamada resolve.
// Todas as ações aceitam repetição, menos a troca de senha (a 2ª tentativa viria com a senha antiga).
const TENTATIVAS_REDE = 3;
// usuarios.criar e redefinirSenha: se a resposta se perdesse e a chamada fosse repetida, a senha provisória gerada na 1ª ficaria perdida.
const SEM_REPETICAO = ['trocarSenha', 'usuarios.criar', 'usuarios.redefinirSenha'];

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

// Se o servidor demora, avisa que não travou (o Apps Script às vezes leva alguns segundos).
const AVISO_LENTO_MS = 8000;
let chamadasPendentes = 0;
let avisoLentoEl = null;

function mostrarAvisoLento() {
  if (chamadasPendentes <= 0 || avisoLentoEl) return;
  avisoLentoEl = document.createElement('div');
  avisoLentoEl.className = 'aviso-lento';
  avisoLentoEl.setAttribute('role', 'status');
  avisoLentoEl.textContent = 'O servidor está demorando mais que o normal. Aguarde um instante…';
  document.body.appendChild(avisoLentoEl);
}

function esconderAvisoLento() {
  if (chamadasPendentes > 0 || !avisoLentoEl) return;
  avisoLentoEl.remove();
  avisoLentoEl = null;
}

async function api(action, dados) {
  chamadasPendentes++;
  const t = setTimeout(mostrarAvisoLento, AVISO_LENTO_MS);
  try {
    return await apiChamada(action, dados);
  } finally {
    clearTimeout(t);
    chamadasPendentes--;
    esconderAvisoLento();
  }
}

async function apiChamada(action, dados) {
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
      : 'Sem conexão com o servidor. Verifique a internet e tente de novo em instantes.');
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
    const err = new Error(json.erro || 'Erro no servidor.');
    err.codigo = json.codigo;
    throw err;
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
  const iniciais = String(u.nome).split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();
  const chip = document.createElement('span');
  chip.className = 'user-chip';
  chip.innerHTML = `<span class="user-chip__avatar" aria-hidden="true">${esc(iniciais)}</span><span class="user-chip__txt"><b>${esc(u.nome)}</b><small>${esc(rotuloPerfil(u))}</small></span>`;
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

// ── Rodapé: "Como usar" e "Relatar problema" ────────────────────
// E-mail da TI que recebe os relatos. Vazio = o link de relato não aparece.
const CONTATO_SUPORTE = '';

function linkRelatar() {
  const versao = typeof APP_VERSION !== 'undefined' ? APP_VERSION : '';
  const assunto = 'Indicadores da Farmácia v' + versao + ': problema ou sugestão';
  const corpo = 'O que você estava fazendo:\n\nO que aconteceu (ou o que gostaria que existisse):\n\n\n---\nPágina: ' + location.origin + location.pathname + '\nVersão: ' + versao;
  return 'mailto:' + CONTATO_SUPORTE + '?subject=' + encodeURIComponent(assunto) + '&body=' + encodeURIComponent(corpo);
}

function montarRodape() {
  const rodape = document.querySelector('.app-footer');
  if (!rodape || rodape.querySelector('.rodape-links')) return;
  const nav = document.createElement('span');
  nav.className = 'rodape-links';
  nav.innerHTML = '<a href="ajuda.html">Como usar</a>' + (CONTATO_SUPORTE ? ' · <a href="' + esc(linkRelatar()) + '">Relatar problema ou sugestão</a>' : '');
  rodape.insertBefore(nav, rodape.lastElementChild);
}
document.addEventListener('DOMContentLoaded', montarRodape);
