// 19-login.js — login + painel inicial
(function () {
  // Use a MESMA URL do Apps Script que o app já usa (URL_GOOGLE_SCRIPT)
  var URL_API = (typeof URL_GOOGLE_SCRIPT !== 'undefined') ? URL_GOOGLE_SCRIPT : '';
  var CHAVE = 'disolle_sessao';

  var css = document.createElement('style');
  css.textContent =
    '#tela-login,#tela-painel{position:fixed;inset:0;z-index:9999;background:#f4f6f5;display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif;padding:16px}' +
    '.lg-card{background:#fff;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,.08);padding:28px;width:100%;max-width:380px}' +
    '.lg-card h1{color:#1D9E75;font-size:22px;margin-bottom:4px}.lg-card p{color:#666;font-size:13px;margin-bottom:18px}' +
    '.lg-card input{width:100%;padding:11px;margin-bottom:12px;border:1px solid #ccc;border-radius:8px;font-size:15px}' +
    '.lg-card button{width:100%;padding:12px;border:0;border-radius:8px;background:#1D9E75;color:#fff;font-size:15px;font-weight:bold;cursor:pointer}' +
    '.lg-card button:disabled{opacity:.6}.lg-erro{color:#c0392b;font-size:13px;min-height:18px;margin-bottom:8px}' +
    '.pn-topo{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;font-size:13px;color:#555}' +
    '.pn-topo a{color:#c0392b;cursor:pointer;text-decoration:underline}' +
    '.pn-btn{margin-bottom:10px}';
  document.head.appendChild(css);

  function el(html) { var d = document.createElement('div'); d.innerHTML = html; return d.firstElementChild; }
  function getSessao() { try { return JSON.parse(localStorage.getItem(CHAVE)); } catch (e) { return null; } }
  function limpar(id) { var x = document.getElementById(id); if (x) x.remove(); }
  function telaPedido() { return document.getElementById('tela-pedido'); }

  window.Sessao = { get: getSessao, sair: sair };

  function sair() {
    localStorage.removeItem(CHAVE);
    location.reload();
  }

  function mostrarLogin() {
    limpar('tela-painel');
    if (telaPedido()) telaPedido().style.display = 'none';
    var t = el(
      '<div id="tela-login"><div class="lg-card">' +
      '<h1>DI SOLLE</h1><p>Acesso interno — entre com seu usuário e senha.</p>' +
      '<input id="lg-user" placeholder="Usuário" autocomplete="username" autocapitalize="none">' +
      '<input id="lg-pass" type="password" placeholder="Senha" autocomplete="current-password">' +
      '<div class="lg-erro" id="lg-erro"></div>' +
      '<button id="lg-btn">Entrar</button></div></div>');
    document.body.appendChild(t);
    var btn = document.getElementById('lg-btn');
    function entrar() {
      var u = document.getElementById('lg-user').value, s = document.getElementById('lg-pass').value;
      var erro = document.getElementById('lg-erro'); erro.textContent = '';
      btn.disabled = true; btn.textContent = 'Entrando...';
      fetch(URL_API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                       body: JSON.stringify({ acao: 'login', usuario: u, senha: s }) })
        .then(function (r) { return r.json(); })
        .then(function (res) {
          if (res.status !== 'success') throw new Error(res.message || 'Falha no login.');
          localStorage.setItem(CHAVE, JSON.stringify({ token: res.token, usuario: res.usuario, equipe: res.equipe, em: Date.now() }));
          limpar('tela-login'); mostrarPainel();
        })
        .catch(function (e) { erro.textContent = e.message; })
        .then(function () { btn.disabled = false; btn.textContent = 'Entrar'; });
    }
    btn.onclick = entrar;
    t.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') entrar(); });
  }

  function mostrarPainel() {
    var sess = getSessao();
    if (!sess) return mostrarLogin();
    if (telaPedido()) telaPedido().style.display = 'none';
    limpar('tela-painel');
    var p = el(
      '<div id="tela-painel"><div class="lg-card">' +
      '<div class="pn-topo"><span>Olá, <b>' + sess.usuario.nome + '</b></span><a id="pn-sair">Sair</a></div>' +
      '<h1>Painel</h1><p>O que você quer fazer?</p>' +
      '<button class="pn-btn" id="pn-pedido">Fazer pedido</button></div></div>');
    document.body.appendChild(p);
    document.getElementById('pn-sair').onclick = sair;
    document.getElementById('pn-pedido').onclick = function () {
      limpar('tela-painel');
      if (telaPedido()) telaPedido().style.display = '';
    };
  }

  // Botão "Voltar ao painel" que você pode chamar de dentro da tela de pedido
  window.voltarAoPainel = mostrarPainel;

  document.addEventListener('DOMContentLoaded', function () {
    var s = getSessao();
    // sessão local vale 6h, igual ao servidor
    if (s && Date.now() - s.em < 6 * 3600 * 1000) mostrarPainel(); else { localStorage.removeItem(CHAVE); mostrarLogin(); }
  });
})();
