// Adaptador do comparador de layouts (../../../_ux-design/comparador) para o Indicadores da Farmácia.
// Uso, a partir da pasta Desenvolvimento:
//   node _ux-design/comparador/comparar.js --repo projeto-indicadores-farmacia --a main --b atualizacao-visual --adaptador projeto-indicadores-farmacia/tools/visual/comparar.adaptador.js
// Os dois lados usam a mesma API simulada (mock.js), então a diferença que aparece é só a das telas.
const { responder } = require('./mock');

// gravações não alteram nada: só devolvem o que o servidor devolveria
const GRAVACOES = req => ({
  'lancamentos.salvar': { ano: 2026, mes: 4 },
  'logistica.salvar': { gravados: (req.itens || []).length },
  'metas.salvar': true, sair: true, trocarSenha: { token: req.token },
  'usuarios.criar': { login: req.login, nome: req.nome, unidade: req.unidade, senhaProvisoria: 'abc123xyz9' },
  'usuarios.redefinirSenha': { login: req.login, nome: 'Usuário', senhaProvisoria: 'nova456abc' },
  'usuarios.atualizar': true, 'usuarios.definirAtivo': true,
});

module.exports = {
  nome: 'Indicadores da Farmácia',
  paginas: ['index.html', 'indicadores.html', 'logistica.html', 'usuarios.html', 'dashboard.html', 'ajuda.html'],
  perfis: {
    'Tereza (coordenação)': { farma_sessao: 'admin' },
    'Coordenadora': { farma_sessao: 'coordenador' },
  },
  temas: { 'Claro': { farma_theme: 'light' }, 'Escuro': { farma_theme: 'dark' } },

  // a API real vira a simulada, relativa ao lado (/a/api ou /b/api)
  reescrever(caminho, texto) {
    if (caminho === 'js/api.js') return texto.replace(/const API_URL = '[^']*';/, "const API_URL = 'api';");
  },

  api(corpo) {
    const req = JSON.parse(corpo || '{}');
    const perfil = ['admin', 'coordenador'].includes(req.token) ? req.token : null;
    if (req.action === 'login') return { ok: true, dados: { token: /tereza|admin/i.test(req.login) ? 'admin' : 'coordenador' } };
    if (!perfil) return { ok: false, erro: 'Sua sessão expirou. Entre novamente.', codigo: 'sessao' };
    const lido = responder(req, perfil);
    if (lido) return { ok: true, dados: lido };
    const g = GRAVACOES(req);
    return req.action in g ? { ok: true, dados: g[req.action] } : { ok: false, erro: 'Ação não simulada: ' + req.action };
  },
};
