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
  let icmsBase = (["RS", "SC", "PR","SP", "MG", "RJ"].includes(uf)) ? "12" : "7";
  let prazoBase2 = parseInt(document.getElementById('prazo-d').value) || 0;
  let pctPrazo2 = (100 - prazoBase2) / 100;
  let tabelaBase2 = icmsBase === "7" ? "M26071" : "M26121";
  let limiteTabela2 = icmsBase === "7" ? 5000 : 2500;
  let liquidoPrevia2 = calcularTotalLiquidoComTabela(tabelaBase2, pctPrazo2, uf);
  let tabelaFiltro = (liquidoPrevia2 <= limiteTabela2)
    ? tabelaBase2
    : (icmsBase === "7" ? "M26072" : "M26122");

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
  let uf = document.getElementById('uf-d') ? document.getElementById('uf-d').value : '';
  let icmsBase = (["RS", "SC", "PR", "SP", "MG", "RJ"].includes(uf)) ? "12" : "7";
  let tabelaBase = icmsBase === "7" ? "M26071" : "M26121";
  let bruto = 0;
  Object.values(SELECIONADOS).forEach(item => {
    let p = item.produto;
    let precoUnit = p.emPromocao ? (p.precosPromo[tabelaBase] || 0) : (p.precos[tabelaBase] || 0);
    bruto += (precoUnit * item.qtd);
  });
  return bruto;
}

function renderizar(arr) {
  const g = document.getElementById('grid');
  g.innerHTML = '';
  document.getElementById('cont').innerText = `${arr.length} produtos`;

  let uf = document.getElementById('uf-d').value;
  let icmsBase = (["RS", "SC", "PR","SP", "MG", "RJ"].includes(uf)) ? "12" : "7";
  let prazoBaseR = parseInt(document.getElementById('prazo-d').value) || 0;
  let pctPrazoR = (100 - prazoBaseR) / 100;
  let tabelaBaseR = icmsBase === "7" ? "M26071" : "M26121";
  let limiteTabelaR = icmsBase === "7" ? 5000 : 2500;
  let liquidoPreviaR = calcularTotalLiquidoComTabela(tabelaBaseR, pctPrazoR, uf);
  let tabelaCard = (liquidoPreviaR <= limiteTabelaR)
    ? tabelaBaseR
    : (icmsBase === "7" ? "M26072" : "M26122");

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
  let icmsBase = (["RS", "SC", "PR","SP", "MG", "RJ"].includes(uf)) ? "12" : "7";
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
  ['cnpj','razao','fantasia','telefone','endereco','estado','bairro','municipio','numero','cep','email','obs'].forEach(f => {
    let input = document.getElementById('cli-' + f);
    if (input) input.value = '';
  });
}

