export type CellValue = string | number | null;
export type SheetRow = Record<string, CellValue>;

export interface DashboardSheets {
  fatos: SheetRow[];
  vigencia: SheetRow[];
  baseMensal: SheetRow[];
  posicaoGeografica: SheetRow[];
}

import initialPayload from "../initial-data.json";

export function getInitialSheets(): DashboardSheets {
  const raw = initialPayload as Record<string, SheetRow[]>;
  return {
    fatos: raw["Fatos Movimentacao"] ?? [],
    vigencia: raw["Vigência CNPJ x Serviço"] ?? [],
    baseMensal: raw["Base Mensal"] ?? [],
    posicaoGeografica: raw["posicao geografica"] ?? [],
  };
}

export function isSuspiciouslyPartial(previous: DashboardSheets, next: DashboardSheets): boolean {
  const keys: Array<keyof DashboardSheets> = ["fatos", "vigencia", "baseMensal", "posicaoGeografica"];
  return keys.some((key) => {
    const previousCount = previous[key].length;
    const nextCount = next[key].length;
    // Uma resposta pública que perde quase toda uma aba é mais provável de ser
    // uma leitura intermediária do Apps Script do que uma atualização válida.
    return previousCount >= 100 && nextCount < Math.max(100, Math.floor(previousCount * 0.25));
  });
}

export function mergeDashboardSheets(previous: DashboardSheets, next: DashboardSheets): { data: DashboardSheets; partialSheets: Array<keyof DashboardSheets> } {
  const keys: Array<keyof DashboardSheets> = ["fatos", "vigencia", "baseMensal", "posicaoGeografica"];
  const partialSheets = keys.filter((key) => {
    const previousCount = previous[key].length;
    const nextCount = next[key].length;
    return previousCount >= 100 && nextCount < Math.max(100, Math.floor(previousCount * 0.25));
  });
  return {
    data: {
      fatos: partialSheets.includes("fatos") ? previous.fatos : next.fatos,
      vigencia: partialSheets.includes("vigencia") ? previous.vigencia : next.vigencia,
      baseMensal: partialSheets.includes("baseMensal") ? previous.baseMensal : next.baseMensal,
      posicaoGeografica: partialSheets.includes("posicaoGeografica") ? previous.posicaoGeografica : next.posicaoGeografica,
    },
    partialSheets,
  };
}

const SPREADSHEET_ID = "1BWWM39AJ88tj59EWN4qJCP5kVJAx16t7yVYuVw_QuIY";
const SHEET_ENDPOINT = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq`;

function parseDateLiteral(value: string): string | null {
  const match = value.match(/^Date\((\d+),(\d+),(\d+)(?:,(\d+),(\d+),(\d+))?\)$/);
  if (!match) return null;
  const [, year, month, day, hour = "0", minute = "0", second = "0"] = match;
  const date = new Date(
    Number(year),
    Number(month),
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function parseCell(cell: { v?: unknown; f?: string } | null | undefined): CellValue {
  if (!cell || cell.v === null || cell.v === undefined || cell.v === "") return null;
  if (typeof cell.v === "string") {
    const date = parseDateLiteral(cell.v);
    if (date) return date;
    return cell.v;
  }
  if (typeof cell.v === "number" || typeof cell.v === "string") return cell.v as CellValue;
  return cell.f ?? String(cell.v);
}

function parseGvizResponse(raw: string): SheetRow[] {
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace < 0 || lastBrace <= firstBrace) {
    throw new Error("A planilha retornou uma resposta inválida.");
  }

  const payload = JSON.parse(raw.slice(firstBrace, lastBrace + 1)) as {
    status?: string;
    errors?: Array<{ message?: string }>;
    table?: {
      cols: Array<{ id?: string; label?: string }>;
      rows: Array<{ c?: Array<{ v?: unknown; f?: string } | null> }>;
    };
  };

  if (payload.status !== "ok" || !payload.table) {
    throw new Error(payload.errors?.[0]?.message ?? "Não foi possível ler esta aba da planilha.");
  }

  const columns = payload.table.cols.map((column, index) => column.label?.trim() || column.id || `coluna_${index}`);
  return payload.table.rows.map((row) => {
    const values = row.c ?? [];
    return Object.fromEntries(columns.map((column, index) => [column, parseCell(values[index])]));
  });
}

async function fetchSheet(sheetName: string): Promise<SheetRow[]> {
  const params = new URLSearchParams({
    tqx: "out:json;responseHandler:__indicadoresResponse",
    sheet: sheetName,
  });
  const response = await fetch(`${SHEET_ENDPOINT}?${params.toString()}`, {
    cache: "no-store",
    headers: { Accept: "application/javascript, application/json" },
  });
  if (!response.ok) {
    throw new Error(`Falha ao consultar a aba “${sheetName}” (${response.status}).`);
  }
  return parseGvizResponse(await response.text());
}

export async function fetchDashboardSheets(): Promise<DashboardSheets> {
  const [fatos, vigencia, baseMensal, posicaoGeografica] = await Promise.all([
    fetchSheet("Fatos Movimentacao"),
    fetchSheet("Vigência CNPJ x Serviço"),
    fetchSheet("Base Mensal"),
    fetchSheet("posicao geografica"),
  ]);
  return { fatos, vigencia, baseMensal, posicaoGeografica };
}

export const spreadsheetSource = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`;
