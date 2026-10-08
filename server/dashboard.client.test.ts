import { describe, expect, it } from "vitest";
import { buildActiveCnpjRows, buildClientOptions, deriveClientDetail, deriveSnapshot, PERIOD_OPTIONS } from "../client/src/lib/dashboard";
import type { FilterState } from "../client/src/lib/dashboard";
import type { DashboardSheets } from "../client/src/lib/sheets";

function sheetsFrom(rows: Array<Record<string, string>>, historicoServicos: Array<Record<string, string>> = []): DashboardSheets {
  return {
    fatos: [],
    vigencia: rows,
    baseMensal: [],
    posicaoGeografica: [],
    historicoServicos,
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

  it("monta uma série mensal independente para cada serviço", () => {
    const detail = deriveClientDetail(sheetsFrom([
      {
        Cliente: "Cliente Multisserviço",
        Serviço: "BPO Gerencial",
        Início: "2026-01-01",
        Fim: "2026-01-31",
        CNPJ: "123",
      },
      {
        Cliente: "Cliente Multisserviço",
        Serviço: "Contabilidade",
        Início: "2026-02-01",
        Fim: "2026-04-30",
        CNPJ: "123",
      },
    ]), "Cliente Multisserviço");

    expect(detail?.activeSeries.map((point) => point.services)).toEqual([
      [
        { label: "BPO Gerencial", active: 1 },
        { label: "Contabilidade", active: 0 },
      ],
      [
        { label: "BPO Gerencial", active: 0 },
        { label: "Contabilidade", active: 1 },
      ],
      [
        { label: "BPO Gerencial", active: 0 },
        { label: "Contabilidade", active: 1 },
      ],
      [
        { label: "BPO Gerencial", active: 0 },
        { label: "Contabilidade", active: 1 },
      ],
    ]);
  });

  it("combina o histórico operacional com a vigência atual do cliente", () => {
    const detail = deriveClientDetail(sheetsFrom([
      {
        Cliente: "Cp Smell Perfumaria",
        Serviço: "BPO Suprimentos",
        Início: "2024-01-16",
        Fim: "",
        CNPJ: "03418664000244",
        Marca: "O Boticário",
      },
    ], [
      {
        "Nome Cliente": "Cp Smell Perfumaria",
        "Tipo de Operação": "Contratação",
        "Serviço(s) Afetado(s)": "BPO Controle/Tesouraria, BPO Gerencial, BPO Operacional Receitas",
        "Data/Hora": "2022-11-07",
        "Data Ativação": "2022-11-07",
        "Data Desativação": "",
      },
      {
        "Nome Cliente": "Cp Smell Perfumaria",
        "Tipo de Operação": "Contratação",
        "Serviço(s) Afetado(s)": "BPO Suprimentos",
        "Data/Hora": "2024-01-16",
        "Data Ativação": "2024-01-16",
        "Data Desativação": "",
      },
      {
        "Nome Cliente": "Cp Smell Perfumaria",
        "Tipo de Operação": "Cancelamento",
        "Serviço(s) Afetado(s)": "BPO Gerencial",
        "Data/Hora": "2026-10-08",
        "Data Ativação": "",
        "Data Desativação": "2026-10-08",
      },
    ]), "Cp Smell Perfumaria");

    expect(detail?.serviceHistory.map((item) => item.service)).toEqual(expect.arrayContaining([
      "BPO Controle/Tesouraria",
      "BPO Gerencial",
      "BPO Operacional Receitas",
      "BPO Suprimentos",
    ]));
    expect(detail?.serviceHistory.find((item) => item.service === "BPO Gerencial")).toMatchObject({
      status: "Encerrado",
      startDate: "2022-11-07",
      endDate: "2026-10-08",
    });
    expect(detail?.serviceHistory.find((item) => item.service === "BPO Suprimentos")).toMatchObject({
      status: "Ativo",
      startDate: "2024-01-16",
    });
    expect(detail?.referenceEndDate).toBe("2026-10-08");
  });

  it("inclui clientes que aparecem somente na aba histórica", () => {
    const data = sheetsFrom([], [{ "Nome Cliente": "Cp Histórico", "Serviço(s) Afetado(s)": "Contabilidade" }]);
    expect(buildClientOptions(data)).toContain("Cp Histórico");
  });
});

