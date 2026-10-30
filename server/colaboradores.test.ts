import { afterEach, describe, expect, it, vi } from "vitest";
import {
  prepararPayloadParaUsuario,
  resolverFuncao,
  type ColaboradoresPayload,
} from "../shared/colaboradores";
import { carregarColaboradores, limparCacheColaboradores, payloadDeExemplo } from "./colaboradores";
import { ENV } from "./_core/env";

const payload: ColaboradoresPayload = {
  fonte: "pipefy",
  atualizadoEm: "2026-01-01T00:00:00Z",
  colaboradores: [
    { email: "ana@vena.app.br", nome: "Ana", cargo: "Consultora", departamento: "BPO Gerencial", telefone: "+55 11 90000-0001", fotoUrl: null },
    { email: "bia@vena.app.br", nome: "Bia", cargo: "Analista", departamento: "BPO Operacional", telefone: "+55 11 90000-0002", fotoUrl: null },
    { email: "caio@vena.app.br", nome: "Caio", cargo: "Analista", departamento: "Suprimentos", telefone: null, fotoUrl: null },
  ],
  vinculos: [
    { email: "ana@vena.app.br", cliente: "Cliente A", funcao: "BPO Gerencial" },
    { email: "bia@vena.app.br", cliente: "Cliente A", funcao: "Receita" },
    { email: "bia@vena.app.br", cliente: "Cliente B", funcao: "Despesa 2" },
  ],
};

describe("resolverFuncao", () => {
  it("mapeia os campos do Pipefy para serviço e grupo", () => {
    expect(resolverFuncao("Receita 2")).toEqual({ servico: "BPO Operacional Receitas", grupo: "Operacional" });
    expect(resolverFuncao("Conciliação Bancaria").servico).toBe("BPO Controle/Tesouraria");
    expect(resolverFuncao("BPO Gerencial").grupo).toBe("Gerencial");
    expect(resolverFuncao("Suprimentos Outros").servico).toBe("BPO Suprimentos");
  });

  it("trata campo desconhecido como nome de serviço", () => {
    expect(resolverFuncao("Operação Assistida")).toEqual({ servico: "Operação Assistida", grupo: "Outros" });
  });
});

describe("prepararPayloadParaUsuario", () => {
  it("remove telefone para quem não é admin", () => {
    const r = prepararPayloadParaUsuario(payload, { role: "user", allowedServices: null });
    expect(r.colaboradores.every((c) => c.telefone === null)).toBe(true);
    expect(r.colaboradores).toHaveLength(3);
  });

  it("mantém telefone para admin e super_admin", () => {
    for (const role of ["admin", "super_admin"]) {
      const r = prepararPayloadParaUsuario(payload, { role, allowedServices: null });
      expect(r.colaboradores[0].telefone).toBe("+55 11 90000-0001");
    }
  });

  it("restringe vínculos e colaboradores aos serviços permitidos", () => {
    const r = prepararPayloadParaUsuario(payload, { role: "user", allowedServices: ["BPO Gerencial"] });
    expect(r.vinculos).toEqual([{ email: "ana@vena.app.br", cliente: "Cliente A", funcao: "BPO Gerencial" }]);
    expect(r.colaboradores.map((c) => c.email)).toEqual(["ana@vena.app.br"]);
  });

  it("lista vazia de serviços não mostra nada", () => {
    const r = prepararPayloadParaUsuario(payload, { role: "user", allowedServices: [] });
    expect(r.vinculos).toHaveLength(0);
    expect(r.colaboradores).toHaveLength(0);
  });
});

describe("carregarColaboradores", () => {
  const original = { url: ENV.colaboradoresApiUrl, key: ENV.colaboradoresApiKey };
  afterEach(() => {
    ENV.colaboradoresApiUrl = original.url;
    ENV.colaboradoresApiKey = original.key;
    limparCacheColaboradores();
    vi.unstubAllGlobals();
  });

  it("devolve dados de exemplo sem a API configurada", async () => {
    ENV.colaboradoresApiUrl = "";
    const r = await carregarColaboradores();
    expect(r.fonte).toBe("exemplo");
    expect(r.vinculos).toHaveLength(0);
    expect(payloadDeExemplo().colaboradores.every((c) => c.email.endsWith("@exemplo.invalid"))).toBe(true);
  });

  it("lê a API real, normaliza e-mails e usa cache", async () => {
    ENV.colaboradoresApiUrl = "https://script.example.test/exec";
    ENV.colaboradoresApiKey = "segredo";
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({
        colaboradores: [{ email: "Ana@Vena.app.br", nome: "Ana" }],
        vinculos: [{ email: "ANA@vena.app.br", cliente: "Cliente A", funcao: "Receita" }],
      })),
    );
    vi.stubGlobal("fetch", fetchMock);

    const r = await carregarColaboradores();
    expect(r.fonte).toBe("pipefy");
    expect(r.colaboradores[0].email).toBe("ana@vena.app.br");
    expect(r.vinculos[0].email).toBe("ana@vena.app.br");
    expect(String(fetchMock.mock.calls[0][0])).toContain("key=segredo");

    await carregarColaboradores();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falha com formato inesperado", async () => {
    ENV.colaboradoresApiUrl = "https://script.example.test/exec";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ foo: 1 }))));
    await expect(carregarColaboradores()).rejects.toThrow();
  });
});
