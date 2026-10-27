// Recurso visual: PAINEL DA REDE (tag visual-painel-rede)
// O fechamento do mês da coordenação vira um cartão por município, com um quadrado por unidade, e uma lista
// agrupada por situação quando se olha um município (ou um filtro). Usa o cadastro provisório js/rede-catalogo.js
// e o status real vindo do painel (rota painel.carregar). Unidades que ainda não têm planilha ficam no estado
// "Sem planilha ainda", separado de "Nada lançado".
// Eventos: dispara 'rede:resumo' (números do recorte atual, para os atalhos) e 'rede:filtro-mudou' (filtro novo).

(function () {
  const TIPOS = ['Hospital', 'UPA', 'UBS', 'CAPS', 'Outros'];
  const ROT_TIPO = { Hospital: 'Hospitais', UPA: 'UPAs', UBS: 'UBS', CAPS: 'CAPS', Outros: 'Outros' };
  const ROT_UN = { Hospital: 'Hospital', UPA: 'UPA', UBS: 'UBS', CAPS: 'CAPS', Outros: 'Outro' };
  const ESTADOS = { ok: 'Tudo lançado', parc: 'Em andamento', pend: 'Nada lançado', sem: 'Sem planilha ainda' };
  const ORDEM_GRUPOS = ['pend', 'parc', 'ok', 'sem'];

  const escapar = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const plural = (n, um, varios) => n + ' ' + (n === 1 ? um : varios);

  // ── regras (puras, testadas em tests/front.test.js) ──────────────────────
  function saidasFeitas(sd) {
    if (!sd) return false;
    const duasAbas = sd.med.total > 0 && sd.mat.total > 0;
    return duasAbas && sd.med.preenchidos + sd.mat.preenchidos >= sd.med.total + sd.mat.total;
  }
  // "Tudo lançado" = clínica e as duas abas de saídas completas; "Nada lançado" = nenhum lançamento; o resto é "Em andamento".
  function estadoDaUnidade(p) {
    const clin = !!(p.clinica && p.clinica.lancado);
    const pre = p.saidas ? p.saidas.med.preenchidos + p.saidas.mat.preenchidos : 0;
    if (clin && saidasFeitas(p.saidas)) return 'ok';
    return clin || pre > 0 ? 'parc' : 'pend';
  }
  const nomesDe = u => [u.n].concat(u.a || []).map(norm).filter(Boolean);

  // Junta o cadastro (152 equipamentos) com as unidades do painel. Casa pelo nome (o painel não traz município):
  // primeiro nome igual; senão, parte do nome, mas só se der exatamente um candidato.
  function montarRede(catalogo, unidadesPainel) {
    const rede = catalogo.map(m => ({ m: m.m, u: m.u.map(u => ({ n: u.n, t: u.t, a: u.a, p: null, id: null, s: 'sem' })) }));
    const todas = rede.flatMap(m => m.u);
    const extras = [];
    (unidadesPainel || []).forEach(p => {
      const nome = norm(p.nome);
      let achados = todas.filter(u => !u.p && nomesDe(u).includes(nome));
      if (!achados.length) {
        const parcial = todas.filter(u => !u.p && nomesDe(u).some(n => (n.length >= 4 && nome.includes(n)) || (nome.length >= 4 && n.includes(nome))));
        achados = parcial.length === 1 ? parcial : [];
      }
      if (achados.length) { const u = achados[0]; u.p = p; u.id = p.id; u.s = estadoDaUnidade(p); }
      else extras.push({ n: p.nome, t: 'Outros', a: [], p, id: p.id, s: estadoDaUnidade(p) });
    });
    if (extras.length) rede.push({ m: 'Outras unidades', u: extras });
    return rede;
  }

  // filtro: { municipios: [nome]|null, unidades: ['município|nome']|null, tipos: [tipo]|null, busca: '' }
  function passa(muni, u, f) {
    if (!f) return true;
    if (f.municipios && !f.municipios.includes(muni)) return false;
    if (f.unidades && !f.unidades.includes(muni + '|' + u.n)) return false;
    if (f.tipos && f.tipos.length && !f.tipos.includes(u.t)) return false;
    if (f.busca && !(norm(u.n).includes(norm(f.busca)) || norm(muni).includes(norm(f.busca)))) return false;
    return true;
  }
  function filtrar(rede, f) {
    return rede.map(m => ({ m: m.m, u: m.u.filter(u => passa(m.m, u, f)) })).filter(m => m.u.length);
  }
  function contar(us) {
    const c = { ok: 0, parc: 0, pend: 0, sem: 0, total: us.length };
    us.forEach(u => { c[u.s]++; });
    c.comPlanilha = c.ok + c.parc + c.pend;
    return c;
  }
  // Números dos atalhos: só unidades com planilha entram na conta
  function resumir(redeFiltrada) {
    const us = redeFiltrada.flatMap(m => m.u);
    const c = contar(us);
    let pre = 0, tot = 0;
    us.forEach(u => { if (u.p && u.p.saidas) { pre += u.p.saidas.med.preenchidos + u.p.saidas.mat.preenchidos; tot += u.p.saidas.med.total + u.p.saidas.mat.total; } });
    return { completas: c.ok, total: c.comPlanilha, pctSaidas: tot ? Math.min(100, Math.round(pre / tot * 100)) : null };
  }
  // municípios com mais pendências primeiro; quem só tem unidade sem planilha vai para o fim
  function ordenar(rede) {
    const pe = m => m.u.filter(u => u.s === 'pend').length * 2 + m.u.filter(u => u.s === 'parc').length;
    const so = m => m.u.every(u => u.s === 'sem');
    return rede.slice().sort((a, b) => (so(a) - so(b)) || (pe(b) - pe(a)) || a.m.localeCompare(b.m, 'pt-BR'));
  }
  const textoMunicipio = (m, c) => c.comPlanilha
    ? `${m}: ${c.ok} de ${c.comPlanilha} unidades com tudo lançado, ${c.parc} em andamento, ${c.pend} sem lançamento` + (c.sem ? `, ${c.sem} ainda sem planilha` : '')
    : `${m}: ${plural(c.total, 'unidade', 'unidades')}, nenhuma com planilha ainda`;

  // ── tela ─────────────────────────────────────────────────────────────────
  const est = { rede: [], filtro: null, painel: null, raiz: null, busca: '' };

  function infoUnidade(u) {
    if (u.s === 'sem') return 'Planilha de saídas ainda não configurada';
    if (u.s === 'pend') return 'Nada lançado neste mês';
    const ult = [u.p.clinica && u.p.clinica.lancado ? { por: u.p.clinica.por, em: u.p.clinica.em } : null, u.p.saidas ? { por: u.p.saidas.por, em: u.p.saidas.em } : null].filter(Boolean).pop();
    return ult ? `Última atualização: ${ult.por}, ${ult.em}` : 'Em andamento';
  }

  function cartaoMunicipio(m) {
    const c = contar(m.u);
    const ordem = m.u.slice().sort((a, b) => (b.t === 'Hospital' || b.t === 'UPA') - (a.t === 'Hospital' || a.t === 'UPA'));
    const quadrados = ordem.map(u => `<i class="q q--${u.s}${u.t === 'Hospital' || u.t === 'UPA' ? ' q--g' : ''}"></i>`).join('');
    const pct = c.total ? Math.round(c.ok / c.total * 100) : 0, pctP = c.total ? Math.round(c.parc / c.total * 100) : 0;
    const tipos = TIPOS.map(t => [t, m.u.filter(u => u.t === t).length]).filter(x => x[1])
      .map(([t, n]) => plural(n, t === 'UBS' || t === 'CAPS' || t === 'UPA' ? t : t === 'Hospital' ? 'hospital' : 'outro', t === 'Hospital' ? 'hospitais' : t === 'Outros' ? 'outros' : t === 'UPA' ? 'UPAs' : t)).join(' · ');
    const linha = c.comPlanilha
      ? `${plural(c.ok, 'pronta', 'prontas')} · ${c.parc} em andamento · ${c.pend} sem lançamento` + (c.sem ? ` · ${c.sem} sem planilha` : '')
      : 'Sem planilha ainda';
    return `<button type="button" class="mu" data-m="${escapar(m.m)}" aria-label="${escapar(textoMunicipio(m.m, c) + '. Abrir a lista de unidades.')}">
      <span class="mu__topo"><b>${escapar(m.m)}</b><span class="mu__n">${c.comPlanilha ? c.ok + '/' + c.comPlanilha : '—'}</span></span>
      ${c.comPlanilha ? `<span class="mu__barra" aria-hidden="true"><i class="ok" style="width:${pct}%"></i><i class="parc" style="width:${pctP}%"></i></span>` : ''}
      <span class="mu__q" aria-hidden="true">${quadrados}</span>
      <small>${escapar(linha)}</small><small class="mu__t">${escapar(tipos)}</small></button>`;
  }

  function linhaUnidade(u, muni, mostrarMuni) {
    const nome = u.id
      ? `<a class="ru__link" href="indicadores.html?unidade=${encodeURIComponent(u.id)}">${escapar(u.n)}</a>`
      : escapar(u.n);
    return `<li class="ru"><span class="ru__t"><b>${nome}</b><small>${escapar((mostrarMuni ? muni + ' · ' : '') + ROT_UN[u.t] + ' · ' + infoUnidade(u))}</small></span><span class="st st--${u.s}">${ESTADOS[u.s]}</span></li>`;
  }

  function listaAgrupada(redeF, mostrarMuni) {
    const todas = redeF.flatMap(m => m.u.map(u => [m.m, u]));
    if (!todas.length) return '<p class="rede-vazio" role="status">Nenhuma unidade encontrada com esse filtro.</p>';
    return ORDEM_GRUPOS.map(s => {
      const g = todas.filter(([, u]) => u.s === s);
      if (!g.length) return '';
      return `<section class="rg"><h4>${ESTADOS[s]} <span>${g.length}</span></h4><ul class="rl">${g.map(([m, u]) => linhaUnidade(u, m, mostrarMuni)).join('')}</ul></section>`;
    }).join('');
  }

  function recorte() { return filtrar(est.rede, est.filtro); }
  function emListaDe() { // visão de lista: busca digitada, um município só, ou unidades escolhidas
    const f = est.filtro || {};
    return !!f.busca || !!f.unidades || (f.municipios && f.municipios.length === 1);
  }

  function pintarLegenda(c) {
    const l = est.raiz.querySelector('.rede-leg');
    l.innerHTML = ORDEM_GRUPOS.slice().reverse().map(s => `<li><i class="q q--${s}" aria-hidden="true"></i>${ESTADOS[s]} <b>${c[s]}</b></li>`).join('');
  }
  function pintarFerramentas() {
    const f = est.filtro || {};
    const base = filtrar(est.rede, Object.assign({}, f, { tipos: null }));
    const todas = base.flatMap(m => m.u);
    const ativo = (f.tipos && f.tipos.length === 1) ? f.tipos[0] : null;
    est.raiz.querySelector('.rede-chips').innerHTML =
      `<button type="button" class="ch" aria-pressed="${ativo === null}" data-tipo="">Todas <b>${todas.length}</b></button>` +
      TIPOS.map(t => `<button type="button" class="ch" aria-pressed="${ativo === t}" data-tipo="${t}">${ROT_TIPO[t]} <b>${todas.filter(u => u.t === t).length}</b></button>`).join('');
  }
  function pintarCorpo() {
    const redeF = recorte();
    const corpo = est.raiz.querySelector('.rede-corpo');
    const f = est.filtro || {};
    if (emListaDe()) {
      const muni = f.municipios && f.municipios.length === 1 ? f.municipios[0] : null;
      const nav = (!window.SeletorUnidades && muni)
        ? `<div class="rede-nav"><button type="button" class="rede-voltar">← Todos os municípios</button><b>${escapar(muni)}</b></div>` : '';
      corpo.innerHTML = nav + listaAgrupada(redeF, !muni);
    } else {
      corpo.innerHTML = redeF.length
        ? `<div class="rede-grade">${ordenar(redeF).map(cartaoMunicipio).join('')}</div>`
        : '<p class="rede-vazio" role="status">Nenhuma unidade encontrada com esse filtro.</p>';
    }
  }

  function pintarTopo(redeF) {
    const c = contar(redeF.flatMap(m => m.u));
    const sub = document.getElementById('fech-sub');
    if (sub) sub.textContent = c.comPlanilha
      ? `${c.ok} de ${plural(c.comPlanilha, 'unidade com planilha', 'unidades com planilha')} com tudo lançado` + (c.sem ? ` · ${c.sem} ainda sem planilha` : '') + ` · ${plural(redeF.length, 'município', 'municípios')}.`
      : `Nenhuma das ${plural(c.total, 'unidade', 'unidades')} tem planilha configurada ainda.`;
    const pct = c.comPlanilha ? Math.round(c.ok / c.comPlanilha * 100) : 0;
    const ring = document.getElementById('fech-ring');
    if (ring) {
      ring.style.setProperty('--p', pct);
      ring.classList.toggle('completo', c.comPlanilha > 0 && c.ok === c.comPlanilha);
      ring.setAttribute('aria-label', `${c.ok} de ${c.comPlanilha} unidades com tudo lançado`);
    }
    const rt = document.getElementById('fech-ring-txt');
    if (rt) rt.textContent = `${c.ok}/${c.comPlanilha}`;
    pintarLegenda(c);
  }

  function atualizar(completo) {
    if (!est.raiz) return;
    const redeF = recorte();
    pintarTopo(redeF);
    if (completo !== false) pintarFerramentas();
    pintarCorpo();
    document.dispatchEvent(new CustomEvent('rede:resumo', { detail: resumir(redeF) }));
  }

  function setFiltro(f, origem) {
    const vazio = f && !(f.municipios || f.unidades || (f.tipos && f.tipos.length) || f.busca);
    est.filtro = vazio ? null : f;
    const input = est.raiz && est.raiz.querySelector('.rede-busca input');
    if (input && origem !== 'busca') input.value = (est.filtro && est.filtro.busca) || '';
    atualizar(origem !== 'busca');
    document.dispatchEvent(new CustomEvent('rede:filtro-mudou', { detail: est.filtro, bubbles: false }));
  }

  function montar(opc) {
    est.painel = opc.painel;
    est.rede = montarRede(window.REDE_CATALOGO || [], opc.painel.unidades);
    est.raiz = opc.raiz;
    const lista = est.raiz.querySelector('#fech-lista');
    let el = est.raiz.querySelector('#rede-painel');
    if (!el) {
      el = document.createElement('div');
      el.id = 'rede-painel';
      el.className = 'rede';
      el.innerHTML = `<ul class="rede-leg" aria-label="Legenda do andamento"></ul>
        <div class="rede-ferr"><div class="rede-chips" role="group" aria-label="Tipo de unidade"></div>
          <label class="rede-busca"><span class="sr-only">Buscar unidade ou município</span><input type="search" placeholder="Buscar unidade ou município" autocomplete="off"></label></div>
        <div class="rede-corpo" aria-live="polite"></div>`;
      lista.parentNode.insertBefore(el, lista);
      el.addEventListener('click', ev => {
        const mu = ev.target.closest('.mu');
        if (mu) return setFiltro(Object.assign({}, est.filtro, { municipios: [mu.dataset.m], unidades: null }));
        if (ev.target.closest('.rede-voltar')) return setFiltro(Object.assign({}, est.filtro, { municipios: null, unidades: null }));
        const ch = ev.target.closest('.ch');
        if (ch) return setFiltro(Object.assign({}, est.filtro, { tipos: ch.dataset.tipo ? [ch.dataset.tipo] : null }));
      });
      el.querySelector('.rede-busca input').addEventListener('input', ev => setFiltro(Object.assign({}, est.filtro, { busca: ev.target.value.trim() }), 'busca'));
    }
    lista.hidden = true;
    atualizar();
    const c = contar(est.rede.flatMap(m => m.u));
    return { feitos: c.ok, total: c.comPlanilha };
  }

  const api = {
    montar, setFiltro, getFiltro: () => est.filtro, rede: () => est.rede, recorte, resumir,
    estadoDaUnidade, montarRede, filtrar, contar, ordenar, norm, TIPOS, ROT_TIPO, ESTADOS,
  };
  if (typeof window !== 'undefined') window.PainelRede = api;
  if (typeof module !== 'undefined') module.exports = api;
})();
