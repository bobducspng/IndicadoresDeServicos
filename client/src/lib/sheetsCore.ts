export type CellValue = string | number | null;
export type SheetRow = Record<string, CellValue>;

export interface DashboardSheets {
  fatos: SheetRow[];
  vigencia: SheetRow[];
  baseMensal: SheetRow[];
  posicaoGeografica: SheetRow[];
  historicoServicos: SheetRow[];
}

export function isSuspiciouslyPartial(previous: DashboardSheets, next: DashboardSheets): boolean {
  const keys: Array<keyof DashboardSheets> = ["fatos", "vigencia", "baseMensal", "posicaoGeografica", "historicoServicos"];
  return keys.some((key) => {
    const previousCount = previous[key].length;
    const nextCount = next[key].length;
    // Uma resposta pública que perde quase toda uma aba é mais provável de ser
    // uma leitura intermediária do Apps Script do que uma atualização válida.
    return previousCount >= 100 && nextCount < Math.max(100, Math.floor(previousCount * 0.25));
  });
}

export function mergeDashboardSheets(previous: DashboardSheets, next: DashboardSheets): { data: DashboardSheets; partialSheets: Array<keyof DashboardSheets> } {
  const keys: Array<keyof DashboardSheets> = ["fatos", "vigencia", "baseMensal", "posicaoGeografica", "historicoServicos"];
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
      historicoServicos: partialSheets.includes("historicoServicos") ? previous.historicoServicos : next.historicoServicos,
    },
    partialSheets,
  };
}

export const SPREADSHEET_ID = "1BWWM39AJ88tj59EWN4qJCP5kVJAx16t7yVYuVw_QuIY";
export const spreadsheetSource = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`;
