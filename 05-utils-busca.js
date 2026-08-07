/* =============================================
   Di Solle — 05. UTILITÁRIOS E BUSCA INTELIGENTE
   Funções pequenas de apoio (toast, formatação de dinheiro) e o motor
   de busca por texto (multi-palavra, sem acento, tolerante a erro de
   digitação) usado no catálogo e na busca de clientes.
   Depende de: nada (funções puras / independentes).
   ============================================= */

function showToast(m) {
  const t = document.getElementById('toast');
  t.innerText = m;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

function formatDin(v) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function normalizarTexto(txt) {
  return (txt || '')
    .toString()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
    .toLowerCase()
    .trim();
}

// Distância de Levenshtein (nº mínimo de edições para transformar 'a' em 'b')
// Usada para tolerar erros de digitação/grafia na base (ex: MILLENIUM x MILLENIUN)
function distanciaLevenshtein(a, b) {
  let m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let linhaAnterior = new Array(n + 1);
  let linhaAtual = new Array(n + 1);
  for (let j = 0; j <= n; j++) linhaAnterior[j] = j;
  for (let i = 1; i <= m; i++) {
    linhaAtual[0] = i;
    for (let j = 1; j <= n; j++) {
      let custo = a[i - 1] === b[j - 1] ? 0 : 1;
      linhaAtual[j] = Math.min(
        linhaAnterior[j] + 1,      // remoção
        linhaAtual[j - 1] + 1,     // inserção
        linhaAnterior[j - 1] + custo // substituição
      );
    }
    [linhaAnterior, linhaAtual] = [linhaAtual, linhaAnterior];
  }
  return linhaAnterior[n];
}

// Tolerância de erro permitida conforme o tamanho da palavra digitada
function toleranciaPara(tamanho) {
  if (tamanho <= 3) return 0;  // palavras muito curtas: precisa ser exata
  if (tamanho <= 5) return 1;
  if (tamanho <= 9) return 2;
  return 3;
}

// Retorna true se TODAS as palavras digitadas aparecerem (em qualquer ordem)
// em algum dos campos informados — mesmo com pequenos erros de digitação/grafia
// na base (ex: "millenium" encontra "MILLENIUN"). Ex: "millenium faca" casa com
// "FACA CHURRASCO MILLENIUM INOX" mesmo não estando na mesma ordem/adjacência.
function buscaInteligente(campos, termo) {
  let termoNorm = normalizarTexto(termo);
  if (!termoNorm) return true;
  let tokens = termoNorm.split(/\s+/).filter(Boolean);
  let textoCompleto = normalizarTexto(campos.filter(Boolean).join(' '));

  return tokens.every(tok => {
    // Caminho rápido: substring exata (cobre código, EAN e a maioria das buscas)
    if (textoCompleto.includes(tok)) return true;

    // Caminho tolerante a erro: compara com cada palavra do texto
    let tolerancia = toleranciaPara(tok.length);
    if (tolerancia === 0) return false;
    let palavras = textoCompleto.split(/\s+/);
    return palavras.some(p => {
      if (Math.abs(p.length - tok.length) > tolerancia) return false; // descarta rápido
      if (p[0] !== tok[0]) return false; // 1ª letra costuma estar certa; acelera muito
      return distanciaLevenshtein(tok, p) <= tolerancia;
    });
  });
}
