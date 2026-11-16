/* =============================================
   Di Solle — 12. PDF E ENVIO DE PEDIDOS
   Modal de dados do cliente (compartilhado entre "Efetuar Pedido" e
   "Orçamento"), envio para o Google Apps Script e download do PDF.
   Depende de: 01-estado-global.js (ENVIANDO_PEDIDO), 05-utils-busca.js,
               14-orcamentos.js (salvarOrcamentoAtualLocal, removerOrcamentoLocal, mostrarModalSucesso),
               15-navegacao.js (fecharSheet)
   ============================================= */

// --------- Trava de duplo clique / duplo envio ---------
// Evita que o usuário clique várias vezes em "Efetuar Pedido" (achando que
// falhou) e acabe gerando pedidos e e-mails duplicados no servidor.
function travarBotoesEnvio(travar) {
  ['btn-orc-d', 'btn-orc-m', 'btn-baixar-d', 'btn-baixar-m'].forEach(function (id) {
    var btn = document.getElementById(id);
    if (btn) btn.disabled = travar;
  });
  var btnSalvarCli = document.getElementById('btn-salvar-cli');
  if (btnSalvarCli) btnSalvarCli.disabled = travar;
}

// --------- ID único do pedido (dedupe no servidor) ---------
// Gerado 1x por carrinho/DADOS_PDF_PRONTO e reaproveitado em qualquer
// reenvio (retry de rede, clique de novo após erro, etc.), pra que o
// Code.gs consiga reconhecer que já processou esse mesmo pedido e não
// grave/gera o PDF duas vezes.
// Orçamento e download rápido usam o mesmo id + um sufixo ("-orc", "-pdf"):
// assim um orçamento feito antes NÃO faz o servidor ignorar o pedido
// real do mesmo carrinho (antes, os dois dividiam o mesmo id).
function garantirPedidoId() {
  if (!DADOS_PDF_PRONTO.pedidoId) {
    DADOS_PDF_PRONTO.pedidoId = 'PED-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  }
  return DADOS_PDF_PRONTO.pedidoId;
}

// --------- Janela "Salvar como" do Chrome (só computador) ---------
// Funciona no Chrome e Edge do computador. No celular e em outros
// navegadores a função não existe, e o download segue como sempre.
// Precisa ser chamada DENTRO do clique do usuário (depois do envio o
// navegador já não deixa abrir), então o arquivo é escolhido antes e
// gravado quando o PDF fica pronto.
function nomeSugeridoPdf(prefixo) {
  var d = new Date();
  var dd = String(d.getDate()).padStart(2, '0');
  var mm = String(d.getMonth() + 1).padStart(2, '0');
  var elRazao = document.getElementById('cli-razao');
  var razao = ((elRazao && elRazao.value) || '').replace(/[\/\\:*?"<>|]/g, '').trim() || 'SemCliente';
  return (prefixo || '') + CODIGO_REPRE + '_' + dd + mm + d.getFullYear() + '_' + razao + '.pdf';
}

function pedirLocalSalvar(nome) {
  if (typeof window.showSaveFilePicker !== 'function') return Promise.resolve(null);
  try {
    return window.showSaveFilePicker({
      suggestedName: nome,
      types: [{ description: 'PDF', accept: { 'application/pdf': ['.pdf'] } }]
    }).catch(function () { return null; }); // fechou a janela ou não permitido: segue com o download normal
  } catch (e) {
    return Promise.resolve(null);
  }
}

function idDoDrive(url) {
  var m = /[?&]id=([^&]+)/.exec(url || '');
  return m ? m[1] : '';
}

// Pega os bytes do PDF (do que veio na resposta, ou do próprio Drive numa
// chamada separada e leve) e grava no arquivo escolhido. Devolve true/false.
function gravarNoLocalEscolhido(res, handle) {
  var id = idDoDrive(res.fileUrl);
  var obter;
  if (res.base64) {
    obter = Promise.resolve(res.base64);
  } else if (id) {
    obter = fetch(URL_GOOGLE_SCRIPT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ acao: 'baixar_pdf', fileId: id })
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (j.status !== 'success' || !j.base64) throw new Error(j.message || 'sem arquivo');
      return j.base64;
    });
  } else {
    return Promise.resolve(false);
  }

  return obter.then(function (b64) {
    var bin = atob(String(b64).split(',').pop());
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return handle.createWritable().then(function (w) {
      return w.write(new Blob([bytes], { type: 'application/pdf' })).then(function () { return w.close(); });
    });
  }).then(function () { return true; }).catch(function () { return false; });
}

