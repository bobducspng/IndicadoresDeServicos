/**
 * INDICADORES DE SERVIÇOS — Web App (Google Apps Script)
 *
 * Este arquivo é o "servidor" do painel. O "site" é o arquivo Index.html (o React já
 * compilado em um único arquivo). O navegador chama `api(...)` por google.script.run.
 *
 * COMO FUNCIONA
 *  - Implantação: "Executar como: Eu" + "Quem pode acessar: qualquer pessoa da organização (vena.app.br)".
 *    O Google faz o login; aqui só conferimos se o e-mail está na aba "Acessos".
 *  - Dados dos indicadores: lidos DIRETO da planilha do Painel (que pode ficar privada).
 *  - Colaboradores x clientes: abas "Colaboradores" e "Carteira Colaborador" da mesma planilha
 *    (gravadas pelo script colaboradores_api.gs do projeto integracao_cadastro_clientes).
 *  - Acessos (quem pode entrar) e Fotos: planilha de CONTROLE, criada automaticamente
 *    (função setupInicial). Só o dono do script e quem você compartilhar enxerga.
 *  - Fotos: enviadas para a pasta pública do Drive (PASTA_FOTOS_ID) e exibidas pelo link.
 *
 * PRIMEIRA VEZ: rode `setupInicial` no editor (autoriza o script, cria a planilha de controle
 * e cadastra os administradores). Depois: Implantar > Nova implantação > App da Web.
 */

var CONFIG = {
  // Planilha do Painel de Indicadores (abas lidas pelo painel).
  PAINEL_ID: "1BWWM39AJ88tj59EWN4qJCP5kVJAx16t7yVYuVw_QuIY",
  ABAS_INDICADORES: {
    fatos: "Fatos Movimentacao",
    vigencia: "Vigência CNPJ x Serviço",
    baseMensal: "Base Mensal",
    posicaoGeografica: "posicao geografica",
    historicoServicos: "Histórico de Serviços",
  },
  ABA_COLABORADORES: "Colaboradores",
  ABA_CARTEIRA: "Carteira Colaborador",

  // Pasta do Drive onde ficam as fotos (acesso público de visualização).
  PASTA_FOTOS_ID: "1Jat9fAkUl4OxLzfL3xAPa_Zp3hhXCszg",
  FOTO_MAX_BYTES: 300 * 1024,
  FOTO_TAMANHO_URL: "s256", // lado em pixels do thumbnail do Google (s0 = original)

  // Planilha de controle (criada por setupInicial; o id fica nas propriedades do script).
  NOME_PLANILHA_CONTROLE: "Indicadores de Serviços — Controle de acesso e fotos",
  ABA_ACESSOS: "Acessos",
  ABA_FOTOS: "Fotos",
  CABECALHO_ACESSOS: ["id", "email", "name", "role", "isActive", "allowedServices", "avatarUrl", "addedBy", "createdAt", "updatedAt"],
  CABECALHO_FOTOS: ["email", "fileId", "url", "mime", "updatedBy", "updatedAt"],

  DOMINIO: "@vena.app.br",
  // Cadastro inicial (só usado quando a aba Acessos está vazia). allowedServices vazio = todos os serviços.
  ADMINS_INICIAIS: [
    ["ederlei.pereira@vena.app.br", "Ederlei Pereira", "super_admin"],
    ["cancelamento@vena.app.br", "Cancelamento", "admin"],
  ],

  CACHE_INDICADORES_SEGUNDOS: 600,
  CACHE_ACESSOS_SEGUNDOS: 60,
};

var PERFIS = ["user", "admin", "super_admin"];

/* ========================================================================== */
/* Página                                                                     */
/* ========================================================================== */