// =============================================
// CARRINHO — RENDERIZAÇÃO INDEPENDENTE
// =============================================
function renderizarCarrinho(tabelaAtiva) {
  if (!tabelaAtiva) {
    let uf = document.getElementById('uf-d').value;
    let icmsBase = (["RS", "SC", "PR", "SP", "MG", "RJ"].includes(uf)) ? "12" : "7";
    let prazoBase = parseInt(document.getElementById('prazo-d').value) || 0;
    let pctPrazo = (100 - prazoBase) / 100;
    let tabelaBase = icmsBase === "7" ? "M26071" : "M26121";
    let limiteTabela = icmsBase === "7" ? 5000 : 2500;
    let liquidoPrevia = calcularTotalLiquidoComTabela(tabelaBase, pctPrazo, uf);
    tabelaAtiva = (liquidoPrevia <= limiteTabela) ? tabelaBase : (icmsBase === "7" ? "M26072" : "M26122");
  }

  let hd = document.getElementById('lista-d');
  if (!hd) return;

  let prazoBase = parseInt(document.getElementById('prazo-d').value) || 0;
  let pctPrazo = (100 - prazoBase) / 100;

  let scrollTop = hd.scrollTop;
  hd.innerHTML = '';

  let chaves = Object.keys(SELECIONADOS);
  if (chaves.length === 0) {
    hd.innerHTML = '<div class="vazio" style="padding:36px 20px;font-size:13px;text-align:center;">🛒<br><br>Carrinho vazio</div>';
    let rh = document.getElementById('cart-header-resumo');
    if (rh) rh.innerText = 'Nenhum item';
    return;
  }

  let totalCx = 0;
  chaves.forEach(cod => {
    let item = SELECIONADOS[cod];
    let p = item.produto, qty = item.qtd;
    let precoUnit = p.emPromocao ? (p.precosPromo[tabelaAtiva] || 0) : (p.precos[tabelaAtiva] || 0);
    let totalItem = precoUnit * qty;
    totalCx += qty;

    let div = document.createElement('div');
    div.className = 'cart-item';

    let imgEl = document.createElement('div');
    imgEl.className = 'cart-item-img';
    if (p.fileId) {
      let img = document.createElement('img');
      img.src = `https://drive.google.com/thumbnail?id=${p.fileId}&sz=w80`;
      img.style.cssText = 'width:100%;height:100%;object-fit:contain;opacity:0;transition:opacity .3s';
      img.onload = () => { img.style.opacity = 1; };
      imgEl.appendChild(img);
    } else {
      imgEl.innerHTML = '<span style="font-size:18px;color:#ddd;">📷</span>';
    }

    let infoEl = document.createElement('div');
    infoEl.className = 'cart-item-info';
    infoEl.innerHTML = `
      <div class="cart-item-cod">${p.codigo}</div>
      <div class="cart-item-desc" title="${p.descricao}">${p.descricao}</div>
      <div class="cart-item-preco">${formatDin(precoUnit)} × ${qty} = <b style="color:var(--verde-dk)">${formatDin(totalItem)}</b></div>
    `;

    let ctrlEl = document.createElement('div');
    ctrlEl.className = 'cart-qty-ctrl';
    ctrlEl.style.cssText = 'margin-top:8px;align-self:flex-start;';

    let btnMenos = document.createElement('button');
    btnMenos.className = 'cart-qty-btn';
    btnMenos.textContent = '−';
    btnMenos.title = 'Diminuir';

    let inputQty = document.createElement('input');
    inputQty.className = 'cart-qty-input';
    inputQty.type = 'number';
    inputQty.value = qty;
    inputQty.min = p.qtdEmbalagem || 1;

    let btnMais = document.createElement('button');
    btnMais.className = 'cart-qty-btn';
    btnMais.textContent = '+';
    btnMais.title = 'Aumentar';

    let multiplo = p.qtdEmbalagem || 1;

    btnMenos.addEventListener('click', () => {
      let novaQty = (SELECIONADOS[cod] ? SELECIONADOS[cod].qtd : qty) - multiplo;
      if (novaQty < multiplo) {
        if (confirm(`Remover "${p.descricao}" do carrinho?`)) {
          delete SELECIONADOS[cod];
          calcularTudo();
        }
      } else {
        SELECIONADOS[cod].qtd = novaQty;
        calcularTudo();
      }
    });

    btnMais.addEventListener('click', () => {
      if (SELECIONADOS[cod]) SELECIONADOS[cod].qtd += multiplo;
      calcularTudo();
    });

    inputQty.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') inputQty.blur();
    });

    inputQty.addEventListener('blur', () => {
      if (!SELECIONADOS[cod]) return;
      let v = parseInt(inputQty.value) || 0;
      if (v <= 0) {
        if (confirm(`Remover "${p.descricao}" do carrinho?`)) {
          delete SELECIONADOS[cod];
          calcularTudo();
        } else {
          inputQty.value = SELECIONADOS[cod].qtd;
        }
        return;
      }
      if (v % multiplo !== 0) {
        v = Math.ceil(v / multiplo) * multiplo;
        showToast(`Corrigido para ${v} (múltiplo de ${multiplo})`);
      }
      SELECIONADOS[cod].qtd = v;
      calcularTudo();
    });

    ctrlEl.appendChild(btnMenos);
    ctrlEl.appendChild(inputQty);
    ctrlEl.appendChild(btnMais);

    let rmBtn = document.createElement('button');
    rmBtn.className = 'cart-rm-btn';
    rmBtn.title = 'Remover';
    rmBtn.textContent = '✕';
    rmBtn.addEventListener('click', () => {
      delete SELECIONADOS[cod];
      calcularTudo();
    });

    div.appendChild(imgEl);

    let rightEl = document.createElement('div');
    rightEl.style.cssText = 'flex:1;min-width:0;display:flex;flex-direction:column;gap:0;';

    let topRowEl = document.createElement('div');
    topRowEl.style.cssText = 'display:flex;justify-content:space-between;align-items:flex-start;gap:6px;';
    topRowEl.appendChild(infoEl);
    topRowEl.appendChild(rmBtn);

    rightEl.appendChild(topRowEl);
    rightEl.appendChild(ctrlEl);

    div.appendChild(rightEl);
    hd.appendChild(div);
  });

  hd.scrollTop = scrollTop;

  let rh = document.getElementById('cart-header-resumo');
  if (rh) rh.innerText = `${chaves.length} produto${chaves.length > 1 ? 's' : ''} · ${totalCx} cx`;
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

