import {
  GRUPOS_SERVICO,
  normalizarTexto,
  resolverFuncao,
  type Colaborador,
  type ColaboradoresPayload,
  type GrupoServico,
  type VinculoColaborador,
} from "@shared/colaboradores";
import { asText } from "@/lib/dashboard";
import type { SheetRow } from "@/lib/sheets";

/** Dados de um cliente, montados a partir da aba "Vigência CNPJ x Serviço". */
export interface ClienteInfo {
  nome: string;
  marca: string;
  estados: string[];
  cidades: string[];
  servicosAtivos: string[];
  ativo: boolean;
}

export const SEM_UF = "—";
export const TOTAL_UFS = 27;

export function chaveCliente(nome: unknown): string {
  return normalizarTexto(nome);
}

export function iniciais(nome: string): string {
  return nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0])
    .join("")
    .toUpperCase();
}

export function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? nome;
}

/** Um cliente é "ativo" se tem ao menos uma vigência com Situação "Ativo". */
export function montarIndiceClientes(vigencia: SheetRow[]): Map<string, ClienteInfo> {
  const mapa = new Map<string, ClienteInfo & { _estados: Set<string>; _cidades: Set<string>; _servicos: Set<string> }>();

  vigencia.forEach((linha) => {
    const nome = asText(linha["Cliente"]);
    if (!nome) return;
    const chave = chaveCliente(nome);
    const item = mapa.get(chave) ?? {
      nome,
      marca: "",
      estados: [],
      cidades: [],
      servicosAtivos: [],
      ativo: false,
      _estados: new Set<string>(),
      _cidades: new Set<string>(),
      _servicos: new Set<string>(),
    };

    const ativa = asText(linha["Situação"]) === "Ativo";
    if (!item.marca) item.marca = asText(linha["Marca"]);
    if (ativa) {
      item.ativo = true;
      const servico = asText(linha["Serviço"]);
      if (servico) item._servicos.add(servico);
      const uf = asText(linha["Estado"]).toUpperCase();
      if (uf) item._estados.add(uf);
      const cidade = asText(linha["Cidade"]);
      if (cidade) item._cidades.add(cidade);
    }
    mapa.set(chave, item);
  });

  const resultado = new Map<string, ClienteInfo>();
  mapa.forEach((item, chave) => {
    resultado.set(chave, {
      nome: item.nome,
      marca: item.marca,
      estados: Array.from(item._estados).sort(),
      cidades: Array.from(item._cidades).sort((a, b) => a.localeCompare(b, "pt-BR")),
      servicosAtivos: Array.from(item._servicos).sort((a, b) => a.localeCompare(b, "pt-BR")),
      ativo: item.ativo,
    });
  });
  return resultado;
}

/* ------------------------------------------------------------------ */
/* Dados de exemplo (só quando o servidor ainda não tem a API real)    */
/* ------------------------------------------------------------------ */

const FUNCAO_DE_SERVICO: Record<string, string> = {
  "BPO Operacional Receitas": "Receita",
  "BPO Operacional Despesas": "Despesa",
  "BPO Controle/Tesouraria": "Conciliação Bancaria",
  "BPO Gerencial": "BPO Gerencial",
  "BPO Suprimentos": "Suprimentos Pedidos",
};

function hashTexto(texto: string): number {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i += 1) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function departamentoDoGrupo(grupo: GrupoServico): string[] {
  if (grupo === "Gerencial") return ["bpo gerencial"];
  if (grupo === "Suprimentos") return ["suprimentos"];
  if (grupo === "Operacional") return ["bpo operacional"];
  return ["operacao assistida"];
}

/**
 * Distribui os clientes ATIVOS reais entre os colaboradores de exemplo, de forma
 * determinística, respeitando o departamento de cada colaborador. Serve só para
 * validar a tela antes de ligar os dados reais.
 */
export function gerarVinculosDeExemplo(
  colaboradores: Colaborador[],
  clientes: Iterable<ClienteInfo>,
): VinculoColaborador[] {
  const vinculos: VinculoColaborador[] = [];
  const porDepartamento = new Map<string, Colaborador[]>();
  colaboradores.forEach((c) => {
    const chave = normalizarTexto(c.departamento);
    porDepartamento.set(chave, [...(porDepartamento.get(chave) ?? []), c]);
  });

  Array.from(clientes)
    .filter((cliente) => cliente.ativo)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
    .forEach((cliente) => {
      cliente.servicosAtivos.forEach((servico) => {
        const funcao = FUNCAO_DE_SERVICO[servico] ?? servico;
        const grupo = resolverFuncao(funcao).grupo;
        const candidatos = departamentoDoGrupo(grupo).flatMap((d) => porDepartamento.get(d) ?? []);
        if (!candidatos.length) return;
        const escolhido = candidatos[hashTexto(`${cliente.nome}|${funcao}`) % candidatos.length];
        vinculos.push({ email: escolhido.email, cliente: cliente.nome, funcao });
      });
    });

  return vinculos;
}

