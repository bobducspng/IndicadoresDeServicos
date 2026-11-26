import { describe, expect, it } from "vitest";
import { prepararPayloadParaUsuario, resolverFuncao, type ColaboradoresPayload } from "../../shared/colaboradores";
// @ts-expect-error módulo .mjs sem tipos (simulador do Apps Script)
import { criarAmbiente, painelDeTeste } from "./gasHarness.mjs";

const ADMIN = "ederlei.pereira@vena.app.br";
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

function novo() {
  const env = criarAmbiente({ painel: painelDeTeste() });
  env.como(ADMIN);
  env.executar("setupInicial"); // cria a planilha de controle e semeia administradores
  return env;
}

describe("Code.gs — acesso", () => {
  it("conta fora da lista ou fora do domínio não entra", () => {
    const env = novo();
    env.como("alguem@vena.app.br");
    const me = env.chamar("auth.me");
    expect(me.ok && me.data.isAllowed).toBe(false);
    expect(env.chamar("dashboard.sheets")).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(env.chamar("colaboradores.carteira")).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    env.como("ederlei@gmail.com");
    expect(env.chamar("auth.me").data.isAllowed).toBe(false);
    env.como("");
    expect(env.chamar("auth.me").data).toMatchObject({ isAllowed: false, email: null });
  });

  it("administrador semeado entra e recebe o link do app", () => {
    const env = novo();
    const me = env.chamar("auth.me").data;
    expect(me).toMatchObject({ isAllowed: true, role: "super_admin", email: ADMIN, allowedServices: null });
    expect(me.appUrl).toContain("script.google.com");
    expect(env.estado.logs.some((l: string) => l.includes("Planilha de controle"))).toBe(true);
  });

  it("operação desconhecida e usuário comum chamando função de administrador", () => {
    const env = novo();
    expect(env.chamar("nao.existe")).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
    env.como(ADMIN);
    env.chamar("accessControl.add", { email: "comum@vena.app.br", name: "Comum", role: "user" });
    env.como("comum@vena.app.br");
    expect(env.chamar("auth.me").data.isAllowed).toBe(true);
    expect(env.chamar("accessControl.list")).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(env.chamar("colaboradores.salvarFoto", { email: "ana.silva@vena.app.br", imagem: PNG })).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
  });
});

describe("Code.gs — cadastro de acessos", () => {
  it("valida e-mail/nome, cadastra, atualiza e lista", () => {
    const env = novo();
    expect(env.chamar("accessControl.add", { email: "x@gmail.com", name: "Fulano" })).toMatchObject({ ok: false, error: { code: "BAD_REQUEST" } });
    expect(env.chamar("accessControl.add", { email: "ok@vena.app.br", name: "F" })).toMatchObject({ ok: false });
    const criado = env.chamar("accessControl.add", { email: "  Maria.Souza@VENA.app.br ", name: "Maria Souza", role: "user", allowedServices: ["BPO Gerencial", "BPO Gerencial", " "] });
    expect(criado.data).toMatchObject({ email: "maria.souza@vena.app.br", role: "user", isActive: 1, allowedServicesList: ["BPO Gerencial"], addedBy: ADMIN });
    // cadastrar de novo o mesmo e-mail atualiza, não duplica
    env.chamar("accessControl.add", { email: "maria.souza@vena.app.br", name: "Maria S.", role: "admin" });
    const lista = env.chamar("accessControl.list").data;
    expect(lista.filter((u: any) => u.email === "maria.souza@vena.app.br")).toHaveLength(1);
    expect(lista.find((u: any) => u.email === "maria.souza@vena.app.br")).toMatchObject({ name: "Maria S.", role: "admin" });
    expect(new Set(lista.map((u: any) => u.id)).size).toBe(lista.length);

    const id = lista.find((u: any) => u.email === "maria.souza@vena.app.br").id;
    expect(env.chamar("accessControl.updateName", { id, name: "Maria Souza Lima" }).data.name).toBe("Maria Souza Lima");
    expect(env.chamar("accessControl.updateRole", { id, role: "user" }).data.role).toBe("user");
    expect(env.chamar("accessControl.updateServices", { id, allowedServices: ["A", "B"] }).data.allowedServicesList).toEqual(["A", "B"]);
    expect(env.chamar("accessControl.toggleStatus", { id, isActive: 0 }).data.isActive).toBe(0);
    env.como("maria.souza@vena.app.br");
    expect(env.chamar("auth.me").data.isAllowed).toBe(false); // desativada (cache limpo na gravação)
    env.como(ADMIN);
    expect(env.chamar("accessControl.remove", { id }).data).toBe(true);
    expect(env.chamar("accessControl.remove", { id }).data).toBe(false);
  });

  it("mantém sempre pelo menos um administrador", () => {
    const env = novo();
    const lista = env.chamar("accessControl.list").data;
    const [a, b] = ["ederlei.pereira@vena.app.br", "cancelamento@vena.app.br"].map((e) => lista.find((u: any) => u.email === e));
    // desativar um admin é permitido enquanto sobrar outro ativo
    expect(env.chamar("accessControl.toggleStatus", { id: b.id, isActive: 0 }).ok).toBe(true);
    expect(env.chamar("accessControl.toggleStatus", { id: a.id, isActive: 0 })).toMatchObject({ ok: false, error: { message: expect.stringContaining("administrador ativo") } });
    expect(env.chamar("accessControl.updateRole", { id: a.id, role: "user" }).ok).toBe(true); // ainda há outro admin (inativo conta em "privilegiados")
    expect(env.chamar("accessControl.updateRole", { id: b.id, role: "user" })).toMatchObject({ ok: false });
    expect(env.chamar("accessControl.remove", { id: b.id })).toMatchObject({ ok: false });
  });
});

