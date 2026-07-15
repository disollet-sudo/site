/**
 * DI SOLLE - SISTEMA DE CATÁLOGO E PEDIDOS DE COMPRA
 * Código Frontend Completo (app.js)
 */

// ==========================================
// 1. CONFIGURAÇÕES E ESTADO GLOBAL
// ==========================================

// IMPORTANTE: Substitui pela URL gerada ao publicar o teu Web App no Google Apps Script
const API_URL = "https://script.google.com/macros/s/AKfycbzbCwKFzvwzgwGT0U_k49Z7aI5SQFSL7KAro9UqOBmtW4aSSCyB2ZQIPE04ztQeh4tVpA/exec"; 

let PRODUTOS = [];
let CLIENTES = [];
let ESTADOS = [];
let FRETE_REGRAS = {};
let TABELA_KNE825 = {};
let TABELA_MILLENIUM = {};
let LOGO_URL = "";

let CARRINHO = [];
let CLIENTE_SELECIONADO = null;
let TABELA_PRECO_SELECIONADA = "A"; // Padrão da Tabela
let ESTADO_SELECIONADO = "";
let PRAZO_SELECIONADO = "";
let CODIGO_REPRESENTANTE = localStorage.getItem("cod_representante") || "";
let FILTRO_PROMO = false;
let FILTRO_BUSCA = "";

// Evita submissões duplicadas
let ENVIANDO_PEDIDO = false;
let BLOQUEIA_SALVAMENTO_CNPJ = false;

// ==========================================
// 2. INICIALIZAÇÃO DA APLICAÇÃO
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
  inicializarUI();
  carregarDadosIniciais();
});

function inicializarUI() {
  // Preencher Representante se já existir no localStorage
  const inputRepre = document.getElementById("repre-cod");
  if (inputRepre && CODIGO_REPRESENTANTE) {
    inputRepre.value = CODIGO_REPRESENTANTE;
  }

  // Escuta de eventos para filtros e configurações
  document.getElementById("repre-cod")?.addEventListener("change", (e) => {
    CODIGO_REPRESENTANTE = e.target.value.trim();
    localStorage.setItem("cod_representante", CODIGO_REPRESENTANTE);
  });

  document.getElementById("filtro-busca")?.addEventListener("input", (e) => {
    FILTRO_BUSCA = e.target.value.toLowerCase().trim();
    renderizarProdutos();
  });

  document.getElementById("btn-filtro-promo")?.addEventListener("click", () => {
    FILTRO_PROMO = !FILTRO_PROMO;
    const btn = document.getElementById("btn-filtro-promo");
    if (FILTRO_PROMO) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
    renderizarProdutos();
  });

  document.getElementById("select-tabela")?.addEventListener("change", (e) => {
    TABELA_PRECO_SELECIONADA = e.target.value;
    atualizarPrecosCarrinhoEProdutos();
  });

  document.getElementById("select-estado")?.addEventListener("change", (e) => {
    ESTADO_SELECIONADO = e.target.value.toUpperCase();
    atualizarPrecosCarrinhoEProdutos();
  });

  document.getElementById("select-prazo")?.addEventListener("change", (e) => {
    PRAZO_SELECIONADO = e.target.value;
    atualizarPrecosCarrinhoEProdutos();
  });

  // Modal Novo Cliente - Autocompletar CEP
  document.getElementById("nc-cep")?.addEventListener("blur", (e) => {
    buscarCep(e.target.value);
  });
}

