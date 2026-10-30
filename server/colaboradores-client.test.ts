import { describe, expect, it } from "vitest";
import type { Colaborador } from "../shared/colaboradores";
import {
  carteiraDoColaborador,
  contarClientesPorUf,
  gerarVinculosDeExemplo,
  mensagemDeChamada,
  montarIndiceClientes,
  resumirColaboradores,
  urlDoChat,
} from "../client/src/lib/colaboradores";

const vigencia = [
  { Cliente: "Cliente A", Marca: "Marca A", "Situação": "Ativo", "Serviço": "BPO Gerencial", Estado: "SP", Cidade: "São Paulo" },
  { Cliente: "Cliente A", Marca: "Marca A", "Situação": "Ativo", "Serviço": "BPO Operacional Receitas", Estado: "RJ", Cidade: "Niterói" },
  { Cliente: "Cliente B", Marca: "Marca B", "Situação": "Encerrado", "Serviço": "BPO Gerencial", Estado: "MG", Cidade: "BH" },
];

describe("montarIndiceClientes", () => {
  it("considera ativo apenas quem tem vigência ativa e junta UFs", () => {
    const indice = montarIndiceClientes(vigencia as any);
    const a = indice.get("cliente a")!;
    expect(a.ativo).toBe(true);
    expect(a.estados).toEqual(["RJ", "SP"]);
    expect(indice.get("cliente b")!.ativo).toBe(false);
    expect(indice.get("cliente b")!.estados).toEqual([]);
  });
});

describe("carteira", () => {
  const indice = montarIndiceClientes(vigencia as any);
  const vinculos = [
    { email: "ana@vena.app.br", cliente: "CLIENTE A", funcao: "BPO Gerencial" },
    { email: "ana@vena.app.br", cliente: "Cliente A", funcao: "Receita" },
    { email: "ana@vena.app.br", cliente: "Cliente Novo", funcao: "Despesa" },
    { email: "bia@vena.app.br", cliente: "Cliente B", funcao: "Receita" },
  ];

  it("agrupa funções por cliente, ignora caixa e sinaliza cliente sem vigência", () => {
    const carteira = carteiraDoColaborador("Ana@vena.app.br", vinculos, indice);
    expect(carteira).toHaveLength(2);
    const a = carteira.find((c) => c.nome === "Cliente A")!;
    expect(a.funcoes).toEqual(["BPO Gerencial", "Receita"]);
    expect(a.grupos).toEqual(["Gerencial", "Operacional"]);
    expect(carteira.find((c) => c.nome === "Cliente Novo")!.semVigencia).toBe(true);
  });

  it("conta clientes por UF, com bucket para sem UF", () => {
    const contagem = contarClientesPorUf(carteiraDoColaborador("ana@vena.app.br", vinculos, indice));
    expect(contagem.get("SP")).toBe(1);
    expect(contagem.get("RJ")).toBe(1);
    expect(contagem.get("—")).toBe(1);
  });

  it("resumo respeita o filtro de ativos", () => {
    const colabs = [
      { email: "ana@vena.app.br", nome: "Ana" },
      { email: "bia@vena.app.br", nome: "Bia" },
    ] as Colaborador[];
    const ativos = resumirColaboradores(colabs, vinculos, indice, true);
    expect(ativos.find((r) => r.colaborador.nome === "Ana")!.clientes).toBe(1);
    expect(ativos.find((r) => r.colaborador.nome === "Bia")!.clientes).toBe(0);
    const todos = resumirColaboradores(colabs, vinculos, indice, false);
    expect(todos.find((r) => r.colaborador.nome === "Bia")!.clientes).toBe(1);
  });
});

describe("dados de exemplo e chat", () => {
  it("distribui só clientes ativos, respeitando o departamento, de forma estável", () => {
    const indice = montarIndiceClientes(vigencia as any);
    const colabs = [
      { email: "g@x.invalid", nome: "G", cargo: "", departamento: "BPO Gerencial", telefone: null, fotoUrl: null },
      { email: "o@x.invalid", nome: "O", cargo: "", departamento: "BPO Operacional", telefone: null, fotoUrl: null },
    ] as Colaborador[];
    const v1 = gerarVinculosDeExemplo(colabs, indice.values());
    const v2 = gerarVinculosDeExemplo(colabs, indice.values());
    expect(v1).toEqual(v2);
    expect(v1.every((v) => v.cliente === "Cliente A")).toBe(true);
    expect(v1.find((v) => v.funcao === "BPO Gerencial")!.email).toBe("g@x.invalid");
    expect(v1.find((v) => v.funcao === "Receita")!.email).toBe("o@x.invalid");
  });

  it("chat abre a página inicial por padrão e aceita modelo de link", () => {
    expect(urlDoChat("a@b.c", null)).toBe("https://chat.google.com/");
    expect(urlDoChat("a@b.c", "https://chat.example/dm/{email}")).toBe("https://chat.example/dm/a%40b.c");
    expect(mensagemDeChamada({ nome: "Ana Silva" } as Colaborador, "João Souza")).toContain("Ana");
  });
});