function calcularTotalLiquidoComTabela(tabela, pctPrazo, uf) {
  let subtotal = 0, totalIpi = 0;
  Object.values(SELECIONADOS).forEach(item => {
    let p = item.produto, qty = item.qtd;
    let precoUnit = p.emPromocao ? (p.precosPromo[tabela] || 0) : (p.precos[tabela] || 0);
    subtotal += precoUnit * qty;
    let valorComDesc = precoUnit * pctPrazo;
    totalIpi += valorComDesc * (p.ipi / 100) * qty;
  });
  let valDesc = subtotal - (subtotal * pctPrazo);
  let liquido = (subtotal - valDesc) + totalIpi;
  let configFrete = FRETE_REGRAS[uf] || null;
  if (configFrete && subtotal >= configFrete.pedidoMinimo && subtotal < configFrete.gratis) {
    liquido += configFrete.intervalo;
  }
  return liquido;
}

function calcularTudo() {
  let uf = document.getElementById('uf-d').value;
  let icmsBase = (["RS", "SC", "PR", "SP", "MG", "RJ"].includes(uf)) ? "12" : "7";
  let prazoBase = parseInt(document.getElementById('prazo-d').value) || 0;
  let pctPrazo = (100 - prazoBase) / 100;
  let prazoTexto = document.getElementById('prazo-d').options[document.getElementById('prazo-d').selectedIndex].text;
  if (SUB_PRAZOS[prazoBase]) prazoTexto = document.getElementById('subprazo-d').value || prazoTexto;

  let tabelaBase = icmsBase === "7" ? "M26071" : "M26121";
  let limiteTabela = icmsBase === "7" ? 5000 : 2500;
  let liquidoPrevia = calcularTotalLiquidoComTabela(tabelaBase, pctPrazo, uf);

  let usaTabelaMaior = false;
  if (liquidoPrevia > limiteTabela) { usaTabelaMaior = true; }
  let tabelaAtual = usaTabelaMaior ? (icmsBase === "7" ? "M26072" : "M26122") : tabelaBase;

  let subtotalProdutos = 0, totalIpi = 0, listaItensPdf = [];
  
  Object.values(SELECIONADOS).forEach(item => {
    let p = item.produto, qty = item.qtd;
    let precoUnit = p.emPromocao ? (p.precosPromo[tabelaAtual] || 0) : (p.precos[tabelaAtual] || 0);
    subtotalProdutos += precoUnit * qty;
    let valorComDesc = precoUnit * pctPrazo;
    let descItem = precoUnit - valorComDesc;
    let ipiVal = valorComDesc * (p.ipi / 100);
    totalIpi += (ipiVal * qty);

    listaItensPdf.push({
      fotoId: p.fileId || '',
      referencia: p.codigo,
      descricao: p.descricao,
      qtd: qty,
      precoPrazo: valorComDesc.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      valorIpiStr: ipiVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) + ` (${p.ipi}%)`,
      precoIpiStr: (valorComDesc + ipiVal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      totalLiquidoStr: ((valorComDesc + ipiVal) * qty).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    });
  });

  let valDescPrazo = subtotalProdutos - (subtotalProdutos * pctPrazo);
  let totalComImpostos = (subtotalProdutos - valDescPrazo) + totalIpi;
  let freteVal = 0, fInfo = "";

  let configFrete = FRETE_REGRAS[uf] || null;
  if (configFrete) {
    if (subtotalProdutos < configFrete.pedidoMinimo) {
      fInfo = `<span style="color:red;font-weight:bold;">Mínimo não atingido (Faltam ${formatDin(configFrete.pedidoMinimo - subtotalProdutos)})</span>`;
    } else if (subtotalProdutos >= configFrete.gratis) {
      fInfo = "CIF (Grátis)";
    } else {
      freteVal = configFrete.intervalo;
      fInfo = `FOB (Adicional ${formatDin(freteVal)}) — <span style="font-size:11px;color:var(--verde);">Faltam ${formatDin(configFrete.gratis - subtotalProdutos)} p/ CIF</span>`;
    }
  } else { fInfo = "Regra não cadastrada"; }

  let totalLiquido = totalComImpostos + (freteVal > 0 ? freteVal : 0);
  let valorProdutoCalculado = subtotalProdutos - valDescPrazo;

  DADOS_PDF_PRONTO = {
    tipoAcao: '',
    logoUrl: document.querySelector('#logo-area img') ? document.querySelector('#logo-area img').src : '',
    codigoRepre: CODIGO_REPRE,
    prazo: prazoTexto,
    estado: uf,
    itens: listaItensPdf,
    clienteInfo: '',
    observacoes: '',
    contas: {
      subtotal: subtotalProdutos,
      pctPrazo: prazoBase,
      valPrazo: valDescPrazo,
      valorProduto: valorProdutoCalculado,
      totalIpi,
      valorFrete: freteVal > 0 ? freteVal : 0,
      liquido: totalLiquido,
      valorProdutoFormatado: valorProdutoCalculado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      subtotalFormatado: subtotalProdutos.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      valPrazoFormatado: valDescPrazo.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      totalIpiFormatado: totalIpi.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      valorFreteFormatado: (freteVal > 0 ? freteVal : 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      liquidoFormatado: totalLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    },
    tabelaAtiva: tabelaAtual
  };

  ['res-sub-d'].forEach(id => document.getElementById(id).innerText = formatDin(subtotalProdutos));
  ['res-prazo-d'].forEach(id => document.getElementById(id).innerText = `- ${formatDin(valDescPrazo)}`);
  ['res-ipi-d'].forEach(id => document.getElementById(id).innerText = `+ ${formatDin(totalIpi)}`);
  ['res-frete-d'].forEach(id => document.getElementById(id).innerHTML = fInfo);
  ['res-total-d'].forEach(id => document.getElementById(id).innerText = formatDin(totalLiquido));

  let idsB = ['btn-disolle-d'];
  if (configFrete && subtotalProdutos < configFrete.pedidoMinimo && subtotalProdutos > 0) {
    idsB.forEach(id => { document.getElementById(id).disabled = true; document.getElementById(id).classList.remove('liberado'); });
  } else if (subtotalProdutos > 0) {
    idsB.forEach(id => { document.getElementById(id).disabled = false; document.getElementById(id).classList.add('liberado'); });
  } else {
    idsB.forEach(id => { document.getElementById(id).disabled = true; document.getElementById(id).classList.remove('liberado'); });
  }
  
  renderizarCarrinho(tabelaAtual);
  filtrar(); 
}

// =============================================
// NOVO CLIENTE / CADASTRO 
// =============================================
function formatarCNPJ(input) {
  let v = input.value.replace(/\D/g, '');
  if (v.length > 14) v = v.slice(0, 14);
  v = v.replace(/^(\d{2})(\d)/, '$1.$2');
  v = v.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
  v = v.replace(/\.(\d{3})(\d)/, '.$1/$2');
  v = v.replace(/(\d{4})(\d)/, '$1-$2');
  input.value = v;

  if (v.replace(/\D/g, '').length === 14) {
    let loader = document.getElementById('nc-loader');
    loader.style.display = 'inline-block';
    document.getElementById('btn-salvar-nc').disabled = true;
    BLOQUEIA_SALVAMENTO_CNPJ = true;

    fetch(`https://brasilapi.com.br/api/cnpj/v1/${v.replace(/\D/g, '')}`)
      .then(r => r.json())
      .then(d => {
        loader.style.display = 'none';
        if (d.message) {
          alert("Erro Receita: " + d.message);
          return;
        }
        document.getElementById('nc-razao').value = d.razao_social || '';
        document.getElementById('nc-fantasia').value = d.nome_fantasia || '';
        document.getElementById('nc-telefone').value = d.ddd_telefone_1 || d.ddd_telefone_2 || '';
        document.getElementById('nc-endereco').value = (d.descricao_tipo_de_logradouro ? d.descricao_tipo_de_logradouro + ' ' : '') + (d.logradouro || '');
        document.getElementById('nc-estado').value = d.uf || '';
        document.getElementById('nc-bairro').value = d.bairro || '';
        document.getElementById('nc-municipio').value = d.municipio || '';
        document.getElementById('nc-numero').value = d.numero || '';
        document.getElementById('nc-cep').value = d.cep || '';
        
        let dup = CLIENTES.find(x => x.cnpj.replace(/\D/g, '') === v.replace(/\D/g, ''));
        if (dup) {
          alert("⚠️ Este CNPJ já está cadastrado na sua carteira!");
        } else {
          BLOQUEIA_SALVAMENTO_CNPJ = false;
          document.getElementById('btn-salvar-nc').disabled = false;
        }
      })
      .catch(e => {
        loader.style.display = 'none';
        BLOQUEIA_SALVAMENTO_CNPJ = false;
        document.getElementById('btn-salvar-nc').disabled = false;
      });
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
  if (!c.cnpj || !c.razao) { alert("CNPJ e Razão Social são obrigatórios."); return; }

  let btn = document.getElementById('btn-salvar-nc');
  btn.innerText = "Salvando...";
  btn.disabled = true;

  fetch(URL_GOOGLE_SCRIPT, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ acao: 'salvar_cliente', repre: CODIGO_REPRE, cliente: c })
  })
  .then(r => r.json())
  .then(res => {
    if (res.status === 'success') {
      CLIENTES.push(c);
      fecharModalNovoCliente();
      showToast("✅ Cliente salvo com sucesso!");
      setTimeout(() => {
        abrirModalCliente();
        document.getElementById('cli-cnpj').value = c.cnpj;
        buscarClienteAoDigitar(c.cnpj);
      }, 500);
    } else { alert("Erro ao salvar cliente."); }
  })
  .catch(e => { alert("Falha na conexão."); })
  .finally(() => {
    btn.innerText = "Salvar e Continuar";
    btn.disabled = false;
  });
}

