import { describe, expect, it } from "vitest";
import { deriveClientDetail } from "../client/src/lib/dashboard";
import type { DashboardSheets } from "../client/src/lib/sheets";

function sheetsFrom(rows: Array<Record<string, string>>): DashboardSheets {
  return {
    fatos: [],
    vigencia: rows,
    baseMensal: [],
    posicaoGeografica: [],
  };
}

describe("deriveClientDetail", () => {
  it("marca como Encerrado o serviço com data fim no recorte de referência", () => {
    const detail = deriveClientDetail(sheetsFrom([
      {
        Cliente: "Cliente Teste",
        Serviço: "BPO Gerencial",
        Início: "2023-02-09",
        Fim: "2026-09-14",
        CNPJ: "123",
        Marca: "O Boticário",
        Cidade: "Muriaé",
        Estado: "MG",
        Região: "Sudeste",
      },
    ]), "Cliente Teste");

    expect(detail?.serviceHistory).toHaveLength(1);
    expect(detail?.serviceHistory[0]).toMatchObject({
      service: "BPO Gerencial",
      endDate: "2026-09-14",
      status: "Encerrado",
    });
    expect(detail?.metrics.closedServices).toBe(1);
    expect(detail?.metrics.activeServices).toBe(0);
  });

  it("mantém ativo um serviço cujo término ainda é posterior à referência", () => {
    const detail = deriveClientDetail(sheetsFrom([
      {
        Cliente: "Cliente Teste",
        Serviço: "BPO Suprimentos",
        Início: "2023-03-07",
        Fim: "2026-12-31",
        CNPJ: "123",
        Marca: "O Boticário",
      },
      {
        Cliente: "Cliente Teste",
        Serviço: "BPO Suprimentos",
        Início: "2026-09-15",
        Fim: "",
        CNPJ: "123",
        Marca: "O Boticário",
      },
    ]), "Cliente Teste");

    expect(detail?.serviceHistory.some((item) => item.status === "Ativo")).toBe(true);
  });
});
