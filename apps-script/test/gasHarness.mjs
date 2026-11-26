/**
 * Simulador mínimo do ambiente do Google Apps Script para testar o Code.gs no Node.
 * Cobre só o que o Code.gs usa: Session, CacheService, LockService, PropertiesService,
 * SpreadsheetApp, DriveApp, Utilities, ScriptApp, Logger.
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import zlib from "node:zlib";

class Intervalo {
  constructor(aba, linha, coluna, nLinhas, nColunas) {
    Object.assign(this, { aba, linha, coluna, nLinhas, nColunas });
  }
  getValues() {
    const saida = [];
    for (let r = 0; r < this.nLinhas; r++) {
      const linha = [];
      for (let c = 0; c < this.nColunas; c++) {
        const v = this.aba.dados[this.linha - 1 + r]?.[this.coluna - 1 + c];
        linha.push(v === undefined ? "" : v);
      }
      saida.push(linha);
    }
    return saida;
  }
  setValues(valores) {
    valores.forEach((linha, r) => {
      const alvo = (this.aba.dados[this.linha - 1 + r] ??= []);
      linha.forEach((v, c) => { alvo[this.coluna - 1 + c] = v; });
    });
    return this;
  }
  setFontWeight() { return this; }
}

class Aba {
  constructor(nome) { this.nome = nome; this.dados = []; }
  getName() { return this.nome; }
  setName(n) { this.nome = n; }
  getLastRow() {
    let ultima = 0;
    this.dados.forEach((l, i) => { if (l && l.some((v) => v !== "" && v !== undefined && v !== null)) ultima = i + 1; });
    return ultima;
  }
  getMaxCols() { return this.dados.reduce((m, l) => Math.max(m, l?.length ?? 0), 0); }
  getRange(l, c, nl = 1, nc = 1) { return new Intervalo(this, l, c, nl, nc); }
  getDataRange() { return new Intervalo(this, 1, 1, this.getLastRow(), this.getMaxCols()); }
  setFrozenRows() {}
  deleteRow(n) { this.dados.splice(n - 1, 1); }
}

class Planilha {
  constructor(id, nome) {
    this.id = id; this.nome = nome;
    this.abas = [new Aba("Página1")];
  }
  getId() { return this.id; }
  getUrl() { return `https://docs.google.com/spreadsheets/d/${this.id}/edit`; }
  getSheets() { return this.abas; }
  getSheetByName(n) { return this.abas.find((a) => a.nome === n) ?? null; }
  insertSheet(n) { const a = new Aba(n); this.abas.push(a); return a; }
}

const bytesAssinados = (buf) => Array.from(buf, (b) => (b > 127 ? b - 256 : b));
const bufDe = (arr) => Buffer.from(arr.map((b) => b & 255));

class Blob {
  constructor(conteudo, tipo, nome) {
    this.buf = typeof conteudo === "string" ? Buffer.from(conteudo, "utf8") : bufDe(conteudo);
    this.tipo = tipo; this.nome = nome;
  }
  getBytes() { return bytesAssinados(this.buf); }
  getDataAsString() { return this.buf.toString("utf8"); }
  getContentType() { return this.tipo; }
  getName() { return this.nome; }
}

export function criarAmbiente({ painel = {} } = {}) {
  const estado = {
    emailAtivo: "",
    proprietario: "ederlei.pereira@vena.app.br",
    props: new Map(),
    cache: new Map(),
    planilhas: new Map(),
    arquivos: new Map(),
    pastaPermitida: true,
    logs: [],
    chamadasPainel: 0,
    contagemId: 0,
  };

  // Planilha do Painel simulada: { "Nome da aba": [ [cabeçalho...], [linha...] ] }
  const ssPainel = new Planilha("PAINEL", "Painel");
  ssPainel.abas = [];
  Object.entries(painel).forEach(([nome, linhas]) => {
    const aba = ssPainel.insertSheet(nome);
    linhas.forEach((l, i) => aba.getRange(i + 1, 1, 1, l.length).setValues([l]));
  });
  const abrir = (id) => {
    if (id === "1BWWM39AJ88tj59EWN4qJCP5kVJAx16t7yVYuVw_QuIY") { estado.chamadasPainel++; return ssPainel; }
    const ss = estado.planilhas.get(id);
    if (!ss) throw new Error("Planilha inexistente: " + id);
    return ss;
  };

  const ctx = {
    console: { error() {}, warn() {}, log() {} },
    Logger: { log: (m) => estado.logs.push(String(m)) },
    Session: {
      getActiveUser: () => ({ getEmail: () => estado.emailAtivo }),
      getEffectiveUser: () => ({ getEmail: () => estado.proprietario }),
    },
    ScriptApp: { getService: () => ({ getUrl: () => "https://script.google.com/a/macros/vena.app.br/s/TESTE/exec" }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => estado.props.get(k) ?? null,
        setProperty: (k, v) => estado.props.set(k, v),
        deleteProperty: (k) => estado.props.delete(k),
      }),
    },
    CacheService: {
      getScriptCache: () => ({
        get: (k) => estado.cache.get(k) ?? null,
        put: (k, v) => { if (String(v).length > 100000) throw new Error("Argumento grande demais"); estado.cache.set(k, String(v)); },
        putAll: (m) => Object.entries(m).forEach(([k, v]) => { if (String(v).length > 100000) throw new Error("Argumento grande demais"); estado.cache.set(k, String(v)); }),
        getAll: (ks) => Object.fromEntries(ks.filter((k) => estado.cache.has(k)).map((k) => [k, estado.cache.get(k)])),
        remove: (k) => estado.cache.delete(k),
      }),
    },
    SpreadsheetApp: {
      create: (nome) => {
        const id = `CONTROLE${++estado.contagemId}`;
        const ss = new Planilha(id, nome);
        estado.planilhas.set(id, ss);
        return ss;
      },
      openById: abrir,
    },
    Utilities: {
      base64Decode: (s) => bytesAssinados(Buffer.from(s, "base64")),
      base64Encode: (b) => (typeof b === "string" ? Buffer.from(b) : bufDe(b)).toString("base64"),
      newBlob: (c, t, n) => new Blob(c, t, n),
      gzip: (blob) => new Blob(Array.from(zlib.gzipSync(blob.buf)), "application/x-gzip", "x.gz"),
      ungzip: (blob) => new Blob(Array.from(zlib.gunzipSync(blob.buf)), "text/plain", "x"),
      getUuid: () => "00000000-0000-0000-0000-000000000000",
    },
    DriveApp: {
      Access: { ANYONE: "ANYONE" },
      Permission: { VIEW: "VIEW" },
      getFolderById: (id) => {
        if (!estado.pastaPermitida) throw new Error("Exception: Você não tem permissão para acessar a pasta.");
        return {
          getName: () => "Imagens públicas",
          createFile: (blob) => {
            const arq = { id: `ARQ${estado.arquivos.size + 1}`, blob, compartilhamento: null, lixeira: false };
            estado.arquivos.set(arq.id, arq);
            return {
              getId: () => arq.id,
              setSharing: (a, p) => { arq.compartilhamento = `${a}:${p}`; },
            };
          },
        };
      },
      getFileById: (id) => {
        const arq = estado.arquivos.get(id);
        if (!arq) throw new Error("Arquivo não encontrado");
        return { setTrashed: (t) => { arq.lixeira = t; } };
      },
    },
  };

  const contexto = vm.createContext(ctx);
  const codigo = fs.readFileSync(path.resolve(import.meta.dirname, "..", "Code.gs"), "utf8");
  vm.runInContext(codigo, contexto, { filename: "Code.gs" });

  const chamar = (procedimento, entrada) => {
    const bruto = vm.runInContext("api", contexto)(procedimento, entrada === undefined ? null : JSON.stringify(entrada));
    return JSON.parse(bruto);
  };

  return {
    estado,
    contexto,
    ssPainel,
    chamar,
    /** Como se o usuário com esse e-mail estivesse abrindo o Web App. */
    como(email) { estado.emailAtivo = email; return this; },
    executar(nomeFuncao, ...args) { return vm.runInContext(nomeFuncao, contexto)(...args); },
  };
}