// Carrega os produtos, clientes, regras de frete e tabelas especiais do backend
async function carregarDadosIniciais(forcarAtualizacao = false) {
  mostrarLoading(true, "A carregar catálogo de produtos...");
  try {
    const url = forcarAtualizacao ? `${API_URL}?atualizar=true` : API_URL;
    const response = await fetch(url);
    if (!response.ok) throw new Error("Erro na comunicação com o servidor.");

    const dados = await response.json();

    PRODUTOS = dados.produtos || [];
    CLIENTES = dados.clientes || [];
    ESTADOS = dados.estados || [];
    FRETE_REGRAS = dados.freteRegras || {};
    TABELA_KNE825 = dados.tabelaKNE825 || {};
    TABELA_MILLENIUM = dados.tabelaMillenium || {};
    LOGO_URL = dados.logoUrl || "";

    // Atualizar Logo da Empresa na UI se disponível
    if (LOGO_URL) {
      const logoEl = document.getElementById("img-logo");
      if (logoEl) logoEl.src = LOGO_URL;
    }

    popularDropdownEstados();
    popularDropdownClientes();
    renderizarProdutos();
    atualizarCarrinhoUI();

    mostrarLoading(false);
  } catch (erro) {
    console.error(erro);
    mostrarLoading(false);
    alert("Erro ao carregar os dados. Verifique a sua ligação ou a URL do Web App.");
  }
}

// ==========================================
// 3. REGRAS DE NEGÓCIO: CÁLCULO DE PREÇOS
// ==========================================

/**
 * Calcula o subtotal dos produtos no carrinho usando os preços padrões/promocionais.
 * Esta estimativa serve para verificar se o pedido qualifica para a Tabela Millenium.
 */
function obterSubtotalEstimadoPadrao() {
  let subtotal = 0;
  CARRINHO.forEach((item) => {
    const precoPadrao = obterPrecoItemIndividual(item.produto, TABELA_PRECO_SELECIONADA, ESTADO_SELECIONADO, PRAZO_SELECIONADO, 0, true);
    subtotal += precoPadrao * item.qtd;
  });
  return subtotal;
}

/**
 * Retorna o preço correto de um produto com base nas tabelas especiais e regras.
 */
function obterPrecoItemIndividual(produto, tabela, estado, prazo, subtotalEstimado = 0, ignorarMillenium = false) {
  const codNorm = normalizarReferencia(produto.codigo);

  // 1. Regra Especial: TABELA KNE825
  if (tabela === "KNE825" && TABELA_KNE825) {
    if (TABELA_KNE825[codNorm] !== undefined) {
      return TABELA_KNE825[codNorm];
    }
  }

  // 2. Regra Especial: TABELA MILLENIUM
  if (tabela === "MILLENIUM" && TABELA_MILLENIUM && !ignorarMillenium) {
    let chavePrazo = "";
    if (prazo.includes("42")) chavePrazo = "42";
    else if (prazo.includes("63")) chavePrazo = "63";

    if (chavePrazo) {
      // Regra de ICMS por Estado Destino (Partindo de RS):
      // RS, SC, PR, SP, RJ, MG possuem ICMS 12% (Mínimo de R$ 3.000)
      // Demais estados possuem ICMS 7% (Mínimo de R$ 5.000)
      const estadosICMS12 = ["RS", "SC", "PR", "SP", "RJ", "MG"];
      const ehICMS12 = estadosICMS12.includes(String(estado).toUpperCase());
      const limiteMinimo = ehICMS12 ? 3000 : 5000;

      if (subtotalEstimado >= limiteMinimo) {
        if (TABELA_MILLENIUM[codNorm] && TABELA_MILLENIUM[codNorm][chavePrazo] !== undefined) {
          return TABELA_MILLENIUM[codNorm][chavePrazo];
        }
      }
    }
  }

  // 3. Promoção Ativa (Padrão)
  const tabelaPrecoPadrao = tabela === "MILLENIUM" || tabela === "KNE825" ? "A" : tabela;
  if (produto.emPromocao && produto.precosPromo && produto.precosPromo[tabelaPrecoPadrao] > 0) {
    return produto.precosPromo[tabelaPrecoPadrao];
  }

  // 4. Tabela de Preços Padrão
  if (produto.precos && produto.precos[tabelaPrecoPadrao] !== undefined) {
    return produto.precos[tabelaPrecoPadrao];
  }

  return 0;
}

// ==========================================
// 4. RENDERS DE PRODUTOS E INTERFACE
// ==========================================

