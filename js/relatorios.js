// Relatórios: a coordenação do Instituto vê o relatório mensal de farmácia de uma unidade na tela e imprime
// (ou salva em PDF). Os números saem da planilha de saídas da unidade (mesma rota da tela "Planilha de saídas");
// nada é gravado. Os textos de análise ficam de fora por enquanto.

const ROTULO_ABA = { MEDICAMENTOS: 'Medicamentos', MATERIAIS: 'Materiais' };
const ROTULO_ABA_UN = { MEDICAMENTOS: 'medicamento', MATERIAIS: 'material' };
const MESES_REL = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

// Faixas de situação do estoque (cobertura = estoque ÷ saída do mês)
const FAIXAS = [
  { id: 'zerado', rotulo: 'Zerado', criterio: 'Estoque zero, com saída no mês', cor: '#a93226', txt: '#fff' },
  { id: 'semsemsaida', rotulo: 'Sem estoque e sem saída', criterio: 'Estoque zero e nenhuma saída no mês', cor: '#d98880', txt: '#2e0f0b' },
  { id: 'critico', rotulo: 'Crítico', criterio: 'Cobre menos de 15 dias', cor: '#e67e22', txt: '#2b1500' },
  { id: 'baixo', rotulo: 'Baixo', criterio: 'Cobre de 15 a 30 dias', cor: '#c9971c', txt: '#2a1f00' },
  { id: 'adequado', rotulo: 'Adequado', criterio: 'Cobre de 1 a 3 meses', cor: '#27ae60', txt: '#04210e' },
  { id: 'elevado', rotulo: 'Elevado', criterio: 'Cobre de 3 a 6 meses', cor: '#6fa8dc', txt: '#08233b' },
  { id: 'excesso', rotulo: 'Excesso', criterio: 'Cobre mais de 6 meses', cor: '#2f6db5', txt: '#fff' },
  { id: 'semsaida', rotulo: 'Sem saída no mês', criterio: 'Tem estoque, mas nenhuma saída no mês', cor: '#9aa5b1', txt: '#16202b' },
  { id: 'semdado', rotulo: 'Sem dado de estoque', criterio: 'Coluna de estoque vazia', cor: '#cfd6dd', txt: '#1d2733' },
];
const POR_FAIXA = Object.fromEntries(FAIXAS.map(f => [f.id, f]));

const num = v => Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
const dec1 = v => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function limparNome(s) {
  return String(s || '').replace(/\s*\[+\s*\d+\s*\]+/g, '').replace(/\s+-\s+-\s+/g, ' - ').replace(/\s{2,}/g, ' ').trim();
}

// diasCobertura: null quando não há saída para medir
function classificar(it) {
  const est = it.estoque;
  if (est === null || est === undefined) { it.faixa = 'semdado'; it.dias = null; return; }
  if (est <= 0) { it.faixa = it.atual > 0 ? 'zerado' : 'semsemsaida'; it.dias = 0; return; }
  if (!(it.atual > 0)) { it.faixa = 'semsaida'; it.dias = null; return; }
  it.dias = est / it.atual * 30;
  it.faixa = it.dias < 15 ? 'critico' : it.dias < 30 ? 'baixo' : it.dias < 90 ? 'adequado' : it.dias < 180 ? 'elevado' : 'excesso';
}

function cobertura(it) {
  if (it.dias === null || it.dias === undefined) return '—';
  return it.dias < 30 ? Math.round(it.dias) + ' d' : dec1(it.dias / 30) + ' meses';
}

// Reposição sugerida = 2 meses de consumo do mês menos o estoque (ponto de partida, não é pedido).
function reposicao(it) { return Math.max(0, Math.ceil(2 * it.atual - (it.estoque || 0))); }

function variacao(atual, ant) {
  if (ant === null || ant === undefined) return '—';
  if (ant === 0) return atual > 0 ? 'novo' : '0%';
  const p = Math.round((atual - ant) / ant * 100);
  return (p > 0 ? '+' : p < 0 ? '−' : '') + Math.abs(p) + '%';
}