function doGet() {
  return HtmlService.createHtmlOutputFromFile("Index")
    .setTitle("Indicadores de Serviços")
    .addMetaTag("viewport", "width=device-width, initial-scale=1, maximum-scale=1")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/* ========================================================================== */
/* API chamada pelo navegador                                                 */
/* ========================================================================== */

/**
 * Ponto único de entrada. Devolve SEMPRE um texto JSON:
 *   { ok: true, data }  ou  { ok: false, error: { code, message } }
 * Níveis de acesso: "publico" (qualquer conta do domínio), "permitido" (cadastrado e ativo) e "admin".
 */
function api(procedimento, entradaJson) {
  try {
    var procedimentoDef = PROCEDIMENTOS_[procedimento];
    if (!procedimentoDef) throw erro_("NOT_FOUND", "Operação desconhecida: " + procedimento);
    var entrada = entradaJson ? JSON.parse(entradaJson) : null;
    var ctx = contexto_();
    if (procedimentoDef.acesso !== "publico") {
      if (!ctx.permitido) throw erro_("FORBIDDEN", "Acesso não autorizado.");
      if (procedimentoDef.acesso === "admin" && !ctx.admin) {
        throw erro_("FORBIDDEN", "Somente administradores podem fazer isso.");
      }
    }
    return JSON.stringify({ ok: true, data: procedimentoDef.executar(entrada || {}, ctx) });
  } catch (e) {
    var codigo = e && e.codigo ? e.codigo : "INTERNAL_SERVER_ERROR";
    if (codigo === "INTERNAL_SERVER_ERROR") console.error("[api] " + procedimento + ": " + (e && e.stack ? e.stack : e));
    return JSON.stringify({
      ok: false,
      error: { code: codigo, message: e && e.message ? String(e.message) : "Erro inesperado." },
    });
  }
}

var PROCEDIMENTOS_ = {
  "auth.me": { acesso: "publico", executar: function (_e, ctx) { return authMe_(ctx); } },
  "auth.logout": { acesso: "publico", executar: function () { return { success: true }; } },
  "dashboard.sheets": {
    acesso: "permitido",
    executar: function (e) { return lerIndicadores_(Boolean(e.forcar)); },
  },
  "colaboradores.carteira": { acesso: "permitido", executar: function (_e, ctx) { return carteira_(ctx); } },
  "colaboradores.salvarFoto": { acesso: "admin", executar: function (e, ctx) { return salvarFoto_(e, ctx); } },
  "colaboradores.removerFoto": { acesso: "admin", executar: function (e) { return removerFoto_(e); } },
  "accessControl.list": { acesso: "admin", executar: function () { return listarAcessos_(); } },
  "accessControl.add": { acesso: "admin", executar: function (e, ctx) { return adicionarAcesso_(e, ctx); } },
  "accessControl.updateRole": { acesso: "admin", executar: function (e) { return atualizarPerfil_(e); } },
  "accessControl.updateName": { acesso: "admin", executar: function (e) { return atualizarNome_(e); } },
  "accessControl.updateServices": { acesso: "admin", executar: function (e) { return atualizarServicos_(e); } },
  "accessControl.toggleStatus": { acesso: "admin", executar: function (e) { return alternarStatus_(e); } },
  "accessControl.remove": { acesso: "admin", executar: function (e) { return removerAcesso_(e); } },
};

function erro_(codigo, mensagem) {
  var e = new Error(mensagem);
  e.codigo = codigo;
  return e;
}

/* ========================================================================== */
/* Usuário atual                                                              */
/* ========================================================================== */

function contexto_() {
  var email = "";
  try {
    email = String(Session.getActiveUser().getEmail() || "").trim().toLowerCase();
  } catch (e) {
    email = "";
  }
  var usuario = null;
  if (email && email.slice(-CONFIG.DOMINIO.length) === CONFIG.DOMINIO) {
    usuario = acessoPorEmail_(email);
  }
  var permitido = Boolean(usuario && usuario.isActive === 1);
  return {
    email: email,
    usuario: usuario,
    permitido: permitido,
    admin: permitido && (usuario.role === "admin" || usuario.role === "super_admin"),
  };
}

function authMe_(ctx) {
  var u = ctx.usuario;
  var restrito = u && u.allowedServices !== null ? parseServicos_(u.allowedServices) : null;
  return {
    id: u ? u.id : 0,
    openId: ctx.email,
    name: u ? u.name : nomeDoEmail_(ctx.email),
    email: ctx.email || null,
    avatarUrl: u && u.avatarUrl ? u.avatarUrl : null,
    role: u ? u.role : "user",
    allowedServices: restrito,
    isAllowed: ctx.permitido,
    lastSignedIn: new Date().toISOString(),
    appUrl: urlDoApp_(),
  };
}

function urlDoApp_() {
  try {
    return ScriptApp.getService().getUrl() || null;
  } catch (e) {
    return null;
  }
}

function nomeDoEmail_(email) {
  if (!email) return "Usuário";
  return String(email.split("@")[0]).replace(/[._]+/g, " ").replace(/\b\w/g, function (c) { return c.toUpperCase(); });
}

/* ========================================================================== */
/* Planilha de controle (Acessos e Fotos)                                     */
/* ========================================================================== */

function planilhaControle_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty("CONTROLE_ID");
  if (id) {
    try {
      return SpreadsheetApp.openById(id);
    } catch (e) {
      throw erro_("INTERNAL_SERVER_ERROR", "Não foi possível abrir a planilha de controle (" + id + "). Rode setupInicial novamente.");
    }
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    id = props.getProperty("CONTROLE_ID");
    if (id) return SpreadsheetApp.openById(id);
    var ss = SpreadsheetApp.create(CONFIG.NOME_PLANILHA_CONTROLE);
    props.setProperty("CONTROLE_ID", ss.getId());
    prepararAbaControle_(ss, CONFIG.ABA_ACESSOS, CONFIG.CABECALHO_ACESSOS);
    prepararAbaControle_(ss, CONFIG.ABA_FOTOS, CONFIG.CABECALHO_FOTOS);
    semearAdministradores_(ss);
    return ss;
  } finally {
    lock.releaseLock();
  }
}

function prepararAbaControle_(ss, nome, cabecalho) {
  var aba = ss.getSheetByName(nome);
  if (!aba) {
    // A planilha nova nasce com uma aba "Página1"/"Sheet1": reaproveita a primeira vazia.
    var primeira = ss.getSheets()[0];
    if (primeira && primeira.getLastRow() === 0 && !ss.getSheetByName(CONFIG.ABA_ACESSOS) && nome === CONFIG.ABA_ACESSOS) {
      aba = primeira;
      aba.setName(nome);
    } else {
      aba = ss.insertSheet(nome);
    }
  }
  if (aba.getLastRow() === 0) {
    aba.getRange(1, 1, 1, cabecalho.length).setValues([cabecalho]).setFontWeight("bold");
    aba.setFrozenRows(1);
  }
  return aba;
}