function baixarArquivoResultado(res, nomeFallback, handle) {
  // Computador (Chrome/Edge): grava no local que a pessoa escolheu na janela "Salvar como".
  // Se algo falhar, cai no download normal logo abaixo.
  if (handle) {
    gravarNoLocalEscolhido(res, handle).then(function (ok) {
      if (ok) {
        if (typeof showToast === 'function') showToast('✅ PDF salvo no local escolhido.');
      } else {
        baixarArquivoResultado(res, nomeFallback);
      }
    });
    return;
  }
  // Preferência 1: link direto do Drive (mais leve, mais rápido, sem
  // depender de um base64 gigante voltando na resposta HTTP).
  if (res.fileUrl) {
    window.open(res.fileUrl, '_blank');
    return;
  }
  // Preferência 2 (fallback): base64 embutido na resposta.
  if (res.base64) {
    let nomeFinal = res.nomeArquivo || nomeFallback;
    let href = res.base64.startsWith('data:') ? res.base64 : 'data:application/pdf;base64,' + res.base64;
    let a = document.createElement('a');
    a.href = href;
    a.download = nomeFinal;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return;
  }
  // Se nenhum dos dois veio, ainda assim o pedido pode ter sido
  // registrado/salvo no Drive — avisa em vez de falhar silenciosamente.
  if (typeof showToast === 'function') {
    showToast('Pedido processado, mas não foi possível localizar o arquivo PDF para download automático.');
  } else {
    alert('Pedido processado, mas não foi possível localizar o arquivo PDF para download automático.');
  }
}

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
  if (ENVIANDO_PEDIDO) return; // já tem um envio em andamento, ignora clique repetido
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
  if (ENVIANDO_PEDIDO) return;

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

  let pedidoId = garantirPedidoId();

  ENVIANDO_PEDIDO = true;
  travarBotoesEnvio(true);

  // A janela "Salvar como" abre agora, no clique (depois do envio o Chrome não deixa mais).
  pedirLocalSalvar(nomeSugeridoPdf('')).then(function (handle) {
    fecharModalCliente();
    document.getElementById('loading-modal').style.display = 'flex';
    document.getElementById('loading-modal').classList.add('open');

    // Payload unificado (Salva na Planilha + Gera PDF em 1 única chamada de rede)
    let payloadUnificado = {
      acao: 'pedido_e_pdf',
      pedidoId: pedidoId,
      qtd: DADOS_PDF_PRONTO.contas ? DADOS_PDF_PRONTO.contas.totalCx : 0,
      subtotalProdutos: DADOS_PDF_PRONTO.contas ? DADOS_PDF_PRONTO.contas.subtotal : 0,
      totalIpi: DADOS_PDF_PRONTO.contas ? DADOS_PDF_PRONTO.contas.totalIpi : 0,
      totalDescontos: DADOS_PDF_PRONTO.contas ? DADOS_PDF_PRONTO.contas.valPrazo : 0,
      prazo: DADOS_PDF_PRONTO.prazo,
      total: DADOS_PDF_PRONTO.contas ? DADOS_PDF_PRONTO.contas.liquido : 0,
      // Código da transportadora (aba "Frete", coluna E) — vai junto pro
      // Code.gs gravar na aba "Pedidos" e também aparece no PDF, pra ser
      // usado no preenchimento do Cigam.
      transportadora: DADOS_PDF_PRONTO.transportadora || '',
      clienteInfo: strCli + (obs ? "\nObs: " + obs : ""),
      itensResumo: JSON.stringify(DADOS_PDF_PRONTO.itens.map(x => `${x.codigo} (${x.qtd}cx)`)),
      dadosPdf: DADOS_PDF_PRONTO
    };

    return fetch(URL_GOOGLE_SCRIPT, { 
      method: 'POST', 
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payloadUnificado) 
    })
      .then(r => r.json())
      .then(res => {
        document.getElementById('loading-modal').classList.remove('open');
        document.getElementById('loading-modal').style.display = 'none';

        if (res.status === 'success') {
          baixarArquivoResultado(res, `${CODIGO_REPRE} - Pedido.pdf`, handle);

          if (ORCAMENTO_ATIVO_ID) {
            removerOrcamentoLocal(ORCAMENTO_ATIVO_ID);
            ORCAMENTO_ATIVO_ID = null;
          }

          mostrarModalSucesso('pedido');
          if (res.driveStatus && res.driveStatus.some(d => !d.ok)) {
            let erros = res.driveStatus.filter(d => !d.ok).map(d => d.erro).join('; ');
            if (typeof showToast === 'function') showToast("⚠️ PDF processado, mas falhou ao salvar no Drive: " + erros);
          }
        } else { 
          alert("Erro ao processar Pedido/PDF: " + (res.message || 'erro desconhecido no servidor. Verifique os Logs de Execução do Apps Script.')); 
        }
      });
  })
    .catch(err => {
      document.getElementById('loading-modal').classList.remove('open');
      document.getElementById('loading-modal').style.display = 'none';
      alert("Falha de rede ou tempo de resposta excedido ao processar o pedido. " + (err && err.message ? err.message : ''));
    })
    .finally(() => {
      ENVIANDO_PEDIDO = false;
      travarBotoesEnvio(false);
    });
}

