// Tela inicial: login, troca da senha provisória e menu.

const views = ['login', 'senha', 'skel', 'home'];

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
  const emCache = cacheLer('painel');
  const mostrouCache = !!emCache && !emCache.dados.sessao.usuario.trocarSenha;
  if (mostrouCache) montarHome(emCache.dados);
  else mostrar('skel');
  try {
    const painel = await api('painel.carregar');
    cacheGravar('painel', painel);
    status('');
    if (painel.sessao.usuario.trocarSenha) { mostrarUsuario(painel.sessao.usuario); mostrar('senha'); return; }
    montarHome(painel);
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

// ── Fechamento do mês ──────────────────────────────────────────
const ICONE_OK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

function saidasResumo(unidade) {
  const sd = unidade.saidas;
  if (!sd) return { feito: false, parcial: false, pct: 0, texto: 'Nenhum item lançado ainda.' };
  const pre = sd.med.preenchidos + sd.mat.preenchidos;
  const tot = sd.med.total + sd.mat.total;
  // aba ainda não salva nenhuma vez tem total 0: não pode contar como lançada
  const duasAbas = sd.med.total > 0 && sd.mat.total > 0;
  const feito = duasAbas && pre >= tot;
  const parte = (nome, a) => a.total ? `${nome} ${a.preenchidos} de ${a.total}` : `${nome}: nenhum item lançado`;
  const detalhe = parte('Medicamentos', sd.med) + ' · ' + parte('Materiais', sd.mat);
  return {
    feito, parcial: pre > 0 && !feito, pct: tot ? Math.min(duasAbas ? 100 : 99, Math.round(pre / tot * 100)) : 0,
    texto: detalhe + (sd.em ? `. Atualizada por ${sd.por} em ${sd.em}.` : '.'),
  };
}

function unidadeCompleta(un) { return un.clinica.lancado && saidasResumo(un).feito; }

function tarefa(href, titulo, feito, texto, acao, pct) {
  return `<li><a class="fech-tarefa ${feito ? 'ok' : 'pend'}" href="${href}">
    <span class="fech-marca">${ICONE_OK}</span>
    <span><b>${esc(titulo)}</b><small>${esc(texto)}</small></span>
    <span class="fech-acao">${esc(acao)}</span>
    ${pct === undefined ? '' : `<span class="fech-barra" style="--w:${pct}"><i></i></span>`}
  </a></li>`;
}

// selo; com href vira link (só para o que já tem lançamento para ver)
function selo(ok, texto, href, dica, nome) {
  if (!href) return `<span class="fech-selo${ok ? ' ok' : ''}"${dica ? ` title="${esc(dica)}"` : ''}>${esc(texto)}</span>`;
  return `<a class="fech-selo${ok ? ' ok' : ''}" href="${esc(href)}"${nome ? ` aria-label="${esc(texto + ' — ' + nome)}"` : ''}>${esc(texto)}</a>`;
}

function montarFechamento(painel, admin) {
  const mes = nomeMes(painel.mesAberto);
  const uns = painel.unidades;
  document.getElementById('fech-titulo').textContent = 'Fechamento de ' + mes;
  const lista = document.getElementById('fech-lista');
  let feitos, total;

  if (admin) {
    const completas = uns.filter(unidadeCompleta).length;
    feitos = completas; total = uns.length;
    document.getElementById('fech-sub').textContent = `${completas} de ${uns.length} unidades com tudo lançado.`;
    lista.innerHTML = uns.map(un => {
      const sd = saidasResumo(un);
      const ultima = [un.clinica.lancado ? { por: un.clinica.por, em: un.clinica.em } : null, un.saidas ? { por: un.saidas.por, em: un.saidas.em } : null].filter(Boolean).pop();
      const quando = ultima ? `Última atualização: ${ultima.por}, ${ultima.em}` : 'Nada lançado ainda neste mês.';
      const q = '?unidade=' + encodeURIComponent(un.id);
      return `<li class="fech-unidade"><div><b><a class="fech-link" href="indicadores.html${q}">${esc(un.nome)}</a></b><small>${esc(quando)}</small></div>
        <div class="fech-selos">${selo(un.clinica.lancado, un.clinica.lancado ? 'Clínica lançada' : 'Clínica pendente', un.clinica.lancado ? 'indicadores.html' + q : '', 'Ainda não lançado', un.nome)}${selo(sd.feito, sd.feito ? 'Saídas completas' : sd.pct ? 'Saídas ' + sd.pct + '%' : 'Saídas pendentes', sd.pct || sd.feito ? 'logistica.html' + q : '', 'Ainda não lançado', un.nome)}</div></li>`;
    }).join('') || '<li class="fech-unidade"><div><b>Nenhuma unidade cadastrada.</b></div></li>';
    document.getElementById('fech-rodape').textContent = 'Os coordenadores lançam; aqui você acompanha. As metas de cada unidade ficam em Acompanhamento mensal.';
  } else {
    const un = uns[0];
    if (!un) { lista.innerHTML = ''; return; }
    const sd = saidasResumo(un);
    feitos = (un.clinica.lancado ? 1 : 0) + (sd.feito ? 1 : 0); total = 2;
    document.getElementById('fech-sub').textContent = feitos === 2
      ? `${un.nome}. Tudo lançado, obrigado!`
      : `${un.nome}. ${feitos === 0 ? 'Faltam 2 lançamentos.' : 'Falta 1 lançamento.'}`;
    lista.innerHTML =
      tarefa('indicadores.html?lancar=1', 'Indicadores da Clínica Geral', un.clinica.lancado,
        un.clinica.lancado ? `Lançados por ${un.clinica.por} em ${un.clinica.em}.` : 'Ainda não lançados.',
        un.clinica.lancado ? 'Revisar' : 'Lançar indicadores') +
      tarefa('logistica.html', 'Planilha de saídas', sd.feito, sd.texto,
        sd.feito ? 'Revisar' : sd.parcial ? 'Continuar lançamento' : 'Lançar saídas', sd.pct);
    document.getElementById('fech-rodape').textContent = 'Você pode salvar aos poucos: o que já foi lançado fica gravado.';
  }
  const pct = total ? Math.round(feitos / total * 100) : 0;
  const ring = document.getElementById('fech-ring');
  ring.style.setProperty('--p', pct);
  ring.setAttribute('aria-label', `${feitos} de ${total} concluídos`);
  document.getElementById('fech-ring-txt').textContent = `${feitos}/${total}`;
}

function montarHome(painel) {
  const info = painel.sessao;
  const u = info.usuario;
  mostrarUsuario(u);
  const admin = u.perfil === 'admin';
  document.getElementById('home-ola').textContent = 'Olá, ' + u.nome.split(' ')[0];
  document.getElementById('home-intro').textContent = admin
    ? 'Acompanhe o andamento de cada unidade neste mês e defina as metas.'
    : 'Veja o que falta lançar neste mês.';
  document.getElementById('card-indicadores').textContent = admin
    ? 'Indicadores de todas as unidades, metas e alertas.'
    : 'Indicadores clínicos e de logística, com gráficos.';
  document.getElementById('card-logistica').textContent = admin
    ? 'Saídas de medicamentos e materiais de cada unidade.'
    : 'Saídas, CMM e estoque de cada item.';
  document.getElementById('card-dashboard').hidden = !admin;
  document.getElementById('card-usuarios').hidden = !admin;
  document.getElementById('card-relatorios').hidden = !admin;
  montarFechamento(painel, admin);
  if (painel.mesAberto.teste) status('Ambiente de teste: o mês aberto está fixo em ' + nomeMes(painel.mesAberto) + '.', 'warn');
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
    msg('login-msg', e.message + (/incorretos/.test(e.message) ? ' Se esqueceu a senha, peça à coordenação farmacêutica para redefinir.' : ''), 'erro');
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
