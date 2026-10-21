// Fonte única da versão exibida no cabeçalho e no rodapé. Atualize junto com o CHANGELOG.md.
const APP_VERSION = '0.3.3';
document.querySelectorAll('[data-app-version]').forEach(el => { el.textContent = APP_VERSION; });