describe("Code.gs — indicadores (planilha privada)", () => {
  it("devolve as abas no formato do painel, com cache e atualização forçada", () => {
    const env = novo();
    const r = env.chamar("dashboard.sheets");
    expect(r.ok).toBe(true);
    expect(Object.keys(r.data)).toEqual(["fatos", "vigencia", "baseMensal", "posicaoGeografica", "historicoServicos"]);
    expect(r.data.fatos).toEqual([
      { Data: "2026-01-05T03:00:00.000Z", Cliente: "Cliente A", Valor: 10 },
      { Data: "2026-02-05T03:00:00.000Z", Cliente: "Cliente B", Valor: 20.5 },
    ]); // linha totalmente vazia ignorada
    expect(r.data.vigencia[0]).toMatchObject({ Fim: null, Cliente: "Cliente A" });
    expect(r.data.posicaoGeografica[0]).toEqual({ Cliente: "Cliente A", UF: "SP", C: "TRUE" }); // cabeçalho vazio vira a letra da coluna
    const antes = env.estado.chamadasPainel;
    expect(env.chamar("dashboard.sheets").data).toEqual(r.data); // vindo do cache
    expect(env.estado.chamadasPainel).toBe(antes);
    env.chamar("dashboard.sheets", { forcar: true });
    expect(env.estado.chamadasPainel).toBeGreaterThan(antes);
  });

  it("avisa qual aba está faltando", () => {
    const painel = painelDeTeste();
    delete painel["Base Mensal"];
    const env = criarAmbiente({ painel }).como(ADMIN);
    env.executar("setupInicial");
    expect(env.chamar("dashboard.sheets")).toMatchObject({ ok: false, error: { message: expect.stringContaining("Base Mensal") } });
  });
});

describe("Code.gs — colaboradores", () => {
  it("restringe por serviço e mantém telefone para qualquer usuário autorizado", () => {
    const env = novo();
    const admin = env.chamar("colaboradores.carteira").data;
    expect(admin.fonte).toBe("pipefy");
    expect(admin.colaboradores.map((c: any) => c.email)).toEqual(["ana.silva@vena.app.br", "bruno.lima@vena.app.br", "carla.dias@vena.app.br"]);
    expect(admin.colaboradores[0].telefone).toBe("+55 41 99999-0001");
    expect(admin.vinculos).toHaveLength(3);

    env.chamar("accessControl.add", { email: "livre@vena.app.br", name: "Livre", role: "user" });
    env.chamar("accessControl.add", { email: "restrito@vena.app.br", name: "Restrito", role: "user", allowedServices: ["BPO Gerencial"] });
    env.como("livre@vena.app.br");
    const livre = env.chamar("colaboradores.carteira").data;
    expect(livre.colaboradores).toHaveLength(3);
    expect(livre.colaboradores[0].telefone).toBe("+55 41 99999-0001");
    env.como("restrito@vena.app.br");
    const restrito = env.chamar("colaboradores.carteira").data;
    expect(restrito.vinculos).toEqual([{ email: "ana.silva@vena.app.br", cliente: "Cliente A", funcao: "BPO Gerencial" }]);
    expect(restrito.colaboradores.map((c: any) => c.email)).toEqual(["ana.silva@vena.app.br"]);
  });

  it("sem as abas da carteira devolve dados de exemplo", () => {
    const painel = painelDeTeste();
    delete (painel as any).Colaboradores;
    const env = criarAmbiente({ painel }).como(ADMIN);
    env.executar("setupInicial");
    const r = env.chamar("colaboradores.carteira").data;
    expect(r.fonte).toBe("exemplo");
    expect(r.colaboradores[0].email).toMatch(/@exemplo\.invalid$/);
  });

  it("regras de função/serviço e de filtro iguais às do código TypeScript do site", () => {
    const env = novo();
    const funcoes = ["Receita", "receita 2", "Despesa", "Agend. Bancário", "Conciliação Bancaria", "BPO Gerencial", "Suprimentos Pedidos",
      "Suprimentos Outros", "Recursos Humanos", "Operação Assistida", "BPO Operacional Algo", "Gerencial Novo", "  Spot F360 "];
    for (const f of funcoes) {
      expect(JSON.parse(JSON.stringify(env.executar("resolverFuncao_", f)))).toEqual(resolverFuncao(f));
    }
    // Nomes que existem em todo objeto JS não podem ser confundidos com função conhecida.
    expect(JSON.parse(JSON.stringify(env.executar("resolverFuncao_", "constructor")))).toMatchObject({ servico: "constructor", grupo: "Outros" });
    const payload: ColaboradoresPayload = {
      fonte: "pipefy", atualizadoEm: "x",
      colaboradores: [
        { email: "a@v.br", nome: "A", cargo: "", departamento: "", telefone: "1", fotoUrl: null },
        { email: "b@v.br", nome: "B", cargo: "", departamento: "", telefone: "2", fotoUrl: null },
        { email: "c@v.br", nome: "C", cargo: "", departamento: "", telefone: null, fotoUrl: null },
      ],
      vinculos: [
        { email: "a@v.br", cliente: "X", funcao: "Recursos Humanos" },
        { email: "b@v.br", cliente: "Y", funcao: "Receita" },
      ],
    };
    for (const [role, servicos] of [["user", null], ["user", ["RH sob Medida"]], ["user", ["BPO Operacional Receitas"]], ["admin", null], ["super_admin", ["x"]], ["user", []]] as const) {
      const esperado = prepararPayloadParaUsuario(payload, { role, allowedServices: servicos ? [...servicos] : null });
      const obtido = JSON.parse(JSON.stringify(env.executar("prepararPayloadParaUsuario_", JSON.parse(JSON.stringify(payload)), role, servicos ? [...servicos] : null)));
      expect(obtido).toEqual(esperado);
    }
  });
});

