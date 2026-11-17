/* =============================================
   Di Solle — 21. PAINEL DE GESTÃO (gestor e admin)
   - Cabeçalho do painel: meta e valor vendido no mês
     (admin = todos os representantes; gestor = só os da sua equipe).
   - Coluna da direita: Top 5 do mês.
   - Botão "Representantes": lista com meta e valor vendido de cada um,
     com edição (o servidor confere o login: gestor só edita a própria equipe).
   Carregar DEPOIS do 19-login.js.
   Depende de: 19-login.js (window.Sessao.get / .api / .sair)
   ============================================= */
(function () {
  'use strict';

  var MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  var TTL = 2 * 60 * 1000;      // reaproveita o resultado por 2 min
  var cache = {};               // { 'atual' | '0'..'11': { ts, token, res } }
  var mesModal = null;          // mês (0..11) aberto na tela Representantes; null = mês atual

  // ---------- utilidades ----------
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function brl(v) { return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  function fmtNum(v) { return (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function norm(s) { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
  function sessao() { return window.Sessao && window.Sessao.get && window.Sessao.get(); }
  function ehGestao(s) { return !!(s && s.usuario && (s.usuario.perfil === 'GESTOR' || s.usuario.perfil === 'ADMIN')); }
  function pctMeta(vendido, meta) { return meta > 0 ? Math.round((vendido / meta) * 100) : null; }

  // "10.000,50" / "10000,5" / "10000.5" / "R$ 1.500" -> número (vazio -> null, inválido -> NaN)
  function lerNumero(txt) {
    var s = String(txt == null ? '' : txt).replace(/[R$\s]/g, '');
    if (s === '') return null;
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    var n = parseFloat(s);
    return isNaN(n) ? NaN : n;
  }

  function estilos() {
    if (document.getElementById('pg-style')) return;
    var st = document.createElement('style');
    st.id = 'pg-style';
    st.textContent =
      // layout do painel: duas colunas no computador, empilhado no celular
      '#pn-gestao{margin-top:18px}' +
      '@media(min-width:900px){' +
        '#tela-painel .pn-wrap.pg-duas{max-width:1120px;display:grid;grid-template-columns:minmax(0,1fr) 360px;column-gap:18px;align-items:start}' +
        '.pg-duas>.pn-topo{grid-column:1/-1}' +
        '.pg-duas>.pn-ola,.pg-duas>#pn-aviso,.pg-duas>.pn-grid{grid-column:1}' +
        '.pg-duas>#pn-gestao{grid-column:2;grid-row:2/span 3;margin-top:0}' +
      '}' +
      '.pg-duas .pn-meta{min-width:230px}' +
      '#pg-vendido{margin-top:12px;padding-top:10px;border-top:1px solid #e8eeeb}' +
      '#pg-vendido small{color:#777;font-size:13px;display:block}' +
      '#pg-vendido b{display:block;font-size:22px;color:#0f6e56;margin:2px 0}' +
      '#pg-vendido .pg-sub{font-size:12px;color:#777}' +
      '.pg-card{background:#fff;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,.06);padding:18px 20px;font-family:Arial,sans-serif}' +
      '.pg-load{text-align:center;color:#666;font-size:14px;padding:26px}' +
      '.pg-spin{width:34px;height:34px;margin:0 auto 10px;border:4px solid #E1F5EE;border-top-color:#1D9E75;border-radius:50%;animation:pgspin .8s linear infinite}' +
      '@keyframes pgspin{to{transform:rotate(360deg)}}' +
      '.pg-tit{font-size:13px;color:#777;font-weight:bold;text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px}' +
      '.pg-sub{font-size:13px;color:#666;line-height:1.5}' +
      '.pg-aviso{margin-top:8px;font-size:12px;color:#8a5a00;background:#fff4e5;border-radius:8px;padding:8px 10px}' +
      '.pg-track{height:9px;background:#e9efec;border-radius:20px;overflow:hidden;margin-top:8px}' +
      '.pg-fill{height:100%;background:#1D9E75;border-radius:20px}' +
      '.pg-top{display:flex;align-items:center;gap:10px;margin-top:13px}' +
      '.pg-pos{width:28px;text-align:center;font-size:19px;flex:none}' +
      '.pg-top-corpo{flex:1;min-width:0}' +
      '.pg-top-linha{display:flex;justify-content:space-between;gap:8px;font-size:14px}' +
      '.pg-top-linha b{color:#222;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.pg-top-linha span{color:#0f6e56;font-weight:bold;white-space:nowrap}' +
      '.pg-vazio{color:#777;font-size:14px;padding:10px 0}' +
      '.pg-erro{text-align:center;color:#555;font-size:14px;padding:20px}' +
      '.pg-erro button{margin-top:10px;background:#1D9E75;color:#fff;border:0;border-radius:8px;padding:8px 18px;font-weight:bold;cursor:pointer}' +
      // tela Representantes
      '#pg-overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:100000;display:flex;align-items:flex-end;justify-content:center;font-family:Arial,sans-serif}' +
      '#pg-box{background:#fff;width:100%;max-width:680px;max-height:94vh;border-radius:16px 16px 0 0;display:flex;flex-direction:column;overflow:hidden}' +
      '@media(min-width:700px){#pg-overlay{align-items:center}#pg-box{border-radius:16px}}' +
      '.pg-head{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid #e5e5e5;font-weight:bold;font-size:17px;color:#0f6e56}' +
      '.pg-head button{border:none;background:none;cursor:pointer;color:#666}' +
      '.pg-x{font-size:26px;line-height:1;padding:2px 8px}' +
      '.pg-upd{font-size:13px;color:#1D9E75!important;font-weight:bold;margin-right:6px}' +
      '.pg-body{overflow-y:auto;padding:12px 16px 22px;-webkit-overflow-scrolling:touch}' +
      '.pg-filtros{display:flex;gap:8px;margin:8px 0}' +
      '.pg-busca,.pg-mes{padding:10px;border:1px solid #ccc;border-radius:8px;font-size:15px;box-sizing:border-box;background:#fff}' +
      '.pg-busca{flex:1;min-width:0}' +
      '.pg-resumo{font-size:13px;color:#555;line-height:1.6}' +
      '#pg-status{min-height:18px;font-size:13px;text-align:center;font-weight:bold;color:#0f6e56;margin-top:4px}' +
      '#pg-status.pg-bad{color:#c0392b}' +
      '.pg-rep{border:1px solid #e1e1e1;border-radius:10px;padding:11px 12px;margin-top:10px;background:#fafafa}' +
      '.pg-rep-topo{display:flex;justify-content:space-between;gap:8px;align-items:baseline}' +
      '.pg-rep-topo b{font-size:15px;color:#222}' +
      '.pg-rep-topo small{color:#888;font-size:12px;text-align:right}' +
      '.pg-campos{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-top:8px}' +
      '.pg-campos label{font-size:12px;color:#666;display:block}' +
      '.pg-in{width:100%;margin-top:3px;padding:9px;border:1px solid #ccc;border-radius:8px;font-size:15px;box-sizing:border-box;text-align:right}' +
      '.pg-in.pg-ed{border-color:#1D9E75;background:#f4fbf8}' +
      '.pg-in.pg-inv{border-color:#c0392b}' +
      '.pg-baixo{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:8px;font-size:12px;color:#777}' +
      '.pg-salvar{background:#1D9E75;color:#fff;border:0;border-radius:8px;padding:8px 18px;font-size:14px;font-weight:bold;cursor:pointer;flex:none}' +
      '.pg-salvar:disabled{background:#cfd8d4;cursor:default}' +
      '.pg-auto{background:none;border:0;color:#1D9E75;font-size:12px;cursor:pointer;text-decoration:underline;padding:0}';
    document.head.appendChild(st);
  }

  // ---------- busca no Apps Script ----------
  function chamar(corpo, ms) {
    var s = sessao();
    var api = window.Sessao && window.Sessao.api && window.Sessao.api();
    if (!s) return Promise.reject(Object.assign(new Error('Faça login novamente.'), { expirou: true }));
    if (!api) return Promise.reject(new Error('URL do Apps Script não encontrada.'));
    corpo.token = s.token;
    var ctrl = ('AbortController' in window) ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, ms || 45000);
    return fetch(api, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(corpo),
      signal: ctrl ? ctrl.signal : undefined
    })
      .then(function (r) { return r.json(); })
      .then(function (res) { clearTimeout(timer); return res; })
      .catch(function (e) {
        clearTimeout(timer);
        if (e && e.name === 'AbortError') throw new Error('Demorou demais para responder.');
        throw e;
      });
  }

  function buscar(mesIdx, forcar) {
    var s = sessao();
    var chave = mesIdx == null ? 'atual' : String(mesIdx);
    var c = cache[chave];
    if (!forcar && s && c && c.token === s.token && Date.now() - c.ts < TTL) return Promise.resolve(c.res);
    var corpo = { acao: 'resumo_equipe' };
    if (mesIdx != null) corpo.mesIdx = mesIdx;
    return chamar(corpo).then(function (res) {
      if (!res || res.status !== 'success' || !Array.isArray(res.equipe)) {
        var e = new Error((res && res.message) || 'O servidor ainda não tem a função de resumo (publique a nova versão do Apps Script).');
        e.expirou = !!(res && res.expirou);
        throw e;
      }
      cache[chave] = { ts: Date.now(), token: s.token, res: res };
      return res;
    });
  }

  function erroHtml(e, idBtn, titulo) {
    return '<div class="pg-erro">' + (e && e.expirou ? 'Sua sessão expirou.' : titulo) +
      '<br><small>' + esc(e && e.message || e) + '</small><br><button id="' + idBtn + '">' +
      (e && e.expirou ? 'Entrar de novo' : 'Tentar de novo') + '</button></div>';
  }

  // ---------- painel inicial ----------
  function atualizarCabecalho(res) {
    var rot = document.getElementById('pn-meta-rot'), val = document.getElementById('pn-meta-val');
    if (!rot || !val) return;
    var t = res.totais, nomeMes = MESES[res.mesIdx] || '';
    rot.textContent = (res.perfil === 'ADMIN' ? 'Meta de todos os representantes' : 'Meta dos seus representantes') + ' · ' + nomeMes;
    val.textContent = t.meta ? brl(t.meta) : 'não cadastrada';

    var antigo = document.getElementById('pg-vendido');
    if (antigo) antigo.remove();
    var pct = pctMeta(t.vendido, t.meta);
    var d = document.createElement('div');
    d.id = 'pg-vendido';
    if (res.temValores) {
      d.innerHTML = '<small>Vendido no mês</small><b>' + esc(brl(t.vendido)) + '</b>' +
        '<div class="pg-sub">' + (pct !== null ? pct + '% da meta · ' : '') + t.pedidos + (t.pedidos === 1 ? ' pedido' : ' pedidos') + '</div>' +
        (pct !== null ? '<div class="pg-track"><div class="pg-fill" style="width:' + Math.min(pct, 100) + '%"></div></div>' : '');
    } else {
      d.innerHTML = '<small>Pedidos no mês</small><b>' + t.pedidos + '</b>' +
        '<div class="pg-sub">Valores vendidos ainda não registrados. Informe em Representantes.</div>';
    }
    val.parentNode.appendChild(d);
  }

  function medalha(i) { return ['🥇', '🥈', '🥉', '4º', '5º'][i] || (i + 1) + 'º'; }

  function desenharTop5(box, res) {
    var nomeMes = MESES[res.mesIdx] || '';
    var h = '<div class="pg-card"><div class="pg-tit">🏆 Top 5 · ' + esc(nomeMes) + '</div>';
    if (!res.top5.length) {
      h += '<div class="pg-vazio">Ainda não há pedidos neste mês.</div>';
    } else {
      var chave = res.temValores ? 'vendido' : 'pedidos';
      var max = res.top5[0][chave] || 1;
      res.top5.forEach(function (r, i) {
        var txt = res.temValores ? brl(r.vendido) : r.pedidos + (r.pedidos === 1 ? ' pedido' : ' pedidos');
        h += '<div class="pg-top"><div class="pg-pos">' + medalha(i) + '</div><div class="pg-top-corpo">' +
             '<div class="pg-top-linha"><b>' + esc(r.nome) + '</b><span>' + esc(txt) + '</span></div>' +
             '<div class="pg-track" style="margin-top:5px"><div class="pg-fill" style="width:' + Math.max(4, Math.round((r[chave] / max) * 100)) + '%"></div></div>' +
             '</div></div>';
      });
      if (!res.temValores) h += '<div class="pg-aviso">Ranking por quantidade de pedidos (valores ainda não registrados).</div>';
    }
    box.innerHTML = h + '</div>';
  }

  function montar() {
    var box = document.getElementById('pn-gestao');
    if (!box) return;
    var s = sessao();
    if (!ehGestao(s)) { box.innerHTML = ''; return; }
    estilos();
    if (box.parentNode) box.parentNode.classList.add('pg-duas');
    box.innerHTML = '<div class="pg-card pg-load"><div class="pg-spin"></div>Carregando o resumo do mês...</div>';
    buscar(null, false)
      .then(function (res) {
        var b = document.getElementById('pn-gestao');
        if (!b) return;
        desenharTop5(b, res);
        atualizarCabecalho(res);
      })
      .catch(function (e) {
        var b = document.getElementById('pn-gestao');
        if (!b) return;
        b.innerHTML = '<div class="pg-card">' + erroHtml(e, 'pg-retry', 'Não consegui carregar o resumo do mês.') + '</div>';
        var r = document.getElementById('pg-retry');
        if (r) r.onclick = function () { if (e && e.expirou && window.Sessao) window.Sessao.sair(); else montar(); };
      });
  }

  // ---------- tela Representantes (ver e editar) ----------
  function fechar() {
    var o = document.getElementById('pg-overlay');
    if (o) o.remove();
  }

  function status(msg, ruim) {
    var el = document.getElementById('pg-status');
    if (!el) return;
    el.textContent = msg || '';
    el.className = ruim ? 'pg-bad' : '';
  }

  function linhaRep(r, res) {
    var pct = pctMeta(r.vendido, r.meta);
    var manual = r.vendidoManual;
    var tag = manual !== null
      ? '✎ valor editado · automático: ' + brl(r.vendidoAuto) + ' <button class="pg-auto" data-acao="auto">usar automático</button>'
      : (r.vendidoAuto > 0 ? 'calculado pelos pedidos' : 'sem valor registrado');
    return '<div class="pg-rep" data-u="' + esc(r.usuario) + '" data-meta="' + r.meta + '" data-vend="' + (manual === null ? '' : manual) + '">' +
      '<div class="pg-rep-topo"><b>' + esc(r.nome) + '</b><small>Cód. ' + esc(r.codigoRepre || 'sem código') + ' · ' + r.pedidos + (r.pedidos === 1 ? ' pedido' : ' pedidos') + '</small></div>' +
      '<div class="pg-campos">' +
        '<label>Meta do mês (R$)<input class="pg-in pg-meta" inputmode="decimal" autocomplete="off" value="' + (r.meta ? fmtNum(r.meta) : '') + '" placeholder="0,00"></label>' +
        '<label>Vendido (R$)<input class="pg-in pg-vend" inputmode="decimal" autocomplete="off" value="' + (manual === null ? '' : fmtNum(manual)) + '" placeholder="auto: ' + fmtNum(r.vendidoAuto) + '"></label>' +
      '</div>' +
      '<div class="pg-baixo"><span>' + tag + (pct !== null ? ' · ' + pct + '% da meta' : '') + '</span><button class="pg-salvar" disabled>Salvar</button></div>' +
      (pct !== null ? '<div class="pg-track"><div class="pg-fill" style="width:' + Math.min(pct, 100) + '%"></div></div>' : '') +
      '</div>';
  }

  function desenharLista(res) {
    var lista = res.equipe.slice().sort(function (a, b) {
      var ka = res.temValores ? a.vendido : a.pedidos, kb = res.temValores ? b.vendido : b.pedidos;
      return (kb - ka) || String(a.nome).localeCompare(String(b.nome));
    });
    var q = norm((document.getElementById('pg-busca') || {}).value || '');
    var f = !q ? lista : lista.filter(function (r) { return norm(r.nome + ' ' + r.codigoRepre).indexOf(q) >= 0; });
    var el = document.getElementById('pg-lista');
    if (el) el.innerHTML = f.length ? f.map(function (r) { return linhaRep(r, res); }).join('') : '<div class="pg-vazio">Nenhum representante encontrado.</div>';
  }

  function desenharModal(res) {
    var corpo = document.getElementById('pg-corpo');
    if (!corpo) return;
    var t = res.totais, nomeMes = MESES[res.mesIdx] || '';
    var opcoes = MESES.map(function (m, i) {
      return '<option value="' + i + '"' + (i === res.mesIdx ? ' selected' : '') + '>' + m + (i === res.mesAtual ? ' (atual)' : '') + '</option>';
    }).join('');
    var busca = (document.getElementById('pg-busca') || {}).value || '';

    corpo.innerHTML =
      '<div class="pg-resumo"><b>' + (res.perfil === 'ADMIN' ? 'Todos os representantes' : 'Seus representantes') + '</b> · ' + res.equipe.length +
      '<br>' + esc(nomeMes) + ': vendido <b>' + esc(brl(t.vendido)) + '</b> · ' + t.pedidos + (t.pedidos === 1 ? ' pedido' : ' pedidos') +
      (t.meta ? ' · meta total <b>' + esc(brl(t.meta)) + '</b>' : ' · metas não cadastradas') + '</div>' +
      '<div class="pg-filtros"><input class="pg-busca" id="pg-busca" placeholder="Buscar representante ou código" autocomplete="off" value="' + esc(busca) + '">' +
      '<select class="pg-mes" id="pg-mes">' + opcoes + '</select></div>' +
      '<div id="pg-status"></div><div id="pg-lista"></div>';

    document.getElementById('pg-busca').oninput = function () { desenharLista(res); };
    document.getElementById('pg-mes').onchange = function () {
      mesModal = parseInt(this.value, 10);
      carregarModal(false);
    };
    var lista = document.getElementById('pg-lista');
    lista.oninput = function (ev) { marcarAlteracao(ev.target.closest('.pg-rep')); };
    lista.onclick = function (ev) {
      var linha = ev.target.closest('.pg-rep');
      if (!linha) return;
      if (ev.target.classList.contains('pg-salvar')) salvar(linha, false);
      else if (ev.target.getAttribute('data-acao') === 'auto') salvar(linha, true);
    };
    desenharLista(res);
  }

  // habilita "Salvar" só se algo mudou e valida os números
  function marcarAlteracao(linha) {
    if (!linha) return;
    var inMeta = linha.querySelector('.pg-meta'), inVend = linha.querySelector('.pg-vend');
    var meta = lerNumero(inMeta.value), vend = lerNumero(inVend.value);
    var metaOrig = parseFloat(linha.getAttribute('data-meta')) || 0;
    var vendOrigTxt = linha.getAttribute('data-vend');
    var vendOrig = vendOrigTxt === '' ? null : parseFloat(vendOrigTxt);
    var metaInv = Number.isNaN(meta) || (meta !== null && meta < 0);
    var vendInv = Number.isNaN(vend) || (vend !== null && vend < 0);
    var mudouMeta = !metaInv && (meta || 0) !== metaOrig;
    var mudouVend = !vendInv && vend !== vendOrig;
    inMeta.classList.toggle('pg-inv', metaInv);
    inVend.classList.toggle('pg-inv', vendInv);
    inMeta.classList.toggle('pg-ed', mudouMeta);
    inVend.classList.toggle('pg-ed', mudouVend);
    linha.querySelector('.pg-salvar').disabled = metaInv || vendInv || !(mudouMeta || mudouVend);
  }

  function salvar(linha, voltarAuto) {
    var inMeta = linha.querySelector('.pg-meta'), inVend = linha.querySelector('.pg-vend');
    var meta = lerNumero(inMeta.value), vend = voltarAuto ? null : lerNumero(inVend.value);
    var metaOrig = parseFloat(linha.getAttribute('data-meta')) || 0;
    var vendOrigTxt = linha.getAttribute('data-vend');
    var vendOrig = vendOrigTxt === '' ? null : parseFloat(vendOrigTxt);

    var corpo = { acao: 'salvar_representante', usuario: linha.getAttribute('data-u') };
    if (mesModal != null) corpo.mesIdx = mesModal;
    else if (cache.atual) corpo.mesIdx = cache.atual.res.mesIdx;
    if ((meta || 0) !== metaOrig) corpo.meta = meta || 0;
    if (vend !== vendOrig) corpo.vendido = vend;      // null = voltar ao valor automático
    if (corpo.meta === undefined && !('vendido' in corpo)) return;

    var btn = linha.querySelector('.pg-salvar');
    btn.disabled = true; btn.textContent = 'Salvando...';
    status('');
    chamar(corpo, 30000)
      .then(function (res) {
        if (!res || res.status !== 'success') {
          var e = new Error((res && res.message) || 'Não foi possível salvar.');
          e.expirou = !!(res && res.expirou);
          throw e;
        }
        cache = {};
        status('Salvo ✓');
        carregarModal(true, true);
        montar();                                      // atualiza cabeçalho e Top 5 do painel
      })
      .catch(function (e) {
        btn.textContent = 'Salvar'; btn.disabled = false;
        if (e && e.expirou && window.Sessao) { window.Sessao.sair(); return; }
        status(e && e.message || 'Erro ao salvar.', true);
      });
  }

  function carregarModal(forcar, manterStatus) {
    var corpo = document.getElementById('pg-corpo');
    if (!corpo) return;
    var msg = manterStatus ? (document.getElementById('pg-status') || {}).textContent : '';
    if (!manterStatus || !document.getElementById('pg-lista')) {
      corpo.innerHTML = '<div class="pg-load"><div class="pg-spin"></div>Carregando representantes...</div>';
    }
    buscar(mesModal, !!forcar)
      .then(function (res) {
        desenharModal(res);
        if (msg) status(msg);
      })
      .catch(function (e) {
        var c = document.getElementById('pg-corpo');
        if (!c) return;
        c.innerHTML = erroHtml(e, 'pg-retry2', 'Não consegui carregar os dados.');
        var r = document.getElementById('pg-retry2');
        if (r) r.onclick = function () { if (e && e.expirou && window.Sessao) window.Sessao.sair(); else carregarModal(true); };
      });
  }

  window.abrirRepresentantes = function () {
    if (!ehGestao(sessao())) { alert('Acesso restrito a gestores.'); return; }
    estilos();
    fechar();
    mesModal = null;
    var o = document.createElement('div');
    o.id = 'pg-overlay';
    o.innerHTML =
      '<div id="pg-box"><div class="pg-head"><span>👥 Representantes</span>' +
      '<span><button class="pg-upd" id="pg-upd">Atualizar</button><button class="pg-x" id="pg-x" aria-label="Fechar">×</button></span></div>' +
      '<div class="pg-body" id="pg-corpo"></div></div>';
    o.addEventListener('click', function (e) { if (e.target === o) fechar(); });
    document.body.appendChild(o);
    document.getElementById('pg-x').onclick = fechar;
    document.getElementById('pg-upd').onclick = function () { cache = {}; carregarModal(true); montar(); };
    carregarModal(false);
  };
  window.abrirAdmin = window.abrirRepresentantes;     // compatível com o botão já criado no 19-login.js

  // ---------- gancho com o painel do 19-login.js ----------
  document.addEventListener('painel:montado', montar);
  if (document.getElementById('pn-gestao')) montar();   // o painel pode já ter sido desenhado antes deste arquivo carregar
})();
