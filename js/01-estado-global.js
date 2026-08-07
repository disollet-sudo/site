/* =============================================
   Di Solle — 01. ESTADO GLOBAL
   TODAS as variáveis e constantes globais do app ficam aqui.
   Por que centralizado: no navegador, "let"/"const" no nível raiz de um
   <script> não pode ser declarado duas vezes na mesma página. Então,
   para não ter erro de "already declared", todo o estado mora neste
   único arquivo — os outros arquivos só LEEM e ALTERAM essas variáveis.
   Este arquivo precisa ser o PRIMEIRO <script> carregado no index.html.
   ============================================= */

const URL_GOOGLE_SCRIPT = "https://script.google.com/macros/s/AKfycbz6qpZZE_6i0k-Caz3QZBC7JeHrOXWB5r6spNnxA1Yc3qwCLim0kk0Nn0o_vK8E7fDwFA/exec";

// --- ESTADO GLOBAL PRINCIPAL ---
let PRODUTOS = [];
let CLIENTES = [];
let SELECIONADOS = {};
let DADOS_PDF_PRONTO = null;
let FRETE_REGRAS = {};
let CODIGO_REPRE = localStorage.getItem('repre_cod') || "";
let PRODUTO_MODAL_ATIVO = null;
let BLOQUEIA_SALVAMENTO_CNPJ = false;
let MODO_MODAL_CLIENTE = 'pedido'; // 'pedido' ou 'orcamento' — controla o comportamento do modal de dados do cliente
let ORCAMENTO_ATIVO_ID = null;     // id do orçamento salvo que está sendo editado no carrinho atual (null = nenhum)
let TABELA_ATIVA_ANTERIOR = null;  // guarda a última tabela de preço aplicada — usado para só
                                   // re-renderizar o grid de produtos quando ela realmente mudar
                                   // (evita recriar todos os cards/fotos a cada clique no carrinho)

// --- CLIENTE ESPECIAL KNE825 ---
const CNPJ_KNE825 = '92740687000110';          // CNPJ fixo do cliente especial
let TABELA_KNE825 = {};                         // { codNorm: precoUnit } vindo do GS
let CLIENTE_ESPECIAL_ATIVO = false;             // true quando KNE825 selecionado + prazo 28 dias

// --- TABELA ESPECIAL MILLENIUM ---
let TABELA_MILLENIUM = {};                      // { codNorm: { precoIcms7, precoIcms12, minimoIcms7, minimoIcms12, colunas:[{pct,termo}], fixoAntecipado, fixo42, fixo63 } } vindo do GS

// Tabela de prazos e opções de desmembramento
const SUB_PRAZOS = {
  "9": ["28 DIAS","14/42 DIAS","21/35 DIAS","14/28/42 DIAS"],
  "7": ["35 DIAS","14/56 DIAS","21/49 DIAS","28/42 DIAS","14/35/56 DIAS","21/35/49 DIAS","14/28/42/56 DIAS"],
  "5": ["42 DIAS","28/56 DIAS","35/49 DIAS","14/42/70 DIAS","28/42/56 DIAS","21/35/49/63 DIAS","14/28/42/56/70 DIAS"],
  "2": ["56 DIAS","28/84 DIAS","49/63 DIAS","35/56/77 DIAS","42/56/70 DIAS","35/49/63/77 DIAS","28/42/56/70/84 DIAS","21/35/49/63/77/91 DIAS"],
  "0": ["63 DIAS","35/91 DIAS","35/63/91 DIAS","56/70 DIAS","42/63/84 DIAS","21/49/77/105 DIAS","42/56/70/84 DIAS","35/49/63/77/91 DIAS","28/42/56/70/84/98 DIAS"]
};

// --- POPUP DE CARREGAMENTO INICIAL ---
let LOADING_INICIAL_START = null;
let LOADING_INICIAL_INTERVAL = null;
const LOADING_INICIAL_DURACAO_ESTIMADA = 6000; // ms — tempo médio estimado para os itens aparecerem

// --- PERSISTÊNCIA LOCAL (localStorage) ---
const LS_CARRINHO = 'disolle_carrinho_v1';
const LS_CLIENTE  = 'disolle_cliente_v1';
const LS_CONFIG   = 'disolle_config_v1';
const LS_ORCAMENTOS = 'disolle_orcamentos_v1';
const CAMPOS_CLIENTE_FORM = ['cnpj','razao','fantasia','telefone','endereco','estado','bairro','municipio','numero','cep','email','obs'];
let RESTAURANDO_ESTADO = false; // true enquanto restaurarEstadoLocal() está rodando, evita sobrescrever o localStorage com dados vazios pela metade

// --- CATÁLOGO / FILTROS ---
var _filtrarTimeout = typeof _filtrarTimeout !== 'undefined' ? _filtrarTimeout : null;

// --- FILTRO POR LINHA DE PRODUTO (2 primeiros dígitos do código) ---
const LINHAS_PRODUTO = [
  { nome: 'Paraty',    prefixo: '01' },
  { nome: 'Tradição',   prefixo: '06' },
  { nome: 'Clean',     prefixo: '07' },
  { nome: 'Utilidade', prefixo: '07' },
  { nome: 'Sollewood', prefixo: '08' },
  { nome: 'Classica',  prefixo: '10' },
  { nome: 'Millenium', prefixo: '14' },
  { nome: 'Durafio',   prefixo: '18' },
  { nome: 'Oceano',    prefixo: '27' },
  { nome: 'Universo',  prefixo: '33' },
  { nome: 'Prisma',    prefixo: '35' },
  { nome: 'Inova',     prefixo: '38' }
];
let FILTRO_LINHA_ATIVO = null; // prefixo de 2 dígitos ativo, ou null