// =============================================
// LISTA DE CLIENTES (CONSULTA RÁPIDA)
// =============================================
function abrirModalListaClientes() {
  document.getElementById('modal-lista-clientes').style.display = 'flex';
  document.getElementById('modal-lista-clientes').classList.add('open');
  renderizarListaClientes(CLIENTES);
}

function fecharModalListaClientes() {
  document.getElementById('modal-lista-clientes').classList.remove('open');
  setTimeout(() => document.getElementById('modal-lista-clientes').style.display = 'none', 300);
}

function filtrarListaClientes() {
  let b = document.getElementById('busca-cliente').value.toLowerCase();
  let f = CLIENTES.filter(c => (c.fantasia || '').toLowerCase().includes(b) || (c.razao || '').toLowerCase().includes(b) || (c.cnpj || '').includes(b));
  renderizarListaClientes(f);
}

function renderizarListaClientes(lista) {
  let container = document.getElementById('container-lista-clientes');
  container.innerHTML = '';
  document.getElementById('conteudo-detalhes-cliente').innerHTML = '<div style="color:var(--sub);font-size:12px;text-align:center;margin-top:20px;">Selecione um cliente para ver os detalhes</div>';

  if (lista.length === 0) {
    container.innerHTML = '<div style="padding:15px;color:var(--sub);font-size:13px;text-align:center;">Nenhum cliente encontrado.</div>';
    return;
  }

  lista.forEach(c => {
    let d = document.createElement('div');
    d.style.borderBottom = '1px solid var(--borda)';
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
  let btnCopiar = document.createElement('button');
  btnCopiar.className = 'btn sec';
  btnCopiar.style.marginTop = '15px';
  btnCopiar.style.width = '100%';
  btnCopiar.innerText = 'Copiar CNPJ para Pedido';
  btnCopiar.onclick = () => {
    fecharModalListaClientes();
    abrirModalCliente();
    document.getElementById('cli-cnpj').value = c.cnpj;
    buscarClienteAoDigitar(c.cnpj);
  };
  document.getElementById('conteudo-detalhes-cliente').appendChild(btnCopiar);
}

// =============================================
// FINALIZAÇÃO DE PEDIDO & GERAÇÃO DE PDF
// =============================================
function abrirModalCliente() {
  document.getElementById('modal-cliente').style.display = 'flex';
  document.getElementById('modal-cliente').classList.add('open');
}

function fecharModalCliente() {
  document.getElementById('modal-cliente').classList.remove('open');
  setTimeout(() => document.getElementById('modal-cliente').style.display = 'none', 300);
}

function confirmarSalvamentoPedido() {
  let f_cnpj = document.getElementById('cli-cnpj').value.trim();
  let f_razao = document.getElementById('cli-razao').value.trim();
  if (!f_cnpj || !f_razao) { alert("Preencha CNPJ e Razão Social para gerar o pedido."); return; }

  let cInfo = `CNPJ/CPF: ${f_cnpj}\nRazão Social: ${f_razao}\nFantasia: ${document.getElementById('cli-fantasia').value}\nTelefone: ${document.getElementById('cli-telefone').value}\nEndereço: ${document.getElementById('cli-endereco').value}\nEstado: ${document.getElementById('cli-estado').value}\nBairro: ${document.getElementById('cli-bairro').value}\nMunicípio: ${document.getElementById('cli-municipio').value}\nNúmero: ${document.getElementById('cli-numero').value}\nCEP: ${document.getElementById('cli-cep').value}\nE-mail: ${document.getElementById('cli-email').value}`;

  DADOS_PDF_PRONTO.clienteInfo = cInfo;
  DADOS_PDF_PRONTO.observacoes = document.getElementById('cli-obs').value.trim();

  fecharModalCliente();
  fecharCarrinho();
  
  if (DADOS_PDF_PRONTO.tipoAcao === 'enviar_disolle') {
    document.getElementById('loading-txt').innerText = "Enviando Pedido Oficial...";
  } else {
    document.getElementById('loading-txt').innerText = "Gerando PDF...";
  }
  document.getElementById('loading-modal').style.display = 'flex';
  document.getElementById('loading-modal').classList.add('open');

  ['btn-disolle-d', 'btn-disolle-m'].forEach(id => {
    document.getElementById(id).classList.remove('liberado');
    document.getElementById(id).disabled = true;
  });

  fetch(URL_GOOGLE_SCRIPT, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ acao: 'pdf', dadosPdf: DADOS_PDF_PRONTO })
  })
  .then(res => res.json())
  .then(res => {
    document.getElementById('loading-modal').classList.remove('open');
    document.getElementById('loading-modal').style.display = 'none';

    if (res.status === 'success' && res.base64) {
      let f_razao_limpa = document.getElementById('cli-razao').value.trim() || 'SEM_RAZAO';
      let nomeFinal = CODIGO_REPRE + '_' + f_razao_limpa.replace(/[^a-zA-Z0-9]/g, '_') + '.pdf';
      let href = res.base64.startsWith('data:') ? res.base64 : 'data:application/pdf;base64,' + res.base64;

      let a = document.createElement('a');
      a.href = href;
      a.download = nomeFinal;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      ['btn-disolle-d', 'btn-disolle-m'].forEach(id => {
        document.getElementById(id).classList.add('liberado');
        document.getElementById(id).disabled = false;
      });

      document.getElementById('modal-sucesso').style.display = 'flex';
      document.getElementById('modal-sucesso').classList.add('open');
    } else {
      alert("Erro ao processar PDF: " + res.message);
    }
  })
  .catch((error) => {
    console.error("Erro na requisição Fetch: ", error);
    document.getElementById('loading-modal').classList.remove('open');
    document.getElementById('loading-modal').style.display = 'none';
    alert("Falha na comunicação geral da transação. Verifique se o navegador está bloqueando a requisição.");
  });
}