function popularDropdownEstados() {
  const select = document.getElementById("select-estado");
  if (!select) return;
  select.innerHTML = `<option value="">Selecione a UF Destino</option>`;
  ESTADOS.forEach((uf) => {
    const opt = document.createElement("option");
    opt.value = uf;
    opt.textContent = uf;
    if (uf === ESTADO_SELECIONADO) opt.selected = true;
    select.appendChild(opt);
  });
}

function renderizarProdutos() {
  const grid = document.getElementById("grid-produtos");
  if (!grid) return;
  grid.innerHTML = "";

  const subtotalEstimado = obterSubtotalEstimadoPadrao();

  // Filtrar produtos com base na busca e promoção
  const produtosFiltrados = PRODUTOS.filter((p) => {
    const atendeBusca = p.codigo.toLowerCase().includes(FILTRO_BUSCA) || p.descricao.toLowerCase().includes(FILTRO_BUSCA);
    const atendePromo = FILTRO_PROMO ? p.emPromocao : true;
    return atendeBusca && atendePromo;
  });

  if (produtosFiltrados.length === 0) {
    grid.innerHTML = `<p class="aviso-vazio">Nenhum produto encontrado para os filtros ativos.</p>`;
    return;
  }

  produtosFiltrados.forEach((p) => {
    const precoUnitario = obterPrecoItemIndividual(p, TABELA_PRECO_SELECIONADA, ESTADO_SELECIONADO, PRAZO_SELECIONADO, subtotalEstimado);
    const itemNoCarrinho = CARRINHO.find((item) => item.produto.codigo === p.codigo);
    const qtdAtual = itemNoCarrinho ? itemNoCarrinho.qtd : 0;

    const divCard = document.createElement("div");
    divCard.className = `card-produto ${p.emPromocao ? "promocao" : ""}`;

    // Construção do link da imagem do Drive
    const imgUrl = p.fileId 
      ? `https://drive.google.com/thumbnail?id=${p.fileId}&sz=w300` 
      : "https://via.placeholder.com/150?text=Sem+Foto";

    divCard.innerHTML = `
      ${p.emPromocao ? '<span class="badge-promo">PROMOÇÃO</span>' : ""}
      <div class="img-wrapper">
        <img src="${imgUrl}" alt="${p.descricao}" loading="lazy" onclick="abrirImagemAmpliada('${p.fileId}')">
      </div>
      <div class="produto-detalhes">
        <span class="produto-ref">${p.codigo}</span>
        <h3 class="produto-titulo">${p.descricao}</h3>
        <p class="produto-info">Caixa master: ${p.qtdEmbalagem} un. | IPI: ${p.ipi.toFixed(1)}%</p>
        <div class="preco-wrapper">
          <span class="preco-valor">${fmtBRL(precoUnitario)}</span>
        </div>
        <div class="controles-carrinho">
          <button class="btn-controle" onclick="alterarQtd('${p.codigo}', -${p.qtdEmbalagem})">-</button>
          <input type="number" class="input-qtd" id="qtd-${p.codigo}" value="${qtdAtual}" onchange="ajustarQtdDigitada('${p.codigo}', this.value, ${p.qtdEmbalagem})">
          <button class="btn-controle" onclick="alterarQtd('${p.codigo}', ${p.qtdEmbalagem})">+</button>
        </div>
      </div>
    `;
    grid.appendChild(divCard);
  });
}

// ==========================================
// 5. GESTÃO DO CARRINHO DE COMPRAS
// ==========================================

function alterarQtd(codigo, variação) {
  const p = PRODUTOS.find((prod) => prod.codigo === codigo);
  if (!p) return;

  const itemExistente = CARRINHO.find((item) => item.produto.codigo === codigo);
  let novaQtd = (itemExistente ? itemExistente.qtd : 0) + variação;

  if (novaQtd < 0) novaQtd = 0;

  // Garante múltiplos da embalagem
  if (novaQtd > 0 && novaQtd % p.qtdEmbalagem !== 0) {
    novaQtd = Math.ceil(novaQtd / p.qtdEmbalagem) * p.qtdEmbalagem;
  }

  atualizarQtdNoCarrinhoArray(p, novaQtd);
}

