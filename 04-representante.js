/* =============================================
   Di Solle — 04. REPRESENTANTE
   Tela de login simples por código de representante.
   Depende de: 01-estado-global.js
   ============================================= */

function salvarRepre() {
  let val = document.getElementById('repre-codigo').value.trim();
  if (!val) { alert("Digite o código."); return; }
  CODIGO_REPRE = val;
  localStorage.setItem('repre_cod', val);
  document.getElementById('modal-repre').style.display = 'none';
  atualizarExibicaoRepre();
  showToast("Representante saved!");
}

function atualizarExibicaoRepre() {
  document.getElementById('info-repre-txt').innerText = CODIGO_REPRE;
  document.getElementById('info-repre-box').style.display = 'flex';
}

function abrirModalRepre() {
  document.getElementById('repre-codigo').value = CODIGO_REPRE;
  document.getElementById('modal-repre').style.display = 'flex';
  document.getElementById('modal-repre').classList.add('open');
}