function confirmarComoOrcamento() {
  if (ENVIANDO_PEDIDO) return;

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

  let pedidoId = garantirPedidoId() + '-orc'; // sufixo: o orçamento não "gasta" o id do pedido real

  ENVIANDO_PEDIDO = true;
  travarBotoesEnvio(true);

  // A janela "Salvar como" abre agora, no clique (depois do envio o Chrome não deixa mais).
  pedirLocalSalvar(nomeSugeridoPdf('ORC_')).then(function (handle) {
    fecharModalCliente();
    document.getElementById('loading-modal').style.display = 'flex';
    document.getElementById('loading-modal').classList.add('open');

    return fetch(URL_GOOGLE_SCRIPT, { 
      method: 'POST', 
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ acao: 'pdf', pedidoId: pedidoId, dadosPdf: DADOS_PDF_PRONTO }) 
    })
      .then(r => r.json())
      .then(res => {
        document.getElementById('loading-modal').classList.remove('open');
        document.getElementById('loading-modal').style.display = 'none';
        if (res.status === 'success') {
          baixarArquivoResultado(res, `${CODIGO_REPRE} - Orcamento.pdf`, handle);
          salvarOrcamentoAtualLocal();
          mostrarModalSucesso('orcamento');
        } else {
          alert("Erro ao processar PDF: " + (res.message || 'erro desconhecido no servidor. Verifique os Logs de Execução do Apps Script.'));
        }
      });
  })
    .catch(err => {
      document.getElementById('loading-modal').classList.remove('open');
      document.getElementById('loading-modal').style.display = 'none';
      alert("Falha na comunicação geral da transação. " + (err && err.message ? err.message : ''));
    })
    .finally(() => {
      ENVIANDO_PEDIDO = false;
      travarBotoesEnvio(false);
    });
}

function acionarPdf(tipo) {
  if (ENVIANDO_PEDIDO) return;
  if (!DADOS_PDF_PRONTO || !DADOS_PDF_PRONTO.itens || DADOS_PDF_PRONTO.itens.length === 0) { 
    alert("Carrinho vazio."); 
    return; 
  }
  DADOS_PDF_PRONTO.tipoAcao = tipo;
  if (tipo === 'baixar' && !DADOS_PDF_PRONTO.clienteInfo) {
    DADOS_PDF_PRONTO.clienteInfo = "Download Rápido - Sem dados cadastrais preenchidos";
  }

  let pedidoId = garantirPedidoId() + '-pdf';

  ENVIANDO_PEDIDO = true;
  travarBotoesEnvio(true);
  document.getElementById('loading-modal').style.display = 'flex';
  document.getElementById('loading-modal').classList.add('open');
  
  fetch(URL_GOOGLE_SCRIPT, { 
    method: 'POST', 
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ acao: 'pdf', pedidoId: pedidoId, dadosPdf: DADOS_PDF_PRONTO }) 
  })
    .then(r => r.json())
    .then(res => {
      document.getElementById('loading-modal').classList.remove('open');
      document.getElementById('loading-modal').style.display = 'none';
      if (res.status === 'success') {
        baixarArquivoResultado(res, `${CODIGO_REPRE} - Pedido.pdf`);

        let modSuc = document.getElementById('modal-sucesso');
        if (modSuc) {
          modSuc.style.display = 'flex';
          modSuc.classList.add('open');
        }
      } else {
        alert("Erro ao processar operação: " + (res.message || 'erro desconhecido no servidor. Verifique os Logs de Execução do Apps Script.'));
      }
    })
    .catch(err => {
      document.getElementById('loading-modal').classList.remove('open');
      document.getElementById('loading-modal').style.display = 'none';
      alert("Falha de rede. " + (err && err.message ? err.message : ''));
    })
    .finally(() => {
      ENVIANDO_PEDIDO = false;
      travarBotoesEnvio(false);
    });
}
