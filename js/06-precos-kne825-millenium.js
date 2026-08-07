/* =============================================
   Di Solle — 06. REGRAS DE PREÇO ESPECIAL (KNE825 e MILLENIUM)
   ★ Este é o arquivo a editar quando uma regra de preço/desconto mudar. ★
   Depende de: 01-estado-global.js, 08-catalogo-filtros.js (somarBrutoPrevia)
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
// TABELA ESPECIAL MILLENIUM (regras por prazo definidas na aba MILLENIUM da planilha)
// =============================================
// Mapeia o valor do <select> de prazo base (prazo-d) para o nome do prazo tal como
// aparece na aba MILLENIUM. Só o prazo BASE entra nessa regra — desmembramentos (subprazo)
// não são considerados aqui.
const TERMOS_PRAZO_BASE_MILLENIUM = { "14": "ANTECIPADO", "9": "28 DIAS", "7": "35 DIAS", "5": "42 DIAS", "2": "56 DIAS", "0": "63 DIAS" };

// Retorna { preco, pctPrazoEfetivo } se este produto tiver regra MILLENIUM válida para o
// prazo/ICMS/carrinho atuais, ou null se não se aplicar (nesse caso usa-se o preço normal da tabela).
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
  if (!termoAtual) return null;

  // 1) Valor fixo (L/M/N) específico do ICMS atual — cada fixo tem seu próprio mínimo (0 = sem mínimo)
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

  // 2) Preço base (B/C) + desconto percentual (colunas F-K), com o mínimo geral D/E
  let minimoBase = (icmsBase === '12') ? m.minimoIcms12 : m.minimoIcms7;
  if (minimoBase && minimoBase > 0 && brutoCarrinho < minimoBase) return null;

  let precoBase = (icmsBase === '12') ? m.precoIcms12 : m.precoIcms7;
  if (!precoBase || precoBase <= 0) return null;

  for (let col of m.colunas) {
    if (col.termo && normalizarTexto(col.termo) === termoAtual) {
      return { preco: precoBase, pctPrazoEfetivo: (100 - col.pct) / 100 };
    }
  }

  return null;
}
// Retorna { preco, pctPrazoEfetivo } considerando prioridade:
// Cliente Especial KNE825  >  Tabela Especial MILLENIUM  >  Tabela normal.
// "preco" é o valor unitário base (mesmo papel que getPrecoFinal sempre teve);
// "pctPrazoEfetivo" é o fator (0 a 1) a aplicar sobre esse preço para chegar no valor
// líquido de prazo — normalmente é o desconto global do prazo selecionado, mas o
// MILLENIUM pode fixar 1 (preço já pronto) ou um percentual próprio daquele item.
function getInfoPrecoItem(produto, tabelaAtiva) {
  let uf = document.getElementById('uf-d') ? document.getElementById('uf-d').value : '';
  let prazoBase = document.getElementById('prazo-d') ? document.getElementById('prazo-d').value : '';
  let pctPrazoGlobal = (100 - (parseInt(prazoBase) || 0)) / 100;

  if (CLIENTE_ESPECIAL_ATIVO) {
    let esp = getPrecoEspecialKNE825(produto);
    if (esp !== null) return { preco: esp, pctPrazoEfetivo: pctPrazoGlobal };
  }

  let icmsBase = (["RS", "SC", "PR", "SP", "MG", "RJ"].includes(uf)) ? "12" : "7";
  let brutoCarrinho = somarBrutoPrevia();
  let mill = getInfoMillenium(produto, icmsBase, prazoBase, brutoCarrinho);
  if (mill) return mill;

  let precoNormal = produto.emPromocao ? (produto.precosPromo[tabelaAtiva] || 0) : (produto.precos[tabelaAtiva] || 0);
  return { preco: precoNormal, pctPrazoEfetivo: pctPrazoGlobal };
}

// Mantém a mesma assinatura de sempre — usada em cards, modal e carrinho — e continua
// retornando só o preço unitário "bruto" (ainda sem o desconto de prazo aplicado).
function getPrecoFinal(produto, tabelaNormal) {
  return getInfoPrecoItem(produto, tabelaNormal).preco;
}

function verificarModoEspecial() {
  // Ativa somente se CNPJ do cliente = KNE825 E prazo = 28 dias (valor "9")
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
