/* =============================================
   Di Solle — 02. POPUP DE CARREGAMENTO INICIAL
   Barra de progresso e tempo restante exibidos ao abrir o app.
   Depende de: 01-estado-global.js
   ============================================= */

function iniciarLoadingInicial() {
  const overlay = document.getElementById('loading-inicial');
  if (!overlay) return;
  overlay.style.display = 'flex';
  overlay.classList.remove('fechando');
  LOADING_INICIAL_START = Date.now();
  clearInterval(LOADING_INICIAL_INTERVAL);
  atualizarProgressoLoadingInicial();
  LOADING_INICIAL_INTERVAL = setInterval(atualizarProgressoLoadingInicial, 150);
}

function atualizarProgressoLoadingInicial() {
  const barra = document.getElementById('loading-inicial-barra');
  const pct = document.getElementById('loading-inicial-pct');
  const tempo = document.getElementById('loading-inicial-tempo');
  let decorrido = Date.now() - LOADING_INICIAL_START;
  // Progresso simulado: sobe rápido no início e desacelera, sem passar de 92% sozinho
  // (os últimos % só completam quando os dados realmente chegam)
  let fracao = decorrido / LOADING_INICIAL_DURACAO_ESTIMADA;
  let progresso = 92 * (1 - Math.exp(-fracao * 2.2));
  if (progresso > 92) progresso = 92;
  let restanteSeg = Math.max(0, Math.ceil((LOADING_INICIAL_DURACAO_ESTIMADA - decorrido) / 1000));
  if (barra) barra.style.width = progresso.toFixed(0) + '%';
  if (pct) pct.innerText = progresso.toFixed(0) + '%';
  if (tempo) tempo.innerText = restanteSeg > 0 ? ('~' + restanteSeg + 's restantes') : 'Quase pronto...';
}

function finalizarLoadingInicial() {
  const overlay = document.getElementById('loading-inicial');
  const barra = document.getElementById('loading-inicial-barra');
  const pct = document.getElementById('loading-inicial-pct');
  const tempo = document.getElementById('loading-inicial-tempo');
  clearInterval(LOADING_INICIAL_INTERVAL);
  if (!overlay) return;
  if (barra) barra.style.width = '100%';
  if (pct) pct.innerText = '100%';
  if (tempo) tempo.innerText = 'Pronto!';
  setTimeout(() => {
    overlay.classList.add('fechando');
    setTimeout(() => { overlay.style.display = 'none'; overlay.classList.remove('fechando'); }, 300);
  }, 250);
}
