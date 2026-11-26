/**
 * Versão do "@/lib/sheets" para o Google Apps Script: os dados da planilha não são
 * lidos pelo navegador (a planilha fica privada); o Code.gs lê as abas e entrega
 * ao painel somente para quem está cadastrado. Também não há cópia dos dados
 * embutida no arquivo.
 */
import { gasCall } from "./gas";
import type { DashboardSheets } from "./sheetsCore";

export * from "./sheetsCore";

export function getInitialSheets(): DashboardSheets {
  return { fatos: [], vigencia: [], baseMensal: [], posicaoGeografica: [], historicoServicos: [] };
}

// A primeira leitura pode vir do cache do Code.gs (rápida); quando a pessoa clica em
// "Reconectar"/atualizar, as leituras seguintes ignoram o cache e vão direto à planilha.
let leituras = 0;

export function fetchDashboardSheets(): Promise<DashboardSheets> {
  const forcar = leituras++ > 0;
  return gasCall<DashboardSheets>("dashboard.sheets", { forcar });
}
