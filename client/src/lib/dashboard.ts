import type { DashboardSheets, SheetRow } from "./sheets";

export type DashboardView = "general" | "client" | "access";
export type PeriodPreset = "year" | "last6" | "month" | "previousMonth" | "semester1" | "semester2" | "quarter1" | "quarter2" | "quarter3" | "quarter4";

export interface FilterState {
  regions: string[];
  services: string[];
  brands: string[];
  year: string;
  period: PeriodPreset;
}

export interface FilterOptions {
  regions: string[];
  services: string[];
  brands: string[];
  years: string[];
  latestDate: string;
}

export interface ClientMovement {
  client: string;
  date: string;
  detail: string;
  service: string;
  club: string;
}

export interface ActiveCnpjRow {
  cnpj: string;
  client: string;
  services: string[];
  startDate: string;
  endDate: string;
  region: string;
  city: string;
  state: string;
  brand: string;
}

export interface TimelinePoint {
  key: string;
  label: string;
  contractedServices: number;
  cancelledServices: number;
}

export interface DashboardSnapshot {
  period: {
    preset: PeriodPreset;
    startDate: string;
    endDate: string;
    label: string;
  };
  kpis: {
    clients: number;
    clientsYoYPercent: number | null;
    cnpjs: number;
    ltvYears: number;
    newClients: number;
    cancelledClients: number;
    boticarioClients: number;
    otherBrandClients: number;
    boticarioShare: number;
  };
  newClients: ClientMovement[];
  cancelledClients: ClientMovement[];
  timeline: TimelinePoint[];
  serviceBreakdown: Array<{ label: string; value: number; percent: number }>;
  serviceTotal: number;
  clientServiceBreakdown: Array<{ label: string; serviceCount: number; clients: number; percent: number; totalServices: number }>;
  clubBreakdown: Array<{ label: string; value: number; percent: number }>;
  stateCounts: Array<{ state: string; value: number }>;
  clientRows: Array<{
    client: string;
    services: number;
    cnpjs: number;
    region: string;
    brand: string;
    city: string;
    status: string;
  }>;
  activeRows: SheetRow[];
  latestDataDate: string;
}

export interface ClientServiceHistory {
  service: string;
  startDate: string;
  endDate: string;
  status: "Ativo" | "Encerrado" | "Operação Assistida";
  days: number;
  cnpjs: number;
  brand: string;
  city: string;
  state: string;
  region: string;
}

export interface ClientEventPoint {
  date: string;
  service: string;
  movement: string;
  event: string;
  club: string;
  responsible: string;
}

export interface ClientActiveSeriesPoint {
  key: string;
  label: string;
  services: Array<{
    label: string;
    active: number;
  }>;
}

export interface ClientDetail {
  client: string;
  referenceEndDate: string;
  metrics: {
    activeServices: number;
    historicalServices: number;
    closedServices: number;
    cnpjs: number;
    averageActiveDays: number;
    relationshipDays: number;
    firstServiceDate: string;
    lastMovementDate: string;
  };
  serviceHistory: ClientServiceHistory[];
  activeSeries: ClientActiveSeriesPoint[];
  events: ClientEventPoint[];
  brand: string;
  city: string;
  state: string;
  region: string;
}

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const PERIOD_LABELS: Record<PeriodPreset, string> = {
  year: "Ano",
  last6: "Últimos 6 meses",
  month: "Mês atual",
  previousMonth: "Mês anterior",
  semester1: "1º Semestre",
  semester2: "2º Semestre",
  quarter1: "1º Trimestre",
  quarter2: "2º Trimestre",
  quarter3: "3º Trimestre",
  quarter4: "4º Trimestre",
};

export const PERIOD_OPTIONS: Array<{ value: PeriodPreset; label: string }> = [
  { value: "year", label: PERIOD_LABELS.year },
  { value: "last6", label: PERIOD_LABELS.last6 },
  { value: "month", label: PERIOD_LABELS.month },
  { value: "previousMonth", label: PERIOD_LABELS.previousMonth },
  { value: "semester1", label: PERIOD_LABELS.semester1 },
  { value: "semester2", label: PERIOD_LABELS.semester2 },
  { value: "quarter1", label: PERIOD_LABELS.quarter1 },
  { value: "quarter2", label: PERIOD_LABELS.quarter2 },
  { value: "quarter3", label: PERIOD_LABELS.quarter3 },
  { value: "quarter4", label: PERIOD_LABELS.quarter4 },
];

export const DEFAULT_FILTERS: FilterState = {
  regions: [],
  services: [],
  brands: [],
  year: "all",
  period: "last6",
};