function ajustarQtdDigitada(codigo, valor, qtdEmbalagem) {
  const p = PRODUTOS.find((prod) => prod.codigo === codigo);
  if (!p) return;

  let qtd = parseInt(valor) || 0;
  if (qtd < 0) qtd = 0;

  // Ajusta para o múltiplo mais próximo da caixa master
  if (qtd > 0 && qtd % qtdEmbalagem !== 0) {
    qtd = Math.ceil(qtd / qtdEmbalagem) * qtdEmbalagem;
    alert(`Quantidade ajustada para ${qtd} unidades para corresponder à caixa master de ${qtdEmbalagem} un.`);
  }

  atualizarQtdNoCarrinhoArray(p, qtd);
}

function atualizarQtdNoCarrinhoArray(produto, qtd) {
  const index = CARRINHO.findIndex((item) => item.produto.codigo === produto.codigo);

  if (qtd === 0) {
    if (index !== -1) CARRINHO.splice(index, 1);
  } else {
    if (index !== -1) {
      CARRINHO[index].qtd = qtd;
    } else {
      CARRINHO.push({ produto, qtd });
    }
  }

  atualizarCarrinhoUI();
  
  // Atualiza as quantidades exibidas nos inputs do Grid sem re-renderizar todo o HTML
  const inputEl = document.getElementById(`qtd-${produto.codigo}`);
  if (inputEl) inputEl.value = qtd;
}

function atualizarPrecosCarrinhoEProdutos() {
  atualizarCarrinhoUI();
  renderizarProdutos();
}

/**
 * Reconstrói e calcula os totais finais do carrinho com todas as regras aplicadas
 */
function calcularTotaisCarrinho() {
  let subtotalProdutos = 0;
  let totalIpi = 0;
  let totalCaixas = 0;

  const subtotalEstimado = obterSubtotalEstimadoPadrao();

  // Verifica se a tabela Millenium está ativa e se as condições de desbloqueio foram atendidas
  let milleniumDesbloqueada = false;
  let limiteRequerido = 0;
  let diferencaParaLiberar = 0;

  if (TABELA_PRECO_SELECIONADA === "MILLENIUM") {
    let chavePrazo = "";
    if (PRAZO_SELECIONADO.includes("42")) chavePrazo = "42";
    else if (PRAZO_SELECIONADO.includes("63")) chavePrazo = "63";

    const estadosICMS12 = ["RS", "SC", "PR", "SP", "RJ", "MG"];
    const ehICMS12 = estadosICMS12.includes(String(ESTADO_SELECIONADO).toUpperCase());
    limiteRequerido = ehICMS12 ? 3000 : 5000;

    if (chavePrazo && subtotalEstimado >= limiteRequerido) {
      milleniumDesbloqueada = true;
    } else {
      diferencaParaLiberar = limiteRequerido - subtotalEstimado;
    }
  }

  // Prepara os itens finais com os cálculos
  const itensFinais = CARRINHO.map((item) => {
    const p = item.produto;
    const precoFinalItem = obterPrecoItemIndividual(p, TABELA_PRECO_SELECIONADA, ESTADO_SELECIONADO, PRAZO_SELECIONADO, subtotalEstimado);

    const valorTotalItemSemIPI = precoFinalItem * item.qtd;
    const ipiDec = p.ipi / 100;
    const ipiCadaItem = precoFinalItem * ipiDec;
    const totalIpiItem = ipiCadaItem * item.qtd;

    subtotalProdutos += valorTotalItemSemIPI;
    totalIpi += totalIpiItem;
    totalCaixas += item.qtd / p.qtdEmbalagem;

    return {
      codigo: p.codigo,
      descricao: p.descricao,
      qtd: item.qtd,
      valorComDesconto: precoFinalItem, // Preço líquido unitário
      valorIpiCada: ipiCadaItem,
      ipi: p.ipi,
      valorComIpi: precoFinalItem + ipiCadaItem,
      valorTotalItem: (valorTotalItemSemIPI + totalIpiItem).toFixed(2),
      fileId: p.fileId,
    };
  });

  // Cálculo do Frete
  let valorFrete = 0;
  let freteStatusMsg = "Sem regra de frete configurada.";
  const regraFrete = FRETE_REGRAS[ESTADO_SELECIONADO];

  if (regraFrete) {
    const gratisApartir = regraFrete.gratis;
    const minimoPedidoFrete = regraFrete.pedidoMinimo;
    const freteFixo = regraFrete.intervalo; // 'intervalo' é a taxa padrão/fixa configurada

    if (gratisApartir > 0 && subtotalProdutos >= gratisApartir) {
      valorFrete = 0;
      freteStatusMsg = "Frete Grátis Atendido!";
    } else {
      valorFrete = freteFixo;
      freteStatusMsg = `Frete Pago: ${fmtBRL(valorFrete)}`;
    }

    if (minimoPedidoFrete > 0 && subtotalProdutos < minimoPedidoFrete) {
      freteStatusMsg += ` | ATENÇÃO: Pedido abaixo do mínimo de ${fmtBRL(minimoPedidoFrete)} para esta UF.`;
    }
  }

  const totalLiquidoFinal = subtotalProdutos + totalIpi + valorFrete;

  return {
    itens: itensFinais,
    totalCaixas: Math.ceil(totalCaixas),
    subtotalProdutos,
    totalIpi,
    valorFrete,
    freteStatusMsg,
    total: totalLiquidoFinal,
    milleniumMeta: {
      desbloqueada: milleniumDesbloqueada,
      limiteRequerido,
      diferencaParaLiberar,
    },
  };
}