export function aplicarDadosDeExemplo(
  payload: ColaboradoresPayload | undefined,
  clientes: Map<string, ClienteInfo>,
): ColaboradoresPayload | undefined {
  if (!payload) return payload;
  if (payload.fonte !== "exemplo" || payload.vinculos.length > 0) return payload;
  return { ...payload, vinculos: gerarVinculosDeExemplo(payload.colaboradores, clientes.values()) };
}

/* ------------------------------------------------------------------ */
/* Carteira de um colaborador                                          */
/* ------------------------------------------------------------------ */

export interface ClienteDaCarteira {
  nome: string;
  marca: string;
  estados: string[];
  cidades: string[];
  ativo: boolean;
  /** Campos de responsável em que o colaborador aparece neste cliente. */
  funcoes: string[];
  grupos: GrupoServico[];
  servicosAtivos: string[];
  /** Cliente que existe no Pipefy mas não aparece na Vigência. */
  semVigencia: boolean;
}

export function carteiraDoColaborador(
  email: string,
  vinculos: VinculoColaborador[],
  indice: Map<string, ClienteInfo>,
): ClienteDaCarteira[] {
  const alvo = email.trim().toLowerCase();
  const porCliente = new Map<string, ClienteDaCarteira>();

  vinculos.forEach((vinculo) => {
    if (vinculo.email.trim().toLowerCase() !== alvo) return;
    const chave = chaveCliente(vinculo.cliente);
    const info = indice.get(chave);
    const item = porCliente.get(chave) ?? {
      nome: info?.nome ?? vinculo.cliente,
      marca: info?.marca ?? "",
      estados: info?.estados ?? [],
      cidades: info?.cidades ?? [],
      ativo: info?.ativo ?? false,
      funcoes: [],
      grupos: [],
      servicosAtivos: info?.servicosAtivos ?? [],
      semVigencia: !info,
    };

    if (!item.funcoes.includes(vinculo.funcao)) item.funcoes.push(vinculo.funcao);
    const grupo = resolverFuncao(vinculo.funcao).grupo;
    if (!item.grupos.includes(grupo)) item.grupos.push(grupo);
    porCliente.set(chave, item);
  });

  return Array.from(porCliente.values()).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export function contarClientesPorUf(carteira: ClienteDaCarteira[]): Map<string, number> {
  const contagem = new Map<string, number>();
  carteira.forEach((cliente) => {
    const ufs = cliente.estados.length ? cliente.estados : [SEM_UF];
    ufs.forEach((uf) => contagem.set(uf, (contagem.get(uf) ?? 0) + 1));
  });
  return contagem;
}

export function contarPorGrupo(carteira: ClienteDaCarteira[]): Record<GrupoServico, number> {
  const base = Object.fromEntries(GRUPOS_SERVICO.map((g) => [g, 0])) as Record<GrupoServico, number>;
  carteira.forEach((cliente) => cliente.grupos.forEach((g) => { base[g] += 1; }));
  return base;
}

export interface ResumoColaborador {
  colaborador: Colaborador;
  clientes: number;
  clientesAtivos: number;
}

export function resumirColaboradores(
  colaboradores: Colaborador[],
  vinculos: VinculoColaborador[],
  indice: Map<string, ClienteInfo>,
  somenteAtivos: boolean,
): ResumoColaborador[] {
  const porEmail = new Map<string, Set<string>>();
  vinculos.forEach((v) => {
    const email = v.email.trim().toLowerCase();
    const chave = chaveCliente(v.cliente);
    if (somenteAtivos && !indice.get(chave)?.ativo) return;
    porEmail.set(email, (porEmail.get(email) ?? new Set()).add(chave));
  });

  return colaboradores
    .map((colaborador) => {
      const total = porEmail.get(colaborador.email.toLowerCase())?.size ?? 0;
      return { colaborador, clientes: total, clientesAtivos: total };
    })
    .sort((a, b) => b.clientes - a.clientes || a.colaborador.nome.localeCompare(b.colaborador.nome, "pt-BR"));
}

/* ------------------------------------------------------------------ */
/* Google Chat                                                         */
/* ------------------------------------------------------------------ */

/**
 * O Google Chat não tem link público confirmado para abrir uma conversa direta
 * a partir do e-mail (o link por ID depende do identificador interno do Google).
 * Por isso, por padrão, o botão copia uma mensagem pronta e abre o Chat.
 *
 * Se um link direto for validado no domínio da Vena, basta preencher o modelo
 * abaixo, usando {email} onde o e-mail deve entrar, e o botão passa a abri-lo.
 */
export const CHAT_DM_URL_TEMPLATE: string | null = null;
export const CHAT_HOME_URL = "https://chat.google.com/";

export function urlDoChat(email: string, modelo: string | null = CHAT_DM_URL_TEMPLATE): string {
  return modelo ? modelo.replace("{email}", encodeURIComponent(email)) : CHAT_HOME_URL;
}

export function mensagemDeChamada(colaborador: Colaborador, remetente?: string | null): string {
  const quem = remetente ? ` Aqui é ${primeiroNome(remetente)}.` : "";
  return `Olá, ${primeiroNome(colaborador.nome)}!${quem} Posso falar com você sobre a sua carteira de clientes?`;
}