function acionarPdf(tipo) {
  if (!DADOS_PDF_PRONTO || DADOS_PDF_PRONTO.itens.length === 0) { alert("Carrinho vazio."); return; }
  DADOS_PDF_PRONTO.tipoAcao = tipo;

  if (tipo === 'baixar' && !DADOS_PDF_PRONTO.clienteInfo) {
    DADOS_PDF_PRONTO.clienteInfo = "Download Rápido - Sem dados cadastrais preenchidos";
  }

  document.getElementById('cli-cnpj').value = '';
  document.getElementById('cli-razao').value = '';
  document.getElementById('cli-fantasia').value = '';
  document.getElementById('cli-telefone').value = '';
  document.getElementById('cli-endereco').value = '';
  document.getElementById('cli-estado').value = '';
  document.getElementById('cli-bairro').value = '';
  document.getElementById('cli-municipio').value = '';
  document.getElementById('cli-numero').value = '';
  document.getElementById('cli-cep').value = '';
  document.getElementById('cli-email').value = '';
  document.getElementById('cli-obs').value = '';

  abrirModalCliente();
}

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
  document.getElementById('nc-cnpj').value = '';
  document.getElementById('nc-razao').value = '';
  document.getElementById('nc-fantasia').value = '';
  document.getElementById('nc-telefone').value = '';
  document.getElementById('nc-endereco').value = '';
  document.getElementById('nc-estado').value = '';
  document.getElementById('nc-bairro').value = '';
  document.getElementById('nc-municipio').value = '';
  document.getElementById('nc-numero').value = '';
  document.getElementById('nc-cep').value = '';
}