export const STATE_COORDINATES: Record<string, { lat: number; lng: number }> = {
  AC: { lat: -9.02, lng: -70.81 }, AL: { lat: -9.57, lng: -36.78 }, AP: { lat: 1.41, lng: -51.77 },
  AM: { lat: -4.0, lng: -64.0 }, BA: { lat: -12.96, lng: -41.7 }, CE: { lat: -5.2, lng: -39.5 },
  DF: { lat: -15.8, lng: -47.9 }, ES: { lat: -19.4, lng: -40.3 }, GO: { lat: -16.1, lng: -49.7 },
  MA: { lat: -5.0, lng: -45.0 }, MT: { lat: -12.6, lng: -55.4 }, MS: { lat: -20.5, lng: -54.5 },
  MG: { lat: -18.5, lng: -44.5 }, PA: { lat: -3.8, lng: -52.5 }, PB: { lat: -7.1, lng: -36.8 },
  PR: { lat: -24.5, lng: -51.5 }, PE: { lat: -8.4, lng: -37.8 }, PI: { lat: -7.7, lng: -42.7 },
  RJ: { lat: -22.3, lng: -43.2 }, RN: { lat: -5.8, lng: -36.6 }, RS: { lat: -30.2, lng: -53.2 },
  RO: { lat: -11.0, lng: -62.8 }, RR: { lat: 2.0, lng: -61.3 }, SC: { lat: -27.2, lng: -50.2 },
  SP: { lat: -22.2, lng: -48.2 }, SE: { lat: -10.6, lng: -37.4 }, TO: { lat: -10.2, lng: -48.3 },
};

