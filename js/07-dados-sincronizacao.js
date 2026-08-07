/* =============================================
   Di Solle — 07. DADOS — CARREGAMENTO E SINCRONIZAÇÃO
   Busca o catálogo/clientes/tabelas no Google Apps Script (Code.gs)
   e cuida do botão "Sincronizar Catálogo".
   Depende de: 01-estado-global.js, 05-utils-busca.js,
               08-catalogo-filtros.js (filtrar),
               03-persistencia-local.js
   ============================================= */

// Processa e converte os dados brutos recebidos da planilha Millenium
function processarTabelaMillenium(dados) {
  TABELA_MILLENIUM = {};
  if (!dados) return;

  // Se vier como Array/Matriz de linhas da planilha
  if (Array.isArray(dados)) {
    if (dados.length === 0) return;

    // Identifica se a primeira linha é o cabeçalho ("Código", "icms 7", etc.)
    let inicio = 0;
    if (dados[0] && typeof dados[0][0] === 'string' && isNaN(parseFloat(dados[0][0]))) {
      let col0 = String(dados[0][0]).toLowerCase();
      if (col0.includes('cód') || col0.includes('cod') || col0.includes('produto')) {
        inicio = 1;
      }
    }

    for (let i = inicio; i < dados.length; i++) {
      let r = dados[i];
      if (!r || !r[0]) continue;

      let codigo = String(r[0]).trim().toLowerCase();
      if (!codigo) continue;

      // Estrutura do seu layout de planilha:
      // Coluna A (r[0]): Código
      // Coluna B (r[1]): Pedido Mínimo (Opcional)
      // Coluna C (r[2]): Antecipado
      // Coluna D (r[3]): 28 dias
      // Coluna E (r[4]): 35 dias
      // Coluna F (r[5]): 42 dias
      // Coluna G (r[6]): 56 dias
      // Coluna H (r[7]): 63 dias
      // Coluna I (r[8]) ou Coluna O (r[14]): ICM (ICMS)
      let minVal = r[1];
      let antecipado = r[2];
      let d28 = r[3];
      let d35 = r[4];
      let d42 = r[5];
      let d56 = r[6];
      let d63 = r[7];
      let icmVal = (r[8] !== undefined && r[8] !== '') ? r[8] : r[14];

      let itemData = {
        minimo: minVal,
        antecipado: antecipado,
        d28: d28,
        d35: d35,
        d42: d42,
        d56: d56,
        d63: d63,
        icm: icmVal
      };

      if (!TABELA_MILLENIUM[codigo]) {
        TABELA_MILLENIUM[codigo] = [];
      }
      TABELA_MILLENIUM[codigo].push(itemData);
    }
  } else if (typeof dados === 'object') {
    // Se o Apps Script já retornar formatado como Objeto
    TABELA_MILLENIUM = dados;
  }
}

async function carregarDados(force = false) {
  try {
    const r = await fetch(URL_GOOGLE_SCRIPT + (force ? '?atualizar=true' : ''));
    const d = await r.json();
    PRODUTOS = d.produtos || [];
    FRETE_REGRAS = d.freteRegras || {};
    CLIENTES = d.clientes || [];
    TABELA_KNE825 = d.tabelaKNE825 || {};

    // Processa os dados da Tabela Millenium
    if (d.tabelaMillenium) {
      processarTabelaMillenium(d.tabelaMillenium);
    } else {
      TABELA_MILLENIUM = {};
    }

    let ufs = d.estados || Object.keys(FRETE_REGRAS);
    let ufd = document.getElementById('uf-d'), ufm = document.getElementById('uf-m');
    
    if (ufd) ufd.innerHTML = '<option value="">Selecione o Estado...</option>';
    if (ufm) ufm.innerHTML = '<option value="">Selecione o Estado...</option>';

    ufs.forEach(e => {
      if (ufd) ufd.innerHTML += `<option value="${e}">${e}</option>`;
      if (ufm) ufm.innerHTML += `<option value="${e}">${e}</option>`;
    });

    if (typeof filtrar === 'function') {
      filtrar();
    }
  } catch (e) {
    if (typeof showToast === 'function') {
      showToast('Erro de conexão.');
    }
  }
}

function sincronizarPlanilha() {
  let btn = document.getElementById('btn-sync');
  if (btn) btn.innerText = "Sincronizando...";

  // Garante que o carrinho/dados atuais estão salvos antes de recarregar
  if (typeof salvarCarrinhoLocal === 'function') salvarCarrinhoLocal();
  if (typeof salvarClienteLocal === 'function') salvarClienteLocal();
  if (typeof salvarConfigLocal === 'function') salvarConfigLocal();

  // Força o navegador a buscar TODOS os arquivos de novo (index.html, os js/*.js, estilo.css),
  // ignorando cache antigo. O carrinho volta sozinho pois foi salvo no localStorage acima.
  let url = new URL(window.location.href);
  url.searchParams.set('_r', Date.now());
  window.location.href = url.toString();
}
