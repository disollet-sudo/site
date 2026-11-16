/* =============================================
   Di Solle — 19. LOGIN + PAINEL INICIAL
   Tela de login (usuário/senha da aba "Usuarios"), painel com os
   atalhos e controle de acesso ao catálogo de pedidos.
   Carregar ANTES do 16-init.js.
   Depende de: 01-estado-global.js, 04-representante.js
   ============================================= */

(function () {
  var CHAVE = 'disolle_sessao';
  var VALIDADE_MS = 6 * 3600 * 1000; // igual ao tempo da sessão no servidor (6h)

  // Se o login disser "URL do Apps Script não encontrada", coloque aqui a
  // mesma URL (https://script.google.com/macros/s/.../exec) usada pelo app.
  var URL_MANUAL = '';

  function urlApi() {
    if (URL_MANUAL) return URL_MANUAL;
    var nomes = ['URL_GOOGLE_SCRIPT', 'URL_SCRIPT', 'URL_API', 'API_URL', 'SCRIPT_URL',
                 'APPS_SCRIPT_URL', 'GAS_URL', 'URL_APPS_SCRIPT', 'WEB_APP_URL'];
    for (var i = 0; i < nomes.length; i++) {
      try {
        var v = new Function('return typeof ' + nomes[i] + ' !== "undefined" ? ' + nomes[i] + ' : ""')();
        if (v && String(v).indexOf('script.google.com') !== -1) return v;
      } catch (e) {}
    }
    return '';
  }

  // ---------- estilos ----------
  var css = document.createElement('style');
  css.textContent =
    'body.fora-do-pedido header,body.fora-do-pedido .filtros,body.fora-do-pedido .main,body.fora-do-pedido .mob-bar{display:none!important}' +
    '#tela-login,#tela-painel{position:fixed;inset:0;z-index:99999;background:#f4f6f5;display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif;padding:16px}' +
    '.lg-card{background:#fff;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,.08);padding:28px;width:100%;max-width:380px}' +
    '.lg-logo{display:block;margin:0 auto 14px;max-height:56px}' +
    '.lg-card h1{color:#1D9E75;font-size:22px;margin-bottom:4px;text-align:center}' +
    '.lg-card p{color:#666;font-size:13px;margin-bottom:18px;text-align:center}' +
    '.lg-card input{width:100%;padding:11px;margin-bottom:12px;border:1px solid #ccc;border-radius:8px;font-size:15px;box-sizing:border-box}' +
    '.lg-card button.lg-btn{width:100%;padding:12px;border:0;border-radius:8px;background:#1D9E75;color:#fff;font-size:15px;font-weight:bold;cursor:pointer}' +
    '.lg-card button.lg-btn:disabled{opacity:.6}' +
    '.lg-erro{color:#c0392b;font-size:13px;min-height:18px;margin-bottom:8px;text-align:center}' +
    '.pn-topo{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;font-size:13px;color:#555}' +
    '.pn-topo a{color:#c0392b;cursor:pointer;text-decoration:underline}' +
    '.pn-btn{margin-bottom:10px}';
  document.head.appendChild(css);

  var LOGO = 'https://drive.google.com/thumbnail?id=1xtobPLkiaoKzECRoMO3b4NMgb8i0bBc3&sz=w300';

  // ---------- utilidades ----------
  function el(html) { var d = document.createElement('div'); d.innerHTML = html; return d.firstElementChild; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function limpar(id) { var x = document.getElementById(id); if (x) x.remove(); }
  function getSessao() {
    try {
      var s = JSON.parse(localStorage.getItem(CHAVE));
      if (s && Date.now() - s.em < VALIDADE_MS) return s;
    } catch (e) {}
    localStorage.removeItem(CHAVE);
    return null;
  }

  window.Sessao = { get: getSessao, sair: sair };

  function sair() {
    localStorage.removeItem(CHAVE);
    localStorage.removeItem('repre_cod');
    location.reload();
  }

  // Aplica a sessão no app: define o código do representante.
  // - REPRESENTANTE: fixo, vindo da planilha (e esconde o botão "Trocar").
  // - GESTOR/ADMIN: começa sem código e informa o do representante no pedido.
  function aplicarSessao(sess) {
    var u = sess.usuario;
    var ehRepre = u.perfil === 'REPRESENTANTE';
    try {
      if (ehRepre) {
        CODIGO_REPRE = u.codigoRepre;
        localStorage.setItem('repre_cod', u.codigoRepre);
      } else if (!sess.repreEscolhido) {
        CODIGO_REPRE = '';
        localStorage.removeItem('repre_cod');
      }
    } catch (e) {}
    var trocar = document.querySelector('#info-repre-box button');
    if (trocar) trocar.style.display = ehRepre ? 'none' : '';
    if (CODIGO_REPRE && typeof atualizarExibicaoRepre === 'function') atualizarExibicaoRepre();
  }

  // ---------- login ----------
  function mostrarLogin() {
    limpar('tela-painel');
    document.body.classList.add('fora-do-pedido');
    var t = el(
      '<div id="tela-login"><div class="lg-card">' +
      '<img class="lg-logo" src="' + LOGO + '" alt="Di Solle">' +
      '<h1>Acesso interno</h1><p>Entre com seu usuário e senha.</p>' +
      '<input id="lg-user" placeholder="Usuário" autocomplete="username" autocapitalize="none">' +
      '<input id="lg-pass" type="password" placeholder="Senha" autocomplete="current-password">' +
      '<div class="lg-erro" id="lg-erro"></div>' +
      '<button class="lg-btn" id="lg-btn">Entrar</button></div></div>');
    document.body.appendChild(t);
    var btn = document.getElementById('lg-btn');

    function entrar() {
      var erro = document.getElementById('lg-erro'); erro.textContent = '';
      var api = urlApi();
      if (!api) { erro.textContent = 'URL do Apps Script não encontrada em 19-login.js.'; return; }
      var u = document.getElementById('lg-user').value, s = document.getElementById('lg-pass').value;
      btn.disabled = true; btn.textContent = 'Entrando...';
      fetch(api, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                   body: JSON.stringify({ acao: 'login', usuario: u, senha: s }) })
        .then(function (r) { return r.json(); })
        .then(function (res) {
          if (res.status !== 'success') throw new Error(res.message || 'Falha no login.');
          if (res.usuario.perfil === 'REPRESENTANTE' && !res.usuario.codigoRepre) {
            throw new Error('Seu cadastro está sem código de representante. Avise a gestão.');
          }
          var sess = { token: res.token, usuario: res.usuario, equipe: res.equipe, em: Date.now() };
          localStorage.setItem(CHAVE, JSON.stringify(sess));
          limpar('tela-login');
          aplicarSessao(sess);
          mostrarPainel();
        })
        .catch(function (e) { erro.textContent = e.message || 'Erro de conexão.'; })
        .then(function () { btn.disabled = false; btn.textContent = 'Entrar'; });
    }
    btn.onclick = entrar;
    t.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') entrar(); });
    document.getElementById('lg-user').focus();
  }

  // ---------- painel ----------
  function mostrarPainel() {
    var sess = getSessao();
    if (!sess) return mostrarLogin();
    document.body.classList.add('fora-do-pedido');
    limpar('tela-painel');
    var p = el(
      '<div id="tela-painel"><div class="lg-card">' +
      '<div class="pn-topo"><span>Olá, <b>' + esc(sess.usuario.nome) + '</b></span><a id="pn-sair">Sair</a></div>' +
      '<h1>Painel</h1><p>O que você quer fazer?</p>' +
      '<button class="lg-btn pn-btn" id="pn-pedido">🛒 Fazer pedido</button></div></div>');
    document.body.appendChild(p);
    document.getElementById('pn-sair').onclick = sair;
    document.getElementById('pn-pedido').onclick = abrirPedido;
  }

  function abrirPedido() {
    limpar('tela-painel');
    document.body.classList.remove('fora-do-pedido');
    var sess = getSessao();
    // Gestor/Admin sem representante escolhido: pede o código antes de começar
    if (sess && sess.usuario.perfil !== 'REPRESENTANTE' && !CODIGO_REPRE && typeof abrirModalRepre === 'function') {
      abrirModalRepre();
    }
  }

  window.voltarAoPainel = mostrarPainel;

  // ---------- início (roda antes do 16-init.js) ----------
  var sess = getSessao();
  if (sess) { aplicarSessao(sess); mostrarPainel(); }
  else { mostrarLogin(); }
})();
