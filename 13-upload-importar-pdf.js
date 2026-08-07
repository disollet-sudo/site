/* =============================================
   Di Solle — 13. UPLOAD E IMPORTAÇÃO DE PEDIDO VIA PDF
   Envio manual de um PDF já pronto para a Di Solle, e o recurso de
   "Editar Pedido": lê um PDF de pedido já gerado (via PDF.js, no
   navegador) e recria o carrinho/cliente a partir dele.
   Depende de: 01-estado-global.js, 05-utils-busca.js,
               03-persistencia-local.js,
               06-precos-kne825-millenium.js (ativarClienteKNE825),
               07-dados-sincronizacao.js (carregarDados),
               10-carrinho.js (calcularTudo, alterouPrazoBase)
   ============================================= */

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
        mostrarModalSucesso('manual');
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
// IMPORTAR PEDIDO VIA PDF (EDITAR PEDIDO)
// Usa PDF.js localmente — sem API, sem custo
// =============================================

// Carrega PDF.js sob demanda (só quando precisar)
function carregarPdfJs() {
  return new Promise((resolve, reject) => {
    if (window.pdfjsLib) { resolve(); return; }
    let script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
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
    // Reconstrói linhas usando posição Y para detectar quebras reais
    let ultimoY = null;
    let linhaAtual = '';
    content.items.forEach(it => {
      let y = it.transform ? Math.round(it.transform[5]) : null;
      if (ultimoY !== null && y !== null && Math.abs(y - ultimoY) > 2) {
        textoTotal += linhaAtual.trim() + '\n';
        linhaAtual = '';
      }
      linhaAtual += (linhaAtual ? ' ' : '') + it.str;
      if (y !== null) ultimoY = y;
    });
    if (linhaAtual.trim()) textoTotal += linhaAtual.trim() + '\n';
    textoTotal += '\n';
  }
  return textoTotal;
}

// Parseia o texto extraído do PDF di solle para dados estruturados
function parsearPedidoDiSolle(texto) {
  let resultado = {
    cliente: { cnpj:'', razao:'', fantasia:'', telefone:'', endereco:'',
               estado:'', bairro:'', municipio:'', numero:'', cep:'', email:'', obs:'' },
    prazo: '',
    estado_destino: '',
    itens: []
  };

  // Normaliza espaços múltiplos
  let t = texto.replace(/\s+/g, ' ');

  // ---- DADOS DO CLIENTE ----
  let campo = (label, proxLabels) => {
    let pattern = label + '\\s*[:\\-]?\\s*([\\s\\S]+?)(?=' + proxLabels + '|$)';
    let m = t.match(new RegExp(pattern, 'i'));
    return m ? m[1].trim().replace(/\s+/g, ' ') : '';
  };

  // CNPJ
  let cnpjM = t.match(/CNPJ[\s\/CPF]*[:\-]?\s*([\d.\-\/]+)/i);
  resultado.cliente.cnpj = cnpjM ? cnpjM[1].trim() : '';

  // Razão Social
  let razaoM = t.match(/Raz[aã]o Social[:\-]?\s*([^\n]+?)(?=Fantasia|Telefone|Endere)/i);
  resultado.cliente.razao = razaoM ? razaoM[1].trim() : '';

  // Fantasia
  let fantasiaM = t.match(/Fantasia[:\-]?\s*([^\n]+?)(?=Telefone|Endere|CNPJ|$)/i);
  resultado.cliente.fantasia = fantasiaM ? fantasiaM[1].trim() : '';

  // Telefone
  let telM = t.match(/Telefone[:\-]?\s*([\d\s\(\)\-]+?)(?=Endere|Estado|Bairro|CEP|$)/i);
  resultado.cliente.telefone = telM ? telM[1].trim() : '';

  // Endereço
  let endM = t.match(/Endere[çc]o[:\-]?\s*([^\n]+?)(?=Estado|Bairro|Munic|N[uú]mero|CEP|$)/i);
  resultado.cliente.endereco = endM ? endM[1].trim() : '';

  // Estado
  let estadoM = t.match(/Estado[:\-]?\s*([A-Z]{2})(?:\s|$)/i);
  resultado.cliente.estado = estadoM ? estadoM[1].toUpperCase() : '';

  // Bairro
  let bairroM = t.match(/Bairro[:\-]?\s*([^\n]+?)(?=Munic|N[uú]mero|CEP|Estado|$)/i);
  resultado.cliente.bairro = bairroM ? bairroM[1].trim() : '';

  // Município
  let munM = t.match(/Munic[íi]pio[:\-]?\s*([^\n]+?)(?=N[uú]mero|CEP|E-mail|Observa|Estado|$)/i);
  resultado.cliente.municipio = munM ? munM[1].trim() : '';

  // Número
  let numM = t.match(/N[uú]mero[:\-]?\s*(\d+)/i);
  resultado.cliente.numero = numM ? numM[1].trim() : '';

  // CEP
  let cepM = t.match(/CEP[:\-]?\s*([\d\-]+)/i);
  resultado.cliente.cep = cepM ? cepM[1].trim() : '';

  // Email
  let emailM = t.match(/E-?mail[:\-]?\s*([\w.\-+]+@[\w.\-]+)/i);
  resultado.cliente.email = emailM ? emailM[1].trim() : '';

  // Observações
  let obsM = t.match(/Observa[çc][oõ]es[:\-]?\s*([^\n]+?)(?=Estado Destino|Prazo|Foto|$)/i);
  resultado.cliente.obs = obsM ? obsM[1].trim() : '';

  // ---- ESTADO DESTINO e PRAZO ----
  let destM = t.match(/Estado Destino[^:]*[:\|]\s*([A-Z]{2})/i);
  resultado.estado_destino = destM ? destM[1].toUpperCase() : resultado.cliente.estado;

  let prazoM = t.match(/Prazo Selecionado[:\|]?\s*((?:ANTECIPADO|[\d\/]+ DIAS)[^\n|]*?)(?:\s*(?:\||\n|FOTO|$))/i);
  resultado.prazo = prazoM ? prazoM[1].trim().toUpperCase() : '';

  // ---- ITENS ----
  // Padrão de linha: CODIGO  DESCRICAO  QTD  ...
  // Código Di Solle: 13 dígitos numéricos
  let linhasItens = [...t.matchAll(/(\d{13})\s+([A-Z][A-Z0-9 \/\-\.]+?)\s+(\d{1,4})\s+R\$/g)];
  
  if (linhasItens.length === 0) {
    // Fallback: tenta 10+ dígitos seguidos de texto e quantidade
    linhasItens = [...t.matchAll(/(\d{10,15})\s+([A-Z][A-Z0-9 \/\-\.]{4,80}?)\s+(\d{1,4})\s+R\$/g)];
    linhasItens.forEach(m => {
      resultado.itens.push({ codigo: m[1].trim(), qtd: parseInt(m[3]) });
    });
  } else {
    linhasItens.forEach(m => {
      resultado.itens.push({ codigo: m[1].trim(), qtd: parseInt(m[3]) });
    });
  }

  // Remove duplicatas (mesmo código, soma qtds se aparecer mais de uma vez)
  let itensMapa = {};
  resultado.itens.forEach(it => {
    if (itensMapa[it.codigo]) {
      itensMapa[it.codigo].qtd += it.qtd;
    } else {
      itensMapa[it.codigo] = { ...it };
    }
  });
  resultado.itens = Object.values(itensMapa);

  return resultado;
}

async function importarPedidoPdf() {
  let fileInput = document.getElementById('file-manual');
  if (!fileInput.files.length) { alert("Selecione um arquivo PDF primeiro."); return; }
  let file = fileInput.files[0];

  fecharModalUpload();
  document.getElementById('modal-importando').style.display = 'flex';
  document.getElementById('modal-importando').classList.add('open');

  try {
    document.getElementById('import-status-txt').innerText = 'Carregando leitor de PDF...';
    await carregarPdfJs();

    document.getElementById('import-status-txt').innerText = 'Lendo o arquivo PDF...';
    let texto = await extrairTextoPdf(file);

    document.getElementById('import-status-txt').innerText = 'Identificando cliente e itens...';
    let pedido = parsearPedidoDiSolle(texto);

    if (pedido.itens.length === 0) {
      throw new Error("Nenhum item encontrado no PDF. Verifique se é um pedido Di Solle válido.");
    }

    // Aguarda produtos carregados
    if (PRODUTOS.length === 0) {
      document.getElementById('import-status-txt').innerText = 'Carregando catálogo...';
      await carregarDados();
    }

    // Preenche campos do cliente
    let cli = pedido.cliente;
    ['cnpj','razao','fantasia','telefone','endereco','estado','bairro','municipio','numero','cep','email','obs'].forEach(f => {
      let el = document.getElementById('cli-' + f);
      if (el && cli[f]) el.value = cli[f];
    });
    salvarClienteLocal();

    // Define UF destino
    let uf = (pedido.estado_destino || cli.estado || '').toUpperCase().trim();
    if (uf) {
      let optD = document.querySelector(`#uf-d option[value="${uf}"]`);
      if (optD) {
        document.getElementById('uf-d').value = uf;
        document.getElementById('uf-m').value = uf;
      }
    }

    // Configura prazo
    let prazoStr = pedido.prazo;
    let avisos = [];
    let prazoEncontrado = false;

    if (prazoStr) {
      // Procura em SUB_PRAZOS
      for (let [val, opcoes] of Object.entries(SUB_PRAZOS)) {
        if (opcoes.includes(prazoStr)) {
          document.getElementById('prazo-d').value = val;
          document.getElementById('prazo-m').value = val;
          alterouPrazoBase('prazo-d', 'prazo-m');
          setTimeout(() => {
            ['subprazo-d','subprazo-m'].forEach(id => {
              let sel = document.getElementById(id);
              if (sel) for (let opt of sel.options) { if (opt.value === prazoStr) { sel.value = prazoStr; break; } }
            });
          }, 150);
          prazoEncontrado = true;
          break;
        }
      }
      // Prazo simples
      if (!prazoEncontrado) {
        const MAP = { "28 DIAS":"9","35 DIAS":"7","42 DIAS":"5","56 DIAS":"2","63 DIAS":"0","ANTECIPADO":"14" };
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

    // Importa itens para SELECIONADOS
    SELECIONADOS = {};
    let itensImportados = 0;
    let itensFaltantes = [];

    pedido.itens.forEach(item => {
      let codBusca = String(item.codigo).trim().toLowerCase();
      let prod = PRODUTOS.find(p => p.codigo.toLowerCase().trim() === codBusca)
               || PRODUTOS.find(p => p.codigo.replace(/^0+/,'') === codBusca.replace(/^0+/,''));

      if (prod) {
        let key = prod.codigo.toLowerCase().trim();
        let qtdMin = prod.qtdEmbalagem || 1;
        let qtd = parseInt(item.qtd) || qtdMin;
        if (qtd % qtdMin !== 0) qtd = Math.ceil(qtd / qtdMin) * qtdMin;
        SELECIONADOS[key] = { produto: prod, qtd };
        itensImportados++;
      } else {
        itensFaltantes.push(item.codigo);
      }
    });

    calcularTudo();
    if (cli.cnpj) ativarClienteKNE825(cli.cnpj);

    document.getElementById('modal-importando').classList.remove('open');
    document.getElementById('modal-importando').style.display = 'none';
    fileInput.value = '';

    if (itensFaltantes.length > 0) {
      avisos.push(`⚠️ ${itensFaltantes.length} item(ns) não encontrado(s) no catálogo: ${itensFaltantes.join(', ')}`);
    }

    document.getElementById('import-resumo-txt').innerText =
      `${itensImportados} item(ns) carregado(s) com sucesso.`;

    let avisosEl = document.getElementById('import-avisos');
    let avisosFiltrados = avisos.filter(a => a.includes('item(ns) não encontrado'));
    if (avisosFiltrados.length > 0) {
      avisosEl.innerHTML = avisosFiltrados.map(a => `<div style="margin-bottom:4px;">${a}</div>`).join('');
      avisosEl.style.display = 'block';
    } else {
      avisosEl.style.display = 'none';
    }
    document.getElementById('modal-importado').style.display = 'flex';
    document.getElementById('modal-importado').classList.add('open');

  } catch (err) {
    document.getElementById('modal-importando').classList.remove('open');
    document.getElementById('modal-importando').style.display = 'none';
    alert("Erro ao importar pedido: " + err.message);
  }
}

function fecharModalImportado() {
  document.getElementById('modal-importado').classList.remove('open');
  setTimeout(() => document.getElementById('modal-importado').style.display = 'none', 300);
}