/** Painel de teste com as 5 abas de indicadores + colaboradores e carteira. */
export function painelDeTeste() {
  return {
    "Fatos Movimentacao": [["Data", "Cliente", "Valor"], [new Date("2026-01-05T03:00:00Z"), "Cliente A", 10], [new Date("2026-02-05T03:00:00Z"), "Cliente B", 20.5], ["", "", ""]],
    "Vigência CNPJ x Serviço": [["CNPJ", "Cliente", "Serviço", "Início", "Fim"], ["1", "Cliente A", "BPO Gerencial", new Date("2026-01-01T03:00:00Z"), ""], ["2", "Cliente B", "BPO Operacional Receitas", new Date("2026-01-01T03:00:00Z"), new Date("2026-06-30T03:00:00Z")]],
    "Base Mensal": [["Mês", "Total"], ["2026-01", 3]],
    "posicao geografica": [["Cliente", "UF", ""], ["Cliente A", "SP", true]],
    "Histórico de Serviços": [["Cliente", "Serviço"], ["Cliente A", "BPO Gerencial"]],
    Colaboradores: [
      ["E-mail", "Nome", "Cargo", "Departamento", "Telefone", "Atualizado em"],
      ["Ana.Silva@vena.app.br", "Ana Silva", "Consultora", "BPO Gerencial", "+55 41 99999-0001", "2026-11-23T10:00:00Z"],
      ["bruno.lima@vena.app.br", "Bruno Lima", "Analista", "BPO Operacional", "", "2026-11-23T10:00:00Z"],
      ["carla.dias@vena.app.br", "Carla Dias", "Analista", "Suprimentos", "", "2026-11-23T10:00:00Z"],
    ],
    "Carteira Colaborador": [
      ["E-mail", "Cliente", "Função", "Atualizado em"],
      ["ana.silva@vena.app.br", "Cliente A", "BPO Gerencial", "x"],
      ["bruno.lima@vena.app.br", "Cliente B", "Receita", "x"],
      ["carla.dias@vena.app.br", "Cliente A", "Suprimentos Pedidos", "x"],
    ],
  };
}
