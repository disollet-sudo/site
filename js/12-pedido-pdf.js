/* =============================================
   Di Solle — 12. PDF E ENVIO DE PEDIDOS
   Modal de dados do cliente (compartilhado entre "Efetuar Pedido" e
   "Orçamento"), envio para o Google Apps Script e download do PDF.
   Depende de: 01-estado-global.js, 05-utils-busca.js,
               14-orcamentos.js (salvarOrcamentoAtualLocal, removerOrcamentoLocal, mostrarModalSucesso),
               15-navegacao.js (fecharSheet)
   ============================================= */

function abrirFluxoFechamento(t) {
  fecharSheet();
  configurarModalClienteModo('pedido');
  document.getElementById('modal-cliente').style.display = 'flex';
  document.getElementById('modal-cliente').classList.add('open');
}

function abrirFluxoOrcamento(t) {
  if (!DADOS_PDF_PRONTO || !DADOS_PDF_PRONTO.itens || DADOS_PDF_PRONTO.itens.length === 0) { 
    alert("Carrinho vazio."); 
    return; 
  }
  fecharSheet();
  configurarModalClienteModo('orcamento');
  document.getElementById('modal-cliente').style.display = 'flex';
  document.getElementById('modal-cliente').classList.add('open');
}

function configurarModalClienteModo(modo) {
  MODO_MODAL_CLIENTE = modo;
  let titulo = document.getElementById('modal-cliente-titulo');
  let nota = document.getElementById('modal-cliente-nota');
  let btn = document.getElementById('btn-salvar-cli');
  if (modo === 'orcamento') {
    if (titulo) titulo.innerText = '🧾 SALVAR ORÇAMENTO';
    if (nota) { 
      nota.style.display = 'block'; 
      nota.innerText = 'Dados do cliente são opcionais aqui. Você pode salvar o orçamento sem cliente e completar depois.'; 
    }
    if (btn) btn.innerText = '💾 Salvar Orçamento e Baixar PDF';
  } else {
    if (titulo) titulo.innerText = '📋 DADOS DO CLIENTE';
    if (nota) nota.style.display = 'none';
    if (btn) btn.innerText = 'Enviar e Finalizar';
  }
}

function confirmarModalClienteRouter() {
  if (MODO_MODAL_CLIENTE === 'orcamento') confirmarComoOrcamento();
  else confirmarSalvamentoPedido();
}

function fecharModalCliente() {
  document.getElementById('modal-cliente').classList.remove('open');
  setTimeout(() => document.getElementById('modal-cliente').style.display = 'none', 300);
}

function clicouForaCliente(e) { 
  if (e.target === document.getElementById('modal-cliente')) fecharModalCliente(); 
}

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

  // Payload unificado (Salva na Planilha + Gera PDF em 1 única chamada de rede)
  let payloadUnificado = {
    acao: 'pedido_e_pdf',
    qtd: DADOS_PDF_PRONTO.contas ? DADOS_PDF_PRONTO.contas.totalCx : 0,
    subtotalProdutos: DADOS_PDF_PRONTO.contas ? DADOS_PDF_PRONTO.contas.subtotal : 0,
    totalIpi: DADOS_PDF_PRONTO.contas ? DADOS_PDF_PRONTO.contas.totalIpi : 0,
    totalDescontos: DADOS_PDF_PRONTO.contas ? DADOS_PDF_PRONTO.contas.valPrazo : 0,
    prazo: DADOS_PDF_PRONTO.prazo,
    total: DADOS_PDF_PRONTO.contas ? DADOS_PDF_PRONTO.contas.liquido : 0,
    clienteInfo: strCli + (obs ? "\nObs: " + obs : ""),
    itensResumo: JSON.stringify(DADOS_PDF_PRONTO.itens.map(x => `${x.codigo} (${x.qtd}cx)`)),
    dadosPdf: DADOS_PDF_PRONTO
  };

  fetch(URL_GOOGLE_SCRIPT, { 
    method: 'POST', 
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payloadUnificado) 
  })
    .then(r => r.json())
    .then(res => {
      document.getElementById('loading-modal').classList.remove('open');
      document.getElementById('loading-modal').style.display = 'none';
      
      if (res.status === 'success') {
        let nomeFinal = res.nomeArquivo || `${CODIGO_REPRE} - Pedido.pdf`;
        let href = res.base64.startsWith('data:') ? res.base64 : 'data:application/pdf;base64,' + res.base64;
        let a = document.createElement('a'); 
        a.href = href; 
        a.download = nomeFinal;
        document.body.appendChild(a); 
        a.click(); 
        document.body.removeChild(a);

        if (ORCAMENTO_ATIVO_ID) {
          removerOrcamentoLocal(ORCAMENTO_ATIVO_ID);
          ORCAMENTO_ATIVO_ID = null;
        }

        mostrarModalSucesso('pedido');
        if (res.driveStatus && res.driveStatus.some(d => !d.ok)) {
          let erros = res.driveStatus.filter(d => !d.ok).map(d => d.erro).join('; ');
          if (typeof showToast === 'function') showToast("⚠️ PDF baixado, mas falhou ao salvar no Drive: " + erros);
        }
      } else { 
        alert("Erro ao processar Pedido/PDF: " + res.message); 
      }
    })
    .catch(err => {
      document.getElementById('loading-modal').classList.remove('open');
      document.getElementById('loading-modal').style.display = 'none';
      alert("Falha de rede ou tempo de resposta excedido ao processar o pedido.");
    });
}