describe("buildActiveCnpjRows", () => {
  it("deduplica o CNPJ e consolida os serviços associados", () => {
    const rows = buildActiveCnpjRows([
      { CNPJ: "12.345.678/0001-90", Cliente: "Cliente A", Serviço: "Contabilidade", Início: "2024-01-10", Fim: "", Cidade: "Muriaé", Estado: "MG" },
      { CNPJ: "12.345.678/0001-90", Cliente: "Cliente A", Serviço: "BPO Gerencial", Início: "2023-02-01", Fim: "2025-12-31", Cidade: "Muriaé", Estado: "MG" },
      { CNPJ: "98.765.432/0001-10", Cliente: "Cliente B", Serviço: "BPO Suprimentos", Início: "2025-03-01", Fim: "", Cidade: "São Paulo", Estado: "SP" },
    ]);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ cnpj: "12.345.678/0001-90", client: "Cliente A", startDate: "2023-02-01", endDate: "2025-12-31" });
    expect(rows[0]?.services).toEqual(["Contabilidade", "BPO Gerencial"]);
  });
});

describe("distribuição por serviço", () => {
  it("mantém todos os serviços na saída, inclusive os que ficam abaixo da oitava posição", () => {
    const serviceNames = [
      "BPO Gerencial",
      "BPO Controle/Tesouraria",
      "BPO Operacional Receitas",
      "BPO Operacional Despesas",
      "BPO Suprimentos",
      "Operação Assistida",
      "Spot F360",
      "BPO Gerencial Treinamento em Gestão Financeira",
      "Tecnologia",
      "Mentoria de sucessores",
    ];
    const snapshot = deriveSnapshot({
      fatos: [],
      vigencia: serviceNames.map((service, index) => ({
        Cliente: `Cliente ${index + 1}`,
        Serviço: service,
        Início: "2026-05-01",
        Fim: "",
        Data: "2026-09-30",
        CNPJ: `cnpj-${index + 1}`,
      })),
      baseMensal: [],
      posicaoGeografica: [],
      historicoServicos: [],
    }, {
      regions: [],
      services: [],
      brands: [],
      year: "all",
      period: "last6",
    });

    expect(snapshot.serviceBreakdown).toHaveLength(serviceNames.length);
    expect(snapshot.serviceBreakdown).toContainEqual(expect.objectContaining({
      label: "Mentoria de sucessores",
      value: 1,
    }));
  });
});

describe("filtro de período", () => {
  const filters: FilterState = {
    regions: [],
    services: [],
    brands: [],
    year: "all",
    period: "previousMonth",
  };

  it("exibe Mês anterior logo após Mês atual", () => {
    const labels = PERIOD_OPTIONS.map((option) => option.label);
    expect(labels.indexOf("Mês anterior")).toBe(labels.indexOf("Mês atual") + 1);
  });

  it("calcula o mês-calendário anterior ao mês de referência", () => {
    const snapshot = deriveSnapshot({
      fatos: [
        { Cliente: "Cliente de agosto", Serviço: "Contabilidade", Data: "2026-08-18", "Evento Cliente": "Novo Cliente" },
        { Cliente: "Evento de setembro", Serviço: "Contabilidade", Data: "2026-09-14", "Evento Cliente": "Atualização" },
      ],
      vigencia: [
        { Cliente: "Cliente de agosto", Serviço: "Contabilidade", Início: "2026-08-01", Fim: "", Data: "2026-09-14", CNPJ: "123" },
      ],
      baseMensal: [],
      posicaoGeografica: [],
      historicoServicos: [],
    }, filters);

    expect(snapshot.period).toMatchObject({
      startDate: "2026-08-01",
      endDate: "2026-08-31",
      label: "Mês anterior",
    });
    expect(snapshot.kpis.newClients).toBe(1);
    expect(snapshot.timeline.map((point) => point.key)).toEqual(["2026-08"]);
  });

  it("mantém a virada de ano ao calcular dezembro como mês anterior de janeiro", () => {
    const snapshot = deriveSnapshot({
      fatos: [{ Cliente: "Cliente de dezembro", Serviço: "Contabilidade", Data: "2026-01-05", "Evento Cliente": "Atualização" }],
      vigencia: [],
      baseMensal: [],
      posicaoGeografica: [],
      historicoServicos: [],
    }, filters);

    expect(snapshot.period).toMatchObject({
      startDate: "2025-12-01",
      endDate: "2025-12-31",
    });
  });
});
