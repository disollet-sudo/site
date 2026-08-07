/* =============================================
   Di Solle — 03. PERSISTÊNCIA LOCAL
   Carrinho, dados do cliente e config (UF/prazo) sobrevivem a um F5,
   salvos no localStorage do navegador.
   Depende de: 01-estado-global.js
   ============================================= */

function configurarPersistenciaCliente() {
  CAMPOS_CLIENTE_FORM.forEach(f => {
    let el = document.getElementById('cli-' + f);
    if (el) el.addEventListener('input', salvarClienteLocal);
  });
}

function salvarCarrinhoLocal() {
  if (RESTAURANDO_ESTADO) return;
  try {
    let simples = {};
    Object.keys(SELECIONADOS).forEach(k => { simples[k] = SELECIONADOS[k].qtd; });
    localStorage.setItem(LS_CARRINHO, JSON.stringify(simples));
  } catch (e) {}
}

function salvarClienteLocal() {
  if (RESTAURANDO_ESTADO) return;
  try {
    let obj = {};
    CAMPOS_CLIENTE_FORM.forEach(f => {
      let el = document.getElementById('cli-' + f);
      if (el) obj[f] = el.value;
    });
    localStorage.setItem(LS_CLIENTE, JSON.stringify(obj));
  } catch (e) {}
}

function salvarConfigLocal() {
  if (RESTAURANDO_ESTADO) return;
  try {
    let obj = {
      uf: document.getElementById('uf-d') ? document.getElementById('uf-d').value : '',
      prazo: document.getElementById('prazo-d') ? document.getElementById('prazo-d').value : '',
      subprazo: document.getElementById('subprazo-d') ? document.getElementById('subprazo-d').value : ''
    };
    localStorage.setItem(LS_CONFIG, JSON.stringify(obj));
  } catch (e) {}
}

function restaurarEstadoLocal() {
  RESTAURANDO_ESTADO = true;

  // 1) Restaura UF e prazo (precisa vir antes do carrinho para os preços baterem)
  try {
    let cfg = JSON.parse(localStorage.getItem(LS_CONFIG) || 'null');
    if (cfg) {
      if (cfg.uf) {
        let optD = document.querySelector(`#uf-d option[value="${cfg.uf}"]`);
        if (optD) { document.getElementById('uf-d').value = cfg.uf; document.getElementById('uf-m').value = cfg.uf; }
      }
      if (cfg.prazo) {
        document.getElementById('prazo-d').value = cfg.prazo;
        document.getElementById('prazo-m').value = cfg.prazo;
        alterouPrazoBase('prazo-d', 'prazo-m');
        if (cfg.subprazo) {
          setTimeout(() => {
            ['subprazo-d', 'subprazo-m'].forEach(id => {
              let sel = document.getElementById(id);
              if (sel) sel.value = cfg.subprazo;
            });
          }, 50);
        }
      }
    }
  } catch (e) {}

  // 2) Restaura dados do cliente digitados
  try {
    let cli = JSON.parse(localStorage.getItem(LS_CLIENTE) || 'null');
    if (cli) {
      CAMPOS_CLIENTE_FORM.forEach(f => {
        let el = document.getElementById('cli-' + f);
        if (el && cli[f]) el.value = cli[f];
      });
      if (cli.cnpj) ativarClienteKNE825(cli.cnpj);
    }
  } catch (e) {}

  // 3) Restaura o carrinho (depende do catálogo já carregado em PRODUTOS)
  try {
    let carr = JSON.parse(localStorage.getItem(LS_CARRINHO) || 'null');
    if (carr && Object.keys(carr).length > 0) {
      let restaurados = 0;
      Object.keys(carr).forEach(cod => {
        let prod = PRODUTOS.find(p => p.codigo.toLowerCase().trim() === cod);
        if (prod) { SELECIONADOS[cod] = { produto: prod, qtd: carr[cod] }; restaurados++; }
      });
      if (restaurados > 0) showToast(`🛒 Carrinho restaurado (${restaurados} item(ns))`);
    }
  } catch (e) {}

  RESTAURANDO_ESTADO = false;
  calcularTudo();
}

function limparEstadoLocal() {
  try {
    localStorage.removeItem(LS_CARRINHO);
    localStorage.removeItem(LS_CLIENTE);
    localStorage.removeItem(LS_CONFIG);
  } catch (e) {}
}
