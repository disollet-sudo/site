/* =============================================
   Di Solle — 07. DADOS — CARREGAMENTO E SINCRONIZAÇÃO
   Busca o catálogo/clientes/tabelas no Google Apps Script (Code.gs)
   e cuida do botão "Sincronizar Catálogo".
   Depende de: 01-estado-global.js, 05-utils-busca.js,
               08-catalogo-filtros.js (filtrar),
               03-persistencia-local.js
   ============================================= */

async function carregarDados(force = false) {
  try {
    const r = await fetch(URL_GOOGLE_SCRIPT + (force ? '?atualizar=true' : ''));
    const d = await r.json();
    PRODUTOS = d.produtos || [];
    FRETE_REGRAS = d.freteRegras || {};
    CLIENTES = d.clientes || [];
    TABELA_KNE825 = d.tabelaKNE825 || {};
    TABELA_MILLENIUM = d.tabelaMillenium || {};

    let ufs = d.estados || Object.keys(FRETE_REGRAS);
    let ufd = document.getElementById('uf-d'), ufm = document.getElementById('uf-m');
    ufd.innerHTML = '<option value="">Selecione o Estado...</option>';
    ufm.innerHTML = '<option value="">Selecione o Estado...</option>';
    ufs.forEach(e => {
      ufd.innerHTML += `<option value="${e}">${e}</option>`;
      ufm.innerHTML += `<option value="${e}">${e}</option>`;
    });
    filtrar();
  } catch (e) {
    showToast('Erro de conexão.');
  }
}

function sincronizarPlanilha() {
  document.getElementById('btn-sync').innerText = "Sincronizando...";
  // Garante que o carrinho/dados atuais estão salvos antes de recarregar
  salvarCarrinhoLocal();
  salvarClienteLocal();
  salvarConfigLocal();
  // Força o navegador a buscar TODOS os arquivos de novo (index.html, os js/*.js, estilo.css),
  // ignorando cache antigo. O carrinho volta sozinho pois foi salvo no localStorage acima.
  let url = new URL(window.location.href);
  url.searchParams.set('_r', Date.now());
  window.location.href = url.toString();
}
