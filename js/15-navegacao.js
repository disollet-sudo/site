/* =============================================
   Di Solle — 15. NAVEGAÇÃO — MODAIS, SHEET E CARRINHO
   Abrir/fechar os modais e o bottom-sheet mobile.
   Depende de: 01-estado-global.js, 06-precos-kne825-millenium.js, 08-catalogo-filtros.js, 10-carrinho.js (limSel, atualizarCarrinho)
   ============================================= */

// =============================================
// SINCRONIZAÇÃO E EVENTOS DE PRAZO E UF
// =============================================
function alterouPrazoBase(idOrigem, idDestino) {
  let elemOrigem = document.getElementById(idOrigem);
  let elemDestino = document.getElementById(idDestino);
  if (elemOrigem && elemDestino) {
    elemDestino.value = elemOrigem.value;
  }
  if (typeof verificarModoEspecial === 'function') {
    verificarModoEspecial();
  }
  if (typeof renderizarProdutos === 'function') {
    renderizarProdutos();
  }
  if (typeof atualizarCarrinho === 'function') {
    atualizarCarrinho();
  }
}

function alterouUF(idOrigem, idDestino) {
  let elemOrigem = document.getElementById(idOrigem);
  let elemDestino = document.getElementById(idDestino);
  if (elemOrigem && elemDestino) {
    elemDestino.value = elemOrigem.value;
  }
  if (typeof renderizarProdutos === 'function') {
    renderizarProdutos();
  }
  if (typeof atualizarCarrinho === 'function') {
    atualizarCarrinho();
  }
}

// =============================================
// MODAIS E BOTTOM SHEET
// =============================================
function fecharModalSucesso() {
  document.getElementById('modal-sucesso').classList.remove('open');
  setTimeout(() => document.getElementById('modal-sucesso').style.display = 'none', 300);
  if (DADOS_PDF_PRONTO && DADOS_PDF_PRONTO.tipoAcao === 'enviar') { 
    if (typeof limSel === 'function') limSel(); 
  }
  fecharSheet();
}

function clicouForaSucesso(e) { 
  if (e.target === document.getElementById('modal-sucesso')) fecharModalSucesso(); 
}

function abrirSheet() { 
  document.getElementById('b-sheet').classList.add('open'); 
  document.getElementById('sh-ov').classList.add('open'); 
}

function fecharSheet() { 
  document.getElementById('b-sheet').classList.remove('open'); 
  document.getElementById('sh-ov').classList.remove('open'); 
}

function abrirCarrinho() {
  if (typeof atualizarCarrinho === 'function') {
    atualizarCarrinho();
  }
  document.getElementById('modal-carrinho').style.display = 'flex';
  document.getElementById('modal-carrinho').classList.add('open');
}

function fecharCarrinho() {
  document.getElementById('modal-carrinho').classList.remove('open');
  setTimeout(() => document.getElementById('modal-carrinho').style.display = 'none', 300);
}

function clicouForaCarrinho(e) { 
  if (e.target === document.getElementById('modal-carrinho')) fecharCarrinho(); 
}

function abrirModalNovoCliente() {
  BLOQUEIA_SALVAMENTO_CNPJ = false;
  document.getElementById('btn-salvar-nc').disabled = false;
  document.getElementById('modal-novo-cliente').style.display = 'flex';
  document.getElementById('modal-novo-cliente').classList.add('open');
}

function fecharModalNovoCliente() {
  document.getElementById('modal-novo-cliente').classList.remove('open');
  setTimeout(() => document.getElementById('modal-novo-cliente').style.display = 'none', 300);
}