// Monta todos os números do relatório para o mês escolhido (mesSel = 0..11), comparando com o mês anterior.
function montarRelatorio(planilha, mesSel) {
  const itens = [];
  const ausentes = [];   // abas sem a coluna do mês escolhido
  let temAnterior = false;
  const semAnterior = [];   // abas que têm o mês escolhido mas não o anterior
  planilha.abas.forEach(aba => {
    const iAt = aba.meses.findIndex(m => m.mes === mesSel);
    if (iAt < 0) { ausentes.push(aba.nome); return; }
    const iAn = aba.meses.findIndex(m => m.mes === mesSel - 1);
    if (iAn >= 0) temAnterior = true; else semAnterior.push(aba.nome);
    aba.itens.forEach(it => {
      const bruto = it.valores[iAt];
      const ant = iAn >= 0 ? it.valores[iAn] : null;
      const o = {
        aba: aba.nome, nome: limparNome(it.produto), atual: bruto === null || bruto === undefined ? 0 : bruto,
        // célula em branco conta como zero, no mês e no anterior (só fica null se a aba não tem o mês anterior)
        branco: bruto === null || bruto === undefined, ant: iAn < 0 ? null : (ant === null || ant === undefined ? 0 : ant), antN: ant || 0,
        cmm: it.cmm, estoque: it.estoque,
      };
      classificar(o);
      itens.push(o);
    });
  });

  // comparação só vale se todas as abas têm o mês anterior; com uma só faltando, o total ficaria inflado ("novo")
  if (temAnterior && semAnterior.length) { temAnterior = false; itens.forEach(i => { i.ant = null; i.antN = 0; }); }

  const abas = planilha.abas.map(a => a.nome).filter(n => itens.some(i => i.aba === n));
  const porAba = {};
  abas.forEach(nome => {
    const l = itens.filter(i => i.aba === nome);
    porAba[nome] = {
      itens: l.length,
      atual: l.reduce((s, i) => s + i.atual, 0),
      ant: temAnterior ? l.reduce((s, i) => s + i.antN, 0) : null,
      comSaida: l.filter(i => i.atual > 0).length,
      comSaidaAnt: temAnterior ? l.filter(i => i.antN > 0).length : null,
      faixas: Object.fromEntries(FAIXAS.map(f => [f.id, l.filter(i => i.faixa === f.id).length])),
    };
  });
  const soma = campo => abas.reduce((s, n) => s + (porAba[n][campo] || 0), 0);
  const total = {
    itens: itens.length, atual: soma('atual'), ant: temAnterior ? soma('ant') : null,
    comSaida: soma('comSaida'), comSaidaAnt: temAnterior ? soma('comSaidaAnt') : null,
    faixas: Object.fromEntries(FAIXAS.map(f => [f.id, itens.filter(i => i.faixa === f.id).length])),
  };
  return { mes: mesSel, itens, abas, porAba, total, temAnterior, ausentes, semAnterior };
}

// ── HTML do relatório ──────────────────────────────────────────

const aba1 = i => ROTULO_ABA[i.aba] || i.aba;
const tipo1 = i => ROTULO_ABA_UN[i.aba] || '';

function linhaItem(i, extra) {
  return `<td class="r-item">${esc(i.nome)}<small>${esc(tipo1(i))}${extra ? ' · ' + esc(extra) : ''}</small></td>`;
}

const COLUNAS_TEXTO = ['Critério', 'Situação', 'Exemplos'];

function tabela(cab, linhas, classe) {
  if (!linhas.length) return '<p class="r-vazio">Nenhum item nesta situação.</p>';
  return `<table class="r-tab ${classe || ''}"><thead><tr>${cab.map((c, k) => `<th class="${k && !COLUNAS_TEXTO.includes(c) ? 'n' : ''}">${esc(c)}</th>`).join('')}</tr></thead><tbody>${linhas.join('')}</tbody></table>`;
}

// Texto digitado pela coordenação: parágrafos separados por linha em branco; **assim** vira negrito.
function htmlAnalise(texto) {
  const t = String(texto || '').trim();
  if (!t) return '';
  return t.split(/\n\s*\n/).map(p => `<p class="r-analise">${esc(p.trim()).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>')}</p>`).join('');
}