// =============================================
// EDIÇÃO DE PEDIDOS ANTERIORES (LEITOR DE PDF)
// =============================================

function acionarImportacaoPdf() {
  document.getElementById('input-importar-pdf').click();
}

async function processarArquivoPdf(event) {
  let file = event.target.files[0];
  if (!file) return;

  if (file.type !== 'application/pdf') {
    alert("Por favor, selecione um arquivo PDF.");
    return;
  }

  document.getElementById('loading-txt').innerText = "Lendo PDF...";
  document.getElementById('loading-modal').style.display = 'flex';
  document.getElementById('loading-modal').classList.add('open');

  try {
    await garantirLeitorPdf();
    let textoPdf = await extrairTextoPdf(file);
    let dadosImportados = parsearPedidoDiSolle(textoPdf);

    if (dadosImportados.itens.length === 0) {
      alert("Nenhum item encontrado no PDF. Verifique se é um Pedido Di Solle válido.");
    } else {
      aplicarPedidoImportado(dadosImportados);
      alert(`Pedido importado com sucesso!\nCliente: ${dadosImportados.cliente.razao}\nItens: ${dadosImportados.itens.length}`);
    }
  } catch (error) {
    console.error(error);
    alert("Erro ao importar pedido: " + error.message);
  } finally {
    document.getElementById('loading-modal').classList.remove('open');
    document.getElementById('loading-modal').style.display = 'none';
    event.target.value = ''; // Reseta o input
  }
}

