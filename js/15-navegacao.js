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

  // Valida a regra especial KNE825
  if (typeof verificarModoEspecial === 'function') {
    verificarModoEspecial();
  }

  // Re-renderiza o catálogo para atualizar instantaneamente os preços dos cards na tela
  if (typeof renderizarProdutos === 'function') {
    renderizarProdutos();
  }

  // Recalcula o subtotal e totais do carrinho com as novas condições
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

  // Re-renderiza o catálogo para recalcular o ICMS (7% vs 12%) nos cards
  if (typeof renderizarProdutos === 'function') {
    renderizarProdutos();
  }

  // Recalcula os valores do carrinho com a nova alíquota/frete da UF
  if (typeof atualizarCarrinho === 'function') {
    atualizarCarrinho();
  }
}

// =============================================
// MODAIS E BOTTOM SHEET
// =============================================
function fecharModalSucesso() {
  let modal = document.getElementById('modal-sucesso');
  if (modal) {
    modal.classList.remove('open');
    setTimeout(() => modal.style.display = 'none', 300);
  }
  if (typeof DADOS_PDF_PRONTO !== 'undefined' && DADOS_PDF_PRONTO && DADOS_PDF_PRONTO.tipoAcao === 'enviar') { 
    if (typeof limSel === 'function') limSel(); 
  }
  fecharSheet();
}

function clicouForaSucesso(e) { 
  if (e.target === document.getElementById('modal-sucesso')) fecharModalSucesso(); 
}

function abrirSheet() { 
  let sheet = document.getElementById('b-sheet');
  let ov = document.getElementById('sh-ov');
  if (sheet) sheet.classList.add('open'); 
  if (ov) ov.classList.add('open'); 
}

function fecharSheet() { 
  let sheet = document.getElementById('b-sheet');
  let ov = document.getElementById('sh-ov');
  if (sheet) sheet.classList.remove('open'); 
  if (ov) ov.classList.remove('open'); 
}

function abrirCarrinho() {
  if (typeof atualizarCarrinho === 'function') {
    atualizarCarrinho();
  }
  let modalCarrinho = document.getElementById('modal-carrinho');
  if (modalCarrinho) {
    modalCarrinho.style.display = 'flex';
    modalCarrinho.classList.add('open');
  }
}

function fecharCarrinho() {
  let modalCarrinho = document.getElementById('modal-carrinho');
  if (modalCarrinho) {
    modalCarrinho.classList.remove('open');
    setTimeout(() => modalCarrinho.style.display = 'none', 300);
  }
}

function clicouForaCarrinho(e) { 
  if (e.target === document.getElementById('modal-carrinho')) fecharCarrinho(); 
}

function abrirModalNovoCliente() {
  if (typeof BLOQUEIA_SALVAMENTO_CNPJ !== 'undefined') {
    BLOQUEIA_SALVAMENTO_CNPJ = false;
  }
  let btnSalvar = document.getElementById('btn-salvar-nc');
  if (btnSalvar) btnSalvar.disabled = false;

  let modalNC = document.getElementById('modal-novo-cliente');
  if (modalNC) {
    modalNC.style.display = 'flex';
    modalNC.classList.add('open');
  }
}

function fecharModalNovoCliente() {
  let modalNC = document.getElementById('modal-novo-cliente');
  if (modalNC) {
    modalNC.classList.remove('open');
    setTimeout(() => modalNC.style.display = 'none', 300);
  }
}
