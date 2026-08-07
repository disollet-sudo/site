/* =============================================
   Di Solle — 08. CATÁLOGO — FILTROS E RENDERIZAÇÃO
   Busca/filtros do catálogo, filtro por linha de produto e desenho
   dos cards de produto na tela.
   Depende de: 01-estado-global.js, 05-utils-busca.js,
               06-precos-kne825-millenium.js (getPrecoFinal),
               10-carrinho.js (calcularTotalLiquidoComTabela)
   ============================================= */

function filtrar() {
  clearTimeout(_filtrarTimeout);
  _filtrarTimeout = setTimeout(executarFiltro, 150);
}

function executarFiltro() {
  let b = document.getElementById('busca').value;
  let elPromo = document.getElementById('fil-promo');
  let elPreco = document.getElementById('fil-preco');
  let promo = elPromo ? elPromo.value : '';
  let pMax = elPreco ? (parseFloat(elPreco.value) || 0) : 0;

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
    let mat = buscaInteligente([p.codigo, p.descricao, p.codigoEan], b);
    if (promo === 'sim' && !p.emPromocao) mat = false;
    if (pMax > 0 && preco > pMax) mat = false;
    if (FILTRO_LINHA_ATIVO && !(p.codigo || '').trim().startsWith(FILTRO_LINHA_ATIVO)) mat = false;
    return mat;
  });
  renderizar(f);
}

function limFiltros() {
  document.getElementById('busca').value = '';
  let elPromo = document.getElementById('fil-promo');
  let elPreco = document.getElementById('fil-preco');
  if (elPromo) elPromo.value = '';
  if (elPreco) elPreco.value = '';
  limparFiltroLinha();
}

// =============================================
// FILTRO POR LINHA DE PRODUTO
// =============================================
function montarGridFiltroLinha() {
  let grid = document.getElementById('filtro-linha-grid');
  if (!grid) return;
  grid.innerHTML = '';
  LINHAS_PRODUTO.forEach(l => {
    let btn = document.createElement('button');
    btn.className = 'chip-linha';
    btn.dataset.prefixo = l.prefixo;
    btn.innerText = l.nome;
    if (FILTRO_LINHA_ATIVO === l.prefixo) btn.classList.add('ativo');
    btn.onclick = () => aplicarFiltroLinha(l.prefixo, l.nome);
    grid.appendChild(btn);
  });
}

function toggleFiltroLinhaPopup() {
  let popup = document.getElementById('filtro-linha-popup');
  if (!popup) return;
  let vaiAbrir = !popup.classList.contains('open');
  if (vaiAbrir) { montarGridFiltroLinha(); popup.classList.add('open'); }
  else { popup.classList.remove('open'); }
}

function aplicarFiltroLinha(prefixo, nome) {
  FILTRO_LINHA_ATIVO = prefixo;
  let label = document.getElementById('filtro-linha-label');
  if (label) label.innerText = nome;
  let btn = document.getElementById('btn-filtro-linha');
  if (btn) btn.classList.add('ativo');
  document.getElementById('filtro-linha-popup').classList.remove('open');
  filtrar();
}

function limparFiltroLinha() {
  FILTRO_LINHA_ATIVO = null;
  let label = document.getElementById('filtro-linha-label');
  if (label) label.innerText = 'Filtro por Linha';
  let btn = document.getElementById('btn-filtro-linha');
  if (btn) btn.classList.remove('ativo');
  montarGridFiltroLinha();
  filtrar();
}

// Fecha o popup de filtro por linha ao clicar fora dele
document.addEventListener('click', (e) => {
  let popup = document.getElementById('filtro-linha-popup');
  let btn = document.getElementById('btn-filtro-linha');
  if (!popup || !popup.classList.contains('open')) return;
  if (popup.contains(e.target) || (btn && btn.contains(e.target))) return;
  popup.classList.remove('open');
});

// =============================================
// SOMA BRUTA DO CARRINHO (usada para decidir tabela/threshold e regras MILLENIUM)
// =============================================
function somarBrutoPrevia() {
  // Soma sempre pela tabela BASE (M26071 ou M26121) para decidir o threshold.
  // A decisão de qual tabela aplicar de fato é feita pelos callers (calcularTudo, filtrar, renderizar).
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
    let pFinal = getPrecoFinal(p, tabelaCard);
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