function semearAdministradores_(ss) {
  var aba = ss.getSheetByName(CONFIG.ABA_ACESSOS);
  if (aba.getLastRow() > 1) return;
  var agora = new Date().toISOString();
  var linhas = CONFIG.ADMINS_INICIAIS.map(function (a, i) {
    return [i + 1, a[0], a[1], a[2], 1, "", "", "seed", agora, agora];
  });
  aba.getRange(2, 1, linhas.length, CONFIG.CABECALHO_ACESSOS.length).setValues(linhas);
  limparCacheAcessos_();
}

/** Lê todos os acessos como objetos (com cache curto; o cache é limpo a cada gravação). */
function todosAcessos_() {
  var cache = CacheService.getScriptCache();
  var emCache = null;
  try { emCache = cache.get("acessos:v1"); } catch (e) { emCache = null; }
  if (emCache) return JSON.parse(emCache);

  var aba = planilhaControle_().getSheetByName(CONFIG.ABA_ACESSOS);
  if (!aba) throw erro_("INTERNAL_SERVER_ERROR", "A aba Acessos não existe na planilha de controle.");
  var ultima = aba.getLastRow();
  var lista = [];
  if (ultima >= 2) {
    var valores = aba.getRange(2, 1, ultima - 1, CONFIG.CABECALHO_ACESSOS.length).getValues();
    valores.forEach(function (l, i) {
      var email = String(l[1] || "").trim().toLowerCase();
      if (!email) return;
      lista.push({
        _linha: i + 2,
        id: Number(l[0]) || 0,
        email: email,
        name: String(l[2] || "").trim() || nomeDoEmail_(email),
        role: PERFIS.indexOf(String(l[3])) >= 0 ? String(l[3]) : "user",
        isActive: Number(l[4]) === 0 && String(l[4]) !== "" ? 0 : 1,
        allowedServices: String(l[5] || "").trim() === "" ? null : String(l[5]),
        avatarUrl: String(l[6] || "").trim() === "" ? null : String(l[6]),
        addedBy: String(l[7] || "").trim() === "" ? null : String(l[7]),
        createdAt: textoData_(l[8]),
        updatedAt: textoData_(l[9]),
      });
    });
  }
  try { cache.put("acessos:v1", JSON.stringify(lista), CONFIG.CACHE_ACESSOS_SEGUNDOS); } catch (e) { /* cache é só otimização */ }
  return lista;
}

function textoData_(valor) {
  if (Object.prototype.toString.call(valor) === "[object Date]") return valor.toISOString();
  return String(valor || "");
}

function limparCacheAcessos_() {
  try { CacheService.getScriptCache().remove("acessos:v1"); } catch (e) { /* ignora */ }
}

function acessoPorEmail_(email) {
  var lista = todosAcessos_();
  for (var i = 0; i < lista.length; i++) if (lista[i].email === email) return lista[i];
  return null;
}

function acessoPorId_(id) {
  var lista = todosAcessos_();
  for (var i = 0; i < lista.length; i++) if (lista[i].id === Number(id)) return lista[i];
  return null;
}

function linhaDoAcesso_(u) {
  return [u.id, u.email, u.name, u.role, u.isActive, u.allowedServices === null ? "" : u.allowedServices,
    u.avatarUrl || "", u.addedBy || "", u.createdAt, u.updatedAt];
}

/** Executa uma alteração protegida por trava (evita dois administradores gravando ao mesmo tempo). */
function comTrava_(funcao) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    limparCacheAcessos_();
    var resultado = funcao();
    limparCacheAcessos_();
    return resultado;
  } finally {
    lock.releaseLock();
  }
}

function abaAcessos_() {
  return planilhaControle_().getSheetByName(CONFIG.ABA_ACESSOS);
}

function gravarAcesso_(u) {
  abaAcessos_().getRange(u._linha, 1, 1, CONFIG.CABECALHO_ACESSOS.length).setValues([linhaDoAcesso_(u)]);
}

function visaoAcesso_(u) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    isActive: u.isActive,
    allowedServices: u.allowedServices,
    allowedServicesList: u.allowedServices === null ? [] : parseServicos_(u.allowedServices),
    avatarUrl: u.avatarUrl,
    addedBy: u.addedBy,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}

/** Aceita JSON (["A","B"]) ou texto separado por vírgulas, como o banco antigo. */
function parseServicos_(bruto) {
  if (bruto === null || bruto === undefined || bruto === "") return [];
  try {
    var lista = JSON.parse(bruto);
    if (Array.isArray(lista)) return lista.map(function (s) { return String(s).trim(); }).filter(Boolean);
  } catch (e) { /* cai no formato por vírgulas */ }
  return String(bruto).split(",").map(function (s) { return s.trim(); }).filter(Boolean);
}

function serializarServicos_(lista) {
  var vistos = {};
  var unicos = [];
  (lista || []).forEach(function (s) {
    var t = String(s).trim();
    if (t && !vistos[t]) { vistos[t] = true; unicos.push(t); }
  });
  return JSON.stringify(unicos);
}