describe("Code.gs — fotos (pasta pública do Drive)", () => {
  it("valida o arquivo antes de enviar", () => {
    const env = novo();
    const base = { email: "ana.silva@vena.app.br" };
    expect(env.chamar("colaboradores.salvarFoto", { ...base, imagem: "oi" })).toMatchObject({ ok: false, error: { code: "BAD_REQUEST" } });
    expect(env.chamar("colaboradores.salvarFoto", { ...base, imagem: "data:image/jpeg;base64," + Buffer.from("texto qualquer").toString("base64") })).toMatchObject({ ok: false, error: { message: expect.stringContaining("não é uma imagem") } });
    expect(env.chamar("colaboradores.salvarFoto", { ...base, imagem: PNG.replace("image/png", "image/jpeg") })).toMatchObject({ ok: false }); // tipo declarado diferente do real
    const grande = "data:image/png;base64," + Buffer.concat([Buffer.from(PNG.split(",")[1], "base64"), Buffer.alloc(400 * 1024)]).toString("base64");
    expect(env.chamar("colaboradores.salvarFoto", { ...base, imagem: grande })).toMatchObject({ ok: false, error: { message: expect.stringContaining("grande demais") } });
    expect(env.chamar("colaboradores.salvarFoto", { email: "ninguem@vena.app.br", imagem: PNG })).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
    expect(env.estado.arquivos.size).toBe(0);
  });

  it("envia para o Drive, mostra o link, troca (descartando a antiga) e remove", () => {
    const env = novo();
    expect(env.chamar("colaboradores.salvarFoto", { email: "Ana.Silva@vena.app.br", imagem: PNG })).toEqual({ ok: true, data: { ok: true } });
    expect(env.estado.arquivos.size).toBe(1);
    const arq1 = env.estado.arquivos.get("ARQ1");
    expect(arq1.compartilhamento).toBe("ANYONE:VIEW");
    expect(arq1.blob.tipo).toBe("image/png");
    let ana = env.chamar("colaboradores.carteira").data.colaboradores.find((c: any) => c.email === "ana.silva@vena.app.br");
    expect(ana).toMatchObject({ fotoUrl: "https://lh3.googleusercontent.com/d/ARQ1=s256", fotoOrigem: "upload" });

    env.chamar("colaboradores.salvarFoto", { email: "ana.silva@vena.app.br", imagem: PNG });
    expect(arq1.lixeira).toBe(true);
    ana = env.chamar("colaboradores.carteira").data.colaboradores.find((c: any) => c.email === "ana.silva@vena.app.br");
    expect(ana.fotoUrl).toBe("https://lh3.googleusercontent.com/d/ARQ2=s256");
    expect(env.contexto && env.executar("fotosEnviadas_")).toHaveLength(1); // uma linha por colaborador

    env.chamar("colaboradores.removerFoto", { email: "ana.silva@vena.app.br" });
    expect(env.estado.arquivos.get("ARQ2").lixeira).toBe(true);
    ana = env.chamar("colaboradores.carteira").data.colaboradores.find((c: any) => c.email === "ana.silva@vena.app.br");
    expect(ana).toMatchObject({ fotoUrl: null, fotoOrigem: null });
  });

  it("mostra a mensagem real quando a pasta não está acessível", () => {
    const env = novo();
    env.estado.pastaPermitida = false;
    const r = env.chamar("colaboradores.salvarFoto", { email: "ana.silva@vena.app.br", imagem: PNG });
    expect(r).toMatchObject({ ok: false, error: { code: "INTERNAL_SERVER_ERROR", message: expect.stringContaining("permissão") } });
  });
});