function atualizarCarrinhoUI() {
  const container = document.getElementById("itens-carrinho");
  if (!container) return;

  container.innerHTML = "";
  const contas = calcularTotaisCarrinho();

  if (CARRINHO.length === 0) {
    container.innerHTML = `<p class="carrinho-vazio">O seu carrinho está vazio.</p>`;
    atualizarTotaisUI(contas);
    return;
  }

  contas.itens.forEach((it) => {
    const li = document.createElement("li");
    li.className = "item-carrinho-row";
    li.innerHTML = `
      <div class="carrinho-item-info">
        <span class="carrinho-item-ref">${it.codigo}</span>
        <span class="carrinho-item-desc">${it.descricao}</span>
        <span class="carrinho-item-detalhe">${it.qtd} un. x ${fmtBRL(it.valorComDesconto)} (+${it.ipi}% IPI)</span>
      </div>
      <div class="carrinho-item-preco">
        <strong>${fmtBRL(parseFloat(it.valorTotalItem))}</strong>
        <button class="btn-remover-item" onclick="alterarQtd('${it.codigo}', -${it.qtd})">Remover</button>
      </div>
    `;
    container.appendChild(li);
  });

  atualizarTotaisUI(contas);
}

function atualizarTotaisUI(contas) {
  setTxtVal("tot-subtotal", fmtBRL(contas.subtotalProdutos));
  setTxtVal("tot-ipi", fmtBRL(contas.totalIpi));
  setTxtVal("tot-frete", fmtBRL(contas.valorFrete));
  setTxtVal("tot-caixas", contas.totalCaixas);
  setTxtVal("tot-final", fmtBRL(contas.total));

  const statusFreteEl = document.getElementById("status-frete");
  if (statusFreteEl) statusFreteEl.textContent = contas.freteStatusMsg;

  // Informações de Alerta da Tabela Especial MILLENIUM
  const areaAlerta = document.getElementById("alerta-millenium");
  if (areaAlerta) {
    if (TABELA_PRECO_SELECIONADA === "MILLENIUM") {
      const meta = contas.milleniumMeta;
      if (meta.desbloqueada) {
        areaAlerta.className = "alerta-box sucesso";
        areaAlerta.innerHTML = `<strong>Tabela Millenium Ativada!</strong> Regras atendidas com sucesso para o estado ${ESTADO_SELECIONADO}.`;
      } else {
        areaAlerta.className = "alerta-box aviso";
        let msgAux = "";
        const chavePrazo = PRAZO_SELECIONADO.includes("42") || PRAZO_SELECIONADO.includes("63");
        if (!chavePrazo) {
          msgAux = "Selecione o Prazo Antecipado 42 ou 63 dias nas opções.";
        } else {
          msgAux = `Faltam apenas <strong>${fmtBRL(meta.diferencaParaLiberar)}</strong> em produtos para ativar os preços especiais (Limite Mínimo: ${fmtBRL(meta.limiteRequerido)}).`;
        }
        areaAlerta.innerHTML = `<strong>Preços Millenium Bloqueados:</strong> ${msgAux}`;
      }
      areaAlerta.style.display = "block";
    } else {
      areaAlerta.style.display = "none";
    }
  }
}

