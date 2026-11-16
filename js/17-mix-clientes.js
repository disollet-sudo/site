/* =============================================
   Di Solle — 17. MIX DO CLIENTE (integração com Painel Metas & Repic)
   Busca o histórico de compras do cliente selecionado na planilha
   "Repic e Metas" (mesma fonte do dashboard "Previsão & Metas Mensais")
   e mostra um card com Ticket Médio, Total Comprado, Última Compra,
   Próxima Prevista e Situação Financeira — igual ao card do painel.
   Cruzamento por CNPJ (a aba Pedidos tem coluna CNPJ), não depende do
   código de cliente do Cigam.
   Depende de: 01-estado-global.js
   ============================================= */

function atualizarBotaoMix() {
  let btn = document.getElementById('btn-mix-cliente');
  if (!btn) return;
  let cnpjInput = document.getElementById('cli-cnpj');
  let cnpj = cnpjInput ? cnpjInput.value.replace(/\D/g, '').trim() : '';
  btn.style.display = cnpj ? 'inline-flex' : 'none';
}

function fmtMoedaMix(v) {
  return "R$ " + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatarDataMix(d) {
  if (!d || isNaN(d.getTime())) return '—';
  return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
}

function chaveDiaMix(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function tratarDataMix(dStr) {
  if (!dStr) return null;
  if (dStr instanceof Date) return dStr;
  if (typeof dStr === 'string' && dStr.indexOf('/') !== -1) {
    let partes = dStr.split('/');
    if (partes.length === 3) return new Date(partes[2], partes[1] - 1, partes[0]);
  }
  let dt = new Date(dStr);
  return isNaN(dt.getTime()) ? null : dt;
}

// Cache simples de 5 min pra não rebuscar o pacote inteiro toda vez que o
// representante clicar em "Mix" mais de uma vez seguida.
function buscarPacoteRepicMeta() {
  if (PACOTE_REPIC_META && PACOTE_REPIC_META_TS && (Date.now() - PACOTE_REPIC_META_TS) < 5 * 60 * 1000) {
    return Promise.resolve(PACOTE_REPIC_META);
  }
  return fetch(URL_REPIC_META).then(r => r.json()).then(pacote => {
    PACOTE_REPIC_META = pacote;
    PACOTE_REPIC_META_TS = Date.now();
    return pacote;
  });
}

// Mesma regra de cálculo do modais.js do painel (calcularRepicEmMemoria +
// calcularDividasEmMemoria), só que filtrado a um único CNPJ.
function calcularMixDoCliente(pacote, cnpj) {
  let cnpjLimpo = String(cnpj).replace(/\D/g, '').trim();

  let pedidosCliente = (pacote.pedidos || [])
    .filter(p => String(p.cnpj || '').replace(/\D/g, '').trim() === cnpjLimpo)
    .map(p => ({ ...p, data: tratarDataMix(p.data) || new Date(0), valor: Number(p.valor || 0) }))
    .sort((a, b) => b.data - a.data);

  if (pedidosCliente.length === 0) return null;

  let eventosMap = {};
  pedidosCliente.forEach(p => {
    let k = chaveDiaMix(p.data);
    if (!eventosMap[k]) eventosMap[k] = { data: p.data, valorTotal: 0 };
    eventosMap[k].valorTotal += p.valor;
  });
  let eventos = Object.values(eventosMap).sort((a, b) => a.data - b.data);

  let ultimoEvento = eventos[eventos.length - 1];
  let totalGeral = eventos.reduce((s, e) => s + e.valorTotal, 0);
  let ticketMedio = totalGeral / eventos.length;

  let intervalos = [];
  for (let i = 1; i < eventos.length; i++) {
    intervalos.push((eventos[i].data - eventos[i - 1].data) / 86400000);
  }
  let repicMedio = intervalos.length > 0
    ? intervalos.reduce((s, d) => s + d, 0) / intervalos.length
    : REPIC_PADRAO_CLIENTE_NOVO_MIX;

  // Códigos de cliente (Cigam) que apareceram nos pedidos deste CNPJ — só pra achar as dívidas
  let codigosCliente = [...new Set(pedidosCliente.map(p => String(p.cod_cliente || '').trim()).filter(Boolean))];

  let hoje = new Date();
  let titulos = (pacote.titulosVencidos || []).filter(t => {
    if (!codigosCliente.includes(String(t.cod_cliente || '').trim())) return false;
    let venc = tratarDataMix(t.vencimento);
    let pago = !!t.ultima_liquidacao;
    return venc && !pago && venc < hoje;
  }).map(t => ({ ...t, vencimento: tratarDataMix(t.vencimento), saldo: Number(t.saldo || t.valor || 0) }))
    .sort((a, b) => a.vencimento - b.vencimento);

  let totalDevido = Math.round(titulos.reduce((s, t) => s + t.saldo, 0) * 100) / 100;

  return {
    ticketMedio: Math.round(ticketMedio * 100) / 100,
    totalComprado: Math.round(totalGeral * 100) / 100,
    ultimaCompra: ultimoEvento.data,
    proximaPrevista: new Date(ultimoEvento.data.getTime() + repicMedio * 86400000),
    titulos: titulos,
    totalDevido: totalDevido,
    pedidos: pedidosCliente
  };
}

function montarHtmlMix(mix) {
  let html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">' +
    '<div style="background:#f9f9f9;border:1px solid var(--borda);border-radius:8px;padding:8px 10px;"><div style="font-size:11px;color:var(--sub);">Ticket Médio</div><b>' + fmtMoedaMix(mix.ticketMedio) + '</b></div>' +
    '<div style="background:#f9f9f9;border:1px solid var(--borda);border-radius:8px;padding:8px 10px;"><div style="font-size:11px;color:var(--sub);">Total Comprado</div><b>' + fmtMoedaMix(mix.totalComprado) + '</b></div>' +
    '<div style="background:#f9f9f9;border:1px solid var(--borda);border-radius:8px;padding:8px 10px;"><div style="font-size:11px;color:var(--sub);">Última Compra</div><b>' + formatarDataMix(mix.ultimaCompra) + '</b></div>' +
    '<div style="background:#f9f9f9;border:1px solid var(--borda);border-radius:8px;padding:8px 10px;"><div style="font-size:11px;color:var(--sub);">Próxima Prevista</div><b>' + formatarDataMix(mix.proximaPrevista) + '</b></div>' +
    '<div style="grid-column:1/3;background:#f9f9f9;border:1px solid var(--borda);border-radius:8px;padding:8px 10px;"><div style="font-size:11px;color:var(--sub);">Situação Financeira</div><b style="color:' + (mix.totalDevido > 0 ? '#c0392b' : '#1D9E75') + '">' + (mix.totalDevido > 0 ? '-' + fmtMoedaMix(mix.totalDevido) : 'Em dia') + '</b></div>' +
    '</div>';

  if (mix.totalDevido > 0) {
    html += '<div style="margin-bottom:8px;font-weight:700;color:#c0392b;font-size:12px;">💸 Títulos em Aberto</div>';
    html += '<table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:12px;"><thead><tr>' +
      '<th style="text-align:left;border-bottom:1px solid var(--borda);padding:4px;">Pedido</th>' +
      '<th style="text-align:left;border-bottom:1px solid var(--borda);padding:4px;">Venc.</th>' +
      '<th style="text-align:right;border-bottom:1px solid var(--borda);padding:4px;">Saldo</th>' +
      '</tr></thead><tbody>';
    mix.titulos.forEach(t => {
      html += '<tr><td style="padding:4px;">' + t.num_pedido + '</td><td style="padding:4px;">' + formatarDataMix(t.vencimento) + '</td><td style="padding:4px;text-align:right;color:#c0392b;font-weight:700;">' + fmtMoedaMix(t.saldo) + '</td></tr>';
    });
    html += '</tbody></table>';
  }

  html += '<div style="font-weight:700;font-size:12px;margin-bottom:6px;">Histórico de Pedidos</div>';
  html += '<table style="width:100%;border-collapse:collapse;font-size:11px;"><thead><tr>' +
    '<th style="text-align:left;border-bottom:1px solid var(--borda);padding:4px;">Pedido</th>' +
    '<th style="text-align:left;border-bottom:1px solid var(--borda);padding:4px;">Data</th>' +
    '<th style="text-align:right;border-bottom:1px solid var(--borda);padding:4px;">Valor</th>' +
    '</tr></thead><tbody>';
  mix.pedidos.slice(0, 15).forEach(p => {
    html += '<tr><td style="padding:4px;">' + p.num_pedido + '</td><td style="padding:4px;">' + formatarDataMix(p.data) + '</td><td style="padding:4px;text-align:right;">' + fmtMoedaMix(p.valor) + '</td></tr>';
  });
  html += '</tbody></table>';

  return html;
}

function abrirModalMix() {
  let cnpjInput = document.getElementById('cli-cnpj');
  let cnpj = cnpjInput ? cnpjInput.value.replace(/\D/g, '').trim() : '';
  if (!cnpj) { showToast("Selecione um cliente primeiro."); return; }

  let conteudo = document.getElementById('conteudo-mix-cliente');
  conteudo.innerHTML = '<div style="text-align:center;padding:20px;color:var(--sub);">Buscando histórico...</div>';

  let modal = document.getElementById('modal-mix');
  modal.style.display = 'flex';
  modal.classList.add('open');

  buscarPacoteRepicMeta().then(pacote => {
    let mix = calcularMixDoCliente(pacote, cnpj);
    if (!mix) {
      conteudo.innerHTML = '<div style="text-align:center;padding:20px;color:var(--sub);">Nenhuma compra encontrada pra este cliente na planilha de acompanhamento.</div>';
      return;
    }
    conteudo.innerHTML = montarHtmlMix(mix);
  }).catch(erro => {
    conteudo.innerHTML = '<div style="text-align:center;padding:20px;color:#c0392b;">Erro ao buscar dados: ' + erro.message + '</div>';
  });
}

function fecharModalMix() {
  let modal = document.getElementById('modal-mix');
  if (modal) {
    modal.classList.remove('open');
    setTimeout(() => modal.style.display = 'none', 300);
  }
}
