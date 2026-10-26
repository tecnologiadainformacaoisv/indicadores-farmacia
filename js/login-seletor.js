// Seletor TEMPORÁRIO da proposta do login: liga e desliga cada refinamento para comparar. Sai antes de publicar.
(function () {
  const ITENS = [
    ['v-foco', '1 · Formulário em foco (sem cartão, logo, título maior)'],
    ['v-olho', '2 · Olho dentro do campo de senha'],
    ['v-carga', '3 · Botão com indicador de carregamento'],
    ['v-erro', '4 · Erro em aviso + alerta de Caps Lock'],
    ['v-confianca', '5 · Linha de acesso restrito'],
    ['v-sobrio', '6 · Painel mais sóbrio (grade sutil)'],
    ['v-entrada', '7 · Entrada suave do formulário'],
    ['v-divisao', '8 · Cartão sobre a divisão (telas largas)']
  ];
  const CHAVE = 'farma_login_proposta2';
  let ligados;
  try { ligados = JSON.parse(localStorage.getItem(CHAVE)); } catch (e) { ligados = null; }
  if (!Array.isArray(ligados)) ligados = ITENS.map(i => i[0]);

  const caixa = document.createElement('div');
  caixa.className = 'lg-seletor fechado';   // começa recolhido
  caixa.innerHTML = '<button type="button" class="lg-topo" aria-expanded="false"><b>Proposta do login</b> <span>abrir</span></button>';
  caixa.querySelector('.lg-topo').addEventListener('click', ev => {
    const f = caixa.classList.toggle('fechado');
    ev.currentTarget.setAttribute('aria-expanded', String(!f));
    ev.currentTarget.querySelector('span').textContent = f ? 'abrir' : 'recolher';
  });
  const aplicar = () => {
    ITENS.forEach(([k]) => document.body.classList.toggle(k, ligados.includes(k)));
    try { localStorage.setItem(CHAVE, JSON.stringify(ligados)); } catch (e) { /* ignora */ }
  };
  ITENS.forEach(([k, rotulo]) => {
    const l = document.createElement('label');
    const c = document.createElement('input');
    c.type = 'checkbox'; c.checked = ligados.includes(k);
    c.addEventListener('change', () => {
      ligados = c.checked ? ligados.concat(k) : ligados.filter(x => x !== k);
      aplicar();
      // a entrada suave só aparece ao reabrir a tela
      if (k === 'v-entrada' && c.checked) location.reload();
    });
    l.append(c, ' ' + rotulo);
    caixa.appendChild(l);
  });
  const estilos = document.createElement('div');
  estilos.className = 'lg-estilos';
  const pilha = /[?&]estilo=pilha\b/.test(location.search);
  [['carrossel', false], ['pilha', true]].forEach(([nome, ePilha]) => {
    const a = document.createElement('a');
    a.href = ePilha ? '?estilo=pilha' : location.pathname;
    a.textContent = nome;
    if (ePilha === pilha) a.className = 'on';
    estilos.appendChild(a);
  });
  caixa.append(estilos);
  document.body.appendChild(caixa);
  aplicar();
})();
