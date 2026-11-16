/* =============================================
   Di Solle — 19. LOGIN + PAINEL INICIAL
   Tela de login (usuário/senha da aba "Usuarios"), painel-menu com
   boas-vindas e meta mensal, tela "Localize seu cliente" (antes do
   pedido) e controle de acesso ao catálogo de pedidos.
   Carregar ANTES do 16-init.js.
   Depende de: 01-estado-global.js, 04-representante.js,
               05-utils-busca.js, 11-clientes.js
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
    '#tela-login,#tela-painel,#tela-escolha,#tela-cliente{position:fixed;inset:0;z-index:99999;background:#f4f6f5;display:flex;overflow:auto;font-family:Arial,sans-serif;padding:16px;box-sizing:border-box}' +
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
    // localizar cliente
    '.cl-busca{display:flex;gap:8px;margin-bottom:10px}' +
    '.cl-busca input{flex:1;margin-bottom:0;min-width:0}' +
    '.cl-busca button.lg-btn{width:auto;padding:0 20px}' +
    '.cl-msg{font-size:13px;color:#0f6e56;font-weight:bold;margin:4px 0 10px;text-align:center;min-height:16px}' +
    '.cl-msg.cl-aviso{color:#8a5a00}' +
    '#cl-lista{max-height:46vh;overflow:auto}' +
    '.cl-item{padding:10px 12px;border:1px solid #e3e3e3;border-radius:8px;margin-bottom:8px;cursor:pointer}' +
    '.cl-item:hover{border-color:#1D9E75;background:#f4fbf8}' +
    '.cl-item b{display:block;color:#0f6e56;font-size:14px}' +
    '.cl-item span{display:block;color:#777;font-size:12px;line-height:1.5;margin-top:2px}' +
    '.cl-cad{margin-top:16px;padding:14px;border:2px solid #1D9E75;background:#E1F5EE;border-radius:10px;text-align:center;font-size:15px;color:#0f6e56}' +
    '.cl-cad b{display:block;margin-bottom:8px}' +
    '.cl-cad a{display:inline-block;background:#1D9E75;color:#fff;font-weight:bold;font-size:15px;padding:10px 22px;border-radius:8px;cursor:pointer;text-decoration:none}' +
    // tela de pedido: sem os botões Edição (importar PDF), Cadastrar e Clientes
    '.icons-actions button[onclick^="abrirModalUpload"],.icons-actions button[onclick^="abrirModalNovoCliente"],.icons-actions button[onclick^="abrirModalBuscarCliente"]{display:none!important}' +
    '.cl-and{background:#E1F5EE;border-radius:8px;padding:12px;margin-bottom:14px;font-size:13px;color:#0f6e56;text-align:center}' +
    '.cl-and button.lg-btn{margin-top:8px;padding:9px;font-size:14px}' +
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
    limpar('tela-painel'); limpar('tela-escolha'); limpar('tela-cliente');
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
          abrirClientes();
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

  // =============================================
  // LOCALIZAR CLIENTE (tela que vem antes do pedido)
  // Usa a base CLIENTES e a ficha do cliente (modal-detalhes-cliente) que
  // o app já tem. O botão da ficha passa a se chamar "Iniciar pedido".
  // =============================================
  var fichaAberta = false;     // true enquanto a ficha do cliente está aberta por cima desta tela
  var cadastrando = false;     // true enquanto o cadastro de novo cliente está aberto por cima desta tela
  var totalAntesCadastro = 0;

  function telaCliente() { return document.getElementById('tela-cliente'); }
  function soDig(s) { return String(s || '').replace(/\D/g, ''); }

  function fmtDoc(s) {
    var k = chaveDoc(s);
    if (k.length === 14) return k.replace(/^([0-9A-Z]{2})([0-9A-Z]{3})([0-9A-Z]{3})([0-9A-Z]{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    if (k.length === 11 && /^\d+$/.test(k)) return k.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
    return String(s || '');
  }

  // Mesma regra de busca da "Pesquisa Geral de Clientes" do app
  function procurarClientes(v) {
    var termoNorm = normalizarTexto(v);
    var termoDigitos = soDig(v);
    var termoDoc = normDoc(v);
    var buscaNumerica = termoDigitos.length >= 3 && !/[a-zA-Z]/.test(v);
    var buscaAlfa = !/\s/.test(v) && /^[0-9A-Za-z.\-\/]+$/.test(v) &&
                    /^[0-9A-Z]{12}\d{2}$/.test(termoDoc) && /[A-Z]/.test(termoDoc);
    var tokens = termoNorm.split(/\s+/).filter(Boolean);

    var achados = CLIENTES.filter(function (c) {
      var cnpjDig = soDig(c.cnpj), cnpjChave = chaveDoc(c.cnpj);
      if (buscaNumerica) {
        return cnpjDig.indexOf(termoDigitos) >= 0 || cnpjChave.indexOf(termoDigitos) >= 0 || soDig(c.telefone).indexOf(termoDigitos) >= 0;
      }
      if (buscaAlfa) return cnpjChave === termoDoc;
      var txt = normalizarTexto([c.fantasia, c.razao, c.municipio, c.estado, c.bairro, c.email].join(' '));
      return tokens.every(function (t) {
        if (txt.indexOf(t) >= 0) return true;
        var dt = soDig(t);
        return !/[a-zA-Z]/.test(t) && dt.length >= 3 && cnpjDig.indexOf(dt) >= 0;
      });
    });

    var aproximado = false;
    if (achados.length === 0 && !buscaNumerica && !buscaAlfa) {
      achados = CLIENTES.filter(function (c) { return buscaInteligente([c.fantasia, c.razao, c.municipio], v); });
      aproximado = true;
    }

    var pontos = function (c) {
      var f = normalizarTexto(c.fantasia), r = normalizarTexto(c.razao);
      if (f === termoNorm || r === termoNorm) return 0;
      if (f.indexOf(termoNorm) >= 0 || r.indexOf(termoNorm) >= 0) return 1;
      if (tokens.length && (f.indexOf(tokens[0]) === 0 || r.indexOf(tokens[0]) === 0)) return 2;
      return 3;
    };
    achados.sort(function (a, b) { return pontos(a) - pontos(b); });
    return { lista: achados, aproximado: aproximado };
  }

  function abrirClientes() {
    limpar('tela-painel'); limpar('tela-escolha'); limpar('tela-cliente');
    botaoVoltar(false);
    restaurarTextoFicha();
    document.body.classList.add('fora-do-pedido');

    var t = el(
      '<div id="tela-cliente"><div class="lg-card" style="max-width:520px">' +
      '<h1>Localize seu cliente</h1>' +
      '<p>Para iniciar um pedido, você precisa localizar seu cliente.</p>' +
      '<div id="cl-andamento"></div>' +
      '<div class="cl-busca"><input id="cl-busca" placeholder="CNPJ, nome, fantasia ou cidade" autocomplete="off">' +
      '<button class="lg-btn" id="cl-buscar">Buscar</button></div>' +
      '<div class="cl-msg" id="cl-msg"></div><div id="cl-lista"></div>' +
      '<div class="cl-cad" id="cl-cad"><b>Não localizou seu cliente?</b><a id="cl-cad-link">➕ Cadastre aqui</a></div>' +
      '<button class="lg-btn lg-sec" id="cl-voltar">← Voltar ao painel</button></div></div>');
    document.body.appendChild(t);

    var inp = document.getElementById('cl-busca');
    var msg = document.getElementById('cl-msg');
    var lista = document.getElementById('cl-lista');
    var cad = document.getElementById('cl-cad');

    // Pedido em andamento (carrinho ou cliente já preenchidos): permite continuar sem perder nada
    var nItens = 0;
    try { nItens = Object.keys(SELECIONADOS).length; } catch (e) {}
    var campo = function (id) { var x = document.getElementById(id); return x ? x.value.trim() : ''; };
    var nomeAtual = campo('cli-fantasia') || campo('cli-razao') || campo('cli-cnpj');
    if (nItens > 0 || nomeAtual) {
      var box = document.getElementById('cl-andamento');
      box.className = 'cl-and';
      box.appendChild(document.createTextNode('Pedido em andamento' + (nomeAtual ? ': ' + nomeAtual : '') +
        (nItens ? ' · ' + nItens + ' produto' + (nItens > 1 ? 's' : '') : '')));
      var bc = document.createElement('button');
      bc.className = 'lg-btn';
      bc.textContent = 'Continuar pedido';
      bc.onclick = function () { limpar('tela-cliente'); abrirPedido(); };
      box.appendChild(document.createElement('br'));
      box.appendChild(bc);
    }

    function buscar() {
      var v = inp.value.trim();
      msg.className = 'cl-msg';
      if (!v) { msg.className = 'cl-msg cl-aviso'; msg.textContent = 'Digite o CNPJ, o nome ou a cidade do seu cliente.'; return; }
      if (!CLIENTES.length) { msg.className = 'cl-msg cl-aviso'; msg.textContent = 'Os clientes ainda estão carregando. Tente de novo em alguns segundos.'; return; }

      var r = procurarClientes(v);
      var LIMITE = 50;
      lista.innerHTML = '';
      cad.style.display = 'block';

      if (!r.lista.length) { msg.className = 'cl-msg cl-aviso'; msg.textContent = 'Nenhum cliente localizado.'; return; }

      msg.textContent = 'Clique em cima do cliente desejado.' +
        (r.aproximado ? ' (resultados aproximados)' : '') +
        (r.lista.length > LIMITE ? ' Mostrando os ' + LIMITE + ' primeiros, refine a busca.' : '');

      r.lista.slice(0, LIMITE).forEach(function (c) {
        var d = document.createElement('div');
        d.className = 'cl-item';
        var n = document.createElement('b');
        n.textContent = c.fantasia || c.razao || '-';
        var s = document.createElement('span');
        var partes = [];
        if (c.razao && c.razao !== (c.fantasia || c.razao)) partes.push(c.razao);
        partes.push('CNPJ/CPF: ' + fmtDoc(c.cnpj));
        var cidade = [c.municipio, c.estado].filter(Boolean).join('/');
        if (cidade) partes.push(cidade);
        s.textContent = partes.join(' · ');
        d.appendChild(n); d.appendChild(s);
        d.onclick = function () { abrirFicha(c); };
        lista.appendChild(d);
      });
    }

    document.getElementById('cl-buscar').onclick = buscar;
    inp.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') buscar(); });
    document.getElementById('cl-cad-link').onclick = abrirCadastro;
    document.getElementById('cl-voltar').onclick = mostrarPainel;
    t._buscar = buscar;
    inp.focus();
  }

  // Clicou no cliente: abre a ficha (modal que o app já tem) com o botão "Iniciar pedido"
  function abrirFicha(c) {
    var t = telaCliente();
    if (!t) return;
    fichaAberta = true;
    t.style.display = 'none';
    mostrarFichaCompletaCliente(c);
    var b = document.getElementById('btn-selecionar-cliente-busca');
    if (!b) return;
    b.textContent = 'Iniciar pedido';
    var original = b.onclick;
    b.onclick = function () {
      try { if (original) original.call(b); } catch (e) { console.warn('Ficha do cliente:', e); }
      fichaAberta = false;
      limpar('tela-cliente');
      abrirPedido();
    };
  }

  function restaurarTextoFicha() {
    var b = document.getElementById('btn-selecionar-cliente-busca');
    if (b) b.textContent = '🛒 Fazer Pedido';
  }

  // "Voltar para a Busca" na ficha: mostra de novo a tela de clientes
  var fecharFichaOriginal = window.fecharModalDetalhesCliente;
  window.fecharModalDetalhesCliente = function () {
    if (fecharFichaOriginal) fecharFichaOriginal.apply(this, arguments);
    if (fichaAberta) {
      fichaAberta = false;
      var t = telaCliente();
      if (t) t.style.display = '';
    }
  };

  // Cadastro de cliente: abre o cadastro que o app já tem e, ao fechar/salvar, volta para esta tela
  function abrirCadastro() {
    var t = telaCliente();
    if (!t) return;
    if (typeof abrirModalNovoCliente !== 'function') { alert('Cadastro de cliente indisponível.'); return; }
    var termo = document.getElementById('cl-busca').value.trim();
    cadastrando = true;
    totalAntesCadastro = CLIENTES.length;
    t.style.display = 'none';
    abrirModalNovoCliente();
    if (soDig(termo).length >= 11) {
      var f = document.getElementById('nc-cnpj');
      if (f) f.value = termo;
    }
  }

  var fecharCadastroOriginal = window.fecharModalNovoCliente;
  window.fecharModalNovoCliente = function () {
    if (fecharCadastroOriginal) fecharCadastroOriginal.apply(this, arguments);
    if (!cadastrando) return;
    cadastrando = false;
    var t = telaCliente();
    if (!t) return;
    t.style.display = '';
    if (CLIENTES.length > totalAntesCadastro) {
      // cliente novo salvo: o app pode abrir o modal de dados do pedido; aqui não queremos isso
      setTimeout(function () {
        var m = document.getElementById('modal-cliente');
        if (m) { m.classList.remove('open'); m.style.display = 'none'; }
      }, 0);
      var novo = CLIENTES[CLIENTES.length - 1];
      document.getElementById('cl-busca').value = novo.cnpj || novo.fantasia || novo.razao || '';
      if (t._buscar) t._buscar();
      var msg = document.getElementById('cl-msg');
      if (msg) { msg.className = 'cl-msg'; msg.textContent = 'Cliente cadastrado! Clique em cima dele para iniciar o pedido.'; }
    }
  };

  // ---------- painel ----------
  function fazerPedido() {
    var sess = getSessao();
    if (!sess) return mostrarLogin();
    if (sess.usuario.perfil === 'REPRESENTANTE') return abrirClientes();
    if (sess.repre && sess.repre.codigo) { definirRepre(sess.repre.codigo); return abrirClientes(); }
    abrirEscolha();
  }

  // Para novos itens do menu, acrescente aqui. Sem "acao" aparece como "Em breve".
  var MENU = [
    { icone: '🛒', titulo: 'Fazer pedido', desc: 'Localize o cliente, monte o carrinho e envie o pedido', acao: fazerPedido },
    { icone: '📦', titulo: 'Meus pedidos', desc: 'Acompanhe os pedidos enviados', acao: null },
    { icone: '🧾', titulo: 'Meus orçamentos', desc: 'Orçamentos salvos', acao: null }
  ];

  function mostrarPainel() {
    var sess = getSessao();
    if (!sess) return mostrarLogin();
    botaoVoltar(false);
    restaurarTextoFicha();
    document.body.classList.add('fora-do-pedido');
    limpar('tela-painel'); limpar('tela-escolha'); limpar('tela-cliente');

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
    limpar('tela-painel'); limpar('tela-escolha'); limpar('tela-cliente');
    restaurarTextoFicha();
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
