/* =============================================
   Di Solle — 19. LOGIN + PAINEL INICIAL
   Tela de login (usuário/senha da aba "Usuarios"), painel-menu com
   boas-vindas e meta mensal, e controle de acesso ao catálogo de pedidos.
   Carregar ANTES do 16-init.js.
   Depende de: 01-estado-global.js, 04-representante.js
   ============================================= */

(function () {
  var CHAVE = 'disolle_sessao';
  var VALIDADE_MS = 6 * 3600 * 1000; // igual ao tempo da sessão no servidor (6h)
  var MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  var PERFIS = { ADMIN: 'Administrador', GESTOR: 'Gestor', REPRESENTANTE: 'Representante' };

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
    // o modal antigo "Informe seu Código de Representante" não é mais usado (o login já identifica o usuário)
    '#modal-repre{display:none!important}' +
    'body.fora-do-pedido header,body.fora-do-pedido .filtros,body.fora-do-pedido .main,body.fora-do-pedido .mob-bar{display:none!important}' +
    '#tela-login,#tela-painel,#tela-escolha{position:fixed;inset:0;z-index:99999;background:#f4f6f5;display:flex;overflow:auto;font-family:Arial,sans-serif;padding:16px;box-sizing:border-box}' +
    '#tela-escolha{z-index:100000;background:rgba(0,0,0,.45)}' +
    '.lg-card{background:#fff;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,.08);padding:28px;width:100%;max-width:380px;margin:auto;box-sizing:border-box}' +
    '.lg-logo{display:block;margin:0 auto 14px;max-height:56px}' +
    '.lg-card h1{color:#1D9E75;font-size:22px;margin:0 0 4px;text-align:center}' +
    '.lg-card p{color:#666;font-size:13px;margin:0 0 18px;text-align:center}' +
    '.lg-card input{width:100%;padding:11px;margin-bottom:12px;border:1px solid #ccc;border-radius:8px;font-size:15px;box-sizing:border-box}' +
    '.lg-card button.lg-btn{width:100%;padding:12px;border:0;border-radius:8px;background:#1D9E75;color:#fff;font-size:15px;font-weight:bold;cursor:pointer}' +
    '.lg-card button.lg-btn:disabled{opacity:.6}' +
    '.lg-card button.lg-sec{background:#eee;color:#444;margin-top:10px}' +
    '.lg-erro{color:#c0392b;font-size:13px;min-height:18px;margin-bottom:8px;text-align:center}' +
    // painel
    '.pn-wrap{width:100%;max-width:780px;margin:auto}' +
    '.pn-topo{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px}' +
    '.pn-topo img{max-height:44px}.pn-topo a{color:#c0392b;cursor:pointer;text-decoration:underline;font-size:13px}' +
    '.pn-ola{background:#fff;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,.06);padding:20px 24px;display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:18px}' +
    '.pn-ola small{color:#777;font-size:13px;display:block}.pn-ola h1{margin:2px 0 6px;color:#0f6e56;font-size:24px}' +
    '.pn-perfil{display:inline-block;background:#E1F5EE;color:#0f6e56;font-size:11px;font-weight:bold;border-radius:20px;padding:2px 10px}' +
    '.pn-meta{text-align:right}.pn-meta b{display:block;font-size:22px;color:#1D9E75;margin-top:2px}' +
    '.pn-aviso{background:#fff4e5;color:#8a5a00;border-radius:8px;padding:10px 14px;font-size:13px;margin-bottom:14px}' +
    '.pn-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:14px}' +
    '.pn-tile{background:#fff;border:2px solid transparent;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,.06);padding:20px;cursor:pointer;text-align:left;font-family:inherit}' +
    '.pn-tile:hover{border-color:#1D9E75}.pn-tile .ic{font-size:28px}' +
    '.pn-tile .tt{display:block;font-size:16px;font-weight:bold;color:#222;margin-top:8px}' +
    '.pn-tile .ds{display:block;font-size:12px;color:#777;margin-top:3px}' +
    '.pn-tile .bd{display:inline-block;margin-top:8px;font-size:11px;background:#eee;color:#666;border-radius:20px;padding:2px 8px}' +
    '.pn-tile.off{opacity:.55;cursor:default}.pn-tile.off:hover{border-color:transparent}' +
    // escolha de representante (gestor/admin)
    '#es-lista{max-height:50vh;overflow:auto}' +
    '.es-item{display:flex;justify-content:space-between;gap:10px;padding:10px 12px;border:1px solid #e3e3e3;border-radius:8px;margin-bottom:8px;cursor:pointer;font-size:14px}' +
    '.es-item:hover{border-color:#1D9E75;background:#f4fbf8}.es-item.off{opacity:.5;cursor:default}.es-item span{color:#888}' +
    '#btn-voltar-painel{position:fixed;left:10px;bottom:10px;z-index:900;padding:9px 14px;border:0;border-radius:20px;background:#1D9E75;color:#fff;font-size:13px;font-weight:bold;box-shadow:0 2px 8px rgba(0,0,0,.25);cursor:pointer}';
  document.head.appendChild(css);

  var LOGO = 'https://drive.google.com/thumbnail?id=1xtobPLkiaoKzECRoMO3b4NMgb8i0bBc3&sz=w300';

  // ---------- utilidades ----------
  function el(html) { var d = document.createElement('div'); d.innerHTML = html; return d.firstElementChild; }
  function limpar(id) { var x = document.getElementById(id); if (x) x.remove(); }
  function brl(v) { return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  function getSessao() {
    try {
      var s = JSON.parse(localStorage.getItem(CHAVE));
      if (s && Date.now() - s.em < VALIDADE_MS) return s;
    } catch (e) {}
    localStorage.removeItem(CHAVE);
    return null;
  }
  function salvarSessao(s) { localStorage.setItem(CHAVE, JSON.stringify(s)); }

  function sair() {
    localStorage.removeItem(CHAVE);
    localStorage.removeItem('repre_cod');
    location.reload();
  }

  // Gestor/Admin: lembra o representante escolhido, para não perdê-lo ao recarregar a página
  function marcarRepre(r) {
    var s = getSessao();
    if (!s) return;
    s.repreEscolhido = true;
    if (r) s.repre = { codigo: r.codigoRepre, nome: r.nome };
    salvarSessao(s);
  }

  window.Sessao = { get: getSessao, sair: sair, marcarRepre: marcarRepre };

  function definirRepre(cod) {
    try { CODIGO_REPRE = cod || ''; } catch (e) {}
    if (cod) localStorage.setItem('repre_cod', cod); else localStorage.removeItem('repre_cod');
    if (cod && typeof atualizarExibicaoRepre === 'function') atualizarExibicaoRepre();
  }

  // Aplica a sessão no app: define o código do representante.
  // - REPRESENTANTE: fixo, vindo da planilha (e esconde o botão "Trocar").
  // - GESTOR/ADMIN: usa o representante escolhido na lista da equipe (se já escolheu).
  function aplicarSessao(sess) {
    var u = sess.usuario;
    var ehRepre = u.perfil === 'REPRESENTANTE';
    try {
      if (ehRepre) {
        CODIGO_REPRE = u.codigoRepre;
        localStorage.setItem('repre_cod', u.codigoRepre);
      } else if (sess.repre && sess.repre.codigo) {
        CODIGO_REPRE = sess.repre.codigo;
        localStorage.setItem('repre_cod', sess.repre.codigo);
      } else if (!sess.repreEscolhido) {
        CODIGO_REPRE = '';
        localStorage.removeItem('repre_cod');
      }
    } catch (e) {}
    var trocar = document.querySelector('#info-repre-box button');
    if (trocar) trocar.style.display = ehRepre ? 'none' : '';
    if (CODIGO_REPRE && typeof atualizarExibicaoRepre === 'function') atualizarExibicaoRepre();
  }

  // ---------- botão "Voltar ao painel" (aparece só na tela de pedido) ----------
  function botaoVoltar(mostrar) {
    var b = document.getElementById('btn-voltar-painel');
    if (!mostrar) { if (b) b.remove(); return; }
    if (b) return;
    b = el('<button id="btn-voltar-painel">← Painel</button>');
    b.onclick = mostrarPainel;
    document.body.appendChild(b);
  }

  // ---------- login ----------
  function mostrarLogin() {
    limpar('tela-painel'); limpar('tela-escolha');
    botaoVoltar(false);
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
          var sess = { token: res.token, usuario: res.usuario, equipe: res.equipe || [], em: Date.now() };
          salvarSessao(sess);
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

  // ---------- escolha do representante (só gestor/admin) ----------
  function abrirEscolha() {
    var sess = getSessao();
    if (!sess) return mostrarLogin();
    limpar('tela-escolha');
    var eq = (sess.equipe || []).slice().sort(function (a, b) { return String(a.nome).localeCompare(String(b.nome)); });
    var t = el(
      '<div id="tela-escolha"><div class="lg-card" style="max-width:420px">' +
      '<h1>Pedido para quem?</h1><p>Escolha o representante deste pedido.</p>' +
      '<input id="es-busca" placeholder="Buscar por nome ou código"><div id="es-lista"></div>' +
      '<button class="lg-btn lg-sec" id="es-cancel">Cancelar</button></div></div>');
    document.body.appendChild(t);
    var lista = document.getElementById('es-lista');

    function render() {
      var q = document.getElementById('es-busca').value.trim().toLowerCase();
      lista.innerHTML = '';
      var achou = 0;
      eq.forEach(function (r) {
        if (q && (r.nome + ' ' + r.codigoRepre).toLowerCase().indexOf(q) < 0) return;
        achou++;
        var d = document.createElement('div');
        d.className = 'es-item' + (r.codigoRepre ? '' : ' off');
        var n = document.createElement('b'); n.textContent = r.nome;
        var c = document.createElement('span'); c.textContent = r.codigoRepre || 'sem código';
        d.appendChild(n); d.appendChild(c);
        if (r.codigoRepre) d.onclick = function () {
          marcarRepre(r);
          definirRepre(r.codigoRepre);
          limpar('tela-escolha');
          abrirPedido();
        };
        lista.appendChild(d);
      });
      if (!achou) lista.innerHTML = '<p>Nenhum representante encontrado.</p>';
    }
    document.getElementById('es-busca').oninput = render;
    document.getElementById('es-cancel').onclick = function () {
      limpar('tela-escolha');
      // se ainda está sem representante dentro do pedido, volta ao painel
      if (!document.body.classList.contains('fora-do-pedido') && !CODIGO_REPRE) mostrarPainel();
    };
    render();
    document.getElementById('es-busca').focus();
  }

  // O "(Trocar)" do topo do pedido agora abre a lista da equipe (gestor/admin)
  window.abrirModalRepre = function () {
    var s = getSessao();
    if (s && s.usuario.perfil !== 'REPRESENTANTE') abrirEscolha();
  };

  // ---------- painel ----------
  function fazerPedido() {
    var sess = getSessao();
    if (!sess) return mostrarLogin();
    if (sess.usuario.perfil === 'REPRESENTANTE') return abrirPedido();
    if (sess.repre && sess.repre.codigo) { definirRepre(sess.repre.codigo); return abrirPedido(); }
    abrirEscolha();
  }

  // Para novos itens do menu, acrescente aqui. Sem "acao" aparece como "Em breve".
  var MENU = [
    { icone: '🛒', titulo: 'Fazer pedido', desc: 'Catálogo, carrinho e envio do pedido', acao: fazerPedido },
    { icone: '📦', titulo: 'Meus pedidos', desc: 'Acompanhe os pedidos enviados', acao: null },
    { icone: '🧾', titulo: 'Meus orçamentos', desc: 'Orçamentos salvos', acao: null }
  ];

  function mostrarPainel() {
    var sess = getSessao();
    if (!sess) return mostrarLogin();
    botaoVoltar(false);
    document.body.classList.add('fora-do-pedido');
    limpar('tela-painel'); limpar('tela-escolha');

    var u = sess.usuario, mes = new Date().getMonth();
    var ehRepre = u.perfil === 'REPRESENTANTE';
    var meta = ehRepre
      ? (u.metas || [])[mes]
      : (sess.equipe || []).reduce(function (a, r) { return a + ((r.metas || [])[mes] || 0); }, 0);

    var p = el(
      '<div id="tela-painel"><div class="pn-wrap">' +
      '<div class="pn-topo"><img src="' + LOGO + '" alt="Di Solle"><a id="pn-sair">Sair</a></div>' +
      '<div class="pn-ola"><div><small>Bem-vindo,</small><h1 id="pn-nome"></h1><span class="pn-perfil" id="pn-perfil"></span></div>' +
      '<div class="pn-meta"><small id="pn-meta-rot"></small><b id="pn-meta-val"></b></div></div>' +
      '<div id="pn-aviso"></div><div class="pn-grid" id="pn-grid"></div></div></div>');
    document.body.appendChild(p);
    document.getElementById('pn-nome').textContent = u.nome;
    document.getElementById('pn-perfil').textContent = PERFIS[u.perfil] || u.perfil;
    document.getElementById('pn-meta-rot').textContent = (ehRepre ? 'Sua meta mensal' : 'Meta mensal da equipe') + ' · ' + MESES[mes];
    document.getElementById('pn-meta-val').textContent = meta ? brl(meta) : 'não cadastrada';
    document.getElementById('pn-sair').onclick = sair;

    var semCodigo = ehRepre && !u.codigoRepre;
    if (semCodigo) {
      var av = document.getElementById('pn-aviso');
      av.className = 'pn-aviso';
      av.textContent = 'Seu usuário está sem código de representante. Avise a gestão.';
    }
    var grid = document.getElementById('pn-grid');
    MENU.forEach(function (m) {
      var ativo = !!m.acao && !(semCodigo && m.acao === fazerPedido);
      var b = document.createElement('button');
      b.className = 'pn-tile' + (ativo ? '' : ' off');
      b.innerHTML = '<span class="ic">' + m.icone + '</span><span class="tt"></span><span class="ds"></span>' +
                    (m.acao ? '' : '<span class="bd">Em breve</span>');
      b.querySelector('.tt').textContent = m.titulo;
      b.querySelector('.ds').textContent = m.desc;
      if (ativo) b.onclick = m.acao;
      grid.appendChild(b);
    });
  }

  function abrirPedido() {
    limpar('tela-painel'); limpar('tela-escolha');
    document.body.classList.remove('fora-do-pedido');
    botaoVoltar(true);
    if (CODIGO_REPRE && typeof atualizarExibicaoRepre === 'function') atualizarExibicaoRepre();
  }

  window.voltarAoPainel = mostrarPainel;

  // ---------- início (roda antes do 16-init.js) ----------
  var sess = getSessao();
  if (sess) { aplicarSessao(sess); mostrarPainel(); }
  else { mostrarLogin(); }
})();