function privilegiados_(apenasAtivos) {
  return todosAcessos_().filter(function (u) {
    return (u.role === "admin" || u.role === "super_admin") && (!apenasAtivos || u.isActive === 1);
  });
}

function validarEmailEntrada_(valor) {
  var email = String(valor || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw erro_("BAD_REQUEST", "Informe um e-mail válido.");
  if (email.slice(-CONFIG.DOMINIO.length) !== CONFIG.DOMINIO) {
    throw erro_("BAD_REQUEST", "Cadastre somente e-mails do domínio " + CONFIG.DOMINIO + ".");
  }
  return email;
}

function validarPerfil_(valor) {
  if (PERFIS.indexOf(valor) < 0) throw erro_("BAD_REQUEST", "Perfil inválido.");
  return valor;
}

/* ---- operações de acesso (tela Cadastro) -------------------------------- */

function listarAcessos_() {
  return todosAcessos_()
    .slice()
    .sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : b.id - a.id; })
    .map(visaoAcesso_);
}

function adicionarAcesso_(entrada, ctx) {
  var email = validarEmailEntrada_(entrada.email);
  var nome = String(entrada.name || "").trim();
  if (nome.length < 2) throw erro_("BAD_REQUEST", "Nome deve ter pelo menos 2 caracteres");
  var perfil = validarPerfil_(entrada.role || "user");
  var servicos = Array.isArray(entrada.allowedServices) ? serializarServicos_(entrada.allowedServices) : undefined;
  var avatar = entrada.avatarUrl ? String(entrada.avatarUrl).trim() : null;
  if (avatar && !/^https:\/\//i.test(avatar)) throw erro_("BAD_REQUEST", "A foto precisa ser um link https.");

  return comTrava_(function () {
    var agora = new Date().toISOString();
    var existente = acessoPorEmail_(email);
    if (existente) {
      existente.name = nome;
      existente.role = perfil;
      if (servicos !== undefined) existente.allowedServices = servicos;
      if (avatar) existente.avatarUrl = avatar;
      existente.addedBy = ctx.email || existente.addedBy;
      existente.updatedAt = agora;
      gravarAcesso_(existente);
      return visaoAcesso_(existente);
    }
    var lista = todosAcessos_();
    var proximoId = lista.reduce(function (max, u) { return Math.max(max, u.id); }, 0) + 1;
    var novo = {
      id: proximoId, email: email, name: nome, role: perfil, isActive: 1,
      allowedServices: servicos === undefined ? null : servicos,
      avatarUrl: avatar, addedBy: ctx.email || null, createdAt: agora, updatedAt: agora,
    };
    var aba = abaAcessos_();
    var linha = aba.getLastRow() + 1;
    aba.getRange(linha, 1, 1, CONFIG.CABECALHO_ACESSOS.length).setValues([linhaDoAcesso_(novo)]);
    novo._linha = linha;
    return visaoAcesso_(novo);
  });
}

function exigirAcesso_(id) {
  var u = acessoPorId_(id);
  if (!u) throw erro_("NOT_FOUND", "Usuário não encontrado");
  return u;
}

function atualizarPerfil_(entrada) {
  var perfil = validarPerfil_(entrada.role);
  return comTrava_(function () {
    var u = exigirAcesso_(entrada.id);
    if (perfil === "user" && (u.role === "admin" || u.role === "super_admin") && privilegiados_(false).length <= 1) {
      throw erro_("BAD_REQUEST", "O sistema precisa manter pelo menos um administrador.");
    }
    u.role = perfil;
    u.updatedAt = new Date().toISOString();
    gravarAcesso_(u);
    return visaoAcesso_(u);
  });
}

function atualizarNome_(entrada) {
  var nome = String(entrada.name || "").trim();
  if (nome.length < 2) throw erro_("BAD_REQUEST", "Nome deve ter pelo menos 2 caracteres");
  if (nome.length > 255) throw erro_("BAD_REQUEST", "Nome muito longo.");
  return comTrava_(function () {
    var u = exigirAcesso_(entrada.id);
    u.name = nome;
    u.updatedAt = new Date().toISOString();
    gravarAcesso_(u);
    return visaoAcesso_(u);
  });
}

function atualizarServicos_(entrada) {
  if (!Array.isArray(entrada.allowedServices)) throw erro_("BAD_REQUEST", "Lista de serviços inválida.");
  return comTrava_(function () {
    var u = exigirAcesso_(entrada.id);
    u.allowedServices = serializarServicos_(entrada.allowedServices);
    u.updatedAt = new Date().toISOString();
    gravarAcesso_(u);
    return visaoAcesso_(u);
  });
}

function alternarStatus_(entrada) {
  var ativo = Number(entrada.isActive) === 1 ? 1 : 0;
  return comTrava_(function () {
    var u = exigirAcesso_(entrada.id);
    if (ativo === 0 && (u.role === "admin" || u.role === "super_admin") && privilegiados_(true).length <= 1) {
      throw erro_("BAD_REQUEST", "O sistema precisa manter pelo menos um administrador ativo.");
    }
    u.isActive = ativo;
    u.updatedAt = new Date().toISOString();
    gravarAcesso_(u);
    return visaoAcesso_(u);
  });
}

function removerAcesso_(entrada) {
  return comTrava_(function () {
    var u = acessoPorId_(entrada.id);
    if (!u) return false;
    if ((u.role === "admin" || u.role === "super_admin") && privilegiados_(false).length <= 1) {
      throw erro_("BAD_REQUEST", "Não é possível remover o único administrador do sistema.");
    }
    abaAcessos_().deleteRow(u._linha);
    return true;
  });
}

/* ========================================================================== */
/* Indicadores (planilha do Painel, agora privada)                            */
/* ========================================================================== */

function lerIndicadores_(forcar) {
  if (!forcar) {
    var guardado = cacheLerGrande_("indicadores:v1");
    if (guardado) return JSON.parse(guardado);
  }
  var ss = SpreadsheetApp.openById(CONFIG.PAINEL_ID);
  var resultado = {};
  Object.keys(CONFIG.ABAS_INDICADORES).forEach(function (chave) {
    resultado[chave] = lerAbaComoLinhas_(ss, CONFIG.ABAS_INDICADORES[chave]);
  });
  try { cacheGravarGrande_("indicadores:v1", JSON.stringify(resultado), CONFIG.CACHE_INDICADORES_SEGUNDOS); } catch (e) { /* ignora */ }
  return resultado;
}

/** Equivalente ao antigo gviz: linha 1 = cabeçalho; datas viram texto ISO; vazio vira null. */
function lerAbaComoLinhas_(ss, nome) {
  var aba = ss.getSheetByName(nome);
  if (!aba) throw erro_("INTERNAL_SERVER_ERROR", "A aba “" + nome + "” não foi encontrada na planilha do Painel.");
  var valores = aba.getDataRange().getValues();
  if (valores.length < 1) return [];
  var colunas = valores[0].map(function (c, i) {
    var rotulo = String(c === null || c === undefined ? "" : c).trim();
    return rotulo || letraDaColuna_(i);
  });
  var linhas = [];
  for (var r = 1; r < valores.length; r++) {
    var linha = valores[r];
    var objeto = {};
    var algum = false;
    for (var c = 0; c < colunas.length; c++) {
      var valor = converterCelula_(linha[c]);
      if (valor !== null) algum = true;
      objeto[colunas[c]] = valor;
    }
    if (algum) linhas.push(objeto);
  }
  return linhas;
}

function converterCelula_(valor) {
  if (valor === null || valor === undefined || valor === "") return null;
  if (Object.prototype.toString.call(valor) === "[object Date]") {
    return isNaN(valor.getTime()) ? null : valor.toISOString();
  }
  if (typeof valor === "number") return isFinite(valor) ? valor : null;
  if (typeof valor === "boolean") return valor ? "TRUE" : "FALSE";
  return String(valor);
}

function letraDaColuna_(indice) {
  var n = indice + 1;
  var s = "";
  while (n > 0) {
    var resto = (n - 1) % 26;
    s = String.fromCharCode(65 + resto) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Cache de textos grandes: compacta (gzip) e divide em pedaços de até 90 mil caracteres. */
function cacheGravarGrande_(chave, texto, segundos) {
  var cache = CacheService.getScriptCache();
  var bytes = Utilities.gzip(Utilities.newBlob(texto, "application/json", "dados.json")).getBytes();
  var b64 = Utilities.base64Encode(bytes);
  var tamanho = 90000;
  var partes = Math.ceil(b64.length / tamanho);
  var mapa = {};
  for (var i = 0; i < partes; i++) mapa[chave + ":" + i] = b64.substr(i * tamanho, tamanho);
  mapa[chave + ":n"] = String(partes);
  cache.putAll(mapa, segundos);
}

function cacheLerGrande_(chave) {
  try {
    var cache = CacheService.getScriptCache();
    var n = Number(cache.get(chave + ":n"));
    if (!n) return null;
    var chaves = [];
    for (var i = 0; i < n; i++) chaves.push(chave + ":" + i);
    var mapa = cache.getAll(chaves);
    var b64 = "";
    for (var j = 0; j < n; j++) {
      var parte = mapa[chave + ":" + j];
      if (!parte) return null;
      b64 += parte;
    }
    var bytes = Utilities.base64Decode(b64);
    return Utilities.ungzip(Utilities.newBlob(bytes, "application/x-gzip", "dados.gz")).getDataAsString();
  } catch (e) {
    return null;
  }
}

/* ========================================================================== */
/* Colaboradores e carteira                                                   */
/* ========================================================================== */

function normalizarTexto_(valor) {
  return String(valor === null || valor === undefined ? "" : valor)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function funcaoUnica_(servico, grupo) {
  return { servico: servico, grupo: grupo, servicos: [servico] };
}

var FUNCOES_CONHECIDAS_ = {
  "receita": funcaoUnica_("BPO Operacional Receitas", "Operacional"),
  "receita 2": funcaoUnica_("BPO Operacional Receitas", "Operacional"),
  "despesa": funcaoUnica_("BPO Operacional Despesas", "Operacional"),
  "despesa 2": funcaoUnica_("BPO Operacional Despesas", "Operacional"),
  "agend. bancario": funcaoUnica_("BPO Controle/Tesouraria", "Operacional"),
  "conciliacao bancaria": funcaoUnica_("BPO Controle/Tesouraria", "Operacional"),
  "bpo gerencial": funcaoUnica_("BPO Gerencial", "Gerencial"),
  "suprimentos pedidos": funcaoUnica_("BPO Suprimentos", "Suprimentos"),
  "suprimentos outros": funcaoUnica_("BPO Suprimentos", "Suprimentos"),
  "recursos humanos": {
    servico: "Recursos Humanos",
    grupo: "Outros",
    servicos: ["Recursos Humanos", "Cargos, Salários e Carreira", "RH sob Medida", "Recrutamento e Seleção"],
  },
};

/** Mesma regra de shared/colaboradores.ts (resolverFuncao): campo de responsável -> serviço e grupo. */
function resolverFuncao_(funcao) {
  var chave = normalizarTexto_(funcao);
  if (Object.prototype.hasOwnProperty.call(FUNCOES_CONHECIDAS_, chave)) return FUNCOES_CONHECIDAS_[chave];
  var grupo = chave.indexOf("gerencial") >= 0 ? "Gerencial"
    : chave.indexOf("suprimentos") >= 0 ? "Suprimentos"
    : chave.indexOf("bpo operacional") >= 0 ? "Operacional" : "Outros";
  var nome = String(funcao).trim();
  return { servico: nome, grupo: grupo, servicos: [nome] };
}

/** Lê as abas gravadas pelo colaboradores_api.gs. Sem elas, devolve dados de exemplo (como antes). */
function lerColaboradores_() {
  var ss = SpreadsheetApp.openById(CONFIG.PAINEL_ID);
  var abaC = ss.getSheetByName(CONFIG.ABA_COLABORADORES);
  var abaV = ss.getSheetByName(CONFIG.ABA_CARTEIRA);
  if (!abaC || !abaV || abaC.getLastRow() < 2 || abaV.getLastRow() < 2) return payloadDeExemplo_();

  var c = abaC.getRange(2, 1, abaC.getLastRow() - 1, 6).getValues();
  var v = abaV.getRange(2, 1, abaV.getLastRow() - 1, 4).getValues();
  return {
    fonte: "pipefy",
    atualizadoEm: String(c[0][5] || new Date().toISOString()),
    colaboradores: c.filter(function (l) { return l[0]; }).map(function (l) {
      return {
        email: String(l[0]).trim().toLowerCase(), nome: String(l[1]), cargo: String(l[2] || ""),
        departamento: String(l[3] || ""), telefone: l[4] ? String(l[4]) : null, fotoUrl: null,
      };
    }),
    vinculos: v.filter(function (l) { return l[0] && l[1] && l[2]; }).map(function (l) {
      return { email: String(l[0]).trim().toLowerCase(), cliente: String(l[1]), funcao: String(l[2]) };
    }),
  };
}

function payloadDeExemplo_() {
  var exemplo = [
    ["Ana Exemplo", "Consultora BPO Gerencial", "BPO Gerencial", "ana.exemplo"],
    ["Bruno Exemplo", "Consultor BPO Gerencial", "BPO Gerencial", "bruno.exemplo"],
    ["Carla Exemplo", "Especialista em FP&A", "BPO Gerencial", "carla.exemplo"],
    ["Diego Exemplo", "Assistente Financeiro", "BPO Operacional", "diego.exemplo"],
    ["Elisa Exemplo", "Assistente Financeiro", "BPO Operacional", "elisa.exemplo"],
    ["Fabio Exemplo", "Analista Financeiro", "BPO Operacional", "fabio.exemplo"],
    ["Gisele Exemplo", "Analista Financeiro", "BPO Operacional", "gisele.exemplo"],
    ["Heitor Exemplo", "Assistente Financeiro", "BPO Operacional", "heitor.exemplo"],
    ["Iara Exemplo", "Analista de Gestão de Pedidos", "Suprimentos", "iara.exemplo"],
    ["Joao Exemplo", "Analista de Gestão de Pedidos", "Suprimentos", "joao.exemplo"],
    ["Karen Exemplo", "Analista Pleno", "Suprimentos", "karen.exemplo"],
    ["Lucas Exemplo", "Consultor de Operação Assistida", "Operação Assistida", "lucas.exemplo"],
  ];
  return {
    fonte: "exemplo",
    atualizadoEm: new Date().toISOString(),
    colaboradores: exemplo.map(function (x) {
      // Domínio .invalid nunca resolve: nenhum e-mail de exemplo chega a alguém real.
      return { email: x[3] + "@exemplo.invalid", nome: x[0], cargo: x[1], departamento: x[2], telefone: "+55 11 90000-0000", fotoUrl: null };
    }),
    vinculos: [],
  };
}

/** Regras de acesso: serviços restritos filtram os vínculos; telefone visível para todos os usuários autorizados. */
function prepararPayloadParaUsuario_(payload, role, servicosPermitidos) {
  var permitidos = null;
  if (servicosPermitidos) {
    permitidos = {};
    servicosPermitidos.forEach(function (s) { permitidos[normalizarTexto_(s)] = true; });
  }
  var vinculos = permitidos
    ? payload.vinculos.filter(function (v) {
        return resolverFuncao_(v.funcao).servicos.some(function (s) { return permitidos[normalizarTexto_(s)] === true; });
      })
    : payload.vinculos;
  var comVinculo = {};
  vinculos.forEach(function (v) { comVinculo[v.email.toLowerCase()] = true; });
  var colaboradores = (permitidos
    ? payload.colaboradores.filter(function (c) { return comVinculo[c.email.toLowerCase()] === true; })
    : payload.colaboradores
  ).map(function (c) {
    return c;
  });
  return { fonte: payload.fonte, atualizadoEm: payload.atualizadoEm, colaboradores: colaboradores, vinculos: vinculos };
}

function carteira_(ctx) {
  var u = ctx.usuario;
  var restrito = u.role === "user" && u.allowedServices !== null;
  var payload = lerColaboradores_();
  var visivel = prepararPayloadParaUsuario_(payload, u.role, restrito ? parseServicos_(u.allowedServices) : null);

  var enviadas = {};
  var avatares = {};
  try {
    fotosEnviadas_().forEach(function (f) { enviadas[f.email] = f; });
    todosAcessos_().forEach(function (a) { if (a.avatarUrl) avatares[a.email] = a.avatarUrl; });
  } catch (e) {
    console.warn("[carteira] não foi possível ler as fotos: " + e);
  }
  visivel.colaboradores = visivel.colaboradores.map(function (c) {
    var chave = c.email.toLowerCase();
    var copia = {};
    Object.keys(c).forEach(function (k) { copia[k] = c[k]; });
    var escolhida = escolherFoto_(enviadas[chave], avatares[chave], c.fotoUrl);
    copia.fotoUrl = escolhida.fotoUrl;
    copia.fotoOrigem = escolhida.fotoOrigem;
    return copia;
  });
  return visivel;
}

/* ========================================================================== */
/* Fotos                                                                      */
/* ========================================================================== */

/** Prioridade: enviada por administrador > foto cadastrada na aba Acessos > foto do payload > iniciais. */
function escolherFoto_(enviada, avatarAcesso, fotoPayload) {
  if (enviada && enviada.url) return { fotoUrl: enviada.url, fotoOrigem: "upload" };
  if (avatarAcesso && /^https:\/\//i.test(String(avatarAcesso).trim())) return { fotoUrl: String(avatarAcesso).trim(), fotoOrigem: "google" };
  if (fotoPayload && /^https?:\/\//i.test(String(fotoPayload).trim())) return { fotoUrl: String(fotoPayload).trim(), fotoOrigem: "pipefy" };
  return { fotoUrl: null, fotoOrigem: null };
}

function abaFotos_() {
  return planilhaControle_().getSheetByName(CONFIG.ABA_FOTOS);
}

function fotosEnviadas_() {
  var aba = abaFotos_();
  if (!aba || aba.getLastRow() < 2) return [];
  return aba.getRange(2, 1, aba.getLastRow() - 1, CONFIG.CABECALHO_FOTOS.length).getValues()
    .map(function (l, i) {
      return { _linha: i + 2, email: String(l[0] || "").trim().toLowerCase(), fileId: String(l[1] || ""), url: String(l[2] || ""), mime: String(l[3] || "") };
    })
    .filter(function (f) { return f.email && f.url; });
}

function detectarMimeFoto_(bytes) {
  function b(i) { return bytes[i] & 255; }
  if (bytes.length >= 3 && b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4e && b(3) === 0x47 &&
      b(4) === 0x0d && b(5) === 0x0a && b(6) === 0x1a && b(7) === 0x0a) return "image/png";
  if (bytes.length >= 12 && b(0) === 0x52 && b(1) === 0x49 && b(2) === 0x46 && b(3) === 0x46 &&
      b(8) === 0x57 && b(9) === 0x45 && b(10) === 0x42 && b(11) === 0x50) return "image/webp";
  return null;
}

/** Valida o data URL enviado pelo navegador (tipo declarado, tamanho e assinatura real do arquivo). */
function validarFotoDataUrl_(dataUrl) {
  var m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+\/]+={0,2})$/.exec(String(dataUrl || ""));
  if (!m) throw erro_("BAD_REQUEST", "Envie uma imagem JPG, PNG ou WebP.");
  var declarado = m[1];
  var base64 = m[2];
  if (base64.length > Math.ceil((CONFIG.FOTO_MAX_BYTES * 4) / 3) + 4) {
    throw erro_("BAD_REQUEST", "A imagem é grande demais. Use uma foto menor.");
  }
  var bytes = Utilities.base64Decode(base64);
  if (!bytes.length || bytes.length > CONFIG.FOTO_MAX_BYTES) throw erro_("BAD_REQUEST", "A imagem é grande demais. Use uma foto menor.");
  var real = detectarMimeFoto_(bytes);
  if (!real || real !== declarado) throw erro_("BAD_REQUEST", "O arquivo não é uma imagem válida.");
  return { mime: real, bytes: bytes };
}

function extensaoDoMime_(mime) {
  return mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
}

/**
 * Envia a foto para a pasta pública do Drive e devolve o link de visualização.
 * Roda com a permissão do DONO do script (Executar como: Eu), então quem usa o painel
 * não precisa ter acesso de escrita à pasta.
 */
function enviarFotoParaDrive_(email, foto) {
  var nomeArquivo = email.replace(/[^a-z0-9._-]/g, "_") + "-" + new Date().getTime() + "." + extensaoDoMime_(foto.mime);
  var blob = Utilities.newBlob(foto.bytes, foto.mime, nomeArquivo);
  var pasta = DriveApp.getFolderById(CONFIG.PASTA_FOTOS_ID);
  var arquivo = pasta.createFile(blob);
  arquivo.setSharing(DriveApp.Access.ANYONE, DriveApp.Permission.VIEW);
  var id = arquivo.getId();
  return { fileId: id, url: "https://lh3.googleusercontent.com/d/" + id + "=" + CONFIG.FOTO_TAMANHO_URL };
}

function salvarFoto_(entrada, ctx) {
  var email = String(entrada.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw erro_("BAD_REQUEST", "E-mail inválido.");
  var payload = lerColaboradores_();
  var existe = payload.colaboradores.some(function (c) { return c.email.toLowerCase() === email; });
  if (!existe) throw erro_("NOT_FOUND", "Colaborador não encontrado.");
  var foto = validarFotoDataUrl_(entrada.imagem);

  return comTrava_(function () {
    var enviado = enviarFotoParaDrive_(email, foto);
    var aba = abaFotos_();
    var agora = new Date().toISOString();
    var linha = [email, enviado.fileId, enviado.url, foto.mime, ctx.email || "admin", agora];
    var anterior = fotosEnviadas_().filter(function (f) { return f.email === email; })[0];
    if (anterior) {
      aba.getRange(anterior._linha, 1, 1, linha.length).setValues([linha]);
      descartarArquivo_(anterior.fileId);
    } else {
      aba.getRange(aba.getLastRow() + 1, 1, 1, linha.length).setValues([linha]);
    }
    return { ok: true };
  });
}

function removerFoto_(entrada) {
  var email = String(entrada.email || "").trim().toLowerCase();
  return comTrava_(function () {
    var anterior = fotosEnviadas_().filter(function (f) { return f.email === email; })[0];
    if (anterior) {
      abaFotos_().deleteRow(anterior._linha);
      descartarArquivo_(anterior.fileId);
    }
    return { ok: true };
  });
}

/** Manda o arquivo antigo para a lixeira do Drive (recuperável por 30 dias). Falha aqui não quebra a troca. */
function descartarArquivo_(fileId) {
  if (!fileId) return;
  try {
    DriveApp.getFileById(fileId).setTrashed(true);
  } catch (e) {
    console.warn("[fotos] não foi possível descartar o arquivo antigo " + fileId + ": " + e);
  }
}

/* ========================================================================== */
/* Rotinas para rodar à mão no editor                                         */
/* ========================================================================== */

/** RODE ESTA PRIMEIRO: autoriza o script, cria a planilha de controle e cadastra os administradores. */
function setupInicial() {
  var ss = planilhaControle_();
  Logger.log("Planilha de controle: " + ss.getUrl());
  Logger.log("Acessos cadastrados: " + todosAcessos_().length);
  diagnostico();
}

/** Confere se tudo está acessível (não grava nada). */
function diagnostico() {
  Logger.log("Conta que executa o script (dono): " + Session.getEffectiveUser().getEmail());
  var ctrl = planilhaControle_();
  Logger.log("Controle OK: " + ctrl.getUrl());
  Logger.log("Administradores ativos: " + privilegiados_(true).map(function (u) { return u.email; }).join(", "));

  var painel = SpreadsheetApp.openById(CONFIG.PAINEL_ID);
  Object.keys(CONFIG.ABAS_INDICADORES).forEach(function (k) {
    var aba = painel.getSheetByName(CONFIG.ABAS_INDICADORES[k]);
    Logger.log((aba ? "OK   " : "FALTA") + " aba “" + CONFIG.ABAS_INDICADORES[k] + "”" + (aba ? " (" + (aba.getLastRow() - 1) + " linhas)" : ""));
  });
  [CONFIG.ABA_COLABORADORES, CONFIG.ABA_CARTEIRA].forEach(function (nome) {
    var aba = painel.getSheetByName(nome);
    Logger.log((aba && aba.getLastRow() > 1 ? "OK   " : "FALTA") + " aba “" + nome + "” — se faltar, rode colabAtualizarPlanilha (colaboradores_api.gs)");
  });
  try {
    var pasta = DriveApp.getFolderById(CONFIG.PASTA_FOTOS_ID);
    Logger.log("Pasta de fotos OK: " + pasta.getName());
  } catch (e) {
    Logger.log("FALTA acesso à pasta de fotos (" + CONFIG.PASTA_FOTOS_ID + "): " + e);
  }
  Logger.log("URL do Web App (depois de implantar): " + (urlDoApp_() || "(ainda não implantado)"));
}

/** Se precisar recomeçar a planilha de controle: apaga o vínculo (a planilha antiga NÃO é apagada). */
function reiniciarControle() {
  PropertiesService.getScriptProperties().deleteProperty("CONTROLE_ID");
  limparCacheAcessos_();
  Logger.log("Vínculo removido. Rode setupInicial para criar uma planilha de controle nova.");
}
