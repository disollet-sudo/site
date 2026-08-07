/* =============================================
   Di Solle — 09. MODAL DE PRODUTO
   Tela de detalhe do produto (foto grande, preço, quantidade) aberta
   ao clicar num card do catálogo.
   Depende de: 01-estado-global.js, 05-utils-busca.js,
               06-precos-kne825-millenium.js (getPrecoFinal),
               08-catalogo-filtros.js (somarBrutoPrevia),
               10-carrinho.js (calcularTudo)
   ============================================= */

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
  document.getElementById('modal-preco').innerText = formatDin(getPrecoFinal(p, tAtiva));
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
