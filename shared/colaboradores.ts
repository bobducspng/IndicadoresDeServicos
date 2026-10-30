/**
 * Contrato de dados da visão "Por Colaborador".
 *
 * Duas fontes alimentam a tela:
 *   1. Dados PRIVADOS (este contrato): quem é o colaborador e quais clientes
 *      ele atende. Vêm do servidor, protegidos por login.
 *   2. Dados dos CLIENTES (UF, cidade, marca, serviços ativos): já estão no
 *      navegador, na aba "Vigência CNPJ x Serviço".
 *
 * A ligação entre as duas é o NOME do cliente (mesmo título do Database
 * Clientes do Pipefy, que o Apps Script grava na coluna "Cliente").
 */

export interface Colaborador {
  /** E-mail corporativo em minúsculas. É a chave do colaborador. */
  email: string;
  nome: string;
  cargo: string;
  departamento: string;
  /** Só é enviado a administradores (ver prepararPayloadParaUsuario). */
  telefone: string | null;
  fotoUrl: string | null;
}

export interface VinculoColaborador {
  /** E-mail corporativo do colaborador (mesma chave de Colaborador.email). */
  email: string;
  /** Título do cliente no Database Clientes. */
  cliente: string;
  /**
   * Nome do campo de responsável no Database Clientes: "Receita", "Despesa",
   * "Agend. Bancário", "Conciliação Bancaria", "BPO Gerencial",
   * "Suprimentos Pedidos", "Suprimentos Outros", ou o nome de um serviço novo
   * (ex.: "Operação Assistida").
   */
  funcao: string;
}

export interface ColaboradoresPayload {
  fonte: "exemplo" | "pipefy";
  atualizadoEm: string;
  colaboradores: Colaborador[];
  vinculos: VinculoColaborador[];
}

export type GrupoServico = "Operacional" | "Gerencial" | "Suprimentos" | "Outros";

export const GRUPOS_SERVICO: GrupoServico[] = ["Operacional", "Gerencial", "Suprimentos", "Outros"];

export interface FuncaoInfo {
  /** Nome do serviço, igual ao da coluna "Serviço" da Vigência. */
  servico: string;
  grupo: GrupoServico;
}

export function normalizarTexto(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const FUNCOES_CONHECIDAS: Record<string, FuncaoInfo> = {
  "receita": { servico: "BPO Operacional Receitas", grupo: "Operacional" },
  "receita 2": { servico: "BPO Operacional Receitas", grupo: "Operacional" },
  "despesa": { servico: "BPO Operacional Despesas", grupo: "Operacional" },
  "despesa 2": { servico: "BPO Operacional Despesas", grupo: "Operacional" },
  "agend. bancario": { servico: "BPO Controle/Tesouraria", grupo: "Operacional" },
  "conciliacao bancaria": { servico: "BPO Controle/Tesouraria", grupo: "Operacional" },
  "bpo gerencial": { servico: "BPO Gerencial", grupo: "Gerencial" },
  "suprimentos pedidos": { servico: "BPO Suprimentos", grupo: "Suprimentos" },
  "suprimentos outros": { servico: "BPO Suprimentos", grupo: "Suprimentos" },
};

/**
 * Converte o nome do campo de responsável em serviço e grupo.
 * Campo desconhecido é tratado como nome de serviço (é a convenção dos campos
 * novos: "nome do campo = serviço contratado").
 */
export function resolverFuncao(funcao: string): FuncaoInfo {
  const chave = normalizarTexto(funcao);
  const conhecida = FUNCOES_CONHECIDAS[chave];
  if (conhecida) return conhecida;
  const grupo: GrupoServico = chave.includes("gerencial")
    ? "Gerencial"
    : chave.includes("suprimentos")
      ? "Suprimentos"
      : chave.includes("bpo operacional")
        ? "Operacional"
        : "Outros";
  return { servico: funcao.trim(), grupo };
}

export interface PermissaoUsuario {
  role: string;
  /** null = sem restrição de serviços (mesmo contrato do allowedServices). */
  allowedServices: string[] | null;
}

/**
 * Aplica ao payload as regras de acesso do usuário que pediu:
 *  - usuário com serviços restritos só vê vínculos desses serviços;
 *  - telefone só aparece para administradores.
 */
export function prepararPayloadParaUsuario(
  payload: ColaboradoresPayload,
  permissao: PermissaoUsuario,
): ColaboradoresPayload {
  const ehAdmin = permissao.role === "admin" || permissao.role === "super_admin";
  const permitidos = permissao.allowedServices
    ? new Set(permissao.allowedServices.map(normalizarTexto))
    : null;

  const vinculos = permitidos
    ? payload.vinculos.filter((v) => permitidos.has(normalizarTexto(resolverFuncao(v.funcao).servico)))
    : payload.vinculos;

  // Com restrição de serviços, só sobram colaboradores que atendem algo permitido.
  // Sem restrição, a lista completa é mantida (inclusive quem ainda não tem carteira).
  const comVinculo = new Set(vinculos.map((v) => v.email.toLowerCase()));
  const colaboradores = (permitidos
    ? payload.colaboradores.filter((c) => comVinculo.has(c.email.toLowerCase()))
    : payload.colaboradores
  ).map((c) => (ehAdmin ? c : { ...c, telefone: null }));

  return { ...payload, colaboradores, vinculos };
}