export function asText(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

export function normalize(value: unknown): string {
  return asText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toUpperCase();
}

export function toDate(value: unknown): Date | null {
  const text = asText(value);
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function toDateInput(value: unknown): string {
  const date = toDate(value);
  if (!date) return "";
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function monthKey(value: unknown): string {
  const date = toDate(value);
  if (!date) return "";
  return `${date.getUTCFullYear()}-${`${date.getUTCMonth() + 1}`.padStart(2, "0")}`;
}

export function monthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return year && month ? `${MONTHS[month - 1]}/${String(year).slice(2)}` : key;
}

function numeric(value: unknown): number {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

function uniqueValues(rows: SheetRow[], fields: string[]): string[] {
  return Array.from(
    new Set(rows.flatMap((row) => fields.map((field) => asText(row[field]))).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function serviceFilterValues(rows: SheetRow[]): string[] {
  const operationalOrder = new Map([
    [normalize("BPO Operacional Receitas"), 0],
    [normalize("BPO Operacional Despesas"), 1],
    [normalize("BPO Controle/Tesouraria"), 2],
  ]);
  return uniqueValues(rows, ["Serviço"]).sort((a, b) => {
    const aRank = operationalOrder.get(normalize(a));
    const bRank = operationalOrder.get(normalize(b));
    if (aRank !== undefined || bRank !== undefined) {
      if (aRank === undefined) return 1;
      if (bRank === undefined) return -1;
      return aRank - bRank;
    }
    return a.localeCompare(b, "pt-BR");
  });
}

function availableYears(rows: SheetRow[]): string[] {
  const fields = ["Data", "Ano-Mês", "Início", "Fim"];
  return Array.from(new Set(rows.flatMap((row) => fields.map((field) => toDate(row[field])?.getUTCFullYear()).filter(Boolean).map(String)))).sort((a, b) => Number(b) - Number(a));
}

function latestDateFromRows(rows: SheetRow[], fields: string[]): Date | null {
  const dates = rows.flatMap((row) => fields.map((field) => toDate(row[field]))).filter((date): date is Date => Boolean(date));
  return dates.length ? new Date(Math.max(...dates.map((date) => date.getTime()))) : null;
}

function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function periodRange(latestDate: Date, preset: PeriodPreset): { start: Date; end: Date; label: string } {
  const end = new Date(latestDate);
  const year = end.getUTCFullYear();
  const month = end.getUTCMonth();
  if (preset === "year") return { start: new Date(Date.UTC(year, 0, 1)), end: new Date(Date.UTC(year, 11, 31, 23, 59, 59)), label: PERIOD_LABELS[preset] };
  if (preset === "last6") return { start: new Date(Date.UTC(year, month - 5, 1)), end, label: PERIOD_LABELS[preset] };
  if (preset === "month") return { start: new Date(Date.UTC(year, month, 1)), end, label: PERIOD_LABELS[preset] };
  if (preset === "previousMonth") return { start: new Date(Date.UTC(year, month - 1, 1)), end: new Date(Date.UTC(year, month, 0, 23, 59, 59)), label: PERIOD_LABELS[preset] };
  if (preset === "semester1") return { start: new Date(Date.UTC(year, 0, 1)), end: new Date(Date.UTC(year, 5, 30, 23, 59, 59)), label: PERIOD_LABELS[preset] };
  if (preset === "semester2") return { start: new Date(Date.UTC(year, 6, 1)), end: new Date(Date.UTC(year, 11, 31, 23, 59, 59)), label: PERIOD_LABELS[preset] };
  const quarter = Number(preset.replace("quarter", "")) - 1;
  const startMonth = quarter * 3;
  return {
    start: new Date(Date.UTC(year, startMonth, 1)),
    end: new Date(Date.UTC(year, startMonth + 3, 0, 23, 59, 59)),
    label: PERIOD_LABELS[preset],
  };
}

function anchorDateForYear(_rows: SheetRow[], year: string, fallback: Date): Date {
  if (year === "all") return fallback;
  const target = Number(year);
  // O ano histórico troca somente o ano; o mês permanece o mês de referência
  // global do dashboard. Assim, setembro/2026 vira setembro/2025, e não o
  // último mês que por acaso existe na base de 2025.
  return sameCalendarMonthInYear(fallback, target);
}

function latestDateForYear(rows: SheetRow[], year: number, fallback: Date): Date {
  const dates = rows.flatMap((row) => ["Data", "Ano-Mês", "Início", "Fim"].map((field) => toDate(row[field])))
    .filter((date): date is Date => Boolean(date && date.getUTCFullYear() === year));
  return dates.length ? new Date(Math.max(...dates.map((date) => date.getTime()))) : fallback;
}

function sameCalendarMonthInYear(reference: Date, year: number): Date {
  const month = reference.getUTCMonth();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(reference.getUTCDate(), lastDay);
  return new Date(Date.UTC(year, month, day, 23, 59, 59));
}

function percentageChange(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / previous) * 100;
}

function selectionMatches(row: SheetRow, filters: FilterState): boolean {
  const brandOrClub = [asText(row["Marca"]), asText(row["Clube"])].filter(Boolean);
  return (
    (!filters.regions.length || filters.regions.some((value) => normalize(value) === normalize(row["Região"]))) &&
    (!filters.services.length || filters.services.some((value) => normalize(value) === normalize(row["Serviço"]))) &&
    (!filters.brands.length || filters.brands.some((value) => brandOrClub.some((rowValue) => normalize(value) === normalize(rowValue))))
  );
}

function dateInside(value: unknown, start: Date, end: Date): boolean {
  const date = toDate(value);
  return Boolean(date && date >= start && date <= end);
}

function overlapsPeriod(row: SheetRow, start: Date, end: Date): boolean {
  const rowStart = toDate(row["Início"]);
  const rowEnd = toDate(row["Fim"]);
  if (!rowStart && !rowEnd) return true;
  return (rowStart ?? new Date("1900-01-01T00:00:00Z")) <= end && (rowEnd ?? new Date("2999-12-31T23:59:59Z")) >= start;
}

function activeAtEnd(row: SheetRow, end: Date): boolean {
  const rowStart = toDate(row["Início"]);
  const rowEnd = toDate(row["Fim"]);
  if (rowStart && rowStart > end) return false;
  if (rowEnd && rowEnd < end) return false;
  const status = normalize(row["Situação"]);
  return !rowEnd || status.startsWith("ATIVO") || rowEnd >= end;
}

function countUnique(rows: SheetRow[], keyFor: (row: SheetRow) => string): number {
  return new Set(rows.map(keyFor).filter(Boolean)).size;
}

function serviceKey(row: SheetRow): string {
  return `${normalize(row["Cliente"])}|${normalize(row["Serviço"])}`;
}

function clientKey(row: SheetRow): string {
  return normalize(row["Cliente"]);
}

function formatDetail(row: SheetRow): string {
  const first = asText(row["Clube"]) || asText(row["Marca"]) || "N/A";
  const service = asText(row["Serviço"]) || "serviço não informado";
  return `${first} · ${service}`;
}

function isOperationAssisted(row: SheetRow): boolean {
  return normalize(row["Serviço"]).includes("OPERACAO ASSISTIDA");
}

function movementList(rows: SheetRow[], type: "new" | "cancelled"): ClientMovement[] {
  const selected = rows.filter((row) => {
    const event = normalize(row["Evento Cliente"]);
    const movement = normalize(row["Tipo Movimentação"]);
    return type === "new"
      ? event === "NOVO CLIENTE" || movement === "AQUISICAO" || movement === "EXPANSAO"
      : !isOperationAssisted(row) && (event === "CLIENTE PERDIDO" || movement.includes("CANCELAMENTO"));
  });
  const byClient = new Map<string, ClientMovement>();
  selected.forEach((row) => {
    const client = asText(row["Cliente"]);
    const date = toDateInput(row["Data"]);
    if (!client || !date) return;
    const current = byClient.get(normalize(client));
    if (!current || date > current.date) {
      byClient.set(normalize(client), {
        client,
        date,
        detail: formatDetail(row),
        service: asText(row["Serviço"]),
        club: asText(row["Clube"]),
      });
    }
  });
  return Array.from(byClient.values()).sort((a, b) => b.date.localeCompare(a.date) || a.client.localeCompare(b.client, "pt-BR"));
}

function newClientList(fatos: SheetRow[], vigencia: SheetRow[], start: Date, end: Date): ClientMovement[] {
  const byClient = new Map<string, ClientMovement>();
  movementList(fatos, "new").forEach((item) => byClient.set(normalize(item.client), item));

  // A vigência pode ser criada antes do fato de movimentação pelo App Script.
  // Nesse intervalo, o início do contrato é a fonte mais atual da contratação.
  vigencia
    .filter((row) => dateInside(row["Início"], start, end))
    .forEach((row) => {
      const client = asText(row["Cliente"]);
      const date = toDateInput(row["Início"]);
      if (!client || !date) return;
      const current = byClient.get(normalize(client));
      if (!current || date > current.date) {
        byClient.set(normalize(client), {
          client,
          date,
          detail: formatDetail(row),
          service: asText(row["Serviço"]),
          club: asText(row["Clube"]),
        });
      }
    });

  return Array.from(byClient.values()).sort((a, b) => b.date.localeCompare(a.date) || a.client.localeCompare(b.client, "pt-BR"));
}

function timeline(rows: SheetRow[], start: Date, end: Date): TimelinePoint[] {
  const months = new Map<string, { contractedServices: number; cancelledServices: number }>();
  const firstMonth = startOfMonth(start);
  const lastMonth = startOfMonth(end);
  for (let cursor = new Date(firstMonth); cursor <= lastMonth; cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1))) {
    months.set(monthKey(cursor), { contractedServices: 0, cancelledServices: 0 });
  }
  rows.forEach((row) => {
    const key = monthKey(row["Data"]);
    if (!key) return;
    const event = normalize(row["Evento Cliente"]);
    const movement = normalize(row["Tipo Movimentação"]);
    const current = months.get(key) ?? { contractedServices: 0, cancelledServices: 0 };
    if (event === "NOVO CLIENTE" || movement === "AQUISICAO" || movement === "EXPANSAO") current.contractedServices += 1;
    if (!isOperationAssisted(row) && (event === "CLIENTE PERDIDO" || movement.includes("CANCELAMENTO"))) current.cancelledServices += 1;
    months.set(key, current);
  });
  return Array.from(months.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => ({
    key,
    label: monthLabel(key),
    contractedServices: value.contractedServices,
    cancelledServices: value.cancelledServices,
  }));
}

function averageRetentionYears(rows: SheetRow[], end: Date): number {
  const durations = new Map<string, number>();
  rows.forEach((row) => {
    const clientService = serviceKey(row);
    if (!clientService) return;
    const start = toDate(row["Início"]);
    if (!start) return;
    const explicitDays = numeric(row["Dias"]);
    const finish = toDate(row["Fim"]) ?? end;
    const days = explicitDays > 0 ? explicitDays : Math.max(0, (Math.min(finish.getTime(), end.getTime()) - start.getTime()) / 86400000);
    if (days > 0) durations.set(clientService, Math.max(durations.get(clientService) ?? 0, days));
  });
  const values = Array.from(durations.values());
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length / 365 : 0;
}

function activeClientMap(rows: SheetRow[]): Map<string, SheetRow[]> {
  const result = new Map<string, SheetRow[]>();
  rows.forEach((row) => {
    const key = clientKey(row);
    if (!key) return;
    result.set(key, [...(result.get(key) ?? []), row]);
  });
  return result;
}

function serviceBreakdown(rows: SheetRow[]): { items: Array<{ label: string; value: number; percent: number }>; total: number } {
  const unique = new Map<string, SheetRow>();
  rows.forEach((row) => {
    const key = serviceKey(row);
    if (key) unique.set(key, row);
  });
  const counts = new Map<string, number>();
  unique.forEach((row) => {
    const service = asText(row["Serviço"]) || "Não informado";
    counts.set(service, (counts.get(service) ?? 0) + 1);
  });
  const total = Array.from(counts.values()).reduce((sum, value) => sum + value, 0);
  const items = Array.from(counts.entries()).map(([label, value]) => ({ label, value, percent: total ? (value / total) * 100 : 0 })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "pt-BR"));
  return { items, total };
}

function clientServiceBreakdown(rows: SheetRow[]): Array<{ label: string; serviceCount: number; clients: number; percent: number; totalServices: number }> {
  const grouped = activeClientMap(rows);
  const counts = new Map<number, number>();
  grouped.forEach((clientRowsForClient) => {
    const serviceCount = new Set(clientRowsForClient.map((row) => asText(row["Serviço"])).filter(Boolean)).size;
    if (serviceCount) counts.set(serviceCount, (counts.get(serviceCount) ?? 0) + 1);
  });
  const totalClients = Array.from(counts.values()).reduce((sum, value) => sum + value, 0);
  return Array.from(counts.entries())
    .sort(([a], [b]) => a - b)
    .map(([serviceCount, clients]) => ({
      label: `${serviceCount} ${serviceCount === 1 ? "serviço" : "serviços"}`,
      serviceCount,
      clients,
      percent: totalClients ? (clients / totalClients) * 100 : 0,
      totalServices: serviceCount * clients,
    }));
}

function clubBreakdown(fatos: SheetRow[]): Array<{ label: string; value: number; percent: number }> {
  const byClient = new Map<string, Map<string, number>>();
  fatos.forEach((row) => {
    const client = clientKey(row);
    if (!client) return;
    const rawClub = asText(row["Clube"]).trim();
    if (!rawClub) return;
    const normalized = normalize(rawClub);
    if (normalized.includes("NAO INFORMADO") || normalized === "N/A" || normalized === "NAO CONSTA" || normalized === "SEM CLUBE") return;
    const club = rawClub;
    const clubs = byClient.get(client) ?? new Map<string, number>();
    clubs.set(club, (clubs.get(club) ?? 0) + 1);
    byClient.set(client, clubs);
  });
  const counts = new Map<string, number>();
  byClient.forEach((clubs) => {
    const primary = Array.from(clubs.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"))[0]?.[0];
    if (primary) counts.set(primary, (counts.get(primary) ?? 0) + 1);
  });
  const total = Array.from(counts.values()).reduce((sum, value) => sum + value, 0) || 1;
  return Array.from(counts.entries()).map(([label, value]) => ({ label, value, percent: (value / total) * 100 })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "pt-BR"));
}

function stateCounts(rows: SheetRow[]): Array<{ state: string; value: number }> {
  const byState = new Map<string, Set<string>>();
  rows.forEach((row) => {
    const state = asText(row["Estado"]).toUpperCase();
    const client = clientKey(row);
    if (!state || !client) return;
    const clients = byState.get(state) ?? new Set<string>();
    clients.add(client);
    byState.set(state, clients);
  });
  return Array.from(byState.entries()).map(([state, clients]) => ({ state, value: clients.size })).sort((a, b) => b.value - a.value);
}

function clientRows(rows: SheetRow[]): DashboardSnapshot["clientRows"] {
  const grouped = activeClientMap(rows);
  return Array.from(grouped.values()).map((clientRowsForClient) => {
    const first = clientRowsForClient[0];
    const client = asText(first["Cliente"]);
    return {
      client,
      services: new Set(clientRowsForClient.map((row) => asText(row["Serviço"])).filter(Boolean)).size,
      cnpjs: new Set(clientRowsForClient.map((row) => asText(row["CNPJ"])).filter(Boolean)).size,
      region: asText(first["Região"]) || "—",
      brand: asText(first["Marca"]) || "—",
      city: asText(first["Cidade"]) || "—",
      status: asText(first["Situação"]) || "Ativo",
    };
  }).sort((a, b) => b.services - a.services || a.client.localeCompare(b.client, "pt-BR"));
}

function endOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59));
}

