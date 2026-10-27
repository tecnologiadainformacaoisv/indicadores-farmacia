// Recurso visual: ATALHOS COM RESUMO (tag visual-atalhos-resumo)
// Troca os cartões simples de "Ir para" por atalhos azul-marinho com o número que importa e um mini gráfico.
// Independente dos outros recursos. Se este script não carregar, a tela usa os cartões antigos (ver index.js).
// Ouve o evento 'rede:resumo' (opcional) para recalcular os números quando um filtro de unidades é aplicado.

(function () {
  const ICONES = {
    acomp: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    saidas: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16"/>',
    rel: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
    usr: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/>',
    dash: '<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="5" rx="1.5"/><rect x="13" y="10" width="8" height="11" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/>',
  };
  const escapar = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Números a partir das unidades do painel (rota painel.carregar). "Completa" = clínica lançada e as duas abas de saídas cheias.
  function saidasFeitas(un) {
    const sd = un.saidas;
    if (!sd) return false;
    const duasAbas = sd.med.total > 0 && sd.mat.total > 0;
    return duasAbas && sd.med.preenchidos + sd.mat.preenchidos >= sd.med.total + sd.mat.total;
  }
  function resumir(unidades) {
    const lista = unidades || [];
    const completas = lista.filter(un => un.clinica && un.clinica.lancado && saidasFeitas(un)).length;
    let pre = 0, tot = 0;
    lista.forEach(un => { if (un.saidas) { pre += un.saidas.med.preenchidos + un.saidas.mat.preenchidos; tot += un.saidas.med.total + un.saidas.mat.total; } });
    return { completas, total: lista.length, pctSaidas: tot ? Math.min(100, Math.round(pre / tot * 100)) : null };
  }

  // Mini visuais: só onde existe dado de verdade (nada de tendência inventada)
  function miniColunas(completas, total) {
    if (!total) return '';
    const n = 6, verdes = Math.round(n * completas / total);
    const alturas = [60, 75, 55, 90, 70, 80];
    return '<span class="mini mini--cols" aria-hidden="true">' + alturas.map((h, i) => `<i class="${i < verdes ? 'ok' : 'pend'}" style="height:${i < verdes ? h : 35}%"></i>`).join('') + '</span>';
  }
  function miniBarra(pct) {
    return pct === null ? '' : `<span class="mini mini--barra" aria-hidden="true"><i style="width:${pct}%"></i></span>`;
  }

  // Lista de atalhos conforme o perfil e os números
  function atalhos(ctx) {
    const r = ctx.resumo;
    if (!ctx.admin) {
      const un = (ctx.unidades || [])[0];
      return [
        { id: 'acomp', icone: 'acomp', titulo: 'Acompanhamento mensal', desc: 'Indicadores clínicos e de logística, com gráficos.', href: 'indicadores.html',
          numero: un ? (un.clinica.lancado ? 'Lançada' : 'Pendente') : '', rotulo: un ? 'Clínica Geral de ' + ctx.mes : '' },
        { id: 'saidas', icone: 'saidas', titulo: 'Planilha de saídas', desc: 'Saídas, CMM e estoque de cada item.', href: 'logistica.html',
          numero: r.pctSaidas === null ? '' : r.pctSaidas + '%', rotulo: r.pctSaidas === null ? '' : 'dos itens com saída lançada', mini: miniBarra(r.pctSaidas) },
      ];
    }
    return [
      { id: 'acomp', icone: 'acomp', titulo: 'Acompanhamento mensal', desc: 'Indicadores, metas e alertas de todas as unidades.', href: 'indicadores.html',
        numero: r.total ? `${r.completas} de ${r.total}` : '', rotulo: r.total ? 'unidades com tudo lançado' : '', mini: miniColunas(r.completas, r.total) },
      { id: 'saidas', icone: 'saidas', titulo: 'Planilha de saídas', desc: 'Saídas de medicamentos e materiais de cada unidade.', href: 'logistica.html',
        numero: r.pctSaidas === null ? '' : r.pctSaidas + '%', rotulo: r.pctSaidas === null ? '' : 'dos itens com saída lançada', mini: miniBarra(r.pctSaidas) },
      { id: 'rel', icone: 'rel', titulo: 'Relatórios', desc: 'Veja e imprima o relatório mensal de cada unidade.', href: 'relatorios.html',
        numero: ctx.mes, rotulo: 'último mês fechado' },
      { id: 'usr', icone: 'usr', titulo: 'Usuários', desc: 'Cadastre coordenadores, redefina senhas e desative acessos.', href: 'usuarios.html' },
      { id: 'dash', icone: 'dash', titulo: 'Dashboard', desc: 'Visão geral das unidades. Ainda não usa os lançamentos reais.', href: 'dashboard.html', selo: 'Dados de exemplo', discreto: true },
    ];
  }

  function html(a) {
    const rodape = a.numero
      ? `<span class="atalho__dado"><span class="atalho__n"><strong>${escapar(a.numero)}</strong><small>${escapar(a.rotulo)}</small></span>${a.mini || ''}</span>`
      : '';
    return `<a class="atalho${a.discreto ? ' atalho--discreto' : ''}${a.numero ? '' : ' atalho--sem-dado'}" href="${escapar(a.href)}" data-atalho="${a.id}">
      <span class="atalho__topo"><span class="atalho__ico"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONES[a.icone]}</svg></span><span class="atalho__ir" aria-hidden="true">Abrir →</span></span>
      <b>${escapar(a.titulo)}${a.selo ? `<span class="atalho__selo">${escapar(a.selo)}</span>` : ''}</b>
      <span class="atalho__desc">${escapar(a.desc)}</span>${rodape}</a>`;
  }

  let ultimo = null;   // { nav, ctx }
  function montar(nav, ctx) {
    if (!nav) return;
    ctx.resumo = ctx.resumo || resumir(ctx.unidades);
    ultimo = { nav, ctx };
    const lista = atalhos(ctx);
    nav.classList.add('atalhos');
    nav.classList.toggle('atalhos--poucos', lista.length <= 2);
    nav.innerHTML = lista.map(html).join('');
  }

  // um filtro de unidades (recurso "seletor") avisa os novos números
  if (typeof document !== 'undefined') {
    document.addEventListener('rede:resumo', ev => {
      if (!ultimo || !ultimo.ctx.admin) return;
      ultimo.ctx.resumo = ev.detail;
      montar(ultimo.nav, ultimo.ctx);
    });
  }

  const api = { montar, resumir, atalhos };
  if (typeof window !== 'undefined') window.AtalhosResumo = api;
  if (typeof module !== 'undefined') module.exports = api;
})();
