// Painel decorativo do login: telas que giram. Só enfeite: fica fora do leitor de tela.
(function () {
  const raiz = document.getElementById('login-previa');
  if (!raiz) return;
  const slides = Array.from(raiz.querySelectorAll('.lp-slide'));
  const trilho = raiz.querySelector('.lp-trilho');
  const pontos = raiz.querySelector('.lp-pontos');
  const parado = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let atual = 0, voltas = 0, timer = null;

  raiz.classList.add('lp--carrossel');
  slides.forEach((_, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.tabIndex = -1;
    b.addEventListener('click', () => { ir(i); reiniciar(); });
    pontos.appendChild(b);
  });

  function ir(i) {
    atual = (i + slides.length) % slides.length;
    slides.forEach((s, k) => {
      const o = (k - atual + slides.length) % slides.length;
      s.style.setProperty('--o', o);
      s.classList.toggle('ativo', o === 0);
    });
    trilho.style.transform = 'translateX(' + (-100 * atual) + '%)';
    Array.from(pontos.children).forEach((b, k) => b.classList.toggle('on', k === atual));
  }
  function reiniciar() {
    clearInterval(timer);
    if (parado) return;
    timer = setInterval(() => {
      if (atual === slides.length - 1 && ++voltas >= 2) { clearInterval(timer); return; }  // para após 2 voltas
      ir(atual + 1);
    }, 4500);
  }

  // arrastar com dedo ou mouse
  let x0 = null;
  raiz.addEventListener('pointerdown', e => { x0 = e.clientX; });
  window.addEventListener('pointerup', e => {
    if (x0 === null) return;
    const dx = e.clientX - x0; x0 = null;
    if (Math.abs(dx) > 40) { ir(atual + (dx < 0 ? 1 : -1)); reiniciar(); }
  });
  raiz.addEventListener('mouseenter', () => clearInterval(timer));
  raiz.addEventListener('mouseleave', reiniciar);

  ir(0); reiniciar();
})();