function endOfDate(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59));
}

function daysBetween(start: Date | null, end: Date): number {
  if (!start) return 0;
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000));
}

function clientHistoryRows(rows: SheetRow[], referenceEnd: Date): ClientServiceHistory[] {
  const byServicePeriod = new Map<string, SheetRow[]>();
  rows.forEach((row) => {
    const service = asText(row["Serviço"]);
    if (!service) return;
    const key = `${normalize(service)}|${toDateInput(row["Início"])}|${toDateInput(row["Fim"])}`;
    byServicePeriod.set(key, [...(byServicePeriod.get(key) ?? []), row]);
  });

  return Array.from(byServicePeriod.values()).map((serviceRows) => {
    const first = serviceRows[0];
    const service = asText(first["Serviço"]);
    const starts = serviceRows.map((row) => toDate(row["Início"])).filter((value): value is Date => Boolean(value));
    const ends = serviceRows.map((row) => toDate(row["Fim"])).filter((value): value is Date => Boolean(value));
    const start = starts.length ? new Date(Math.min(...starts.map((value) => value.getTime()))) : null;
    const end = ends.length ? new Date(Math.max(...ends.map((value) => value.getTime()))) : null;
    const isAssisted = isOperationAssisted(first);
    // Uma data de fim preenchida encerra o ciclo na visão histórica do cliente.
    // A exceção é Operação Assistida: seu encerramento representa a finalização
    // prevista do período, por isso permanece identificado separadamente.
    const isActive = Boolean(start && start <= referenceEnd && (!end || end > referenceEnd));
    const status: ClientServiceHistory["status"] = isAssisted ? "Operação Assistida" : isActive ? "Ativo" : "Encerrado";
    const durationDays = end ? daysBetween(start, end) : daysBetween(start, referenceEnd);
    const cnpjs = new Set(serviceRows.map((row) => asText(row["CNPJ"])).filter(Boolean)).size;
    return {
      service,
      startDate: start ? toDateInput(start) : "",
      endDate: end ? toDateInput(end) : "",
      status,
      days: durationDays,
      cnpjs,
      brand: asText(first["Marca"]) || "—",
      city: asText(first["Cidade"]) || "—",
      state: asText(first["Estado"]) || "—",
      region: asText(first["Região"]) || "—",
    };
  }).sort((a, b) => (a.status === "Ativo" ? -1 : 1) - (b.status === "Ativo" ? -1 : 1) || b.startDate.localeCompare(a.startDate) || a.service.localeCompare(b.service, "pt-BR"));
}

