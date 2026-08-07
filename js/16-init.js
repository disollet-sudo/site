/* =============================================
   Di Solle — 16. INICIALIZAÇÃO
   Ponto de entrada do app: dispara ao carregar a página. Este arquivo
   deve ser o ÚLTIMO <script> no index.html, pois usa funções de
   praticamente todos os outros módulos.
   Depende de: todos os arquivos anteriores.
   ============================================= */

window.addEventListener('DOMContentLoaded', () => {
  iniciarLoadingInicial();
  if (!CODIGO_REPRE) {
    document.getElementById('modal-repre').style.display = 'flex';
    document.getElementById('modal-repre').classList.add('open');
  } else {
    document.getElementById('modal-repre').style.display = 'none';
    document.getElementById('modal-repre').classList.remove('open');
    atualizarExibicaoRepre();
  }

  // Vincula os eventos de troca de Prazo (Desktop e Mobile)
  let pD = document.getElementById('prazo-d');
  let pM = document.getElementById('prazo-m');
  if (pD) pD.addEventListener('change', () => alterouPrazoBase('prazo-d', 'prazo-m'));
  if (pM) pM.addEventListener('change', () => alterouPrazoBase('prazo-m', 'prazo-d'));

  // Vincula os eventos de troca de UF / Estado (Desktop e Mobile)
  let ufD = document.getElementById('uf-d');
  let ufM = document.getElementById('uf-m');
  if (ufD) ufD.addEventListener('change', () => alterouUF('uf-d', 'uf-m'));
  if (ufM) ufM.addEventListener('change', () => alterouUF('uf-m', 'uf-d'));

  configurarPersistenciaCliente();
  atualizarBadgeOrcamentos();

  let veioDeSincronizacao = new URLSearchParams(window.location.search).has('_r');
  if (veioDeSincronizacao) {
    // Consome o parâmetro _r e limpa a URL, para que um F5 normal (sem clicar em Sincronizar)
    // não force esse resync pesado de novo.
    let urlLimpa = new URL(window.location.href);
    urlLimpa.searchParams.delete('_r');
    window.history.replaceState({}, '', urlLimpa.toString());
  }
  carregarDados(veioDeSincronizacao).then(() => { 
    restaurarEstadoLocal(); 
    finalizarLoadingInicial(); 
  });
});
