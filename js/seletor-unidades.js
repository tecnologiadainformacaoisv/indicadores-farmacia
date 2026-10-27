// Recurso visual: SELETOR DE UNIDADES (tag visual-seletor-unidades)
// Botão no topo (à esquerda do usuário) que abre uma janela modal para escolher municípios e equipamentos.
// Só a coordenação (perfil admin). Depende do recurso "painel da rede" (cadastro e filtro). O filtro vale só na
// tela inicial, fica guardado só na sessão (sessionStorage, por usuário) e é anunciado numa faixa abaixo da saudação.

(function () {
  const CHAVE = 'farma_filtro_rede';
  const escapar = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const plural = (n, um, varios) => n + ' ' + (n === 1 ? um : varios);
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

  // ── regras puras ──────────────────────────────────────────────
  // Rótulo do botão e da faixa a partir do filtro (municípios, unidades, tipos; a busca não conta).
  function rotulo(filtro, rede, ROT_TIPO) {
    const total = rede.reduce((n, m) => n + m.u.length, 0);
    const f = filtro || {};
    const temEscopo = !!(f.municipios || f.unidades), temTipo = !!(f.tipos && f.tipos.length);
    if (!temEscopo && !temTipo) return { ativo: false, texto: 'Todas as unidades', qtd: total, total, descricao: '' };
    const dentro = rede.filter(m => !f.municipios || f.municipios.includes(m.m));
    let qtd = 0;
    dentro.forEach(m => m.u.forEach(u => {
      if (f.unidades && !f.unidades.includes(m.m + '|' + u.n)) return;
      if (temTipo && !f.tipos.includes(u.t)) return;
      qtd++;
    }));
    const nomeEscopo = !f.municipios ? 'todos os municípios' : f.municipios.length === 1 ? f.municipios[0] : f.municipios.length + ' municípios';
    const tipo = temTipo ? f.tipos.map(t => (ROT_TIPO && ROT_TIPO[t]) || t).join(', ') : '';
    const texto = !f.municipios ? (tipo || 'Todas') : f.municipios.length === 1 ? f.municipios[0] : f.municipios.length + ' municípios';
    const descricao = `Você está vendo só ${tipo ? tipo + ' de ' : ''}${nomeEscopo}${f.unidades ? ' (unidades escolhidas)' : ''}: ${qtd} de ${total} unidades.`;
    return { ativo: true, texto, qtd, total, descricao };
  }
  // Seleção da janela (município → nomes de unidade marcadas) → filtro
  function selecaoParaFiltro(sel, rede, tipo, busca) {
    const munis = rede.filter(m => (sel.get(m.m) || new Set()).size > 0);
    const tudo = munis.length === rede.length && munis.every(m => sel.get(m.m).size === m.u.length);
    const parcial = munis.some(m => sel.get(m.m).size < m.u.length);
    const f = { municipios: tudo ? null : munis.map(m => m.m), unidades: !tudo && parcial ? munis.flatMap(m => [...sel.get(m.m)].map(n => m.m + '|' + n)) : null, tipos: tipo ? [tipo] : null, busca: busca || '' };
    return f;
  }
  function filtroParaSelecao(f, rede) {
    const sel = new Map();
    rede.forEach(m => {
      const dentro = !f || !f.municipios || f.municipios.includes(m.m);
      const nomes = m.u.filter(u => !f || !f.unidades || f.unidades.includes(m.m + '|' + u.n)).map(u => u.n);
      sel.set(m.m, new Set(dentro ? nomes : []));
    });
    return sel;
  }

  // ── tela ──────────────────────────────────────────────────────
  if (typeof document === 'undefined') { module.exports = { rotulo, selecaoParaFiltro, filtroParaSelecao }; return; }

  const est = { login: '', aberto: false, foco: null, tipo: null, busca: '', sel: new Map(), passo2: false, botao: null, janela: null, fundo: null, ultimoFoco: null };
  const rede = () => (window.PainelRede ? window.PainelRede.rede() : []);

  function guardar(f) {
    try {
      if (f && (f.municipios || f.unidades || (f.tipos && f.tipos.length))) sessionStorage.setItem(CHAVE, JSON.stringify({ login: est.login, f: { municipios: f.municipios, unidades: f.unidades, tipos: f.tipos } }));
      else sessionStorage.removeItem(CHAVE);
    } catch (e) { /* sem armazenamento: o filtro só vale nesta visita */ }
  }
  function lerGuardado() {
    try {
      const o = JSON.parse(sessionStorage.getItem(CHAVE) || 'null');
      return o && o.login === est.login ? o.f : null;
    } catch (e) { return null; }
  }

  // botão e faixa
  function pintarBotao() {
    const r = rotulo(window.PainelRede.getFiltro(), rede(), window.PainelRede.ROT_TIPO);
    est.botao.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg><span class="sel-un__t"><small>Unidades</small><b>${escapar(r.texto === 'Todas as unidades' ? r.texto : r.texto)}</b></span><span class="sel-un__n">${r.qtd}</span><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>`;
    est.botao.classList.toggle('sel-un--ativo', r.ativo);
    est.botao.setAttribute('aria-label', 'Unidades: ' + (r.ativo ? r.descricao.replace('Você está vendo só ', 'mostrando só ') : `todas as ${r.total} unidades`) + '. Abrir seletor.');
    let faixa = document.getElementById('filtro-ativo');
    if (r.ativo) {
      if (!faixa) {
        faixa = document.createElement('div');
        faixa.id = 'filtro-ativo';
        faixa.className = 'filtro-ativo';
        faixa.setAttribute('role', 'status');
        const hello = document.querySelector('.home-hello');
        hello.parentNode.insertBefore(faixa, hello.nextSibling);
      }
      faixa.innerHTML = `<span class="filtro-ativo__txt">${escapar(r.descricao)}</span><button type="button" class="filtro-ativo__btn">Ver todas as unidades</button>`;
      faixa.hidden = false;
    } else if (faixa) { faixa.hidden = true; faixa.innerHTML = ''; }
  }

  // janela
  function unidadesDoFoco() {
    const m = rede().find(x => x.m === est.foco);
    return m ? m.u.filter(u => !est.tipo || u.t === est.tipo) : [];
  }
  function contarSelecionadas() {
    let n = 0;
    rede().forEach(m => (est.sel.get(m.m) || new Set()).forEach(nome => { const u = m.u.find(x => x.n === nome); if (u && (!est.tipo || u.t === est.tipo)) n++; }));
    return n;
  }
  function pintarListaMunicipios() {
    const P = window.PainelRede;
    const q = norm(est.busca);
    const munis = rede().filter(m => !q || norm(m.m).includes(q) || m.u.some(u => norm(u.n).includes(q))).slice().sort((a, b) => b.u.length - a.u.length);
    const alvo = est.janela.querySelector('.sj-ml');
    alvo.innerHTML = `<label class="sj-m sj-todos"><input type="checkbox" data-todos><span class="sj-nm">Todos os municípios</span><span class="sj-q">${rede().reduce((n, m) => n + m.u.length, 0)}</span></label>` +
      munis.map(m => `<div class="sj-linha${m.m === est.foco ? ' foco' : ''}"><label class="sj-m"><input type="checkbox" data-muni="${escapar(m.m)}"><span class="sj-nm">${escapar(m.m)}</span><span class="sj-q">${m.u.length}</span></label><button type="button" class="sj-ver" data-ver="${escapar(m.m)}" aria-label="Escolher unidades de ${escapar(m.m)}">›</button></div>`).join('');
    sincronizar();
  }
  function pintarUnidades() {
    const P = window.PainelRede;
    const alvo = est.janela.querySelector('.sj-ul');
    const m = rede().find(x => x.m === est.foco);
    if (!m) { alvo.innerHTML = '<p class="sj-vazio">Escolha um município para ver os equipamentos.</p>'; return; }
    const q = norm(est.busca);
    const us = unidadesDoFoco().filter(u => !q || norm(u.n).includes(q) || norm(m.m).includes(q));
    const tipos = P.TIPOS.map(t => [t, us.filter(u => u.t === t)]).filter(g => g[1].length);
    alvo.innerHTML = `<div class="sj-cab"><button type="button" class="sj-volta">‹ Municípios</button><b>${escapar(m.m)}</b><span>${plural(us.length, 'unidade', 'unidades')}</span><button type="button" class="sj-link" data-todas>Marcar ou desmarcar todas</button></div>` +
      (tipos.map(([t, lista]) => `<div class="sj-g"><h5>${escapar(P.ROT_TIPO[t])} <span>${lista.length}</span></h5><div class="sj-us">${lista.map(u => `<label class="sj-u"><input type="checkbox" data-un="${escapar(u.n)}"><span>${escapar(u.n)}</span><i class="q q--${u.s}" aria-hidden="true"></i><span class="sr-only">${escapar(P.ESTADOS[u.s])}</span></label>`).join('')}</div></div>`).join('') || '<p class="sj-vazio">Nenhuma unidade com esse filtro.</p>');
    sincronizar();
  }
  // atualiza só os estados (checked, parcial, contador, botão Aplicar), sem refazer as listas e sem perder o foco
  function sincronizar() {
    const j = est.janela;
    let totalMunis = 0, marcados = 0;
    rede().forEach(m => {
      const s = est.sel.get(m.m) || new Set();
      const inp = j.querySelector(`[data-muni="${CSS.escape(m.m)}"]`);
      totalMunis++;
      if (s.size === m.u.length) marcados++;
      if (inp) { inp.checked = s.size === m.u.length; inp.indeterminate = s.size > 0 && s.size < m.u.length; }
    });
    const todos = j.querySelector('[data-todos]');
    if (todos) { todos.checked = marcados === totalMunis; todos.indeterminate = marcados > 0 && marcados < totalMunis; }
    const s = est.sel.get(est.foco) || new Set();
    j.querySelectorAll('[data-un]').forEach(i => { i.checked = s.has(i.dataset.un); });
    const n = contarSelecionadas();
    j.querySelector('.sj-contador').innerHTML = `<b>${n}</b> de ${rede().reduce((a, m) => a + m.u.length, 0)} unidades selecionadas`;
    j.querySelector('.sj-aplicar').disabled = n === 0;
    j.querySelectorAll('.sj-tp button').forEach(b => b.setAttribute('aria-pressed', String((b.dataset.tipo || null) === est.tipo)));
    j.classList.toggle('sj--passo2', est.passo2);
    j.querySelectorAll('.sj-linha').forEach(l => l.classList.toggle('foco', l.querySelector('[data-ver]').dataset.ver === est.foco));
  }

  function construirJanela() {
    const P = window.PainelRede;
    const fundo = document.createElement('div');
    fundo.className = 'sj-fundo'; fundo.hidden = true;
    const j = document.createElement('div');
    j.id = 'sel-janela'; j.className = 'sj'; j.hidden = true;
    j.setAttribute('role', 'dialog'); j.setAttribute('aria-modal', 'true'); j.setAttribute('aria-labelledby', 'sj-titulo');
    j.innerHTML = `<div class="sj-top"><div><h2 id="sj-titulo">Filtrar unidades</h2><p>Escolha os municípios e, se quiser, só alguns equipamentos.</p></div><button type="button" class="sj-x" aria-label="Fechar o seletor">×</button></div>
      <div class="sj-ferr"><label class="sj-busca"><span class="sr-only">Buscar município ou unidade</span><input type="search" placeholder="Buscar município ou unidade" autocomplete="off"></label>
        <div class="sj-tp" role="group" aria-label="Tipo de unidade"><button type="button" data-tipo="" aria-pressed="true">Todos</button>${P.TIPOS.map(t => `<button type="button" data-tipo="${t}" aria-pressed="false">${escapar(P.ROT_TIPO[t])}</button>`).join('')}</div></div>
      <div class="sj-corpo"><div class="sj-col sj-ml"></div><div class="sj-col sj-ul"></div></div>
      <div class="sj-rod"><span class="sj-contador" role="status" aria-live="polite"></span><span class="sj-acoes"><button type="button" class="sj-sec sj-todas">Ver todas as unidades</button><button type="button" class="sj-pri sj-aplicar">Aplicar filtro</button></span></div>`;
    document.body.append(fundo, j);
    est.janela = j; est.fundo = fundo;

    j.addEventListener('click', ev => {
      const t = ev.target;
      if (t.closest('.sj-x')) return fechar();
      const ver = t.closest('[data-ver]');
      if (ver) { est.foco = ver.dataset.ver; est.passo2 = true; pintarUnidades(); sincronizar(); const v = j.querySelector('.sj-volta'); if (v) v.focus(); return; }
      if (t.closest('.sj-volta')) { est.passo2 = false; sincronizar(); const f = j.querySelector(`[data-ver="${CSS.escape(est.foco)}"]`); if (f) f.focus(); return; }
      const tp = t.closest('.sj-tp button');
      if (tp) { est.tipo = tp.dataset.tipo || null; pintarUnidades(); sincronizar(); return; }
      if (t.closest('[data-todas]')) {
        const m = rede().find(x => x.m === est.foco); const atual = est.sel.get(est.foco) || new Set();
        const lista = unidadesDoFoco().map(u => u.n);
        const todas = lista.every(n => atual.has(n));
        const novo = new Set(atual); lista.forEach(n => todas ? novo.delete(n) : novo.add(n));
        est.sel.set(est.foco, novo); sincronizar(); return;
      }
      if (t.closest('.sj-todas')) { est.sel = filtroParaSelecao(null, rede()); est.tipo = null; aplicar(); return; }
      if (t.closest('.sj-aplicar')) return aplicar();
    });
    j.addEventListener('change', ev => {
      const i = ev.target;
      if (i.matches('[data-todos]')) { est.sel = i.checked ? filtroParaSelecao(null, rede()) : new Map(rede().map(m => [m.m, new Set()])); sincronizar(); pintarUnidades(); return; }
      if (i.matches('[data-muni]')) { const m = rede().find(x => x.m === i.dataset.muni); est.sel.set(m.m, i.checked ? new Set(m.u.map(u => u.n)) : new Set()); sincronizar(); if (m.m === est.foco) pintarUnidades(); return; }
      if (i.matches('[data-un]')) { const s = new Set(est.sel.get(est.foco) || []); i.checked ? s.add(i.dataset.un) : s.delete(i.dataset.un); est.sel.set(est.foco, s); sincronizar(); }
    });
    j.querySelector('.sj-busca input').addEventListener('input', ev => { est.busca = ev.target.value.trim(); pintarListaMunicipios(); pintarUnidades(); });
    fundo.addEventListener('click', fechar);
    j.addEventListener('keydown', ev => {
      if (ev.key === 'Escape') { ev.preventDefault(); fechar(); return; }
      if (ev.key !== 'Tab') return;
      const foc = [...j.querySelectorAll('button, input, [href]')].filter(e => !e.disabled && e.offsetParent !== null);
      if (!foc.length) return;
      const primeiro = foc[0], ultimo = foc[foc.length - 1];
      if (ev.shiftKey && document.activeElement === primeiro) { ev.preventDefault(); ultimo.focus(); }
      else if (!ev.shiftKey && document.activeElement === ultimo) { ev.preventDefault(); primeiro.focus(); }
    });
  }

  // o resto da página fica inerte enquanto a janela está aberta
  function inertizar(on) {
    [...document.body.children].forEach(e => {
      if (e === est.janela || e === est.fundo || e.tagName === 'SCRIPT') return;
      if (on) { if (!e.inert) { e.inert = true; e.dataset.eraInerte = '1'; } } else if (e.dataset.eraInerte) { e.inert = false; delete e.dataset.eraInerte; }
    });
  }
  function abrir() {
    if (!est.janela) construirJanela();
    est.sel = filtroParaSelecao(window.PainelRede.getFiltro(), rede());
    const f = window.PainelRede.getFiltro();
    est.tipo = f && f.tipos && f.tipos.length === 1 ? f.tipos[0] : null;
    est.busca = ''; est.passo2 = false;
    est.foco = (f && f.municipios && f.municipios[0]) || (rede().slice().sort((a, b) => b.u.length - a.u.length)[0] || {}).m;
    est.janela.querySelector('.sj-busca input').value = '';
    pintarListaMunicipios(); pintarUnidades(); sincronizar();
    est.ultimoFoco = document.activeElement;
    est.fundo.hidden = false; est.janela.hidden = false; est.aberto = true;
    est.botao.setAttribute('aria-expanded', 'true');
    inertizar(true);
    est.janela.querySelector('.sj-busca input').focus();
  }
  function fechar() {
    if (!est.aberto) return;
    est.aberto = false; est.janela.hidden = true; est.fundo.hidden = true;
    est.botao.setAttribute('aria-expanded', 'false');
    inertizar(false);
    (est.ultimoFoco && est.ultimoFoco.focus ? est.ultimoFoco : est.botao).focus();
  }
  function aplicar() {
    const f = selecaoParaFiltro(est.sel, rede(), est.tipo, (window.PainelRede.getFiltro() || {}).busca);
    window.PainelRede.setFiltro(f);
    fechar();
  }

  function montar(opc) {
    if (!window.PainelRede) return;
    est.login = opc.login || '';
    if (!est.botao) {
      const acoes = document.querySelector('.page-header__actions');
      if (!acoes) return;
      est.botao = document.createElement('button');
      est.botao.type = 'button';
      est.botao.className = 'sel-un';
      est.botao.setAttribute('aria-haspopup', 'dialog');
      est.botao.setAttribute('aria-controls', 'sel-janela');
      est.botao.setAttribute('aria-expanded', 'false');
      est.botao.addEventListener('click', abrir);
      acoes.insertBefore(est.botao, acoes.firstChild);
      document.addEventListener('rede:filtro-mudou', () => { guardar(window.PainelRede.getFiltro()); pintarBotao(); });
      document.addEventListener('click', ev => { if (ev.target.closest && ev.target.closest('.filtro-ativo__btn')) window.PainelRede.setFiltro(null); });
      const salvo = lerGuardado();
      if (salvo) window.PainelRede.setFiltro(Object.assign({ busca: '' }, salvo));
    } else if (!document.body.contains(est.botao)) {
      document.querySelector('.page-header__actions').insertBefore(est.botao, document.querySelector('.page-header__actions').firstChild);
    }
    pintarBotao();
  }

  const api = { montar, abrir, fechar, rotulo, selecaoParaFiltro, filtroParaSelecao };
  window.SeletorUnidades = api;
})();
