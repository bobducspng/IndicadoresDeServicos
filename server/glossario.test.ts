import { describe, expect, it } from "vitest";
import { GLOSSARIO, TELAS_GLOSSARIO, buscarGlossario, normalizarBusca } from "../client/src/lib/glossario";

describe("glossário de indicadores", () => {
  it("tem termos com identificador único e todos os campos obrigatórios", () => {
    const ids = GLOSSARIO.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of GLOSSARIO) {
      expect(TELAS_GLOSSARIO).toContain(t.tela);
      expect(t.termo.trim()).not.toBe("");
      expect(t.resumo.trim()).not.toBe("");
      expect(t.calculo.trim()).not.toBe("");
      expect(t.fonte.trim()).not.toBe("");
    }
  });

  it("cobre os indicadores principais de cada tela", () => {
    const termos = GLOSSARIO.map((t) => t.termo);
    for (const esperado of ["Clientes ativos", "CNPJs em operação", "Entradas no período", "Saídas no período", "Encerrados", "Carteira do colaborador"]) {
      expect(termos).toContain(esperado);
    }
    for (const tela of TELAS_GLOSSARIO) expect(GLOSSARIO.some((t) => t.tela === tela)).toBe(true);
  });

  it("a busca ignora acento, caixa e usa sinônimos", () => {
    expect(normalizarBusca("  Retenção  ")).toBe("retencao");
    expect(buscarGlossario("RETENCAO").map((t) => t.id)).toContain("ltv-medio");
    expect(buscarGlossario("churn").map((t) => t.id)).toContain("saidas-no-periodo");
  });

  it("filtra por tela e devolve vazio quando nada combina", () => {
    const porColaborador = buscarGlossario("", "Por Colaborador");
    expect(porColaborador.length).toBeGreaterThan(0);
    expect(porColaborador.every((t) => t.tela === "Por Colaborador")).toBe(true);
    expect(buscarGlossario("zzzxyzzy")).toEqual([]);
  });
});