// Garante que a biblioteca PDF.js esteja carregada
function garantirLeitorPdf() {
  return new Promise((resolve, reject) => {
    if (window.pdfjsLib) { resolve(); return; }
    let script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      resolve();
    };
    script.onerror = () => reject(new Error("Falha ao carregar leitor de PDF."));
    document.head.appendChild(script);
  });
}

// Extrai todo o texto do PDF página a página
async function extrairTextoPdf(file) {
  let arrayBuffer = await file.arrayBuffer();
  let pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let textoTotal = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    let page = await pdf.getPage(i);
    let content = await page.getTextContent();
    // Junta itens de texto com espaço, quebra de página entre páginas
    let linhas = content.items.map(it => it.str).join(' ');
    textoTotal += linhas + '\n';
  }
  return textoTotal;
}

// Parseia o texto extraído do PDF di solle para dados estruturados
function parsearPedidoDiSolle(texto) {
  let t = texto.replace(/\n/g, ' '); // lineariza tudo para facilitar busca por Regex
  let resultado = {
    cliente: {
      cnpj: '', razao: '', fantasia: '', telefone: '', endereco: '',
      estado: '', bairro: '', municipio: '', numero: '', cep: '', email: ''
    },
    itens: [],
    estado_destino: '',
    prazo: ''
  };

  // ---- CLIENTE ----
  let mCnpj = t.match(/CNPJ\/CPF[:\|]\s*([\d\.\-\/]+)/i);
  if (mCnpj) resultado.cliente.cnpj = mCnpj[1].trim();

  let mRazao = t.match(/Razão Social[:\|]\s*(.+?)\s+Fantasia/i);
  if (mRazao) resultado.cliente.razao = mRazao[1].trim();

  let mFantasia = t.match(/Fantasia[:\|]\s*(.*?)\s+Telefone/i);
  if (mFantasia) resultado.cliente.fantasia = mFantasia[1].trim();

  let mTel = t.match(/Telefone[:\|]\s*(.+?)\s+Endereço/i);
  if (mTel) resultado.cliente.telefone = mTel[1].trim();

  let mEnd = t.match(/Endereço[:\|]\s*(.+?)\s+Estado:/i);
  if (mEnd) resultado.cliente.endereco = mEnd[1].trim();

  let mUf = t.match(/Estado[:\|]\s*([A-Z]{2})/i);
  if (mUf) resultado.cliente.estado = mUf[1].trim();

  let mBairro = t.match(/Bairro[:\|]\s*(.+?)\s+Município/i);
  if (mBairro) resultado.cliente.bairro = mBairro[1].trim();

  let mMun = t.match(/Município[:\|]\s*(.+?)\s+Número/i);
  if (mMun) resultado.cliente.municipio = mMun[1].trim();

  let mNum = t.match(/Número[:\|]\s*(.+?)\s+CEP/i);
  if (mNum) resultado.cliente.numero = mNum[1].trim();

  let mCep = t.match(/CEP[:\|]\s*(.+?)\s+E-mail/i);
  if (mCep) resultado.cliente.cep = mCep[1].trim();

  let mEmail = t.match(/E-mail[:\|]\s*([^\s]+)/i);
  if (mEmail) resultado.cliente.email = mEmail[1].trim();

  // ---- DESTINO e PRAZO ----
  let destM = t.match(/Estado Destino[^:]*[:\|]\s*([A-Z]{2})/i);
  resultado.estado_destino = destM ? destM[1].toUpperCase() : resultado.cliente.estado;

  let prazoM = t.match(/Prazo Selecionado[:\|]?\s*([^\|]+?)(?:\s*\||$)/i);
  resultado.prazo = prazoM ? prazoM[1].trim().toUpperCase() : '';

  // ---- ITENS ----
  // Padrão de linha: CODIGO DESCRICAO QTD ...
  // Código Di Solle: 13 dígitos numéricos
  // Usamos (.*?) para aceitar letras, NÚMEROS e símbolos na descrição do produto
  let linhasItens = [...t.matchAll(/(\d{13})\s+(.*?)\s+(\d{1,5})\s+R\$/g)];

  if (linhasItens.length === 0) {
    // Fallback super tolerante: Tenta códigos de 10 a 15 dígitos
    linhasItens = [...t.matchAll(/(\d{10,15})\s+(.*?)\s+(\d{1,5})\s+R\$/g)];
  }

  linhasItens.forEach(m => {
    resultado.itens.push({
      codigo: m[1].trim(),
      qtd: parseInt(m[3])
    });
  });

  return resultado;
}

