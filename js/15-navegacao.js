/* =============================================
   Di Solle — 15. NAVEGAÇÃO — MODAIS, SHEET E CARRINHO
   ============================================= */

// =============================================
// SINCRONIZAÇÃO E EVENTOS DE PRAZO E UF
// =============================================
// alterouPrazoBase() e alterouUF() NÃO ficam neste arquivo — a versão
// válida é a de 10-carrinho.js (que também exibe/popula o dropdown de
// "Opções de Desmembramento" / prazos médios via SUB_PRAZOS).
// Havia uma duplicata dessas duas funções aqui, e como este arquivo é
// carregado DEPOIS de 10-carrinho.js no index.html, a duplicata (que não
// sabia nada do wrapper-subprazo-d/m) sobrescrevia a versão correta,
// deixando o dropdown de prazos médios sempre escondido/vazio.

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