// ==========================================
// 6. GESTÃO DOS CLIENTES
// ==========================================

function popularDropdownClientes() {
  const select = document.getElementById("select-cliente");
  if (!select) return;

  select.innerHTML = `<option value="">Selecione um Cliente Cadastrado</option>`;
  CLIENTES.forEach((c, index) => {
    const opt = document.createElement("option");
    opt.value = index;
    opt.textContent = `${c.cnpj.replace(/^(\d{2})(\d{3})/, "$1.$2...")} - ${c.razao} (${c.estado})`;
    select.appendChild(opt);
  });

  select.addEventListener("change", (e) => {
    const idx = e.target.value;
    if (idx !== "") {
      CLIENTE_SELECIONADO = CLIENTES[idx];
      // Forçar o estado de destino correspondente ao cadastro do cliente
      if (CLIENTE_SELECIONADO.estado) {
        ESTADO_SELECIONADO = CLIENTE_SELECIONADO.estado.toUpperCase();
        const selEstadoEl = document.getElementById("select-estado");
        if (selEstadoEl) selEstadoEl.value = ESTADO_SELECIONADO;
      }
    } else {
      CLIENTE_SELECIONADO = null;
    }
    atualizarPrecosCarrinhoEProdutos();
  });
}

// Autocomplete dinâmico de morada usando a API ViaCEP
async function buscarCep(cepVal) {
  const cep = String(cepVal).replace(/\D/g, "");
  if (cep.length !== 8) return;

  try {
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    if (!response.ok) return;
    const c = await response.json();
    if (c.erro) return;

    setInpVal("nc-endereco", c.logradouro || "");
    setInpVal("nc-bairro", c.bairro || "");
    setInpVal("nc-municipio", c.localidade || "");
    setInpVal("nc-estado", c.uf || "");
  } catch (e) {
    console.error("Erro na busca do CEP:", e);
  }
}

async function salvarNovoCliente(e) {
  e.preventDefault();
  if (BLOQUEIA_SALVAMENTO_CNPJ) return;

  const cnpj = document.getElementById("nc-cnpj").value.trim();
  const razao = document.getElementById("nc-razao").value.trim();
  const fantasia = document.getElementById("nc-fantasia").value.trim();
  const telefone = document.getElementById("nc-telefone").value.trim();
  const endereco = document.getElementById("nc-endereco").value.trim();
  const estado = document.getElementById("nc-estado").value.trim().toUpperCase();
  const bairro = document.getElementById("nc-bairro").value.trim();
  const municipio = document.getElementById("nc-municipio").value.trim();
  const numero = document.getElementById("nc-numero").value.trim();
  const cep = document.getElementById("nc-cep").value.trim();

  if (!cnpj || !razao || !estado) {
    alert("Por favor, preencha obrigatoriamente o CNPJ, Razão Social e Estado (UF).");
    return;
  }

  BLOQUEIA_SALVAMENTO_CNPJ = true;
  const btn = document.getElementById("btn-salvar-nc");
  if (btn) btn.disabled = true;

  const novoCliente = { cnpj, razao, fantasia, telefone, endereco, estado, bairro, municipio, numero, cep };

  mostrarLoading(true, "A registar novo cliente no sistema...");
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        acao: "salvar_cliente",
        cliente: novoCliente,
      }),
    });

    const resultado = await response.json();

    if (resultado.status === "success") {
      alert(resultado.message);
      fecharModalNovoCliente();
      // Recarrega todos os dados do Spreadsheet para trazer a nova lista de clientes atualizada
      await carregarDadosIniciais(true);
    } else {
      alert(resultado.message || "Erro desconhecido ao salvar o cliente.");
      BLOQUEIA_SALVAMENTO_CNPJ = false;
      if (btn) btn.disabled = false;
    }
    mostrarLoading(false);
  } catch (err) {
    console.error(err);
    alert("Não foi possível salvar o cliente. Verifique o servidor.");
    BLOQUEIA_SALVAMENTO_CNPJ = false;
    if (btn) btn.disabled = false;
    mostrarLoading(false);
  }
}

