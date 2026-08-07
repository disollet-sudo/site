/* =============================================
   Di Solle — 14. MODAL DE SUCESSO E "MEUS ORÇAMENTOS"
   Texto dinâmico do modal de sucesso, e o CRUD 100% local (localStorage)
   dos orçamentos salvos pelo representante.
   Depende de: 01-estado-global.js, 05-utils-busca.js,
               06-precos-kne825-millenium.js (ativarClienteKNE825),
               10-carrinho.js (calcularTudo, alterouPrazoBase),
               03-persistencia-local.js (salvarClienteLocal)
   ============================================= */

function mostrarModalSucesso(tipo) {
  let titulo = document.getElementById('modal-sucesso-titulo');
  let texto = document.getElementById('modal-sucesso-texto');
  if (tipo === 'orcamento') {
    if (titulo) titulo.innerText = 'Orçamento Salvo!';
    if (texto) texto.innerText = 'O PDF foi baixado e o orçamento ficou salvo em "Meus Orçamentos" para você continuar editando quando quiser.';
  } else if (tipo === 'manual') {
    if (titulo) titulo.innerText = 'Enviado com Sucesso!';
    if (texto) texto.innerText = 'O pedido manual em PDF foi enviado para a Di Solle.';
  } else {
    if (titulo) titulo.innerText = 'Pedido Enviado!';
    if (texto) texto.innerText = 'A solicitação foi processada com sucesso.';
  }
  document.getElementById('modal-sucesso').style.display = 'flex';
  document.getElementById('modal-sucesso').classList.add('open');
}

// =============================================
// MEUS ORÇAMENTOS — salvar, listar, carregar, excluir (100% local no navegador)
// =============================================
function carregarOrcamentosLocal() {
  try { return JSON.parse(localStorage.getItem(LS_ORCAMENTOS) || '[]'); }
  catch (e) { return []; }
}

function salvarOrcamentosListaLocal(lista) {
  try { localStorage.setItem(LS_ORCAMENTOS, JSON.stringify(lista)); } catch (e) {}
}

function atualizarBadgeOrcamentos() {
  let badge = document.getElementById('badge-orcamentos');
  if (!badge) return;
  let qtd = carregarOrcamentosLocal().length;
  badge.innerText = qtd;
  badge.style.display = qtd > 0 ? 'flex' : 'none';
}

// Salva (ou atualiza, se ORCAMENTO_ATIVO_ID já existir) o carrinho atual como orçamento
function salvarOrcamentoAtualLocal() {
  let lista = carregarOrcamentosLocal();

  let carrinhoSimples = {};
  Object.keys(SELECIONADOS).forEach(k => { carrinhoSimples[k] = SELECIONADOS[k].qtd; });

  let clienteForm = {};
  CAMPOS_CLIENTE_FORM.forEach(f => {
    let el = document.getElementById('cli-' + f);
    if (el) clienteForm[f] = el.value;
  });

  let config = {
    uf: document.getElementById('uf-d').value,
    prazo: document.getElementById('prazo-d').value,
    subprazo: document.getElementById('subprazo-d') ? document.getElementById('subprazo-d').value : ''
  };

  let existente = ORCAMENTO_ATIVO_ID ? lista.find(o => o.id === ORCAMENTO_ATIVO_ID) : null;
  let id = existente ? existente.id : ('orc_' + Date.now());

  let entry = {
    id,
    criadoEm: existente ? existente.criadoEm : new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
    nomeCliente: clienteForm.fantasia || clienteForm.razao || 'Sem cliente vinculado',
    totalItensCx: Object.values(carrinhoSimples).reduce((a, b) => a + b, 0),
    totalLiquidoFormatado: DADOS_PDF_PRONTO.contas.liquidoFormatado,
    carrinho: carrinhoSimples,
    cliente: clienteForm,
    config
  };

  lista = lista.filter(o => o.id !== id);
  lista.unshift(entry);
  salvarOrcamentosListaLocal(lista);
  ORCAMENTO_ATIVO_ID = id;
  atualizarBadgeOrcamentos();
}

function removerOrcamentoLocal(id) {
  let lista = carregarOrcamentosLocal().filter(o => o.id !== id);
  salvarOrcamentosListaLocal(lista);
  atualizarBadgeOrcamentos();
}