function confirmarComoOrcamento() {
  let cnpj = document.getElementById('cli-cnpj').value.trim();
  let razao = document.getElementById('cli-razao').value.trim();
  let obs = document.getElementById('cli-obs').value.trim();

  let temCliente = !!(cnpj || razao);
  let strCli = temCliente
    ? `CNPJ/CPF: ${cnpj}\nRazão Social: ${razao}\nFantasia: ${document.getElementById('cli-fantasia').value}\nTelefone: ${document.getElementById('cli-telefone').value}\nEndereço: ${document.getElementById('cli-endereco').value}\nEstado: ${document.getElementById('cli-estado').value}\nBairro: ${document.getElementById('cli-bairro').value}\nMunicípio: ${document.getElementById('cli-municipio').value}\nNúmero: ${document.getElementById('cli-numero').value}\nCEP: ${document.getElementById('cli-cep').value}\nE-mail: ${document.getElementById('cli-email').value}`
    : "Orçamento sem cliente vinculado";

  DADOS_PDF_PRONTO.clienteInfo = strCli;
  DADOS_PDF_PRONTO.observacoes = obs;
  DADOS_PDF_PRONTO.tipoAcao = 'orcamento';
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

  fetch(URL_GOOGLE_SCRIPT, { 
    method: 'POST', 
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ acao: 'pdf', dadosPdf: DADOS_PDF_PRONTO }) 
  })
    .then(r => r.json())
    .then(res => {
      document.getElementById('loading-modal').classList.remove('open');
      document.getElementById('loading-modal').style.display = 'none';
      if (res.status === 'success') {
        let nomeFinal = res.nomeArquivo || `${CODIGO_REPRE} - Orcamento.pdf`;
        let href = res.base64.startsWith('data:') ? res.base64 : 'data:application/pdf;base64,' + res.base64;
        let a = document.createElement('a'); 
        a.href = href; 
        a.download = nomeFinal;
        document.body.appendChild(a); 
        a.click(); 
        document.body.removeChild(a);

        salvarOrcamentoAtualLocal();
        mostrarModalSucesso('orcamento');
      } else { alert("Erro ao processar PDF: " + res.message); }
    })
    .catch(() => {
      document.getElementById('loading-modal').classList.remove('open');
      document.getElementById('loading-modal').style.display = 'none';
      alert("Falha na comunicação geral da transação.");
    });
}

function acionarPdf(tipo) {
  if (!DADOS_PDF_PRONTO || !DADOS_PDF_PRONTO.itens || DADOS_PDF_PRONTO.itens.length === 0) { 
    alert("Carrinho vazio."); 
    return; 
  }
  DADOS_PDF_PRONTO.tipoAcao = tipo;
  if (tipo === 'baixar' && !DADOS_PDF_PRONTO.clienteInfo) {
    DADOS_PDF_PRONTO.clienteInfo = "Download Rápido - Sem dados cadastrais preenchidos";
  }
  document.getElementById('loading-modal').style.display = 'flex';
  document.getElementById('loading-modal').classList.add('open');
  
  fetch(URL_GOOGLE_SCRIPT, { 
    method: 'POST', 
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ acao: 'pdf', dadosPdf: DADOS_PDF_PRONTO }) 
  })
    .then(r => r.json())
    .then(res => {
      document.getElementById('loading-modal').classList.remove('open');
      document.getElementById('loading-modal').style.display = 'none';
      if (res.status === 'success') {
        let nomeFinal = res.nomeArquivo || `${CODIGO_REPRE} - Pedido.pdf`;
        let href = res.base64.startsWith('data:') ? res.base64 : 'data:application/pdf;base64,' + res.base64;
        let a = document.createElement('a'); 
        a.href = href; 
        a.download = nomeFinal;
        document.body.appendChild(a); 
        a.click(); 
        document.body.removeChild(a);
        
        let modSuc = document.getElementById('modal-sucesso');
        if (modSuc) {
          modSuc.style.display = 'flex';
          modSuc.classList.add('open');
        }
      } else { alert("Erro ao processar operação: " + res.message); }
    })
    .catch(() => {
      document.getElementById('loading-modal').classList.remove('open');
      document.getElementById('loading-modal').style.display = 'none';
      alert("Falha de rede.");
    });
}