function clientActiveSeries(history: ClientServiceHistory[], referenceEnd: Date): ClientActiveSeriesPoint[] {
  const starts = history.map((item) => toDate(item.startDate)).filter((value): value is Date => Boolean(value));
  if (!starts.length) return [];
  const serviceNames = Array.from(new Set(history.map((item) => asText(item.service)).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
  const firstMonth = startOfMonth(new Date(Math.min(...starts.map((value) => value.getTime()))));
  const lastMonth = startOfMonth(referenceEnd);
  const points: ClientActiveSeriesPoint[] = [];
  for (let cursor = new Date(firstMonth); cursor <= lastMonth; cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1))) {
    const monthEnd = endOfMonth(cursor);
    const key = monthKey(cursor);
    points.push({
      key,
      label: monthLabel(key),
      services: serviceNames.map((service) => {
        const serviceKey = normalize(service);
        const active = history.some((item) => {
          if (normalize(item.service) !== serviceKey) return false;
          const start = toDate(item.startDate);
          const end = toDate(item.endDate);
          return Boolean(start && start <= monthEnd && (!end || endOfDate(end) >= monthEnd));
        }) ? 1 : 0;
        return { label: service, active };
      }),
    });
  }
  return points;
}

export function buildClientOptions(data: DashboardSheets): string[] {
  const clients = new Map<string, string>();
  [...data.vigencia, ...data.fatos].forEach((row) => {
    const value = asText(row["Cliente"]);
    const key = normalize(value);
    if (key && !clients.has(key)) clients.set(key, value);
  });
  return Array.from(clients.values()).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export function deriveClientDetail(data: DashboardSheets, client: string): ClientDetail | null {
  const normalizedClient = normalize(client);
  if (!normalizedClient) return null;
  const allRows = [...data.fatos, ...data.vigencia, ...data.baseMensal];
  const latestDate = latestDateFromRows(allRows, ["Data", "Ano-Mês", "Início", "Fim"]) ?? new Date();
  const range = { start: new Date("1900-01-01T00:00:00Z"), end: latestDate };
  const clientVigencia = data.vigencia.filter((row) => normalize(row["Cliente"]) === normalizedClient);
  const historyRows = clientVigencia.filter((row) => {
    const start = toDate(row["Início"]);
    const end = toDate(row["Fim"]);
    return Boolean((start && start <= range.end) || (!start && end && end <= range.end));
  });
  const serviceHistory = clientHistoryRows(historyRows, range.end);
  if (!serviceHistory.length) return null;

  const activeServices = new Set(serviceHistory.filter((item) => item.status === "Ativo").map((item) => normalize(item.service))).size;
  const historicalServices = new Set(serviceHistory.map((item) => normalize(item.service))).size;
  // Operação Assistida não é cancelamento, mas cada ciclo com uma data de fim
  // precisa aparecer como encerrado no resumo. O ciclo aberto continua separado.
  const closedServices = serviceHistory.filter((item) => {
    const end = toDate(item.endDate);
    return Boolean(end && end <= range.end);
  }).length;
  const cnpjs = new Set(historyRows.map((row) => asText(row["CNPJ"])).filter(Boolean)).size;
  const firstServiceDate = serviceHistory.map((item) => item.startDate).filter(Boolean).sort()[0] ?? "";
  const durations = serviceHistory.map((item) => item.days).filter((value) => value > 0);
  const relationshipDays = daysBetween(toDate(firstServiceDate), range.end);
  const clientFatos = data.fatos.filter((row) => normalize(row["Cliente"]) === normalizedClient);
  const events = clientFatos
    .filter((row) => dateInside(row["Data"], range.start, range.end))
    .map((row) => {
      const assistedClosure = isOperationAssisted(row) && normalize(row["Tipo Movimentação"]).includes("CANCELAMENTO");
      return {
        date: toDateInput(row["Data"]),
        service: asText(row["Serviço"]) || "—",
        movement: assistedClosure ? "Finalização do período" : asText(row["Tipo Movimentação"]) || "—",
        event: assistedClosure ? "Serviço concluído" : asText(row["Evento Cliente"]) || "—",
        club: asText(row["Clube"]) || "—",
        responsible: asText(row["Responsável"]) || "—",
      } satisfies ClientEventPoint;
    })
    .filter((item) => item.date)
    .sort((a, b) => b.date.localeCompare(a.date));
  const lastMovementDate = [...clientFatos.map((row) => toDateInput(row["Data"])).filter(Boolean), ...serviceHistory.map((item) => item.endDate).filter(Boolean)].sort().at(-1) ?? "";
  const first = historyRows[0];

  return {
    client,
    referenceEndDate: toDateInput(range.end),
    metrics: {
      activeServices,
      historicalServices,
      closedServices,
      cnpjs,
      averageActiveDays: durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : 0,
      relationshipDays,
      firstServiceDate,
      lastMovementDate,
    },
    serviceHistory,
    activeSeries: clientActiveSeries(serviceHistory, range.end),
    events,
    brand: asText(first?.["Marca"]) || asText(first?.["Clube"]) || "—",
    city: asText(first?.["Cidade"]) || "—",
    state: asText(first?.["Estado"]) || "—",
    region: asText(first?.["Região"]) || "—",
  };
}

export function buildFilterOptions(data: DashboardSheets): FilterOptions {
  const latest = latestDateFromRows([...data.fatos, ...data.baseMensal, ...data.vigencia], ["Data", "Ano-Mês", "Fim"]) ?? new Date();
  return {
    regions: uniqueValues([...data.fatos, ...data.vigencia], ["Região"]),
    services: serviceFilterValues([...data.fatos, ...data.vigencia]),
    brands: uniqueValues([...data.fatos, ...data.vigencia], ["Clube", "Marca"]),
    years: availableYears([...data.fatos, ...data.vigencia, ...data.baseMensal]),
    latestDate: toDateInput(latest),
  };
}

export function filterDataByAllowedServices(data: DashboardSheets, allowedServices?: string[] | null): DashboardSheets {
  // null/undefined representa acesso irrestrito (administradores ou registros antigos).
  // Array vazio representa um usuário restrito sem nenhum serviço liberado.
  if (allowedServices === null || allowedServices === undefined) return data;
  const allowedNormalized = new Set(allowedServices.map((s) => normalize(s)));
  const serviceMatches = (row: SheetRow) => {
    const service = asText(row["Serviço"]);
    if (!service) return false;
    return allowedNormalized.has(normalize(service));
  };
  return {
    fatos: data.fatos.filter(serviceMatches),
    vigencia: data.vigencia.filter(serviceMatches),
    baseMensal: data.baseMensal.filter(serviceMatches),
    posicaoGeografica: data.posicaoGeografica,
  };
}

export function deriveSnapshot(data: DashboardSheets, filters: FilterState): DashboardSnapshot {
  const allRows = [...data.fatos, ...data.baseMensal, ...data.vigencia];
  const latestDate = latestDateFromRows(allRows, ["Data", "Ano-Mês"]) ?? new Date();
  const anchorDate = anchorDateForYear(allRows, filters.year, latestDate);
  const range = periodRange(anchorDate, filters.period);
  const fatos = data.fatos.filter((row) => selectionMatches(row, filters) && dateInside(row["Data"], range.start, range.end));
  const selectedVigencia = data.vigencia.filter((row) => selectionMatches(row, filters));
  const periodVigencia = selectedVigencia.filter((row) => overlapsPeriod(row, range.start, range.end));
  // Se o período começa depois da última data disponível, ele ainda não tem
  // eventos próprios. Nesse caso, o estoque deve representar a carteira atual
  // inteira, e não somente contratos que já tenham uma Fim posterior ao
  // início do trimestre futuro.
  const vigencia = range.start > latestDate ? selectedVigencia : periodVigencia;
  // Ativos é um estoque na data de corte, não a união de todos os contratos
  // que tocaram o período. Em períodos futuros (por exemplo, 4º trimestre
  // antes de outubro), a data de corte é a última data disponível na base.
  // Assim, os movimentos futuros ficam zerados e a carteira mostra os
  // clientes realmente ativos no momento, igual ao recorte anual corrente.
  const snapshotEnd = range.end > latestDate ? latestDate : range.end;
  const effectiveActiveRows = vigencia.filter((row) => activeAtEnd(row, snapshotEnd));
  const activeClients = new Set(effectiveActiveRows.map(clientKey).filter(Boolean));
  const activeCnpjs = new Set(effectiveActiveRows.map((row) => asText(row["CNPJ"])).filter(Boolean));
  const previousYear = anchorDate.getUTCFullYear() - 1;
  const previousAnchor = filters.year === "all"
    ? latestDateForYear([...data.fatos, ...data.baseMensal, ...data.vigencia], previousYear, new Date(Date.UTC(previousYear, anchorDate.getUTCMonth(), anchorDate.getUTCDate())))
    : sameCalendarMonthInYear(anchorDate, previousYear);
  const previousRange = periodRange(previousAnchor, filters.period);
  const previousVigencia = data.vigencia.filter((row) => selectionMatches(row, filters) && overlapsPeriod(row, previousRange.start, previousRange.end));
  const previousSnapshotEnd = previousRange.end;
  const previousActiveRows = previousVigencia.filter((row) => activeAtEnd(row, previousSnapshotEnd));
  const previousClients = new Set(previousActiveRows.map(clientKey).filter(Boolean));
  const newClients = newClientList(fatos, vigencia, range.start, range.end);
  const cancelledClients = movementList(fatos, "cancelled");
  const byClient = activeClientMap(effectiveActiveRows);
  const boticarioClientKeys = new Set<string>();
  byClient.forEach((rows, client) => {
    if (rows.some((row) => normalize(row["Marca"]).includes("O BOTICARIO"))) boticarioClientKeys.add(client);
  });
  const boticarioClients = boticarioClientKeys.size;
  const otherBrandClients = Math.max(0, activeClients.size - boticarioClients);
  const services = serviceBreakdown(effectiveActiveRows);
  const retentionRows = effectiveActiveRows;
  const clubRows = data.fatos.filter((row) => selectionMatches(row, filters));

  return {
    period: { preset: filters.period, startDate: toDateInput(range.start), endDate: toDateInput(range.end), label: range.label },
    kpis: {
    clients: activeClients.size,
      clientsYoYPercent: filters.year === "all" ? null : percentageChange(activeClients.size, previousClients.size),
      cnpjs: activeCnpjs.size,
    ltvYears: averageRetentionYears(retentionRows, snapshotEnd),
      newClients: newClients.length,
      cancelledClients: cancelledClients.length,
      boticarioClients,
      otherBrandClients,
      boticarioShare: activeClients.size ? (boticarioClients / activeClients.size) * 100 : 0,
    },
    newClients,
    cancelledClients,
    timeline: timeline(fatos, range.start, range.end),
    serviceBreakdown: services.items,
    serviceTotal: services.total,
    clientServiceBreakdown: clientServiceBreakdown(effectiveActiveRows),
    clubBreakdown: clubBreakdown(clubRows),
    stateCounts: stateCounts(effectiveActiveRows),
    clientRows: clientRows(effectiveActiveRows),
    activeRows: effectiveActiveRows,
    latestDataDate: toDateInput(latestDate),
  };
}

export function formatNumber(value: number, maximumFractionDigits = 0): string {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits }).format(value);
}