function abrirModalOrcamentos() {
  renderizarListaOrcamentos();
  document.getElementById('modal-orcamentos').style.display = 'flex';
  document.getElementById('modal-orcamentos').classList.add('open');
}

function fecharModalOrcamentos() {
  document.getElementById('modal-orcamentos').classList.remove('open');
  setTimeout(() => document.getElementById('modal-orcamentos').style.display = 'none', 300);
}

function clicouForaOrcamentos(e) { if (e.target === document.getElementById('modal-orcamentos')) fecharModalOrcamentos(); }

function renderizarListaOrcamentos() {
  let lista = carregarOrcamentosLocal();
  let container = document.getElementById('lista-orcamentos');
  if (!container) return;

  if (lista.length === 0) {
    container.innerHTML = '<div class="vazio">Nenhum orçamento salvo ainda. Monte um carrinho e toque em "Orçamento".</div>';
    return;
  }

  container.innerHTML = '';
  lista.forEach(o => {
    let dataFmt = new Date(o.atualizadoEm).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    let row = document.createElement('div');
    row.className = 'orc-row';
    row.onclick = () => carregarOrcamentoLocal(o.id);
    row.innerHTML = `
      <div class="orc-row-info">
        <span class="orc-row-nome">${o.nomeCliente}</span>
        <span class="orc-row-meta">${o.totalItensCx} cx · ${o.totalLiquidoFormatado} · ${dataFmt}</span>
      </div>
      <button class="orc-row-del" title="Excluir orçamento" onclick="event.stopPropagation(); excluirOrcamentoLocal('${o.id}')">🗑️</button>
    `;
    container.appendChild(row);
  });
}

function excluirOrcamentoLocal(id) {
  if (!confirm("Excluir este orçamento salvo? Essa ação não pode ser desfeita.")) return;
  removerOrcamentoLocal(id);
  if (ORCAMENTO_ATIVO_ID === id) ORCAMENTO_ATIVO_ID = null;
  renderizarListaOrcamentos();
  showToast("🗑️ Orçamento excluído.");
}

function carregarOrcamentoLocal(id) {
  let lista = carregarOrcamentosLocal();
  let o = lista.find(x => x.id === id);
  if (!o) return;

  let temCarrinhoAtual = Object.keys(SELECIONADOS).length > 0;
  if (temCarrinhoAtual && ORCAMENTO_ATIVO_ID !== id) {
    if (!confirm("Isso vai substituir o carrinho atual pelos itens deste orçamento. Deseja continuar?")) return;
  }

  // Restaura carrinho
  SELECIONADOS = {};
  Object.keys(o.carrinho).forEach(cod => {
    let prod = PRODUTOS.find(p => p.codigo.toLowerCase().trim() === cod);
    if (prod) SELECIONADOS[cod] = { produto: prod, qtd: o.carrinho[cod] };
  });

  // Restaura dados do cliente
  CAMPOS_CLIENTE_FORM.forEach(f => {
    let el = document.getElementById('cli-' + f);
    if (el) el.value = (o.cliente && o.cliente[f]) ? o.cliente[f] : '';
  });
  salvarClienteLocal();
  if (o.cliente && o.cliente.cnpj) ativarClienteKNE825(o.cliente.cnpj);

  // Restaura UF / prazo
  if (o.config) {
    if (o.config.uf) {
      document.getElementById('uf-d').value = o.config.uf;
      document.getElementById('uf-m').value = o.config.uf;
    }
    if (o.config.prazo) {
      document.getElementById('prazo-d').value = o.config.prazo;
      document.getElementById('prazo-m').value = o.config.prazo;
      alterouPrazoBase('prazo-d', 'prazo-m');
      if (o.config.subprazo) {
        setTimeout(() => {
          ['subprazo-d', 'subprazo-m'].forEach(idSel => {
            let sel = document.getElementById(idSel);
            if (sel) sel.value = o.config.subprazo;
          });
        }, 50);
      }
    }
  }

  ORCAMENTO_ATIVO_ID = id;
  calcularTudo();
  fecharModalOrcamentos();
  showToast(`🧾 Orçamento de "${o.nomeCliente}" carregado. Edite os itens e finalize quando quiser.`);
}
