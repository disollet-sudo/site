/* =============================================
   Di Solle — 06. REGRAS DE PREÇO ESPECIAL (KNE825 e MILLENIUM)
   ============================================= */

// Helper para converter valores monetários ou strings numéricas em Float.
// CORRIGIDO: a planilha MILLENIUM tem colunas com tipos misturados —
// algumas células voltam como NUMBER puro do Apps Script (ex: 3.276),
// outras como STRING em formato BR (ex: "3,60" ou "1.234,56").
// Antes, a função sempre convertia pra string e removia TODO ponto,
// o que destruía o ponto decimal de números puros (3.276 virava 3276).
// Agora: número puro é usado direto; só strings passam pela limpeza
// de formato brasileiro (ponto de milhar + vírgula decimal).
function parseValorNum(val) {
  if (val === undefined || val === null || val === '') return 0;

  // Já é number (veio direto da planilha como célula numérica) — usa direto.
  if (typeof val === 'number') {
    return isNaN(val) ? 0 : val;
  }

  let s = String(val).replace('R$', '').replace('%', '').trim();
  if (!s) return 0;

  // Só remove pontos como separador de milhar se houver vírgula decimal
  // (formato BR: "1.234,56"). Sem vírgula, o ponto (se existir) já é o
  // separador decimal normal (ex: "3.6") e não deve ser removido.
  if (s.indexOf(',') !== -1) {
    s = s.replace(/\./g, '').replace(',', '.');
  }

  let n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

// =============================================
// CLIENTE ESPECIAL KNE825
// =============================================
function getPrecoEspecialKNE825(produto) {
  if (!produto || !produto.codigo) return null;
  let codNorm = produto.codigo.toLowerCase().trim();
  let preco = TABELA_KNE825[codNorm];
  if (preco === undefined) {
    let sem0 = codNorm.replace(/^0+/, '');
    for (let k of Object.keys(TABELA_KNE825)) {
      if (k.replace(/^0+/, '') === sem0) { 
        preco = TABELA_KNE825[k]; 
        break; 
      }
    }
  }
  return (preco !== undefined && preco > 0) ? preco : null;
}

// =============================================
// TABELA ESPECIAL MILLENIUM (Regra por Colunas Diretas)
// =============================================
// ignorarMinimo: quando true, pula a checagem do "Pedido mínimo" (coluna B).
// Usado por getPrecoBrutoItem() pra saber o preço Millenium do item SEM
// depender do próprio bruto do carrinho (evita loop circular).
function getInfoMillenium(produto, icmsBase, prazoBase, brutoCarrinho, ignorarMinimo) {
  if (!TABELA_MILLENIUM || Object.keys(TABELA_MILLENIUM).length === 0) return null;

  let codNorm = produto.codigo.toLowerCase().trim();
  let registros = TABELA_MILLENIUM[codNorm];

  if (!registros) {
    let semZero = codNorm.replace(/^0+/, '');
    for (let k of Object.keys(TABELA_MILLENIUM)) {
      if (k.replace(/^0+/, '') === semZero) { 
        registros = TABELA_MILLENIUM[k]; 
        break; 
      }
    }
  }

  if (!registros) return null;

  let lista = Array.isArray(registros) ? registros : [registros];

  // Mapeamento dos Prazos (Select HTML -> Atributos do Objeto)
  // 14 = Antecipado | 9 = 28 dias | 7 = 35 dias | 5 = 42 dias | 2 = 56 dias | 0 = 63 dias
  let prazoChaveMap = {
    "14": ["antecipado"],
    "9":  ["d28"],
    "7":  ["d35"],
    "5":  ["d42"],
    "2":  ["d56"],
    "0":  ["d63"]
  };

  let chavesBuscadas = prazoChaveMap[String(prazoBase)] || [];

  for (let item of lista) {
    // 1. Validação de ICMS (Compara Coluna ICM da planilha com o ICMS da UF do cliente)
    let icmItem = String(item.icm || '').trim();
    if (icmItem && icmItem !== String(icmsBase)) {
      continue;
    }

    // 2. Validação de Pedido Mínimo (Coluna B) — pulada quando ignorarMinimo=true
    if (!ignorarMinimo) {
      let minimo = parseValorNum(item.minimo);
      if (minimo > 0 && brutoCarrinho < minimo) {
        continue;
      }
    }

    // 3. Leitura direta do valor na coluna correspondente ao prazo selecionado
    let precoEncontrado = 0;
    for (let chv of chavesBuscadas) {
      if (item[chv] !== undefined && item[chv] !== null && item[chv] !== '') {
        let val = parseValorNum(item[chv]);
        if (val > 0) {
          precoEncontrado = val;
          break;
        }
      }
    }

    // Se encontrou o valor cravado para a coluna do prazo, retorna com fator 1 (sem descontos adicionais)
    if (precoEncontrado > 0) {
      return { preco: precoEncontrado, pctPrazoEfetivo: 1 };
    }
  }

  return null;
}

// Retorna o preço "bruto" de um item para fins de soma do carrinho (checar Pedido Mínimo/frete).
// Se o item está na aba Millenium, usa o preço Millenium do prazo atual (ignorando o próprio
// mínimo, pra não virar loop). Se não está na Millenium, usa a tabela normal como antes.
function getPrecoBrutoItem(produto, icmsBase, prazoBase, tabelaBase) {
  let mill = getInfoMillenium(produto, icmsBase, prazoBase, 0, true);
  if (mill) return mill.preco;
  return produto.emPromocao
    ? (produto.precosPromo && produto.precosPromo[tabelaBase] ? produto.precosPromo[tabelaBase] : 0)
    : (produto.precos && produto.precos[tabelaBase] ? produto.precos[tabelaBase] : 0);
}

// Retorna as informações detalhadas de preço do item
function getInfoPrecoItem(produto, tabelaAtiva) {
  if (!produto) return { preco: 0, pctPrazoEfetivo: 1 };

  let ufElem = document.getElementById('uf-d') || document.getElementById('uf-m');
  let prazoElem = document.getElementById('prazo-d') || document.getElementById('prazo-m');

  let uf = ufElem ? ufElem.value : 'RS';
  let prazoBase = prazoElem ? prazoElem.value : '14';
  let pctPrazoGlobal = (100 - (parseInt(prazoBase) || 0)) / 100;

  // 1. Prioridade Cliente Especial KNE825
  if (CLIENTE_ESPECIAL_ATIVO) {
    let esp = getPrecoEspecialKNE825(produto);
    if (esp !== null) return { preco: esp, pctPrazoEfetivo: pctPrazoGlobal };
  }

  // 2. Tabela MILLENIUM
  let icmsBase = (["RS", "SC", "PR", "SP", "MG", "RJ"].includes(uf)) ? "12" : "7";
  let brutoCarrinho = typeof somarBrutoPrevia === 'function' ? somarBrutoPrevia() : 0;
  let mill = getInfoMillenium(produto, icmsBase, prazoBase, brutoCarrinho);
  if (mill) return mill;

  // 3. Tabela Normal (Fallback)
  let tab = tabelaAtiva || (typeof TABELA_ATIVA !== 'undefined' ? TABELA_ATIVA : 'M26071');
  let precoNormal = produto.emPromocao ? (produto.precosPromo && produto.precosPromo[tab] ? produto.precosPromo[tab] : 0) 
                                       : (produto.precos && produto.precos[tab] ? produto.precos[tab] : 0);
  return { preco: precoNormal, pctPrazoEfetivo: pctPrazoGlobal };
}

// Retorna o PREÇO UNITÁRIO FINAL exibido na tela
function getPrecoFinal(produto, tabelaNormal) {
  let info = getInfoPrecoItem(produto, tabelaNormal);
  if (!info) return 0;
  let pct = (info.pctPrazoEfetivo !== undefined) ? info.pctPrazoEfetivo : 1;
  return info.preco * pct;
}

function verificarModoEspecial() {
  let cliElem = document.getElementById('cli-cnpj');
  let prazoElem = document.getElementById('prazo-d') || document.getElementById('prazo-m');

  let cnpjAtual = cliElem ? cliElem.value.replace(/\D/g,'') : '';
  let prazo = prazoElem ? prazoElem.value : '';

  CLIENTE_ESPECIAL_ATIVO = (cnpjAtual === CNPJ_KNE825 && prazo === '9' && Object.keys(TABELA_KNE825).length > 0);
}

function ativarClienteKNE825(cnpj) {
  let cnpjLimpo = (cnpj || '').replace(/\D/g,'');
  if (cnpjLimpo === CNPJ_KNE825 && Object.keys(TABELA_KNE825).length > 0) {
    let pD = document.getElementById('prazo-d');
    let pM = document.getElementById('prazo-m');
    if (pD) pD.value = '9';
    if (pM) pM.value = '9';
    alterouPrazoBase('prazo-d', 'prazo-m');
    CLIENTE_ESPECIAL_ATIVO = true;
    if (typeof showToast === 'function') showToast("📋 Tabela especial KNE825 ativada — prazo 28 dias");
  }
}
