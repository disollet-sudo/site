/* =============================================
   Di Solle — Lógica Principal do App
   Para adicionar funcionalidades, mexa aqui.
   ============================================= */

const URL_GOOGLE_SCRIPT = "https://script.google.com/macros/s/AKfycbxTuine13g9M-bKuZGHXCMYaP3M8CYfyk790dWyfr_fHGc2_SdtKQLoa9Hpej8ZzZDFhA/exec";

// --- ESTADO GLOBAL ---
let PRODUTOS = [];
let CLIENTES = [];
let SELECIONADOS = {};
let DADOS_PDF_PRONTO = null;
let FRETE_REGRAS = {};
let CODIGO_REPRE = localStorage.getItem('repre_cod') || "";
let PRODUTO_MODAL_ATIVO = null;
let BLOQUEIA_SALVAMENTO_CNPJ = false;

// Tabela de prazos e opções de desmembramento
const SUB_PRAZOS = {
  "9": ["28 DIAS","14/42 DIAS","21/35 DIAS","14/28/42 DIAS"],
  "7": ["35 DIAS","14/56 DIAS","21/49 DIAS","28/42 DIAS","14/35/56 DIAS","21/35/49 DIAS","14/28/42/56 DIAS"],
  "5": ["42 DIAS","28/56 DIAS","35/49 DIAS","14/42/70 DIAS","28/42/56 DIAS","21/35/49/63 DIAS","14/28/42/56/70 DIAS"],
  "2": ["56 DIAS","28/84 DIAS","49/63 DIAS","35/56/77 DIAS","42/56/70 DIAS","35/49/63/77 DIAS","28/42/56/70/84 DIAS","21/35/49/63/77/91 DIAS"],
  "0": ["63 DIAS","35/91 DIAS","35/63/91 DIAS","56/70 DIAS","42/63/84 DIAS","21/49/77/105 DIAS","42/56/70/84 DIAS","35/49/63/77/91 DIAS","28/42/56/70/84/98 DIAS"]
};

// =============================================
// INICIALIZAÇÃO
// =============================================
window.addEventListener('DOMContentLoaded', () => {
  if (!CODIGO_REPRE) {
    document.getElementById('modal-repre').style.display = 'flex';
    document.getElementById('modal-repre').classList.add('open');
  } else {
    document.getElementById('modal-repre').style.display = 'none';
    document.getElementById('modal-repre').classList.remove('open');
    atualizarExibicaoRepre();
  }
  carregarDados();
});

// =============================================
// REPRESENTANTE
// =============================================
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