export function formatDate(value: string): string {
  if (!value) return "—";
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

export function formatPeriodDate(value: string): string {
  if (!value) return "—";
  const [year, month] = value.split("-");
  return year && month ? `${month}/${year}` : value;
}

export function buildActiveCnpjRows(rows: SheetRow[]): ActiveCnpjRow[] {
  const grouped = new Map<string, ActiveCnpjRow>();
  rows.forEach((row) => {
    const cnpj = asText(row["CNPJ"]);
    if (!cnpj) return;
    const key = normalize(cnpj);
    const current = grouped.get(key);
    const service = asText(row["Serviço"]);
    const startDate = toDateInput(row["Início"]);
    const endDate = toDateInput(row["Fim"]);
    if (!current) {
      grouped.set(key, {
        cnpj,
        client: asText(row["Cliente"]) || "Cliente não informado",
        services: service ? [service] : [],
        startDate,
        endDate,
        region: asText(row["Região"]) || "—",
        city: asText(row["Cidade"]) || "—",
        state: asText(row["Estado"]) || "—",
        brand: asText(row["Marca"]) || asText(row["Clube"]) || "—",
      });
      return;
    }
    if (service && !current.services.some((item) => normalize(item) === normalize(service))) current.services.push(service);
    if (startDate && (!current.startDate || startDate < current.startDate)) current.startDate = startDate;
    if (endDate && (!current.endDate || endDate > current.endDate)) current.endDate = endDate;
  });
  return Array.from(grouped.values()).sort((a, b) => a.client.localeCompare(b.client, "pt-BR") || a.cnpj.localeCompare(b.cnpj, "pt-BR"));
}
