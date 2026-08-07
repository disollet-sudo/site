/* =============================================
   Di Solle — 06. REGRAS DE PREÇO ESPECIAL (KNE825 e MILLENIUM)
   ============================================= */

// =============================================
// CLIENTE ESPECIAL KNE825
// =============================================
function getPrecoEspecialKNE825(produto) {
  let codNorm = produto.codigo.toLowerCase().trim();
  let preco = TABELA_KNE825[codNorm];
  if (preco === undefined) {
    let sem0 = codNorm.replace(/^0+/, '');
    for (let k of Object.keys(TABELA_KNE825)) {
      if (k.replace(/^0+/, '') === sem0) { preco = TABELA_KNE825[k]; break; }
    }
  }
  return (preco !== undefined && preco > 0) ? preco : null;
}

// =============================================
// TABELA ESPECIAL MILLENIUM
// =============================================
const TERMOS_PRAZO_BASE_MILLENIUM = { 
  "14": "ANTECIPADO", 
  "9": "28 DIAS", 
  "7": "35 DIAS", 
  "5": "42 DIAS", 
  "2": "56 DIAS", 
  "0": "63 DIAS" 
};

function getInfoMillenium(produto, icmsBase, prazoBase, brutoCarrinho) {
  if (!TABELA_MILLENIUM || Object.keys(TABELA_MILLENIUM).length === 0) return null;

  let codNorm = produto.codigo.toLowerCase().trim();
  let m = TABELA_MILLENIUM[codNorm];
  if (!m) {
    let semZero = codNorm.replace(/^0+/, '');
    for (let k of Object.keys(TABELA_MILLENIUM)) {
      if (k.replace(/^0+/, '') === semZero) { m = TABELA_MILLENIUM[k]; break; }
    }
  }
  if (!m) return null;

  let termoAtual = normalizarTexto(TERMOS_PRAZO_BASE_MILLENIUM[String(prazoBase)] || '');
  let pctPrazoSelect = parseInt(prazoBase) || 0;

  // 1) Valor fixo das colunas L/M/N específico do ICMS atual
  let fixo = (icmsBase === '12') ? m.fixo12 : m.fixo7;
  if (fixo && fixo.tem && !(fixo.minimo > 0 && brutoCarrinho < fixo.minimo)) {
    if (termoAtual === normalizarTexto('ANTECIPADO') && fixo.antecipado > 0) {
      return { preco: fixo.antecipado, pctPrazoEfetivo: 1 };
    }
    if (termoAtual === normalizarTexto('42 DIAS') && fixo.d42 > 0) {
      return { preco: fixo.d42, pctPrazoEfetivo: 1 };
    }
    if (termoAtual === normalizarTexto('63 DIAS') && fixo.d63 > 0) {
      return { preco: fixo.d63, pctPrazoEfetivo: 1 };
    }
  }

  // 2) Preço base (B/C) + colunas F-K (Aceita Porcentagem ou Preço Fixo por item)
  let minimoBase = (icmsBase === '12') ? m.minimoIcms12 : m.minimoIcms7;
  if (minimoBase && minimoBase > 0 && brutoCarrinho < minimoBase) return null;

  let precoBase = (icmsBase === '12') ? m.precoIcms12 : m.precoIcms7;

  if (m.colunas && m.colunas.length > 0) {
    for (let col of m.colunas) {
      if (col.termo === undefined || col.termo === null || col.termo === '') continue;

      let termoCol = normalizarTexto(String(col.termo));

      // Verifica se a coluna bate com o prazo selecionado (por termo ou por % do select)
      if (termoCol === termoAtual || col.pct === pctPrazoSelect) {
        // Tenta identificar se foi colocado um PREÇO FIXO direto na célula (ex: 1.85 ou 1,85)
        let valLimpo = String(col.termo).replace('R$', '').replace(',', '.').trim();
        let valorNumFixo = parseFloat(valLimpo);

        // Se for um número válido maior que 0 e diferente de marcações comuns
        if (!isNaN(valorNumFixo) && valorNumFixo > 0 && valLimpo !== String(col.pct)) {
          return { preco: valorNumFixo, pctPrazoEfetivo: 1 };
        }

        // Se for marcação/porcentagem, aplica o desconto % sobre o Preço Base
        if (!precoBase || precoBase <= 0) return null;
        let pctAplicar = (col.pct !== undefined && col.pct !== null) ? col.pct : pctPrazoSelect;
        return { preco: precoBase, pctPrazoEfetivo: (100 - pctAplicar) / 100 };
      }
    }
  }

  return null;
}

// Retorna as informações detalhadas de preço e desconto do item
function getInfoPrecoItem(produto, tabelaAtiva) {
  let uf = document.getElementById('uf-d') ? document.getElementById('uf-d').value : '';
  let prazoBase = document.getElementById('prazo-d') ? document.getElementById('prazo-d').value : '';
  let pctPrazoGlobal = (100 - (parseInt(prazoBase) || 0)) / 100;

  if (CLIENTE_ESPECIAL_ATIVO) {
    let esp = getPrecoEspecialKNE825(produto);
    if (esp !== null) return { preco: esp, pctPrazoEfetivo: pctPrazoGlobal };
  }

  let icmsBase = (["RS", "SC", "PR", "SP", "MG", "RJ"].includes(uf)) ? "12" : "7";
  let brutoCarrinho = typeof somarBrutoPrevia === 'function' ? somarBrutoPrevia() : 0;
  let mill = getInfoMillenium(produto, icmsBase, prazoBase, brutoCarrinho);
  if (mill) return mill;

  let precoNormal = produto.emPromocao ? (produto.precosPromo[tabelaAtiva] || 0) : (produto.precos[tabelaAtiva] || 0);
  return { preco: precoNormal, pctPrazoEfetivo: pctPrazoGlobal };
}

// Retorna o PREÇO UNITÁRIO LÍQUIDO FINAL para ser exibido nos Cards, Modais e Carrinho
function getPrecoFinal(produto, tabelaNormal) {
  let info = getInfoPrecoItem(produto, tabelaNormal);
  if (!info) return 0;
  let pct = (info.pctPrazoEfetivo !== undefined) ? info.pctPrazoEfetivo : 1;
  return info.preco * pct;
}

function verificarModoEspecial() {
  let cnpjAtual = (document.getElementById('cli-cnpj') ? document.getElementById('cli-cnpj').value : '').replace(/\D/g,'');
  let prazo = document.getElementById('prazo-d') ? document.getElementById('prazo-d').value : '';
  CLIENTE_ESPECIAL_ATIVO = (cnpjAtual === CNPJ_KNE825 && prazo === '9' && Object.keys(TABELA_KNE825).length > 0);
}

function ativarClienteKNE825(cnpj) {
  let cnpjLimpo = (cnpj || '').replace(/\D/g,'');
  if (cnpjLimpo === CNPJ_KNE825 && Object.keys(TABELA_KNE825).length > 0) {
    document.getElementById('prazo-d').value = '9';
    document.getElementById('prazo-m').value = '9';
    alterouPrazoBase('prazo-d', 'prazo-m');
    CLIENTE_ESPECIAL_ATIVO = true;
    showToast("📋 Tabela especial KNE825 ativada — prazo 28 dias");
  }
}