// =============================================
// UTILITÁRIOS
// =============================================
function showToast(m) {
  const t = document.getElementById('toast');
  t.innerText = m;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

function formatDin(v) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// =============================================
// DADOS — CARREGAMENTO E SINCRONIZAÇÃO
// =============================================
async function carregarDados(force = false) {
  try {
    const r = await fetch(URL_GOOGLE_SCRIPT + (force ? '?atualizar=true' : ''));
    const d = await r.json();
    PRODUTOS = d.produtos || [];
    FRETE_REGRAS = d.freteRegras || {};
    CLIENTES = d.clientes || [];

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
  document.getElementById('grid').innerHTML = "";
  carregarDados(true).then(() => {
    document.getElementById('btn-sync').innerText = "🔄 Sincronizar Catálogo";
    showToast("Catálogo atualizado!");
  });
}

// =============================================
// CATÁLOGO — FILTROS E RENDERIZAÇÃO
// =============================================
function filtrar() {
  let b = document.getElementById('busca').value.toLowerCase();
  let promo = document.getElementById('fil-promo').value;
  let pMax = parseFloat(document.getElementById('fil-preco').value) || 0;

  // Calcula a tabela ativa da mesma forma que o modal e renderizar()
  let uf = document.getElementById('uf-d').value;
  let icmsBase = (["RS", "SC", "PR", "MG", "RJ"].includes(uf)) ? "12" : "7";
  let brutoPrevia = somarBrutoPrevia();
  let tabelaFiltro = "M26071";
  if (icmsBase === "7") { tabelaFiltro = brutoPrevia <= 5000 ? "M26071" : "M26072"; }
  else { tabelaFiltro = brutoPrevia <= 2500 ? "M26121" : "M26122"; }

  let f = PRODUTOS.filter(p => {
    let preco = p.emPromocao ? p.precosPromo[tabelaFiltro] : p.precos[tabelaFiltro];
    if (!preco) return false;
    let mat = (p.codigo || '').toLowerCase().includes(b) ||
              (p.descricao || '').toLowerCase().includes(b) ||
              (p.codigoEan || '').includes(b);
    if (promo === 'sim' && !p.emPromocao) mat = false;
    if (pMax > 0 && preco > pMax) mat = false;
    return mat;
  });
  renderizar(f);
}

function limFiltros() {
  document.getElementById('busca').value = '';
  document.getElementById('fil-promo').value = '';
  document.getElementById('fil-preco').value = '';
  filtrar();
}

function somarBrutoPrevia() {
  // Determina a tabela correta com base no estado já selecionado
  let uf = document.getElementById('uf-d') ? document.getElementById('uf-d').value : '';
  let icmsBase = (["RS", "SC", "PR", "MG", "RJ"].includes(uf)) ? "12" : "7";
  // Primeira passagem: soma com M26071 para saber o volume e definir tabela
  let brutoInicial = 0;
  Object.values(SELECIONADOS).forEach(item => {
    let p = item.produto;
    let precoUnit = p.emPromocao ? (p.precosPromo['M26071'] || 0) : (p.precos['M26071'] || 0);
    brutoInicial += (precoUnit * item.qtd);
  });
  // Determina tabela definitiva pelo volume
  let tabela;
  if (icmsBase === "7") { tabela = brutoInicial <= 5000 ? "M26071" : "M26072"; }
  else { tabela = brutoInicial <= 2500 ? "M26121" : "M26122"; }
  // Segunda passagem: soma com a tabela correta para o estado
  let bruto = 0;
  Object.values(SELECIONADOS).forEach(item => {
    let p = item.produto;
    let precoUnit = p.emPromocao ? (p.precosPromo[tabela] || 0) : (p.precos[tabela] || 0);
    bruto += (precoUnit * item.qtd);
  });
  return bruto;
}

function renderizar(arr) {
  const g = document.getElementById('grid');
  g.innerHTML = '';
  document.getElementById('cont').innerText = `${arr.length} produtos`;

  let uf = document.getElementById('uf-d').value;
  let icmsBase = (["RS", "SC", "PR", "MG", "RJ"].includes(uf)) ? "12" : "7";
  let brutoPrevia = somarBrutoPrevia();
  let tabelaCard = "M26071";

  if (icmsBase === "7") { tabelaCard = brutoPrevia <= 5000 ? "M26071" : "M26072"; }
  else { tabelaCard = brutoPrevia <= 2500 ? "M26121" : "M26122"; }

  arr.forEach(p => {
    let pFinal = p.emPromocao ? p.precosPromo[tabelaCard] : p.precos[tabelaCard];
    if (!pFinal) return;

    let keyCod = p.codigo.toLowerCase().trim();
    let qty = SELECIONADOS[keyCod] ? SELECIONADOS[keyCod].qtd : 0;

    let c = document.createElement('div');
    c.className = `card ${qty > 0 ? 'sel' : ''} ${p.emPromocao ? 'promo' : ''}`;
    c.onclick = () => abrirModal(p);

    let html = `<div class="card-img">`;
    if (qty > 0) html += `<div class="card-badge-qty">${qty}</div>`;
    if (p.emPromocao) html += `<div class="card-badge-promo">PROMO</div>`;
    if (p.fileId) html += `<img src="https://drive.google.com/thumbnail?id=${p.fileId}&sz=w300" onload="this.classList.add('loaded')">`;
    else html += `<div class="no-img-icon">📷</div>`;
    html += `</div><div class="card-body"><div class="card-cod">${p.codigo}</div><div class="card-desc">${p.descricao}</div><div class="card-bottom"><div class="card-preco">${formatDin(pFinal)}</div><div class="card-emb">cx ${p.qtdEmbalagem}</div></div></div>`;
    c.innerHTML = html;
    g.appendChild(c);
  });
}

// =============================================
// MODAL DE PRODUTO
// =============================================
function abrirModal(p) {
  PRODUTO_MODAL_ATIVO = p;
  let uf = document.getElementById('uf-d').value;
  let icmsBase = (["RS", "SC", "PR", "MG", "RJ"].includes(uf)) ? "12" : "7";
  let brutoPrevia = somarBrutoPrevia();
  let tAtiva = "M26071";

  if (icmsBase === "7") { tAtiva = brutoPrevia <= 5000 ? "M26071" : "M26072"; }
  else { tAtiva = brutoPrevia <= 2500 ? "M26121" : "M26122"; }

  document.getElementById('modal-img').src = p.fileId ? `https://drive.google.com/thumbnail?id=${p.fileId}&sz=w600` : '';
  document.getElementById('modal-img').style.display = 'none';
  document.getElementById('modal-spin').style.display = 'block';
  document.getElementById('modal-cod').innerText = p.codigo;
  document.getElementById('modal-desc').innerText = p.descricao;
  document.getElementById('modal-preco').innerText = formatDin(p.emPromocao ? p.precosPromo[tAtiva] : p.precos[tAtiva]);
  document.getElementById('modal-emb').innerText = `Múltiplo: ${p.qtdEmbalagem} | NCM: ${p.ncm} | IPI: ${p.ipi}%`;

  let key = p.codigo.toLowerCase().trim();
  let q = SELECIONADOS[key] ? SELECIONADOS[key].qtd : p.qtdEmbalagem;
  document.getElementById('modal-qty').value = q;
  document.getElementById('btn-add-modal').innerText = SELECIONADOS[key] ? "Atualizar Quantidade" : "Adicionar ao Pedido";
  document.getElementById('modal').classList.add('open');
}

function fecharModal() { document.getElementById('modal').classList.remove('open'); PRODUTO_MODAL_ATIVO = null; }
function clicouFora(e) { if (e.target === document.getElementById('modal')) fecharModal(); }

function corrigirQtyModal(input) {
  if (!PRODUTO_MODAL_ATIVO) return;
  let v = parseInt(input.value) || 0;
  let m = PRODUTO_MODAL_ATIVO.qtdEmbalagem || 1;
  if (v < m) { input.value = m; }
  else if (v % m !== 0) {
    let old = v;
    input.value = Math.ceil(v / m) * m;
    showToast(`Corrigido de ${old} para ${input.value} (múltiplo de ${m})`);
  }
}

function mudarQtyModal(d) {
  if (!PRODUTO_MODAL_ATIVO) return;
  let i = document.getElementById('modal-qty');
  let v = parseInt(i.value) || 0;
  let m = PRODUTO_MODAL_ATIVO.qtdEmbalagem;
  v += (d * m);
  if (v < m) v = m;
  i.value = v;
}

function confirmarAddModal() {
  if (!PRODUTO_MODAL_ATIVO) return;
  let i = document.getElementById('modal-qty');
  corrigirQtyModal(i);
  let v = parseInt(i.value);
  let key = PRODUTO_MODAL_ATIVO.codigo.toLowerCase().trim();
  SELECIONADOS[key] = { produto: PRODUTO_MODAL_ATIVO, qtd: v };
  fecharModal();
  calcularTudo();
  showToast("Item adicionado.");
}

// =============================================
// CARRINHO E CÁLCULOS
// =============================================
function limSel() { 
  SELECIONADOS = {}; 
  calcularTudo(); 
  // Limpa também os dados cadastrais do cliente conforme solicitado
  ['cnpj','razao','fantasia','telefone','endereco','estado','bairro','municipio','numero','cep','email','obs'].forEach(f => {
    let input = document.getElementById('cli-' + f);
    if (input) input.value = '';
  });
}

function rmItem(cod) { delete SELECIONADOS[cod]; calcularTudo(); }

function alterouUF(id) {
  let val = document.getElementById(id).value;
  document.getElementById('uf-d').value = val;
  document.getElementById('uf-m').value = val;
  calcularTudo();
}

function syncRegras(idO, idD) {
  document.getElementById(idD).value = document.getElementById(idO).value;
  calcularTudo();
}

function alterouPrazoBase(idO, idD) {
  let val = document.getElementById(idO).value;
  document.getElementById(idD).value = val;
  let wD = document.getElementById('wrapper-subprazo-d'), wM = document.getElementById('wrapper-subprazo-m');
  let sD = document.getElementById('subprazo-d'), sM = document.getElementById('subprazo-m');
  if (SUB_PRAZOS[val]) {
    wD.style.display = 'block'; wM.style.display = 'block';
    sD.innerHTML = ''; sM.innerHTML = '';
    SUB_PRAZOS[val].forEach(p => {
      sD.innerHTML += `<option value="${p}">${p}</option>`;
      sM.innerHTML += `<option value="${p}">${p}</option>`;
    });
  } else {
    wD.style.display = 'none'; wM.style.display = 'none';
    sD.innerHTML = ''; sM.innerHTML = '';
  }
  calcularTudo();
}

function calcularTudo() {
  let uf = document.getElementById('uf-d').value;
  let icmsBase = (["RS", "SC", "PR", "MG", "RJ"].includes(uf)) ? "12" : "7";
  let prazoBase = parseInt(document.getElementById('prazo-d').value) || 0;
  let pctPrazo = (100 - prazoBase) / 100;
  let prazoTexto = document.getElementById('prazo-d').options[document.getElementById('prazo-d').selectedIndex].text;
  if (SUB_PRAZOS[prazoBase]) prazoTexto = document.getElementById('subprazo-d').value || prazoTexto;

  let subtotalBrutoInicial = somarBrutoPrevia();
  let tabelaAtiva = "M26071";
  if (icmsBase === "7") { tabelaAtiva = subtotalBrutoInicial <= 5000 ? "M26071" : "M26072"; }
  else { tabelaAtiva = subtotalBrutoInicial <= 2500 ? "M26121" : "M26122"; }

  let subtotalProdutos = 0, totalIpi = 0, contItens = 0, listaItensPdf = [];
  let hd = document.getElementById('lista-d');
  hd.innerHTML = '';

  Object.keys(SELECIONADOS).forEach(c => {
    let item = SELECIONADOS[c];
    let p = item.produto, qty = item.qtd;
    let precoUnit = p.emPromocao ? (p.precosPromo[tabelaAtiva] || 0) : (p.precos[tabelaAtiva] || 0);
    let totalItemOriginal = precoUnit * qty;
    subtotalProdutos += totalItemOriginal;
    contItens += qty;

    let valorComDescontoPrazo = precoUnit * pctPrazo;
    let valorIpiCada = valorComDescontoPrazo * (p.ipi / 100);
    let valorItemComIpi = valorComDescontoPrazo + valorIpiCada;
    let valorTotalItemDescIpi = valorItemComIpi * qty;
    totalIpi += (valorIpiCada * qty);

    listaItensPdf.push({
      fileId: p.fileId, codigo: p.codigo, descricao: p.descricao, qtd: qty, ncm: p.ncm,
      valorComDesconto: valorComDescontoPrazo, valorIpiCada: valorIpiCada, ipi: p.ipi,
      valorComIpi: valorItemComIpi, 
      valorTotalItem: valorTotalItemDescIpi,
      // AJUSTADO: Força formatação com pontuação/separador de milhar pt-BR para a última coluna do PDF
      valorTotalItemFormatado: valorTotalItemDescIpi.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      // AJUSTADO: Parâmetros para indicar aumento de 50% na foto e quebra/compensação na coluna da descrição
      fotoLarguraAumento: 1.50,
      quebraTextoDescricao: true,
      colunaDescricaoLargura: "menor"
    });

    hd.innerHTML += `<div class="sel-row">
      <div class="sel-cod">${p.codigo}</div>
      <div class="sel-desc">${p.descricao}</div>
      <div class="sel-qty-wrap">${qty} cx</div>
      <div class="sel-rm" onclick="rmItem('${c}')">✕</div>
    </div>`;
  });

  if (contItens === 0) { hd.innerHTML = '<div class="vazio">Carrinho vazio</div>'; }

  document.getElementById('badge').innerText = `${contItens} itens`;
  document.getElementById('badge').style.display = contItens > 0 ? 'inline-block' : 'none';
  document.getElementById('cart-count').innerText = Object.keys(SELECIONADOS).length;
  document.getElementById('cart-count-m').innerText = Object.keys(SELECIONADOS).length;

  let valDescPrazo = 0;
  if (prazoBase > 0) { valDescPrazo = subtotalProdutos - (subtotalProdutos * pctPrazo); }
  let subtotalLiquidoParcial = (subtotalProdutos - valDescPrazo) + totalIpi;

  let freteVal = 0, configFrete = FRETE_REGRAS[uf] || null;
  if (configFrete && subtotalBrutoInicial < configFrete.pedidoMinimo) freteVal = -1;
  else if (configFrete && subtotalBrutoInicial < configFrete.gratis) freteVal = configFrete.intervalo;

  let totalLiquido = subtotalLiquidoParcial + (freteVal > 0 ? freteVal : 0);
  
  // AJUSTADO: Novo cálculo do Valor de Produto (subtotal - prazo) solicitado para o bloco final do PDF
  let valorProdutoCalculado = subtotalProdutos - valDescPrazo;

  DADOS_PDF_PRONTO = {
    tipoAcao: '',
    logoUrl: document.querySelector('#logo-area img') ? document.querySelector('#logo-area img').src : '',
    codigoRepre: CODIGO_REPRE, prazo: prazoTexto, estado: uf, itens: listaItensPdf,
    clienteInfo: '', observacoes: '',
    contas: { 
      subtotal: subtotalProdutos, 
      pctPrazo: prazoBase, 
      valPrazo: valDescPrazo, 
      valorProduto: valorProdutoCalculado, // AJUSTADO: Novo campo estruturado
      totalIpi, 
      valorFrete: freteVal > 0 ? freteVal : 0, 
      liquido: totalLiquido,
      // AJUSTADO: Versões textuais com pontuações de milhar garantidas para exibição do cabeçalho de totais
      valorProdutoFormatado: valorProdutoCalculado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      subtotalFormatado: subtotalProdutos.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      valPrazoFormatado: valDescPrazo.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      totalIpiFormatado: totalIpi.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      valorFreteFormatado: (freteVal > 0 ? freteVal : 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      liquidoFormatado: totalLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    },
    // AJUSTADO: Diretrizes gerais de layout adicionadas na raiz do objeto para processamento global de layout do PDF
    layoutAjustes: {
      colunaFotoLarguraAumento: 1.50,
      colunaDescricaoMenor: true,
      quebraTextoDescricao: true
    }
  };

  const upd = (prefix) => {
    document.getElementById(prefix + '-tabela-ativa').innerText = tabelaAtiva;
    // Subtotal exibe o valor já com desconto do prazo aplicado
    document.getElementById(prefix + '-bruto-prod').innerText = formatDin(valorProdutoCalculado);
    document.getElementById(prefix + '-prazo-pct').innerText = prazoBase;
    document.getElementById(prefix + '-prazo-val').innerText = '- ' + formatDin(valDescPrazo);
    document.getElementById(prefix + '-ipi-val').innerText = '+ ' + formatDin(totalIpi);
    let fLabel = document.getElementById(prefix + '-frete-val');
    if (!uf) fLabel.innerText = "Selecione o Estado";
    else if (freteVal === -1) { fLabel.innerText = `Falta ${formatDin(configFrete.pedidoMinimo - subtotalBrutoInicial)}`; fLabel.style.color = 'red'; }
    else { fLabel.innerText = freteVal === 0 ? "GRÁTIS" : formatDin(freteVal); fLabel.style.color = ''; }
    document.getElementById(prefix + '-total').innerText = formatDin(totalLiquido);
  };
  upd('rd'); upd('rm');
  // Rerenderiza os cards para atualizar preços conforme tabela/estado
  filtrar();

  let mb = document.getElementById('mb-info');
  mb.innerHTML = contItens === 0 ? 'Selecione produtos' : `<b>${contItens} cx</b><br>${formatDin(totalLiquido)}`;

  let lib = contItens > 0 && uf !== "" && freteVal !== -1;
  document.getElementById('btn-orc-d').disabled = !lib;
  document.getElementById('btn-orc-m').disabled = !lib;
  document.getElementById('btn-baixar-d').disabled = contItens === 0;
  document.getElementById('btn-baixar-m').disabled = contItens === 0;
}

// =============================================
// CLIENTES — BUSCA E CADASTRO
// =============================================
function verificarNovoClienteExistente(cnpj) {
  if (!cnpj) return;
  let cLimpo = cnpj.replace(/\D/g, '').trim();
  let c = CLIENTES.find(x => x.cnpj.replace(/\D/g, '') === cLimpo);
  if (c) {
    alert("⚠️ ALERTA IMPEDITIVO: Este CNPJ já existe cadastrado na planilha! Não é permitido criar duplicados.");
    ['razao','fantasia','telefone','endereco','estado','bairro','municipio','numero','cep'].forEach(f => {
      document.getElementById('nc-' + f).value = c[f] || '';
    });
    BLOQUEIA_SALVAMENTO_CNPJ = true;
    document.getElementById('btn-salvar-nc').disabled = true;
  } else {
    BLOQUEIA_SALVAMENTO_CNPJ = false;
    document.getElementById('btn-salvar-nc').disabled = false;
  }
}

function buscarClienteAoDigitar(cnpj) {
  if (!cnpj) return;
  let cLimpo = cnpj.replace(/\D/g, '').trim();
  let c = CLIENTES.find(x => x.cnpj.replace(/\D/g, '') === cLimpo);
  if (c) {
    ['razao','fantasia','telefone','endereco','estado','bairro','municipio','numero','cep'].forEach(f => {
      document.getElementById('cli-' + f).value = c[f] || '';
    });
    showToast("✅ Dados do cliente preenchidos automaticamente.");
  } else {
    if (confirm("❌ Cliente não localizado! Deseja abrir a tela de cadastro para este CNPJ agora?")) {
      fecharModalCliente();
      setTimeout(() => {
        abrirModalNovoCliente();
        document.getElementById('nc-cnpj').value = cnpj;
      }, 350);
    }
  }
}

function salvarNovoCliente() {
  let cCnpj = document.getElementById('nc-cnpj').value;
  if (BLOQUEIA_SALVAMENTO_CNPJ || CLIENTES.find(x => x.cnpj.replace(/\D/g, '') === cCnpj.replace(/\D/g, ''))) {
    alert("❌ Operação abortada! CNPJ duplicado na base de dados.");
    return;
  }

  let c = {
    cnpj: cCnpj,
    razao: document.getElementById('nc-razao').value,
    fantasia: document.getElementById('nc-fantasia').value,
    telefone: document.getElementById('nc-telefone').value,
    endereco: document.getElementById('nc-endereco').value,
    estado: document.getElementById('nc-estado').value,
    bairro: document.getElementById('nc-bairro').value,
    municipio: document.getElementById('nc-municipio').value,
    numero: document.getElementById('nc-numero').value,
    cep: document.getElementById('nc-cep').value
  };

  if (!c.cnpj || !c.razao) { alert("Preencha obrigatoriamente CNPJ e Razão Social."); return; }

  document.getElementById('loading-modal').style.display = 'flex';
  document.getElementById('loading-modal').classList.add('open');

  fetch(URL_GOOGLE_SCRIPT, { method: 'POST', body: JSON.stringify({ acao: 'salvar_cliente', cliente: c }) })
    .then(r => r.json()).then(res => {
      document.getElementById('loading-modal').classList.remove('open');
      document.getElementById('loading-modal').style.display = 'none';
      if (res.status === 'success') {
        CLIENTES.push(c);
        showToast("✅ Cliente salvo com sucesso!");
        fecharModalNovoCliente();
        if (Object.keys(SELECIONADOS).length > 0) {
          document.getElementById('modal-cliente').style.display = 'flex';
          document.getElementById('modal-cliente').classList.add('open');
          ['cnpj','razao','fantasia','telefone','endereco','estado','bairro','municipio','numero','cep'].forEach(f => {
            document.getElementById('cli-' + f).value = c[f] || '';
          });
        }
      } else { alert(res.message); }
    }).catch(() => {
      document.getElementById('loading-modal').classList.remove('open');
      document.getElementById('loading-modal').style.display = 'none';
      alert("Erro de conexão.");
    });
}

function abrirModalBuscarCliente() {
  document.getElementById('input-busca-cliente').value = '';
  document.getElementById('lista-busca-clientes').innerHTML = '<div class="vazio">Digite CNPJ, Fantasia ou Cidade para pesquisar...</div>';
  document.getElementById('modal-buscar-cliente').style.display = 'flex';
  document.getElementById('modal-buscar-cliente').classList.add('open');
}

function fecharModalBuscarCliente() {
  document.getElementById('modal-buscar-cliente').classList.remove('open');
  setTimeout(() => document.getElementById('modal-buscar-cliente').style.display = 'none', 300);
}

function fecharModalDetalhesCliente() {
  document.getElementById('modal-detalhes-cliente').classList.remove('open');
  setTimeout(() => document.getElementById('modal-detalhes-cliente').style.display = 'none', 300);
}

function executarBuscaCliente() {
  let v = document.getElementById('input-busca-cliente').value.toLowerCase().trim();
  if (!v) { alert("Digite algum parâmetro para pesquisar."); return; }

  document.getElementById('loading-modal').style.display = 'flex';
  document.getElementById('loading-modal').classList.add('open');

  setTimeout(() => {
    filtrarClientesBusca();
    document.getElementById('loading-modal').classList.remove('open');
    document.getElementById('loading-modal').style.display = 'none';
  }, 300);
}

function filtrarClientesBusca() {
  let v = document.getElementById('input-busca-cliente').value.toLowerCase().trim();
  let container = document.getElementById('lista-busca-clientes');
  container.innerHTML = '';

  let filtrados = CLIENTES.filter(c =>
    (c.cnpj || '').toLowerCase().includes(v) ||
    (c.fantasia || '').toLowerCase().includes(v) ||
    (c.razao || '').toLowerCase().includes(v) ||
    (c.municipio || '').toLowerCase().includes(v)
  );

  if (filtrados.length === 0) { container.innerHTML = '<div class="vazio">Nenhum cliente localizado na base.</div>'; return; }

  filtrados.forEach(c => {
    let d = document.createElement('div');
    d.className = 'sel-row';
    d.style.cursor = 'pointer';
    d.style.padding = '10px';
    d.onclick = () => mostrarFichaCompletaCliente(c);
    d.innerHTML = `<div style="display:flex;flex-direction:column;width:100%;">
      <span style="font-weight:bold;color:var(--verde-dk);">${c.fantasia || c.razao}</span>
      <span style="font-size:11px;color:var(--sub);">${c.cnpj} — ${c.municipio || ''}/${c.estado || ''}</span>
    </div>`;
    container.appendChild(d);
  });
}

function mostrarFichaCompletaCliente(c) {
  document.getElementById('conteudo-detalhes-cliente').innerHTML = `
    <div style="margin-bottom:6px;"><b>CNPJ:</b> ${c.cnpj || '-'}</div>
    <div style="margin-bottom:6px;"><b>RAZÃO SOCIAL:</b> ${c.razao || '-'}</div>
    <div style="margin-bottom:6px;"><b>NOME FANTASIA:</b> ${c.fantasia || '-'}</div>
    <div style="margin-bottom:6px;"><b>TELEFONE:</b> ${c.telefone || '-'}</div>
    <div style="margin-bottom:6px;"><b>ENDEREÇO:</b> ${c.endereco || '-'}</div>
    <div style="margin-bottom:6px;"><b>ESTADO:</b> ${c.estado || '-'}</div>
    <div style="margin-bottom:6px;"><b>BAIRRO:</b> ${c.bairro || '-'}</div>
    <div style="margin-bottom:6px;"><b>MUNICÍPIO:</b> ${c.municipio || '-'}</div>
    <div style="margin-bottom:6px;"><b>NÚMERO:</b> ${c.numero || '-'}</div>
    <div style="margin-bottom:6px;"><b>CEP:</b> ${c.cep || '-'}</div>
  `;

  let btnUsar = document.getElementById('btn-selecionar-cliente-busca');
  btnUsar.style.display = 'block';
  
  btnUsar.onclick = () => {
    ['cnpj','razao','fantasia','telefone','endereco','estado','bairro','municipio','numero','cep','email'].forEach(f => {
      let input = document.getElementById('cli-' + f);
      if (input) input.value = c[f] || '';
    });
    
    if(c.estado) {
      let estadoUpper = c.estado.toUpperCase().trim();
      let optD = document.querySelector(`#uf-d option[value="${estadoUpper}"]`);
      if(optD) {
        document.getElementById('uf-d').value = estadoUpper;
        document.getElementById('uf-m').value = estadoUpper;
        calcularTudo();
      }
    }

    fecharModalDetalhesCliente();
    fecharModalBuscarCliente();
    showToast("✅ Cliente vinculado! Adicione os itens e finalize.");
  };

  document.getElementById('modal-detalhes-cliente').style.display = 'flex';
  document.getElementById('modal-detalhes-cliente').classList.add('open');
}

// =============================================
// PDF E ENVIO DE PEDIDOS
// =============================================
function abrirFluxoFechamento(t) {
  fecharSheet();
  document.getElementById('modal-cliente').style.display = 'flex';
  document.getElementById('modal-cliente').classList.add('open');
}

function fecharModalCliente() {
  document.getElementById('modal-cliente').classList.remove('open');
  setTimeout(() => document.getElementById('modal-cliente').style.display = 'none', 300);
}

function clicouForaCliente(e) { if (e.target === document.getElementById('modal-cliente')) fecharModalCliente(); }

function confirmarSalvamentoPedido() {
  let cnpj = document.getElementById('cli-cnpj').value;
  let razao = document.getElementById('cli-razao').value;
  if (!cnpj || !razao) { alert("Preencha o CNPJ e a Razão Social para prosseguir."); return; }

  let obs = document.getElementById('cli-obs').value.trim();
  let strCli = `CNPJ/CPF: ${cnpj}\nRazão Social: ${razao}\nFantasia: ${document.getElementById('cli-fantasia').value}\nTelefone: ${document.getElementById('cli-telefone').value}\nEndereço: ${document.getElementById('cli-endereco').value}\nEstado: ${document.getElementById('cli-estado').value}\nBairro: ${document.getElementById('cli-bairro').value}\nMunicípio: ${document.getElementById('cli-municipio').value}\nNúmero: ${document.getElementById('cli-numero').value}\nCEP: ${document.getElementById('cli-cep').value}\nE-mail: ${document.getElementById('cli-email').value}`;

  DADOS_PDF_PRONTO.clienteInfo = strCli;
  DADOS_PDF_PRONTO.observacoes = obs;
  DADOS_PDF_PRONTO.tipoAcao = 'enviar';
  DADOS_PDF_PRONTO.cliente = {
    cnpj, razao,
    fantasia: document.getElementById('cli-fantasia').value,
    telefone: document.getElementById('cli-telefone').value,
    endereco: document.getElementById('cli-endereco').value,
    estado: document.getElementById('cli-estado').value,
    bairro: document.getElementById('cli-bairro').value,
    municipio: document.getElementById('cli-municipio').value,
    numero: document.getElementById('cli-numero').value,
    cep: document.getElementById('cli-cep').value,
    email: document.getElementById('cli-email').value,
    obs
  };

  fecharModalCliente();
  document.getElementById('loading-modal').style.display = 'flex';
  document.getElementById('loading-modal').classList.add('open');

  let payloadPlanilha = {
    acao: 'pedido',
    qtd: document.getElementById('cart-count').innerText,
    subtotalProdutos: DADOS_PDF_PRONTO.contas.subtotal,
    totalIpi: DADOS_PDF_PRONTO.contas.totalIpi,
    totalDescontos: DADOS_PDF_PRONTO.contas.valPrazo,
    prazo: DADOS_PDF_PRONTO.prazo,
    total: DADOS_PDF_PRONTO.contas.liquido,
    clienteInfo: strCli + (obs ? "\nObs: " + obs : ""),
    itens: JSON.stringify(DADOS_PDF_PRONTO.itens.map(x => `${x.codigo} (${x.qtd}cx)`))
  };

  fetch(URL_GOOGLE_SCRIPT, { method: 'POST', body: JSON.stringify(payloadPlanilha) })
    .then(() => fetch(URL_GOOGLE_SCRIPT, { method: 'POST', body: JSON.stringify({ acao: 'pdf', dadosPdf: DADOS_PDF_PRONTO }) }))
    .then(r => r.json())
    .then(res => {
      document.getElementById('loading-modal').classList.remove('open');
      document.getElementById('loading-modal').style.display = 'none';
      if (res.status === 'success') {
        let nomeFinal = res.nomeArquivo || `${CODIGO_REPRE} - Pedido.pdf`;
        let href = res.base64.startsWith('data:') ? res.base64 : 'data:application/pdf;base64,' + res.base64;
        let a = document.createElement('a'); a.href = href; a.download = nomeFinal;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        ['btn-disolle-d', 'btn-disolle-m'].forEach(id => {
          document.getElementById(id).classList.add('liberado');
          document.getElementById(id).disabled = false;
        });
        document.getElementById('modal-sucesso').style.display = 'flex';
        document.getElementById('modal-sucesso').classList.add('open');
      } else { alert("Erro ao processar PDF: " + res.message); }
    })
    .catch(() => {
      document.getElementById('loading-modal').classList.remove('open');
      document.getElementById('loading-modal').style.display = 'none';
      alert("Falha na comunicação geral da transação.");
    });
}

function acionarPdf(tipo) {
  if (!DADOS_PDF_PRONTO || DADOS_PDF_PRONTO.itens.length === 0) { alert("Carrinho vazio."); return; }
  DADOS_PDF_PRONTO.tipoAcao = tipo;
  if (tipo === 'baixar' && !DADOS_PDF_PRONTO.clienteInfo) {
    DADOS_PDF_PRONTO.clienteInfo = "Download Rápido - Sem dados cadastrais preenchidos";
  }
  document.getElementById('loading-modal').style.display = 'flex';
  document.getElementById('loading-modal').classList.add('open');
  fetch(URL_GOOGLE_SCRIPT, { method: 'POST', body: JSON.stringify({ acao: 'pdf', dadosPdf: DADOS_PDF_PRONTO }) })
    .then(r => r.json()).then(res => {
      document.getElementById('loading-modal').classList.remove('open');
      document.getElementById('loading-modal').style.display = 'none';
      if (res.status === 'success') {
        let nomeFinal = res.nomeArquivo || `${CODIGO_REPRE} - Pedido.pdf`;
        let href = res.base64.startsWith('data:') ? res.base64 : 'data:application/pdf;base64,' + res.base64;
        let a = document.createElement('a'); a.href = href; a.download = nomeFinal;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        document.getElementById('modal-sucesso').style.display = 'flex';
        document.getElementById('modal-sucesso').classList.add('open');
      } else { alert("Erro ao processar operação: " + res.message); }
    }).catch(() => {
      document.getElementById('loading-modal').classList.remove('open');
      document.getElementById('loading-modal').style.display = 'none';
      alert("Falha de rede.");
    });
}

// =============================================
// UPLOAD DE PDF MANUAL
// =============================================
function abrirModalUpload() {
  document.getElementById('modal-upload').style.display = 'flex';
  document.getElementById('modal-upload').classList.add('open');
}
function fecharModalUpload() {
  document.getElementById('modal-upload').classList.remove('open');
  setTimeout(() => document.getElementById('modal-upload').style.display = 'none', 300);
}

function enviarPdfManual() {
  let fileInput = document.getElementById('file-manual');
  if (!fileInput.files.length) { alert("Selecione um arquivo PDF primeiro."); return; }
  let file = fileInput.files[0];
  let reader = new FileReader();
  reader.onload = function (e) {
    document.getElementById('loading-modal').style.display = 'flex';
    document.getElementById('loading-modal').classList.add('open');
    fetch(URL_GOOGLE_SCRIPT, {
      method: 'POST',
      body: JSON.stringify({
        acao: 'upload_pdf_manual',
        fileName: CODIGO_REPRE + " - Pedido Manual - " + file.name,
        fileMimeType: file.type,
        fileBase64: e.target.result
      })
    }).then(r => r.json()).then(res => {
      fecharModalUpload();
      document.getElementById('loading-modal').classList.remove('open');
      document.getElementById('loading-modal').style.display = 'none';
      if (res.status === 'success') {
        document.getElementById('modal-sucesso').style.display = 'flex';
        document.getElementById('modal-sucesso').classList.add('open');
        fileInput.value = "";
      } else { alert("Erro: " + res.message); }
    }).catch(() => {
      document.getElementById('loading-modal').classList.remove('open');
      document.getElementById('loading-modal').style.display = 'none';
      alert("Erro ao enviar.");
    });
  };
  reader.readAsDataURL(file);
}

// =============================================
// NAVEGAÇÃO — MODAIS, SHEET E CARRINHO
// =============================================
function fecharModalSucesso() {
  document.getElementById('modal-sucesso').classList.remove('open');
  setTimeout(() => document.getElementById('modal-sucesso').style.display = 'none', 300);
  if (DADOS_PDF_PRONTO && DADOS_PDF_PRONTO.tipoAcao === 'enviar_disolle') { limSel(); }
  fecharSheet();
}
function clicouForaSucesso(e) { if (e.target === document.getElementById('modal-sucesso')) fecharModalSucesso(); }

function abrirSheet() { document.getElementById('b-sheet').classList.add('open'); document.getElementById('sh-ov').classList.add('open'); }
function fecharSheet() { document.getElementById('b-sheet').classList.remove('open'); document.getElementById('sh-ov').classList.remove('open'); }

function abrirCarrinho() {
  document.getElementById('modal-carrinho').style.display = 'flex';
  document.getElementById('modal-carrinho').classList.add('open');
}
function fecharCarrinho() {
  document.getElementById('modal-carrinho').classList.remove('open');
  setTimeout(() => document.getElementById('modal-carrinho').style.display = 'none', 300);
}
function clicouForaCarrinho(e) { if (e.target === document.getElementById('modal-carrinho')) fecharCarrinho(); }

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