function htmlRelatorio(r, un, ano, analise) {
  const mesTxt = MESES_REL[r.mes];
  const mesAnt = r.temAnterior ? MESES_REL[r.mes - 1] : null;
  const MES = mesTxt.toUpperCase();
  const t = r.total;
  const nMed = r.porAba.MEDICAMENTOS ? r.porAba.MEDICAMENTOS.itens : 0;
  const nMat = r.porAba.MATERIAIS ? r.porAba.MATERIAIS.itens : 0;
  const zer = t.faixas.zerado + t.faixas.semsemsaida;
  const out = [];
  if (r.ausentes && r.ausentes.length) {
    out.push(`<p class="r-aviso">Atenção: a planilha não tem a coluna de ${esc(mesTxt)} na aba ${esc(r.ausentes.map(n => ROTULO_ABA[n] || n).join(', '))}; o relatório não inclui esses itens.</p>`);
  }

  if (r.semAnterior && r.semAnterior.length && r.semAnterior.length < r.abas.length) {
    out.push(`<p class="r-aviso">Atenção: a planilha não tem a coluna do mês anterior (${esc(MESES_REL[r.mes - 1] || '')}) na aba ${esc(r.semAnterior.map(n => ROTULO_ABA[n] || n).join(', '))}; a comparação com o mês anterior não foi feita.</p>`);
  }
  const semEstoque = t.itens > 0 && t.faixas.semdado === t.itens;
  if (semEstoque) {
    out.push(`<p class="r-aviso">Atenção: a planilha não traz CMM nem estoque disponível; a situação do estoque, a cobertura e a reposição não puderam ser calculadas.</p>`);
  }

  // capa
  out.push(`<p class="r-kicker">RELATÓRIO MENSAL DE FARMÁCIA · COMPETÊNCIA ${esc(MES)} DE ${ano}</p>
    <h1 class="r-titulo">Saídas e estoque da farmácia ${/^hospital/i.test(un.nome) ? 'do' : 'da'} ${esc(un.nome)} em ${esc(mesTxt)} de ${ano}</h1>
    <p class="r-lead">${esc(un.municipio || '')}. Movimento do mês de ${esc(mesTxt)} para ${num(nMed)} medicamentos e ${num(nMat)} materiais médico-hospitalares: saídas${r.temAnterior ? ' comparadas com ' + esc(mesAnt) : ''}, situação do estoque, itens em ruptura ou com cobertura curta e verificações do registro.</p>
    <dl class="r-meta"><div><dt>FONTE</dt><dd>Planilha de saídas da unidade (abas Medicamentos e Materiais)</dd></div><div><dt>COMPETÊNCIA</dt><dd>${esc(mesTxt.charAt(0).toUpperCase() + mesTxt.slice(1))}/${ano}</dd></div></dl>`);

  // resumo executivo
  const varTotal = variacao(t.atual, t.ant);
  out.push(`<h2 class="r-h2">Resumo executivo</h2>
    <div class="r-kpis">
      <div><b>${num(t.atual)}</b><span>unidades dispensadas em ${esc(mesTxt)}</span><small>${num(r.porAba.MEDICAMENTOS ? r.porAba.MEDICAMENTOS.atual : 0)} medicamentos · ${num(r.porAba.MATERIAIS ? r.porAba.MATERIAIS.atual : 0)} materiais</small></div>
      <div><b>${num(t.comSaida)}</b><span>itens com saída no mês</span><small>de ${num(t.itens)} padronizados · ${num(t.itens - t.comSaida)} sem saída</small></div>
      <div><b>${semEstoque ? '—' : num(zer + t.faixas.critico + t.faixas.baixo)}</b><span>itens zerados ou com menos de 30 dias de estoque</span><small>${semEstoque ? 'estoque não informado na planilha' : num(zer) + ' zerados · ' + num(t.faixas.critico) + ' críticos · ' + num(t.faixas.baixo) + ' baixos'}</small></div>
      <div><b>${esc(varTotal)}</b><span>${r.temAnterior ? 'variação das saídas contra ' + esc(mesAnt) : 'sem mês anterior na planilha'}</span><small>${r.temAnterior ? num(t.ant) + ' em ' + esc(mesAnt) + ' → ' + num(t.atual) + ' em ' + esc(mesTxt) : '&nbsp;'}</small></div>
    </div>
    ${htmlAnalise(analise)}
    <h2 class="r-h2">Como os números foram calculados</h2>
    <p><b>Saída do mês</b> é a quantidade dispensada em ${esc(mesTxt)}, conforme a coluna do mês nas abas Medicamentos e Materiais. Células em branco contam como zero, também no mês anterior.</p>
    <p><b>Cobertura</b> = estoque disponível ÷ saída de ${esc(mesTxt)}, expressa em dias (abaixo de 1 mês) ou meses. Itens sem saída no mês não têm cobertura calculada. A planilha não informa a data de referência do estoque; considerou-se o estoque do fechamento do mês.</p>
    <p><b>Reposição sugerida</b> = quantidade para atingir 2 meses de cobertura pelo consumo do mês (2 × saída do mês − estoque). É um ponto de partida para o pedido; não considera pedidos em trânsito, prazos de entrega nem picos atípicos do mês.</p>`);

  // 1. Saídas
  const linhasTot = r.abas.map(n => {
    const a = r.porAba[n];
    return `<tr><td class="r-item">${esc(ROTULO_ABA[n] || n)}</td><td class="n">${a.ant === null ? '—' : num(a.ant)}</td><td class="n">${num(a.atual)}</td><td class="n">${esc(variacao(a.atual, a.ant))}</td><td class="n">${a.comSaidaAnt === null ? '—' : num(a.comSaidaAnt)} → ${num(a.comSaida)}</td></tr>`;
  });
  linhasTot.push(`<tr class="tot"><td class="r-item">Total</td><td class="n">${t.ant === null ? '—' : num(t.ant)}</td><td class="n">${num(t.atual)}</td><td class="n">${esc(varTotal)}</td><td class="n">${t.comSaidaAnt === null ? '—' : num(t.comSaidaAnt)} → ${num(t.comSaida)}</td></tr>`);
  out.push(`<h2 class="r-h2">1. Saídas de ${esc(mesTxt)}</h2>` + tabela(['', mesAnt ? mesAnt.charAt(0).toUpperCase() + mesAnt.slice(1) : 'Mês anterior', mesTxt.charAt(0).toUpperCase() + mesTxt.slice(1), 'Var.', 'Itens com saída'], linhasTot));
  if (r.temAnterior) {
    const comBase = r.itens.filter(i => i.ant !== null);
    const altas = comBase.filter(i => i.atual > i.antN && Math.max(i.atual, i.antN) >= 20).sort((a, b) => (b.atual - b.antN) - (a.atual - a.antN)).slice(0, 10);
    const quedas = comBase.filter(i => i.atual < i.antN && i.antN >= 20).sort((a, b) => (b.antN - b.atual) - (a.antN - a.atual)).slice(0, 10);
    const cab = ['Item', mesAnt.charAt(0).toUpperCase() + mesAnt.slice(1), mesTxt.charAt(0).toUpperCase() + mesTxt.slice(1), 'Var.'];
    const lin = (i, nota) => `<tr>${linhaItem(i, nota)}<td class="n">${num(i.antN)}</td><td class="n">${num(i.atual)}</td><td class="n">${esc(variacao(i.atual, i.antN))}</td></tr>`;
    out.push(`<h3 class="r-h3">Maiores altas</h3>` + tabela(cab, altas.map(i => lin(i, 'alta'))));
    out.push(`<h3 class="r-h3">Maiores quedas</h3>` + tabela(cab, quedas.map(i => lin(i, i.estoque !== null && i.estoque <= 0 ? 'queda · sem estoque' : 'queda'))));
    out.push(`<p class="r-nota">Itens com menos de 20 unidades nos dois meses não entram na lista. Queda de item sem estoque indica falta, não necessariamente menor consumo.</p>`);
  } else {
    out.push(`<p class="r-nota">A planilha não tem o mês anterior a ${esc(mesTxt)}; a comparação de itens não foi feita.</p>`);
  }

  // 2. Situação do estoque
  const barras = r.abas.map(n => {
    const a = r.porAba[n];
    const segs = FAIXAS.filter(f => a.faixas[f.id]).map(f => `<span style="--w:${a.faixas[f.id]};--c:${f.cor};--t:${f.txt}" title="${esc(f.rotulo)}: ${a.faixas[f.id]}"><i>${a.faixas[f.id]}</i></span>`).join('');
    return `<div class="r-barra"><b>${esc(ROTULO_ABA[n] || n)}</b><div class="r-segs">${segs}</div></div>`;
  }).join('');
  const colunas = r.abas.map(n => ROTULO_ABA[n] || n);
  const linhasSit = FAIXAS.map(f => `<tr><td class="r-item"><i class="r-quad" style="--c:${f.cor}"></i>${esc(f.rotulo)}</td><td class="r-crit">${esc(f.criterio)}</td>${r.abas.map(n => `<td class="n">${r.porAba[n].faixas[f.id]}</td>`).join('')}<td class="n">${t.faixas[f.id]}</td></tr>`);
  const adequados = t.faixas.adequado;
  out.push(`<h2 class="r-h2">2. Situação do estoque ao fim de ${esc(mesTxt)}</h2><div class="r-barras">${barras}</div>` +
    tabela(['Situação', 'Critério'].concat(colunas, ['Total']), linhasSit, 'r-sit') +
    `<p class="r-nota">${num(adequados)} dos ${num(t.itens)} itens (${Math.round(adequados / (t.itens || 1) * 100)}%) estão na faixa adequada, de 1 a 3 meses.</p>`);

  // 3. Itens zerados
  const zerados = r.itens.filter(i => i.faixa === 'zerado' || i.faixa === 'semsemsaida').sort((a, b) => (a.faixa === b.faixa ? b.antN - a.antN : a.faixa === 'zerado' ? -1 : 1));
  out.push(`<h2 class="r-h2">3. Itens zerados</h2>` + tabela(['Item', 'Situação', mesAnt ? 'Saída em ' + mesAnt : 'Saída anterior', 'Saída em ' + mesTxt, 'CMM'],
    zerados.map(i => `<tr>${linhaItem(i)}<td class="r-crit">${esc(POR_FAIXA[i.faixa].rotulo)}</td><td class="n">${i.ant === null ? '—' : num(i.antN)}</td><td class="n">${num(i.atual)}</td><td class="n">${i.cmm === null || i.cmm === undefined ? '—' : num(i.cmm)}</td></tr>`)));

  // 4. Cobertura crítica e baixa
  const curtos = r.itens.filter(i => i.faixa === 'critico' || i.faixa === 'baixo').sort((a, b) => a.dias - b.dias);
  out.push(`<h2 class="r-h2">4. Cobertura crítica e baixa</h2>` + tabela(['Item', 'Saída no mês', 'Estoque', 'Cobertura', 'Reposição sugerida'],
    curtos.map(i => `<tr>${linhaItem(i, POR_FAIXA[i.faixa].rotulo.toLowerCase())}<td class="n">${num(i.atual)}</td><td class="n">${num(i.estoque)}</td><td class="n">${cobertura(i)}</td><td class="n">${num(reposicao(i))}</td></tr>`)));

  // 5. Sem giro e excesso
  const excesso = r.itens.filter(i => i.faixa === 'excesso').sort((a, b) => b.dias - a.dias);
  const semGiro = r.itens.filter(i => i.faixa === 'semsaida').sort((a, b) => b.estoque - a.estoque);
  out.push(`<h2 class="r-h2">5. Estoque sem giro e excesso</h2>
    <h3 class="r-h3">Excesso: ${num(excesso.length)} ${excesso.length === 1 ? 'item' : 'itens'} com mais de 6 meses de cobertura${excesso.length > 15 ? ' (15 de maior cobertura)' : ''}</h3>` +
    tabela(['Item', 'Saída no mês', 'Estoque', 'Cobertura'], excesso.slice(0, 15).map(i => `<tr>${linhaItem(i)}<td class="n">${num(i.atual)}</td><td class="n">${num(i.estoque)}</td><td class="n">${cobertura(i)}</td></tr>`)) +
    `<h3 class="r-h3">Sem saída no mês: ${num(semGiro.length)} ${semGiro.length === 1 ? 'item' : 'itens'} com estoque${semGiro.length > 15 ? ' (15 de maior estoque)' : ''}</h3>` +
    tabela(['Item', mesAnt ? 'Saída em ' + mesAnt : 'Saída anterior', 'Estoque'], semGiro.slice(0, 15).map(i => `<tr>${linhaItem(i)}<td class="n">${i.ant === null ? '—' : num(i.antN)}</td><td class="n">${num(i.estoque)}</td></tr>`)));

  // 6. Verificações do registro (contagens, sem interpretação)
  const semEst = r.itens.filter(i => i.faixa === 'semdado');
  const branco = r.itens.filter(i => i.branco);
  const picos = r.temAnterior ? r.itens.filter(i => i.ant !== null && i.atual >= 100 && i.atual > 5 * Math.max(i.antN, 1)).sort((a, b) => b.atual - a.atual) : [];
  const sumiram = r.temAnterior ? r.itens.filter(i => i.antN > 0 && i.atual === 0) : [];
  const verif = [
    ['Itens com estoque em branco', semEst.length, semEst],
    ['Itens com saída em branco em ' + mesTxt, branco.length, branco],
    r.temAnterior ? ['Itens com saída em ' + mesAnt + ' e nenhuma em ' + mesTxt, sumiram.length, sumiram] : null,
    r.temAnterior ? ['Picos isolados (saída de 100 ou mais, mais de 5 vezes a do mês anterior)', picos.length, picos] : null,
  ].filter(Boolean);
  out.push(`<h2 class="r-h2">6. Verificações do registro</h2>` + tabela(['Verificação', 'Itens', 'Exemplos'],
    verif.map(([rot, n, l]) => `<tr><td class="r-item">${esc(rot)}</td><td class="n">${num(n)}</td><td class="r-crit">${n ? esc(l.slice(0, 3).map(i => i.nome).join('; ')) + (n > 3 ? '…' : '') : '—'}</td></tr>`)) +
    `<p class="r-nota">Contagens automáticas da planilha, sem interpretação: servem de roteiro para conferir os lançamentos antes de usar o mês como base de programação.</p>`);

  // Anexo
  out.push(`<h2 class="r-h2 r-quebra">Anexo · Todos os itens em ${esc(mesTxt)}</h2>`);
  r.abas.forEach(n => {
    const l = r.itens.filter(i => i.aba === n);
    out.push(`<h3 class="r-h3">${esc(ROTULO_ABA[n] || n)} (${num(l.length)})</h3>` + tabela(['Item', mesAnt ? mesAnt.charAt(0).toUpperCase() + mesAnt.slice(1) : 'Anterior', mesTxt.charAt(0).toUpperCase() + mesTxt.slice(1), 'Var.', 'CMM', 'Estoque', 'Cobertura', 'Situação'],
      l.map(i => `<tr><td class="r-item">${esc(i.nome)}</td><td class="n">${i.ant === null ? '—' : num(i.antN)}</td><td class="n">${num(i.atual)}</td><td class="n">${esc(variacao(i.atual, i.ant === null ? null : i.antN))}</td><td class="n">${i.cmm === null || i.cmm === undefined ? '—' : num(i.cmm)}</td><td class="n">${i.estoque === null || i.estoque === undefined ? '—' : num(i.estoque)}</td><td class="n">${cobertura(i)}</td><td class="r-crit">${esc(POR_FAIXA[i.faixa].rotulo)}</td></tr>`), 'r-anexo'));
  });

  return out.join('\n');
}

