// Teste ponta a ponta: o index.html único (build:gas) conversando com o Code.gs simulado.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { criarAmbiente } from "./gasHarness.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const raiz = path.resolve(import.meta.dirname, "../..");
const saidaDir = process.argv[2] ?? "/tmp/e2e";
fs.mkdirSync(saidaDir, { recursive: true });

const bruto = JSON.parse(fs.readFileSync(path.join(raiz, "client/src/initial-data.json"), "utf8"));
const comoMatriz = (linhas) => {
  if (!linhas.length) return [[]];
  const cab = Object.keys(linhas[0]);
  const conv = (v) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(v) ? new Date(v + "Z") : v === null ? "" : v);
  return [cab, ...linhas.map((l) => cab.map((c) => conv(l[c])))];
};
const painel = {
  "Fatos Movimentacao": comoMatriz(bruto["Fatos Movimentacao"]),
  "Vigência CNPJ x Serviço": comoMatriz(bruto["Vigência CNPJ x Serviço"]),
  "Base Mensal": comoMatriz(bruto["Base Mensal"]),
  "posicao geografica": comoMatriz(bruto["posicao geografica"]),
  "Histórico de Serviços": [["Cliente", "Serviço"], ["x", "y"]],
};
const clientes = [...new Set(bruto["Vigência CNPJ x Serviço"].map((l) => l["Cliente"]))].slice(0, 12);
painel["Colaboradores"] = [
  ["E-mail", "Nome", "Cargo", "Departamento", "Telefone", "Atualizado em"],
  ["ana.silva@vena.app.br", "Ana Silva", "Consultora BPO Gerencial", "BPO Gerencial", "", "2026-11-23T10:00:00Z"],
  ["bruno.lima@vena.app.br", "Bruno Lima", "Analista Financeiro", "BPO Operacional", "", "2026-11-23T10:00:00Z"],
];
painel["Carteira Colaborador"] = [
  ["E-mail", "Cliente", "Função", "Atualizado em"],
  ...clientes.map((c, i) => [i % 2 ? "bruno.lima@vena.app.br" : "ana.silva@vena.app.br", c, i % 2 ? "Receita" : "BPO Gerencial", "x"]),
];

const env = criarAmbiente({ painel });
env.como("ederlei.pereira@vena.app.br");
env.executar("setupInicial");

const erros = [];
const navegador = await chromium.launch();
async function abrir(email, nome) {
  env.como(email);
  const pagina = await navegador.newPage({ viewport: { width: 1440, height: 900 } });
  pagina.on("pageerror", (e) => erros.push(`${nome}: ${e.message}`));
  pagina.on("console", (m) => { if (m.type() === "error" && !/fonts\.g|ERR_|favicon|Failed to load resource/.test(m.text())) erros.push(`${nome} console: ${m.text()}`); });
  await pagina.exposeFunction("__gasApi", async (proc, json) => { await new Promise((r) => setTimeout(r, 30)); return env.chamar2(proc, json); });
  await pagina.addInitScript(() => {
    const runner = (ok, fail) => ({
      withSuccessHandler: (f) => runner(f, fail),
      withFailureHandler: (f) => runner(ok, f),
      api: (p, j) => window.__gasApi(p, j).then((t) => ok && ok(t)).catch((e) => fail && fail({ message: String(e) })),
    });
    window.google = { script: { run: runner(null, null) } };
  });
  await pagina.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await pagina.goto("file://" + path.join(raiz, "dist-gas/index.gas.html"));
  return pagina;
}
// chamada com o texto JSON cru, exatamente como o google.script.run faz
env.chamar2 = (proc, json) => env.contexto.api ? null : null;
import vm from "node:vm";
env.chamar2 = (proc, json) => vm.runInContext("api", env.contexto)(proc, json);

const resultados = {};
// 1) administrador
let p = await abrir("ederlei.pereira@vena.app.br", "admin");
await p.waitForSelector(".app-shell", { timeout: 20000 });
await p.waitForFunction(() => !document.querySelector(".sync-blocker"), null, { timeout: 30000 });
await p.screenshot({ path: path.join(saidaDir, "1-geral.png") });
resultados.footer = await p.locator(".app-footer").innerText();
resultados.temBotaoSair = await p.locator(".sidebar-logout-btn").count();

await p.getByText("Por Colaborador", { exact: false }).first().click();
await p.waitForTimeout(800);
await p.screenshot({ path: path.join(saidaDir, "2-colaboradores.png") });
resultados.colaboradoresNaTela = await p.locator("body").innerText().then((t) => ["Ana Silva", "Bruno Lima"].filter((n) => t.includes(n)));

// foto: seleciona o colaborador e envia pelo editor
await p.getByText("Ana Silva").first().click();
await p.waitForTimeout(500);
const input = p.locator('input[type="file"]');
resultados.inputFoto = await input.count();
await p.screenshot({ path: path.join(saidaDir, "3-colaborador.png") });
// envia uma foto pelo editor (como administrador)
import("node:child_process").then(() => {});
await input.setInputFiles(path.join(saidaDir, "foto-teste.png"));
await p.waitForTimeout(800);
await p.screenshot({ path: path.join(saidaDir, "3b-editor-foto.png") });
await p.getByRole("button", { name: /salvar foto/i }).click();
await p.waitForTimeout(1500);
resultados.arquivosNoDrive = env.estado.arquivos.size;
resultados.fotoNaTela = await p.locator("img.collab-avatar-img, img[src*='googleusercontent']").first().getAttribute("src").catch(() => null);
await p.screenshot({ path: path.join(saidaDir, "3c-foto-salva.png") });

await p.getByText("Cadastro", { exact: false }).first().click();
await p.waitForTimeout(800);
await p.screenshot({ path: path.join(saidaDir, "4-cadastro.png") });
resultados.cadastroLista = await p.locator("body").innerText().then((t) => t.includes("cancelamento@vena.app.br"));
await p.close();

// 2) usuário fora da lista
p = await abrir("estranho@vena.app.br", "estranho");
await p.waitForSelector(".login-backdrop", { timeout: 20000 });
await p.screenshot({ path: path.join(saidaDir, "5-negado.png") });
resultados.negado = (await p.locator(".login-error-alert").innerText()).slice(0, 120);
resultados.semBotaoGoogle = (await p.locator(".google-sso-button").count()) === 0;
await p.close();

await navegador.close();
console.log(JSON.stringify({ resultados, erros }, null, 2));