// ==========================================
// 7. FECHAMENTO DO PEDIDO E GERAÇÃO DO PDF
// ==========================================

async function submeterPedidoFinal(tipoAcao) {
  if (CARRINHO.length === 0) {
    alert("O seu carrinho está vazio!");
    return;
  }
  if (!CODIGO_REPRESENTANTE) {
    alert("Informe o Código do Representante antes de continuar!");
    return;
  }
  if (!CLIENTE_SELECIONADO) {
    alert("Selecione um cliente para prosseguir.");
    return;
  }
  if (!ESTADO_SELECIONADO) {
    alert("Selecione o Estado Destino da entrega.");
    return;
  }
  if (!PRAZO_SELECIONADO) {
    alert("Defina a condição de Prazo de Pagamento.");
    return;
  }
  if (ENVIANDO_PEDIDO) return;

  ENVIANDO_PEDIDO = true;
  mostrarLoading(true, "A processar pedido. Aguarde...");

  const contas = calcularTotaisCarrinho();
  const obsText = document.getElementById("obs-text")?.value.trim() || "";

  // Formatação amigável das informações do cliente selecionado
  const cInfo = `Razão Social: ${CLIENTE_SELECIONADO.razao}
CNPJ: ${CLIENTE_SELECIONADO.cnpj} | Nome Fantasia: ${CLIENTE_SELECIONADO.fantasia || "-"}
Tel: ${CLIENTE_SELECIONADO.telefone || "-"}
Endereço: ${CLIENTE_SELECIONADO.endereco || "-"}, Nº ${CLIENTE_SELECIONADO.numero || "-"}
Bairro: ${CLIENTE_SELECIONADO.bairro || "-"} | Município: ${CLIENTE_SELECIONADO.municipio || "-"}
UF: ${CLIENTE_SELECIONADO.estado || "-"} | CEP: ${CLIENTE_SELECIONADO.cep || "-"}`;

  const payload = {
    codigoRepre: CODIGO_REPRESENTANTE,
    qtd: contas.totalCaixas,
    subtotalProdutos: contas.subtotalProdutos,
    totalIpi: contas.totalIpi,
    totalDescontos: 0, // Descontos manuais se aplicável no futuro
    prazo: PRAZO_SELECIONADO,
    total: contas.total,
    clienteInfo: cInfo,
    itens: JSON.stringify(contas.itens),
  };

  // Montagem do Payload para a geração e envio do PDF
  const dadosPdf = {
    codigoRepre: CODIGO_REPRESENTANTE,
    clienteInfo: cInfo,
    observacoes: obsText,
    estado: ESTADO_SELECIONADO,
    prazo: PRAZO_SELECIONADO,
    itens: contas.itens,
    contas: {
      totalIpi: contas.totalIpi,
      valorFrete: contas.valorFrete,
      liquido: contas.total,
    },
    cliente: {
      razao: CLIENTE_SELECIONADO.razao,
    },
    tipoAcao: tipoAcao, // 'enviar' (Email + Drive), 'enviar_disolle' (Apenas Drive), ou 'visualizar'
  };

  try {
    let processarRegPedidos = true;

    // Se a ação for criar PDF ou Enviar e-mail, chama a função PDF do backend
    if (tipoAcao === "enviar" || tipoAcao === "enviar_disolle" || tipoAcao === "pdf") {
      const responsePdf = await fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({
          acao: "pdf",
          dadosPdf: dadosPdf,
        }),
      });

      const resPdf = await responsePdf.json();

      if (resPdf.status !== "success") {
        throw new Error(resPdf.message || "Erro durante o processamento do arquivo PDF.");
      }

      // Se for apenas visualizar o PDF (sem envio imediato ao banco de pedidos)
      if (tipoAcao === "pdf") {
        processarRegPedidos = false;
        abrirBlobPdfBase64(resPdf.base64, resPdf.nomeArquivo);
      } else {
        alert(`Pedido Processado!\nE-mail: ${resPdf.emailStatus}`);
      }
    }

    // Grava as informações do Pedido no histórico da planilha
    if (processarRegPedidos) {
      const responseReg = await fetch(API_URL, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const resReg = await responseReg.json();
      if (resReg.status === "success") {
        alert("Pedido guardado na base de dados com sucesso!");
        limparTudoAposEnvio();
      } else {
        alert(`Erro ao registar o pedido: ${resReg.message}`);
      }
    }

    mostrarLoading(false);
    ENVIANDO_PEDIDO = false;
  } catch (e) {
    console.error(e);
    alert(`Ocorreu um erro ao processar a ação: ${e.message}`);
    mostrarLoading(false);
    ENVIANDO_PEDIDO = false;
  }
}