// ── Tela ───────────────────────────────────────────────────────

if (typeof document !== 'undefined' && typeof module === 'undefined') (function () {
  const $ = id => document.getElementById(id);
  let info = null;
  let planilha = null;
  let verificouPerfil = false;
  let tentouEndereco = false;
  let pedido = 0;   // só vale a resposta do último pedido (trocar de unidade rápido não mistura dados)
  const doEndereco = new URLSearchParams(location.search).get('unidade');
  let unidadeSel = doEndereco && /^[A-Za-z0-9_.-]+$/.test(doEndereco) ? doEndereco : '';   // atalho da tela de acompanhamento

  function setStatus(texto, tipo) {
    const el = $('rel-status');
    el.textContent = texto || '';
    el.className = 'notice' + (tipo ? ' ' + tipo : '');
    el.hidden = !texto;
  }

  function semFolha(mensagem) {
    $('rel-folha').hidden = true;
    $('btn-imprimir').disabled = true;
    $('mesSel').innerHTML = '';
    setStatus(mensagem, 'erro');
  }

  // Meses que podem virar relatório: existem em TODAS as abas, não são futuros e têm algum número lançado.
  function mesesDisponiveis() {
    const abas = planilha.abas;
    if (!abas.length) return [];
    const ate = planilha.mesAberto.mes;
    return abas[0].meses.map(m => m.mes).filter(mes => mes <= ate && abas.every(a => {
      const i = a.meses.findIndex(m => m.mes === mes);
      return i >= 0 && a.itens.some(it => it.valores[i] !== null && it.valores[i] !== undefined);
    }));
  }

  // o texto de análise fica neste navegador, por unidade e mês, só para não se perder ao recarregar
  const chaveAnalise = () => 'farma_rel_analise_' + unidadeSel + '_' + $('mesSel').value;
  function lerAnalise() {
    try { $('analise').value = localStorage.getItem(chaveAnalise()) || ''; } catch (e) { $('analise').value = ''; }
  }

  function desenhar() {
    const mes = +$('mesSel').value;
    const un = info.unidades.find(u => u.id === unidadeSel) || { nome: unidadeSel, municipio: '' };
    const r = montarRelatorio(planilha, mes);
    $('rel-folha-corpo').innerHTML = htmlRelatorio(r, un, planilha.mesAberto.ano, $('analise').value);
    $('rel-folha').hidden = false;
    $('btn-imprimir').disabled = false;
    document.title = 'Relatório de farmácia · ' + un.nome + ' · ' + MESES_REL[mes] + ' de ' + planilha.mesAberto.ano;
    $('rel-sub').textContent = r.temAnterior
      ? `Confira a prévia abaixo e clique em Imprimir. Os números de ${MESES_REL[mes]} são comparados com ${MESES_REL[mes - 1]}.`
      : `Confira a prévia abaixo e clique em Imprimir. A planilha não tem o mês anterior a ${MESES_REL[mes]}: a comparação não aparece.`;
  }

  async function carregar() {
    const meu = ++pedido;
    $('btn-imprimir').disabled = true;
    try {
      // coordenador não tem este relatório: volta ao início antes de buscar qualquer dado
      if (!verificouPerfil) {
        const sessao = await exigirSessao();
        if (meu !== pedido) return;
        if (sessao.usuario.perfil !== 'admin') { location.href = 'index.html'; return; }
        verificouPerfil = true;
      }
      setStatus('Carregando os dados da unidade…');
      const r = await api('logistica.carregar', unidadeSel ? { unidade: unidadeSel } : {});
      if (meu !== pedido) return;
      info = r.sessao;
      if (!validarSessao(info)) return;
      planilha = r.logistica;
      unidadeSel = planilha.unidade;
      if (!$('unitSel').dataset.pronto) {
        $('unitSel').dataset.pronto = '1';
        $('unitSel').innerHTML = info.unidades.map(u => `<option value="${esc(u.id)}">${esc(u.nome)}</option>`).join('');
      }
      $('unitSel').value = unidadeSel;

      if (!planilha.abas.length) return semFolha('A planilha desta unidade não tem as abas de medicamentos e materiais. Avise a TI.');
      const lista = mesesDisponiveis();
      if (!lista.length) return semFolha('Não há mês com dados lançados em todas as abas da planilha desta unidade.');
      const sel = $('mesSel');
      sel.innerHTML = lista.map(m => `<option value="${m}">${esc(MESES_NOME[m])}/${planilha.mesAberto.ano}</option>`).join('');
      sel.value = String(lista.indexOf(planilha.mesAberto.mes) >= 0 ? planilha.mesAberto.mes : lista[lista.length - 1]);
      setStatus('');
      lerAnalise();
      desenhar();
    } catch (e) {
      if (meu !== pedido) return;
      if (unidadeSel && !planilha && !tentouEndereco) { tentouEndereco = true; unidadeSel = ''; return carregar(); }   // ?unidade= inválida: abre a padrão
      semFolha(e.message);
    }
  }

  $('unitSel').addEventListener('change', () => { unidadeSel = $('unitSel').value; carregar(); });
  $('mesSel').addEventListener('change', () => { lerAnalise(); desenhar(); });
  $('analise').addEventListener('input', () => {
    try { localStorage.setItem(chaveAnalise(), $('analise').value); } catch (e) { /* sem armazenamento: segue sem rascunho */ }
    if (planilha) desenhar();
  });
  $('btn-imprimir').addEventListener('click', () => window.print());
  carregar();
})();

if (typeof module !== 'undefined') module.exports = { htmlAnalise, montarRelatorio, classificar, htmlRelatorio, limparNome, variacao, reposicao, FAIXAS };
