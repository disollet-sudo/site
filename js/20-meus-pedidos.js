/* =============================================
   Di Solle — 20. MEUS PEDIDOS
   Painel > "Meus pedidos": tela de carregamento e depois a lista dos
   pedidos enviados (PDFs da pasta Pedidos no Drive), com representante,
   cliente e data. Representante vê os seus; gestor, a equipe; admin, todos.
   Carregar DEPOIS do 19-login.js.
   Depende de: 19-login.js (window.Sessao.get / .api / .sair)
   ============================================= */
(function () {
  'use strict';

  var dadosAtuais = [];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function norm(s) {
    return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  // ---------- estilos ----------
  function injetarEstilos() {
    if (document.getElementById('mp-style')) return;
    var st = document.createElement('style');
    st.id = 'mp-style';
    st.textContent =
      '#mp-overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:100000;display:flex;align-items:flex-end;justify-content:center;font-family:Arial,sans-serif}' +
      '#mp-box{background:#fff;width:100%;max-width:580px;max-height:90vh;border-radius:16px 16px 0 0;display:flex;flex-direction:column;overflow:hidden}' +
      '@media(min-width:600px){#mp-overlay{align-items:center}#mp-box{border-radius:16px}}' +
      '.mp-head{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid #e5e5e5;font-weight:bold;font-size:17px;color:#0f6e56}' +
      '.mp-x{border:none;background:none;font-size:26px;line-height:1;cursor:pointer;color:#666;padding:2px 8px}' +
      '.mp-body{overflow-y:auto;padding:12px 16px 20px;-webkit-overflow-scrolling:touch}' +
      '.mp-busca{width:100%;padding:10px;margin-bottom:8px;border:1px solid #ccc;border-radius:8px;font-size:15px;box-sizing:border-box}' +
      '.mp-load{text-align:center;padding:44px 10px;color:#555;font-size:15px}' +
      '.mp-spin{width:44px;height:44px;margin:0 auto 14px;border:4px solid #E1F5EE;border-top-color:#1D9E75;border-radius:50%;animation:mpspin .8s linear infinite}' +
      '@keyframes mpspin{to{transform:rotate(360deg)}}' +
      '.mp-sum{font-size:13px;color:#555;margin:2px 0 10px}' +
      '.mp-item{border:1px solid #e1e1e1;border-radius:10px;padding:11px 12px;margin-bottom:9px;background:#fafafa}' +
      '.mp-cli{font-weight:bold;font-size:15px;color:#222;margin-bottom:3px}' +
      '.mp-rep{font-size:13px;color:#666}' +
      '.mp-row{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:8px}' +
      '.mp-data{font-size:13px;color:#0f6e56;font-weight:bold}' +
      '.mp-ok{display:inline-block;margin-left:6px;font-size:11px;background:#E1F5EE;color:#0f6e56;border-radius:20px;padding:1px 8px}' +
      '.mp-pdf{background:#1D9E75;color:#fff;text-decoration:none;font-weight:bold;font-size:13px;padding:7px 14px;border-radius:8px;white-space:nowrap}' +
      '.mp-vazio,.mp-erro{text-align:center;padding:30px 10px;color:#555;font-size:15px}' +
      '.mp-erro button{margin-top:12px;background:#1D9E75;color:#fff;border:none;border-radius:8px;padding:9px 20px;font-size:14px;font-weight:bold;cursor:pointer}';
    document.head.appendChild(st);
  }

  // ---------- modal ----------
  function fechar() {
    var o = document.getElementById('mp-overlay');
    if (o) o.remove();
  }

  function abrirModal() {
    fechar();
    injetarEstilos();
    var o = document.createElement('div');
    o.id = 'mp-overlay';
    o.innerHTML =
      '<div id="mp-box">' +
        '<div class="mp-head"><span>📦 Meus pedidos</span><button class="mp-x" id="mp-fechar" aria-label="Fechar">×</button></div>' +
        '<div class="mp-body" id="mp-body"></div>' +
      '</div>';
    o.addEventListener('click', function (e) { if (e.target === o) fechar(); });
    document.body.appendChild(o);
    document.getElementById('mp-fechar').onclick = fechar;
  }

  function corpo(html) {
    var b = document.getElementById('mp-body');
    if (b) b.innerHTML = html;
  }

  function mostrarCarregando() {
    corpo('<div class="mp-load"><div class="mp-spin"></div>Carregando seus pedidos...</div>');
  }

  function mostrarErro(msg, expirou) {
    corpo('<div class="mp-erro">' + (expirou ? 'Sua sessão expirou.' : 'Não consegui carregar os pedidos.') +
          '<br><small>' + esc(msg) + '</small><br>' +
          '<button id="mp-retry">' + (expirou ? 'Entrar de novo' : 'Tentar de novo') + '</button></div>');
    var r = document.getElementById('mp-retry');
    if (r) r.onclick = function () {
      if (expirou && window.Sessao) { window.Sessao.sair(); } else { carregar(); }
    };
  }

  // ---------- lista ----------
  function itensHtml(lista) {
    if (!lista.length) return '<div class="mp-vazio">Nenhum pedido encontrado.</div>';
    return lista.map(function (p) {
      return '<div class="mp-item">' +
               '<div class="mp-cli">' + esc(p.cliente) + '</div>' +
               '<div class="mp-rep">Representante: ' + esc(p.rep) + '</div>' +
               '<div class="mp-row">' +
                 '<span class="mp-data">' + esc(p.data) + (p.hora ? ' às ' + esc(p.hora) : '') +
                   (p.ok ? '<span class="mp-ok">✓ ok</span>' : '') + '</span>' +
                 '<a class="mp-pdf" href="' + esc(p.url) + '" target="_blank" rel="noopener">Abrir PDF</a>' +
               '</div>' +
             '</div>';
    }).join('');
  }

  function mostrarLista(lista) {
    dadosAtuais = lista;
    if (!lista.length) {
      corpo('<div class="mp-vazio">Você ainda não tem pedidos enviados.</div>');
      return;
    }
    corpo(
      '<input class="mp-busca" id="mp-busca" placeholder="Buscar por cliente ou representante" autocomplete="off">' +
      '<div class="mp-sum" id="mp-sum"></div><div id="mp-itens"></div>'
    );
    function desenhar() {
      var q = norm(document.getElementById('mp-busca').value.trim());
      var f = !q ? dadosAtuais : dadosAtuais.filter(function (p) {
        return norm(p.cliente + ' ' + p.rep).indexOf(q) >= 0;
      });
      document.getElementById('mp-sum').textContent = f.length + (f.length === 1 ? ' pedido' : ' pedidos');
      document.getElementById('mp-itens').innerHTML = itensHtml(f);
    }
    document.getElementById('mp-busca').oninput = desenhar;
    desenhar();
  }

  // ---------- busca no Apps Script ----------
  function carregar() {
    mostrarCarregando();
    var S = window.Sessao;
    var sess = S && S.get && S.get();
    var api = S && S.api && S.api();

    if (!sess) { mostrarErro('Faça login novamente.', true); return; }
    if (!api) { mostrarErro('URL do Apps Script não encontrada.'); return; }

    var ctrl = ('AbortController' in window) ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 40000);

    fetch(api, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ acao: 'listar_pedidos', token: sess.token }),
      signal: ctrl ? ctrl.signal : undefined
    })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        clearTimeout(timer);
        if (!res || res.status !== 'success') {
          var e = new Error((res && res.message) || 'Resposta inválida do servidor.');
          e.expirou = !!(res && res.expirou);
          throw e;
        }
        mostrarLista(res.pedidos || []);
      })
      .catch(function (e) {
        clearTimeout(timer);
        var msg = e && e.name === 'AbortError' ? 'Demorou demais para responder.' : (e && e.message) || String(e);
        mostrarErro(msg, !!(e && e.expirou));
      });
  }

  window.abrirMeusPedidos = function () {
    abrirModal();
    carregar();
  };
})();
