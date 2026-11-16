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
//
// AJUSTE (bug do Pedido Mínimo): strings SEM vírgula mas com ponto de
// milhar puro (ex: "3.000", "12.500.000") antes eram lidas como decimal
// (3.000 virava 3.0). Agora, se o ponto separa grupos de exatamente 3
// dígitos e não há vírgula, é tratado como milhar e removido.
function parseValorNum(val) {
  if (val === undefined || val === null || val === '') return 0;

  // Já é number (veio direto da planilha como célula numérica) — usa direto.
  if (typeof val === 'number') {
    return isNaN(val) ? 0 : val;
  }

  let s = String(val).replace('R$', '').replace('%', '').trim();
  if (!s) return 0;

  if (s.indexOf(',') !== -1) {
    // Formato BR com decimal: "1.234,56" -> remove pontos de milhar, vírgula vira ponto.
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    // Só tem ponto(s), todos separando grupos de EXATAMENTE 3 dígitos
    // (ex: "3.000", "12.500", "1.234.567") -> são separadores de milhar,
    // não decimal. Um número tipo "3.6" não bate nesse padrão e continua
    // sendo lido como decimal normalmente.
    s = s.replace(/\./g, '');
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
// LÓGICA (confirmada): um item da aba MILLENIUM só usa o preço especial
// dessa tabela se, ao mesmo tempo:
//   1) o total bruto do carrinho (brutoCarrinho) bater o "Pedido mínimo"
//      da coluna B daquele item (item.minimo) — abaixo disso, o item cai
//      pro preço da tabela normal;
//   2) existir valor preenchido na coluna correspondente ao PRAZO
//      selecionado (Antecipado/28/35/42/56/63 dias) — sem valor naquela
//      coluna, também cai pro preço normal.
// Esse "Pedido mínimo" da coluna B NÃO é o pedido mínimo geral que trava
// o botão "Efetuar Pedido" (isso é outra regra, sempre por ICMS/UF — ver
// obterPedidoMinimoAtivo em 10-carrinho.js). Aqui ele só decide qual
// PREÇO usar.
//
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

    // 2. Validação de Pedido Mínimo (Coluna B) — pulada quando ignorarMinimo=true.
    // Item só qualifica pro preço Millenium se o bruto do carrinho já bater
    // esse mínimo específico da coluna B.
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
//
// CORRIGIDO (bug do loop circular do Pedido Mínimo): antes, esta função usava
// o preço JÁ PROMOCIONAL do Millenium (via getInfoMillenium(..., ignorarMinimo=true))
// para somar o bruto do carrinho. Só que esse bruto é exatamente o valor usado
// depois para checar se o carrinho ATINGE o Pedido Mínimo que libera esse mesmo
// desconto — ou seja, quanto maior o desconto Millenium, menor o bruto calculado,
// dificultando (ou até impossibilitando) bater o próprio mínimo que libera o
// desconto. Exemplo real: 3.000 un a R$1,45 (preço promo) = R$4.350 (não bate o
// mínimo de R$5.000) -> cai pro preço cheio R$1,69 -> 3.000 x 1,69 = R$5.070
// (bateria o mínimo, mas tarde demais, o preço já foi decidido como o cheio).
//
// Agora o bruto para checagem do Pedido Mínimo sempre usa o preço da tabela
// NORMAL (cheio) — a mesma base que subtotalBrutoInicial/frete já usam — e só
// cai para o preço Millenium como fallback, para itens que existem SOMENTE na
// aba MILLENIUM (sem nenhuma linha correspondente na aba Tabela).
function getPrecoBrutoItem(produto, icmsBase, prazoBase, tabelaBase) {
  let precoNormal = produto.emPromocao
    ? (produto.precosPromo && produto.precosPromo[tabelaBase] ? produto.precosPromo[tabelaBase] : 0)
    : (produto.precos && produto.precos[tabelaBase] ? produto.precos[tabelaBase] : 0);
  if (precoNormal > 0) return precoNormal;

  // Fallback: item não tem preço na tabela normal (só existe na MILLENIUM).
  let mill = getInfoMillenium(produto, icmsBase, prazoBase, 0, true);
  return mill ? mill.preco : 0;
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
