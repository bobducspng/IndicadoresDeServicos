import { z } from "zod";
import type { ColaboradoresPayload } from "@shared/colaboradores";
import { ENV } from "./_core/env";

/**
 * Fonte dos dados privados da visão "Por Colaborador".
 *
 * Modo real (COLABORADORES_API_URL definido):
 *   GET {COLABORADORES_API_URL}?key={COLABORADORES_API_KEY}
 *   É a URL de um Web App do Google Apps Script que devolve o JSON abaixo.
 *   A chave fica só no .env do servidor e nunca vai para o navegador.
 *
 *   {
 *     "atualizadoEm": "2026-11-02T08:00:00Z",
 *     "colaboradores": [
 *       { "email": "ana.silva@vena.app.br", "nome": "Ana Silva", "cargo": "...",
 *         "departamento": "BPO Gerencial", "telefone": "+55 ...", "fotoUrl": "https://..." }
 *     ],
 *     "vinculos": [
 *       { "email": "ana.silva@vena.app.br", "cliente": "Título do cliente", "funcao": "BPO Gerencial" }
 *     ]
 *   }
 *
 * Sem a variável, o servidor devolve dados de EXEMPLO (fonte "exemplo"). Neste
 * modo os vínculos vêm vazios e o navegador monta uma carteira fictícia sobre os
 * clientes reais, só para validar a tela.
 */

const payloadSchema = z.object({
  atualizadoEm: z.string().optional(),
  colaboradores: z.array(
    z.object({
      email: z.string().min(3),
      nome: z.string().min(1),
      cargo: z.string().default(""),
      departamento: z.string().default(""),
      telefone: z.string().nullish().transform((v) => v ?? null),
      fotoUrl: z.string().nullish().transform((v) => v ?? null),
    }),
  ),
  vinculos: z.array(
    z.object({
      email: z.string().min(3),
      cliente: z.string().min(1),
      funcao: z.string().min(1),
    }),
  ),
});

const TTL_MS = 5 * 60 * 1000;
let cache: { at: number; value: ColaboradoresPayload } | null = null;

export function limparCacheColaboradores() {
  cache = null;
}

const EXEMPLO: Array<[string, string, string, string]> = [
  ["Ana Exemplo", "Consultora BPO Gerencial", "BPO Gerencial", "ana.exemplo"],
  ["Bruno Exemplo", "Consultor BPO Gerencial", "BPO Gerencial", "bruno.exemplo"],
  ["Carla Exemplo", "Especialista em FP&A", "BPO Gerencial", "carla.exemplo"],
  ["Diego Exemplo", "Assistente Financeiro", "BPO Operacional", "diego.exemplo"],
  ["Elisa Exemplo", "Assistente Financeiro", "BPO Operacional", "elisa.exemplo"],
  ["Fabio Exemplo", "Analista Financeiro", "BPO Operacional", "fabio.exemplo"],
  ["Gisele Exemplo", "Analista Financeiro", "BPO Operacional", "gisele.exemplo"],
  ["Heitor Exemplo", "Assistente Financeiro", "BPO Operacional", "heitor.exemplo"],
  ["Iara Exemplo", "Analista de Gestão de Pedidos", "Suprimentos", "iara.exemplo"],
  ["Joao Exemplo", "Analista de Gestão de Pedidos", "Suprimentos", "joao.exemplo"],
  ["Karen Exemplo", "Analista Pleno", "Suprimentos", "karen.exemplo"],
  ["Lucas Exemplo", "Consultor de Operação Assistida", "Operação Assistida", "lucas.exemplo"],
];

export function payloadDeExemplo(): ColaboradoresPayload {
  return {
    fonte: "exemplo",
    atualizadoEm: new Date().toISOString(),
    colaboradores: EXEMPLO.map(([nome, cargo, departamento, usuario]) => ({
      // Domínio .invalid nunca resolve: nenhum e-mail de exemplo chega a alguém real.
      email: `${usuario}@exemplo.invalid`,
      nome,
      cargo,
      departamento,
      telefone: "+55 11 90000-0000",
      fotoUrl: null,
    })),
    vinculos: [],
  };
}

async function buscarPayloadReal(): Promise<ColaboradoresPayload> {
  const url = new URL(ENV.colaboradoresApiUrl);
  if (ENV.colaboradoresApiKey) url.searchParams.set("key", ENV.colaboradoresApiKey);

  const response = await fetch(url, { redirect: "follow", headers: { Accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`API de colaboradores respondeu ${response.status}.`);
  }
  const parsed = payloadSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new Error("A API de colaboradores devolveu um formato inesperado.");
  }

  const dados = parsed.data;
  return {
    fonte: "pipefy",
    atualizadoEm: dados.atualizadoEm ?? new Date().toISOString(),
    colaboradores: dados.colaboradores.map((c) => ({ ...c, email: c.email.trim().toLowerCase() })),
    vinculos: dados.vinculos.map((v) => ({ ...v, email: v.email.trim().toLowerCase() })),
  };
}

export async function carregarColaboradores(): Promise<ColaboradoresPayload> {
  if (!ENV.colaboradoresApiUrl) return payloadDeExemplo();

  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  const value = await buscarPayloadReal();
  cache = { at: Date.now(), value };
  return value;
}
