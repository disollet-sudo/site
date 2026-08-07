/* =============================================
   Di Solle — 10. CARRINHO E MOTOR DE CÁLCULO
   Renderização do carrinho (lista de itens, +/-/remover), troca de
   UF/prazo e o calcularTudo() — a função central que recalcula preços,
   descontos, IPI, frete e monta o objeto DADOS_PDF_PRONTO.
   Depende de: 01-estado-global.js, 05-utils-busca.js,
               06-precos-kne825-millenium.js (getPrecoFinal, getInfoPrecoItem),
               08-catalogo-filtros.js (filtrar, somarBrutoPrevia),
               03-persistencia-local.js
   ============================================= */

function limSel() {
  SELECIONADOS = {};
  calcularTudo();
  ['cnpj','razao','fantasia','telefone','endereco','estado','bairro','municipio','numero','cep','email','obs'].forEach(f => {
    let input = document.getElementById('cli-' + f);
    if (input) input.value = '';
  });
  limparEstadoLocal();
}

// =============================================
// NOVO PEDIDO — zera tudo para começar um pedido do zero
// =============================================
function iniciarNovoPedido() {
  let temCarrinho = Object.keys(SELECIONADOS).length > 0;
  let temCliente = document.getElementById('cli-cnpj') && document.getElementById('cli-cnpj').value.trim() !== '';
  if (temCarrinho || temCliente) {
    if (!confirm("Isso vai apagar o carrinho e os dados preenchidos do pedido atual. Deseja iniciar um novo pedido?")) return;
  }

  SELECIONADOS = {};
  CLIENTE_ESPECIAL_ATIVO = false;
  ORCAMENTO_ATIVO_ID = null;

  CAMPOS_CLIENTE_FORM.forEach(f => {
    let el = document.getElementById('cli-' + f);
    if (el) el.value = '';
  });

  document.getElementById('uf-d').value = '';
  document.getElementById('uf-m').value = '';
  document.getElementById('prazo-d').selectedIndex = 0;
  document.getElementById('prazo-m').selectedIndex = 0;
  alterouPrazoBase('prazo-d', 'prazo-m');

  limparEstadoLocal();
  calcularTudo();
  fecharCarrinho();
  fecharSheet();
  showToast("🆕 Novo pedido iniciado!");
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
    let precoUnit = getPrecoFinal(p, tabelaAtiva);
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
  verificarModoEspecial();
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
  let tabelaAtiva = (liquidoPrevia <= limiteTabela)
    ? tabelaBase
    : (icmsBase === "7" ? "M26072" : "M26122");

  let subtotalBrutoInicial = somarBrutoPrevia();

  let subtotalProdutos = 0, totalIpi = 0, contItens = 0, listaItensPdf = [];
  let totalComDescontoAcumulado = 0;

  Object.keys(SELECIONADOS).forEach(c => {
    let item = SELECIONADOS[c];
    let p = item.produto, qty = item.qtd;
    let infoPreco = getInfoPrecoItem(p, tabelaAtiva);
    let precoUnit = infoPreco.preco;
    let pctPrazoItem = infoPreco.pctPrazoEfetivo;
    let totalItemOriginal = precoUnit * qty;
    subtotalProdutos += totalItemOriginal;
    contItens += qty;

    let valorComDescontoPrazo = precoUnit * pctPrazoItem;
    totalComDescontoAcumulado += valorComDescontoPrazo * qty;
    let valorIpiCada = valorComDescontoPrazo * (p.ipi / 100);
    let valorItemComIpi = valorComDescontoPrazo + valorIpiCada;
    let valorTotalItemDescIpi = valorItemComIpi * qty;
    totalIpi += (valorIpiCada * qty);

    listaItensPdf.push({
      fileId: p.fileId || '',
      codigo: p.codigo,
      descricao: p.descricao,
      qtd: qty,
      ncm: p.ncm || '',
      valorComDesconto: valorComDescontoPrazo,
      valorIpiCada: valorIpiCada,
      ipi: p.ipi || 0,
      valorComIpi: valorItemComIpi,
      valorTotalItem: valorTotalItemDescIpi,
      valorTotalItemFormatado: valorTotalItemDescIpi.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      fotoLarguraAumento: 1.50,
      quebraTextoDescricao: true,
      colunaDescricaoLargura: "menor"
    });
  });

  renderizarCarrinho(tabelaAtiva);

  document.getElementById('badge').innerText = `${contItens} itens`;
  document.getElementById('badge').style.display = contItens > 0 ? 'inline-block' : 'none';
  document.getElementById('cart-count').innerText = Object.keys(SELECIONADOS).length;
  document.getElementById('cart-count-m').innerText = Object.keys(SELECIONADOS).length;

  let valDescPrazo = subtotalProdutos - totalComDescontoAcumulado;
  let subtotalLiquidoParcial = totalComDescontoAcumulado + totalIpi;

  let freteVal = 0, configFrete = FRETE_REGRAS[uf] || null;
  if (configFrete && subtotalBrutoInicial < configFrete.pedidoMinimo) freteVal = -1;
  else if (configFrete && subtotalBrutoInicial < configFrete.gratis) freteVal = configFrete.intervalo;

  let totalLiquido = subtotalLiquidoParcial + (freteVal > 0 ? freteVal : 0);
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
      valorProduto: valorProdutoCalculado,
      totalIpi,
      valorFrete: freteVal > 0 ? freteVal : 0,
      liquido: totalLiquido,
      totalCx: contItens,
      valorProdutoFormatado: valorProdutoCalculado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      subtotalFormatado: subtotalProdutos.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      valPrazoFormatado: valDescPrazo.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      totalIpiFormatado: totalIpi.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      valorFreteFormatado: (freteVal > 0 ? freteVal : 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      liquidoFormatado: totalLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    },
    layoutAjustes: {
      colunaFotoLarguraAumento: 1.50,
      colunaDescricaoMenor: true,
      quebraTextoDescricao: true
    }
  };

  const upd = (prefix) => {
    document.getElementById(prefix + '-tabela-ativa').innerText = tabelaAtiva;
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

  let chaveRenderizacao = tabelaAtiva + '|' + prazoBase;
  if (chaveRenderizacao !== TABELA_ATIVA_ANTERIOR) {
    TABELA_ATIVA_ANTERIOR = chaveRenderizacao;
    filtrar();
  }

  let mb = document.getElementById('mb-info');
  mb.innerHTML = contItens === 0 ? 'Selecione produtos' : `<b>${contItens} cx</b><br>${formatDin(totalLiquido)}`;

  let lib = contItens > 0 && uf !== "" && freteVal !== -1;
  document.getElementById('btn-orc-d').disabled = !lib;
  document.getElementById('btn-orc-m').disabled = !lib;
  document.getElementById('btn-baixar-d').disabled = contItens === 0;
  document.getElementById('btn-baixar-m').disabled = contItens === 0;

  salvarCarrinhoLocal();
  salvarConfigLocal();
}
