/* =============================================
   Di Solle — 04. REPRESENTANTE
   Código do representante do pedido.
   - REPRESENTANTE logado: código fixo, vem do login (19-login.js).
   - GESTOR/ADMIN: informa o código do representante ao fazer o pedido.
   Depende de: 01-estado-global.js, 19-login.js
   ============================================= */

function representanteTravado() {
  let s = (window.Sessao && Sessao.get()) || null;
  return !!(s && s.usuario && s.usuario.perfil === 'REPRESENTANTE');
}

function salvarRepre() {
  let val = document.getElementById('repre-codigo').value.trim();
  if (!val) { alert("Digite o código."); return; }
  CODIGO_REPRE = val;
  localStorage.setItem('repre_cod', val);
  if (window.Sessao && Sessao.marcarRepre) Sessao.marcarRepre(); // gestor não perde a escolha ao recarregar
  document.getElementById('modal-repre').style.display = 'none';
  document.getElementById('modal-repre').classList.remove('open');
  atualizarExibicaoRepre();
  showToast("Representante salvo!");
}

function atualizarExibicaoRepre() {
  document.getElementById('info-repre-txt').innerText = CODIGO_REPRE;
  document.getElementById('info-repre-box').style.display = 'flex';
}

function abrirModalRepre() {
  if (representanteTravado()) return; // representante logado não troca o próprio código
  document.getElementById('repre-codigo').value = CODIGO_REPRE;
  document.getElementById('modal-repre').style.display = 'flex';
  document.getElementById('modal-repre').classList.add('open');
}