// Aplica os dados lidos do PDF no carrinho atual
function aplicarPedidoImportado(dados) {
  SELECIONADOS = {};
  let avisos = [];

  // Mapear Itens
  dados.itens.forEach(itemPdf => {
    let codBase = itemPdf.codigo.toLowerCase().trim();
    let produtoEncontrado = PRODUTOS.find(p => p.codigo.toLowerCase().trim() === codBase || (p.codigoEan && p.codigoEan.trim() === itemPdf.codigo.trim()));

    if (produtoEncontrado) {
      SELECIONADOS[codBase] = {
        produto: produtoEncontrado,
        qtd: itemPdf.qtd
      };
    } else {
      avisos.push(`Produto cód ${itemPdf.codigo} não encontrado no catálogo.`);
    }
  });

  // Mapear Estado
  if (dados.estado_destino) {
    let selectUf = document.getElementById('uf-d');
    let optionExists = [...selectUf.options].some(opt => opt.value === dados.estado_destino);
    if (optionExists) {
      document.getElementById('uf-d').value = dados.estado_destino;
      document.getElementById('uf-m').value = dados.estado_destino;
    }
  }

  // Mapear Prazo (Tentativa de Match com as descrições no HTML)
  let prazoStr = dados.prazo.replace(/ \(\-\d+%\)/g, '').trim(); // Remove " (-14%)" se houver
  let prazoEncontrado = false;
  
  if (prazoStr) {
    // Tenta encontrar em sub_prazos
    for (const [base, subs] of Object.entries(SUB_PRAZOS)) {
      if (subs.includes(prazoStr)) {
        document.getElementById('prazo-d').value = base;
        document.getElementById('prazo-m').value = base;
        alterouPrazoBase('prazo-d', 'prazo-m');
        
        document.getElementById('subprazo-d').value = prazoStr;
        document.getElementById('subprazo-m').value = prazoStr;
        prazoEncontrado = true;
        break;
      }
    }

    // Prazo simples
    if (!prazoEncontrado) {
      const MAP = {
        "28 DIAS":"9",
        "35 DIAS":"7",
        "42 DIAS":"5",
        "56 DIAS":"2",
        "63 DIAS":"0",
        "ANTECIPADO":"14"
      };
      if (MAP[prazoStr]) {
        document.getElementById('prazo-d').value = MAP[prazoStr];
        document.getElementById('prazo-m').value = MAP[prazoStr];
        alterouPrazoBase('prazo-d', 'prazo-m');
        prazoEncontrado = true;
      }
    }

    if (!prazoEncontrado) {
      avisos.push(`⚠️ Prazo "${prazoStr}" não mapeado automaticamente — selecione manualmente.`);
    }
  }

  // Preencher Cliente Invisível (para edição)
  if (dados.cliente.cnpj) {
    setTimeout(() => {
      document.getElementById('cli-cnpj').value = dados.cliente.cnpj;
      document.getElementById('cli-razao').value = dados.cliente.razao;
      document.getElementById('cli-fantasia').value = dados.cliente.fantasia;
      document.getElementById('cli-telefone').value = dados.cliente.telefone;
      document.getElementById('cli-endereco').value = dados.cliente.endereco;
      document.getElementById('cli-estado').value = dados.cliente.estado;
      document.getElementById('cli-bairro').value = dados.cliente.bairro;
      document.getElementById('cli-municipio').value = dados.cliente.municipio;
      document.getElementById('cli-numero').value = dados.cliente.numero;
      document.getElementById('cli-cep').value = dados.cliente.cep;
      document.getElementById('cli-email').value = dados.cliente.email;
    }, 500);
  }

  calcularTudo();

  if (avisos.length > 0) {
    alert("Avisos durante a importação:\n\n- " + avisos.join('\n- '));
  }
}
