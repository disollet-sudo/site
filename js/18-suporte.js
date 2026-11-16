/* js/18-suporte.js
 * Suporte remoto: o dono vê a tela do app em tempo real, aponta e (se o usuário permitir) controla.
 * Só o app é transmitido (estrutura da página via rrweb), não o aparelho. Funciona em PC e celular.
 * Transporte: Firebase Realtime Database por REST + EventSource (sem SDK dentro do app).
 */
(function () {
  'use strict';

  // ===== CONFIGURAR =====
  var DB_URL = 'https://disolle-suporte-default-rtdb.firebaseio.com';
  // ======================

  var RRWEB = 'https://cdn.jsdelivr.net/npm/rrweb@1.1.3/dist/rrweb.min.js';
  var S = { sid: null, nome: '', perm: false, stop: null, es: null, buf: [], novo: true, env: false, visto: {}, tm: [] };
  var ui = {};

  var CSS = [
    '.dsp-ui{font:14px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;color:#1b2430;box-sizing:border-box}',
    '.dsp-ui *{box-sizing:border-box}',
    '.dsp-btn{position:fixed;left:14px;bottom:14px;z-index:2147483000;display:flex;align-items:center;gap:8px;padding:9px 14px 9px 10px;border:0;border-radius:999px;background:#1b2430;color:#fff;font-weight:600;box-shadow:0 2px 10px rgba(0,0,0,.25);cursor:pointer}',
    '.dsp-btn i{width:22px;height:22px;border-radius:50%;background:#fff;color:#1b2430;display:grid;place-items:center;font-style:normal;font-weight:700}',
    '.dsp-fundo{position:fixed;inset:0;z-index:2147483001;background:rgba(15,20,28,.55);display:grid;place-items:center;padding:16px}',
    '.dsp-card{width:100%;max-width:380px;background:#fff;border-radius:12px;padding:20px;display:grid;gap:12px}',
    '.dsp-card h3{margin:0;font-size:17px}',
    '.dsp-card p{margin:0;color:#44505f}',
    '.dsp-card input[type=text]{width:100%;padding:10px;border:1px solid #b8c0cc;border-radius:8px;font:inherit}',
    '.dsp-chk{display:flex;gap:8px;align-items:flex-start}',
    '.dsp-chk input{margin-top:3px}',
    '.dsp-acoes{display:flex;gap:8px;justify-content:flex-end}',
    '.dsp-acoes button{padding:9px 14px;border-radius:8px;border:1px solid #b8c0cc;background:#fff;color:#1b2430;font:inherit;font-weight:600;cursor:pointer}',
    '.dsp-acoes .dsp-ok{background:#0f766e;border-color:#0f766e;color:#fff}',
    '.dsp-pill{position:fixed;left:14px;bottom:84px;z-index:2147483000;display:flex;align-items:center;gap:8px;padding:6px 6px 6px 12px;border-radius:999px;background:#0f766e;color:#fff;font-weight:600;box-shadow:0 2px 10px rgba(0,0,0,.25)}',
    '.dsp-pill button{border:0;border-radius:999px;padding:6px 10px;background:rgba(255,255,255,.18);color:#fff;font:inherit;font-weight:600;cursor:pointer}',
    '.dsp-pill button[data-a=fim]{background:#fff;color:#0f766e}',
    '.dsp-ptr{position:fixed;left:0;top:0;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;border:3px solid #e11d74;background:rgba(225,29,116,.18);z-index:2147483002;pointer-events:none;display:none}',
    '.dsp-anel{position:fixed;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;border:4px solid #e11d74;z-index:2147483002;pointer-events:none;animation:dsp-a 1.6s ease-out forwards}',
    '@keyframes dsp-a{from{transform:scale(.6);opacity:1}to{transform:scale(3.2);opacity:0}}',
    '@media (prefers-reduced-motion:reduce){.dsp-anel{animation:none}}'
  ].join('\n');

  // ---------- utilidades ----------
  function rid() {
    var a = new Uint8Array(12); crypto.getRandomValues(a);
    return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }
  function http(m, p, b) {
    return fetch(DB_URL + '/suporte/' + p + '.json', { method: m, body: b === undefined ? undefined : JSON.stringify(b) })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r; });
  }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; }
  function ss(k, v) { try { if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch (e) {} }
  function carregarRrweb() {
    return new Promise(function (ok, erro) {
      if (window.rrweb && window.rrweb.record) return ok();
      var s = document.createElement('script');
      s.src = RRWEB; s.onload = ok; s.onerror = function () { erro(new Error('rrweb')); };
      document.head.appendChild(s);
    });
  }

  // ---------- interface ----------
  function montar() {
    var st = el('style'); st.textContent = CSS; document.head.appendChild(st);
    var host = document.getElementById('icons-actions'); // barra de botões da tela inicial
    if (host) {
      ui.btn = el('button', 'btn-icon-label', '🛠️ Suporte');
      ui.btn.title = 'Pedir ajuda: o suporte passa a ver a tela deste app';
      host.appendChild(ui.btn);
    } else { // reserva: botão flutuante, caso a barra não exista
      ui.btn = el('button', 'dsp-ui dsp-btn', '<i>?</i>Suporte');
      document.body.appendChild(ui.btn);
    }
    ui.btn.type = 'button'; ui.btn.onclick = pedir;
    ui.ptr = el('div', 'dsp-ui dsp-ptr');
    document.body.appendChild(ui.ptr);
    var sid = null; try { sid = sessionStorage.getItem('dsp_sid'); } catch (e) {}
    if (sid) iniciar(sessionStorage.getItem('dsp_nome') || '', sessionStorage.getItem('dsp_perm') === '1', sid);
  }

  function pedir() {
    var f = el('div', 'dsp-ui dsp-fundo');
    f.innerHTML =
      '<div class="dsp-card"><h3>Pedir ajuda ao suporte</h3>' +
      '<p>O suporte vai ver o que aparece neste app, e só ele. Senhas digitadas não são enviadas.</p>' +
      '<input type="text" id="dsp-nome" placeholder="Seu nome" maxlength="40">' +
      '<label class="dsp-chk"><input type="checkbox" id="dsp-perm"><span>Permitir que o suporte também clique e digite por mim</span></label>' +
      '<div class="dsp-acoes"><button type="button" id="dsp-cancel">Cancelar</button><button type="button" class="dsp-ok" id="dsp-go">Iniciar</button></div></div>';
    document.body.appendChild(f);
    var n = f.querySelector('#dsp-nome');
    try { n.value = localStorage.getItem('dsp_nome') || ''; } catch (e) {}
    f.querySelector('#dsp-cancel').onclick = function () { f.remove(); };
    f.querySelector('#dsp-go').onclick = function () {
      var nome = n.value.trim();
      if (!nome) { n.focus(); return; }
      try { localStorage.setItem('dsp_nome', nome); } catch (e) {}
      var p = f.querySelector('#dsp-perm').checked;
      f.remove(); iniciar(nome, p);
    };
  }

  function pill() {
    ui.pill = el('div', 'dsp-ui dsp-pill',
      '<span>Suporte ao vivo ' + S.sid.slice(0, 4).toUpperCase() + '</span>' +
      '<button type="button" data-a="ctl"></button><button type="button" data-a="fim">Encerrar</button>');
    var ctl = ui.pill.querySelector('[data-a=ctl]');
    function txt() { ctl.textContent = 'Controle: ' + (S.perm ? 'liberado' : 'bloqueado'); }
    txt();
    ctl.onclick = function () { S.perm = !S.perm; ss('dsp_perm', S.perm ? '1' : '0'); txt(); batida(); };
    ui.pill.querySelector('[data-a=fim]').onclick = encerrar;
    document.body.appendChild(ui.pill);
  }

  // ---------- sessão ----------
  function iniciar(nome, perm, sid) {
    S.sid = sid || rid(); S.nome = nome; S.perm = !!perm; S.novo = true; S.buf = []; S.visto = {};
    ss('dsp_sid', S.sid); ss('dsp_nome', nome); ss('dsp_perm', S.perm ? '1' : '0');
    ui.btn.style.display = 'none';
    carregarRrweb().then(function () {
      http('PATCH', 'meta/' + S.sid, {
        nome: S.nome, codigo: S.sid.slice(0, 4).toUpperCase(), inicio: { '.sv': 'timestamp' }, vistoEm: { '.sv': 'timestamp' },
        controle: S.perm, tela: innerWidth + 'x' + innerHeight, ua: navigator.userAgent.slice(0, 120)
      }).catch(function () {});
      S.stop = rrweb.record({
        emit: emitir,
        checkoutEveryNms: 600000,
        maskInputOptions: { password: true },
        sampling: { mousemove: false, scroll: 150, input: 'last' }
      });
      S.tm.push(setInterval(enviar, 300), setInterval(batida, 10000));
      pill(); escutar();
    }).catch(function () {
      alert('Não foi possível iniciar o suporte. Verifique a internet e tente de novo.');
      encerrar();
    });
  }

  function encerrar() {
    try { if (S.stop) S.stop(); } catch (e) {}
    S.tm.forEach(clearInterval); S.tm = [];
    if (S.es) { S.es.close(); S.es = null; }
    if (S.sid) {
      http('DELETE', 'ev/' + S.sid).catch(function () {});
      http('DELETE', 'meta/' + S.sid).catch(function () {});
    }
    S.sid = null; S.stop = null;
    ss('dsp_sid', null); ss('dsp_nome', null); ss('dsp_perm', null);
    if (ui.pill) { ui.pill.remove(); ui.pill = null; }
    ui.ptr.style.display = 'none';
    ui.btn.style.display = '';
  }

  function batida() {
    if (!S.sid) return;
    http('PATCH', 'meta/' + S.sid, { vistoEm: { '.sv': 'timestamp' }, controle: S.perm }).catch(function () {});
  }

  // ---------- envio da tela ----------
  function emitir(ev, checkout) {
    if (checkout && ev.type === 4) { S.buf = []; S.novo = true; } // novo ponto de partida: descarta o que ficou para trás
    S.buf.push(ev);
  }

  // Comprime o lote (gzip nativo do navegador): o catálogo grande fica ~10x menor e chega bem mais rápido
  function comprimir(txt) {
    if (!window.CompressionStream) return Promise.resolve({ e: txt });
    var cs = new CompressionStream('gzip'), w = cs.writable.getWriter();
    w.write(new TextEncoder().encode(txt)); w.close();
    return new Response(cs.readable).arrayBuffer().then(function (buf) {
      var b = new Uint8Array(buf), s = '', n = 0x8000;
      for (var i = 0; i < b.length; i += n) s += String.fromCharCode.apply(null, b.subarray(i, i + n));
      return { e: btoa(s), z: 1 };
    });
  }

  function enviar() {
    if (S.env || !S.buf.length || !S.sid) return;
    S.env = true;
    var lote = S.buf; S.buf = [];
    var apagar = S.novo; S.novo = false;
    var passo = apagar ? http('DELETE', 'ev/' + S.sid) : Promise.resolve();
    passo.then(function () { return comprimir(JSON.stringify(lote)); })
      .then(function (p) { return http('POST', 'ev/' + S.sid, p); })
      .catch(function () { if (apagar) S.novo = true; if (!S.novo) S.buf = lote.concat(S.buf); })
      .then(function () { S.env = false; });
  }

  // ---------- comandos do suporte ----------
  function escutar() {
    var es = new EventSource(DB_URL + '/suporte/cmd/' + S.sid + '.json'); S.es = es;
    function ler(m) {
      var d; try { d = JSON.parse(m.data); } catch (e) { return; }
      tratar(d.path, d.data);
    }
    es.addEventListener('put', ler); es.addEventListener('patch', ler);
  }

  function tratar(path, data) {
    if (path === '/') { // estado inicial ou reconexão: só marca como já visto
      if (data && data.acoes) Object.keys(data.acoes).forEach(function (k) { S.visto[k] = 1; });
      return;
    }
    var p = path.split('/').filter(Boolean);
    if (p[0] === 'ptr') return apontar(data);
    if (p[0] === 'acoes') {
      if (p.length === 1) { if (data) Object.keys(data).forEach(function (k) { executar(k, data[k]); }); }
      else executar(p[1], data);
    }
  }

  function executar(id, a) { if (!a || S.visto[id]) return; S.visto[id] = 1; acao(a); }

  function apontar(d) {
    if (!d || d.x < 0) { ui.ptr.style.display = 'none'; return; }
    ui.ptr.style.display = 'block'; ui.ptr.style.left = d.x + 'px'; ui.ptr.style.top = d.y + 'px';
  }

  function anel(x, y) {
    var a = el('div', 'dsp-ui dsp-anel'); a.style.left = x + 'px'; a.style.top = y + 'px';
    document.body.appendChild(a); setTimeout(function () { a.remove(); }, 1700);
  }

  function acao(a) {
    if (a.tipo === 'anel') return anel(a.x, a.y);
    if (a.tipo === 'resync') return resync(false);
    if (!S.perm) return; // as ações abaixo só rodam com a permissão do usuário
    if (a.tipo === 'clique') return clicar(a.x, a.y);
    if (a.tipo === 'rolar') return rolar(a.x, a.y, a.dx || 0, a.dy || 0);
    if (a.tipo === 'tecla') return digitar(a.k);
  }

  // Manda uma foto nova e completa da tela (corrige qualquer diferença entre o app e o painel)
  var ultimoRs = 0;
  function resync(auto) {
    var t = Date.now();
    if (!S.sid || t - ultimoRs < (auto ? 4000 : 1500)) return;
    ultimoRs = t;
    try { rrweb.record.takeFullSnapshot(true); } catch (e) {}
  }

  function elEm(x, y) { var e = document.elementFromPoint(x, y); return e && !e.closest('.dsp-ui') ? e : null; }

  function clicar(x, y) {
    var e = elEm(x, y); if (!e) return;
    anel(x, y);
    try { if (e.focus) e.focus(); } catch (er) {}
    e.click();
    setTimeout(function () { resync(true); }, 900); // garante que pop-ups abertos pelo clique apareçam no painel
  }

  function rolavel(e) {
    while (e && e !== document.body && e !== document.documentElement) {
      var o = getComputedStyle(e).overflowY;
      if ((o === 'auto' || o === 'scroll') && e.scrollHeight > e.clientHeight) return e;
      e = e.parentElement;
    }
    return null;
  }

  function rolar(x, y, dx, dy) {
    var c = rolavel(elEm(x, y));
    if (c) c.scrollBy(dx, dy); else window.scrollBy(dx, dy);
  }

  function digitar(k) {
    var e = document.activeElement;
    if (!e || typeof k !== 'string' || !k) return;
    if (e.tagName === 'SELECT') { // lista: escolhe a opção que começa com o texto digitado (ex.: "RS", "28")
      var agora = Date.now();
      S.tb = ((S.tbT && agora - S.tbT < 1500) ? S.tb : '') + k; S.tbT = agora;
      var q = S.tb.toLowerCase();
      for (var i = 0; i < e.options.length; i++) {
        if (e.options[i].text.toLowerCase().indexOf(q) === 0 || e.options[i].value.toLowerCase() === q) {
          e.selectedIndex = i; e.dispatchEvent(new Event('change', { bubbles: true })); break;
        }
      }
      return;
    }
    if (!/^(INPUT|TEXTAREA)$/.test(e.tagName)) return;
    var v = e.value, nv = k === 'Backspace' ? v.slice(0, -1) : v + k;
    var proto = e.tagName === 'INPUT' ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(e, nv);
    e.dispatchEvent(new Event('input', { bubbles: true }));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar); else montar();
})();
