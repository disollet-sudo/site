/* =============================================
   Di Solle — 11. CLIENTES — BUSCA E CADASTRO
   Modal de novo cliente, busca geral de clientes cadastrados e
   preenchimento automático dos dados ao digitar um CNPJ conhecido.
   Depende de: 01-estado-global.js, 05-utils-busca.js,
               03-persistencia-local.js,
               06-precos-kne825-millenium.js (ativarClienteKNE825),
               10-carrinho.js (calcularTudo)
   ============================================= */

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
    salvarClienteLocal();
    showToast("✅ Dados do cliente preenchidos automaticamente.");
    ativarClienteKNE825(cnpj);
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
          salvarClienteLocal();
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
  let v = document.getElementById('input-busca-cliente').value.trim();
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
  let v = document.getElementById('input-busca-cliente').value.trim();
  let container = document.getElementById('lista-busca-clientes');
  container.innerHTML = '';

  let filtrados = CLIENTES.filter(c =>
    buscaInteligente([c.cnpj, c.fantasia, c.razao, c.municipio, c.estado], v)
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
    salvarClienteLocal();

    if(c.estado) {
      let estadoUpper = c.estado.toUpperCase().trim();
      let optD = document.querySelector(`#uf-d option[value="${estadoUpper}"]`);
      if(optD) {
        document.getElementById('uf-d').value = estadoUpper;
        document.getElementById('uf-m').value = estadoUpper;
        calcularTudo();
      }
    }

    ativarClienteKNE825(c.cnpj || '');
    fecharModalDetalhesCliente();
    fecharModalBuscarCliente();
    showToast("✅ Cliente vinculado! Adicione os itens e finalize.");
  };

  document.getElementById('modal-detalhes-cliente').style.display = 'flex';
  document.getElementById('modal-detalhes-cliente').classList.add('open');
}