// ==========================================
// 8. FUNÇÕES UTILITÁRIAS E INTERFACE (AUX)
// ==========================================

function fmtBRL(v) {
  const n = parseFloat(v) || 0;
  return "R$ " + n.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function normalizarReferencia(val) {
  if (val === undefined || val === null) return "";
  let s = String(val).trim();
  if (s.endsWith(".0")) s = s.slice(0, -2);
  return s.toLowerCase();
}

function setTxtVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function setInpVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

function mostrarLoading(visivel, mensagem = "") {
  const loader = document.getElementById("loader-global");
  const loaderTxt = document.getElementById("loader-texto");
  if (!loader) return;

  if (visivel) {
    if (loaderTxt) loaderTxt.textContent = mensagem;
    loader.style.display = "flex";
  } else {
    loader.style.display = "none";
  }
}

function abrirBlobPdfBase64(base64Data, nomeArquivo) {
  const byteCharacters = atob(base64Data.split(",")[1]);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: "application/pdf" });

  const blobUrl = URL.createObjectURL(blob);
  
  // Abre o PDF numa nova aba do browser ou força o download
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function limparTudoAposEnvio() {
  CARRINHO = [];
  CLIENTE_SELECIONADO = null;
  ESTADO_SELECIONADO = "";
  PRAZO_SELECIONADO = "";
  
  const selCli = document.getElementById("select-cliente");
  if (selCli) selCli.value = "";

  const selEst = document.getElementById("select-estado");
  if (selEst) selEst.value = "";

  const selPrazo = document.getElementById("select-prazo");
  if (selPrazo) selPrazo.value = "";

  const obs = document.getElementById("obs-text");
  if (obs) obs.value = "";

  atualizarCarrinhoUI();
  renderizarProdutos();
}

// Modais - Gatilhos de Abertura/Fecho
function abrirModalNovoCliente() {
  BLOQUEIA_SALVAMENTO_CNPJ = false;
  const btn = document.getElementById("btn-salvar-nc");
  if (btn) btn.disabled = false;
  
  const modal = document.getElementById("modal-novo-cliente");
  if (modal) modal.style.display = "flex";
}

function fecharModalNovoCliente() {
  const modal = document.getElementById("modal-novo-cliente");
  if (modal) modal.style.display = "none";
  document.getElementById("form-novo-cliente")?.reset();
}

function abrirImagemAmpliada(fileId) {
  if (!fileId) return;
  const modal = document.getElementById("modal-imagem-ampliada");
  const img = document.getElementById("img-ampliada");
  if (modal && img) {
    img.src = `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`;
    modal.style.display = "flex";
  }
}

function fecharModalImagem() {
  const modal = document.getElementById("modal-imagem-ampliada");
  if (modal) modal.style.display = "none";
}
