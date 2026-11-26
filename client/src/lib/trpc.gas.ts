/**
 * Substituto do cliente tRPC no build do Google Apps Script (ver vite.gas.config.ts,
 * que troca "@/lib/trpc" por este arquivo). Mantém a mesma interface usada pelas
 * telas (`trpc.x.y.useQuery/useMutation` e `trpc.useUtils()`), mas cada chamada vai
 * para `google.script.run` em vez de HTTP.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "../../../server/routers";
import { gasCall } from "./gas";

type TrpcReal = ReturnType<typeof createTRPCReact<AppRouter>>;

type Opcoes = Record<string, unknown>;

function procedimento(caminho: string[]) {
  const nome = caminho.join(".");
  return {
    useQuery: (entrada?: unknown, opcoes?: Opcoes) =>
      useQuery({
        queryKey: [caminho, entrada ?? null],
        queryFn: () => gasCall(nome, entrada),
        ...(opcoes ?? {}),
      }),
    useMutation: (opcoes?: Opcoes) =>
      useMutation({
        mutationFn: (entrada: unknown) => gasCall(nome, entrada),
        ...(opcoes ?? {}),
      }),
  };
}

function utilitarios(queryClient: ReturnType<typeof useQueryClient>, caminho: string[] = []): unknown {
  return new Proxy(() => undefined, {
    get(_alvo, propriedade) {
      if (typeof propriedade !== "string") return undefined;
      if (propriedade === "invalidate") return () => queryClient.invalidateQueries({ queryKey: [caminho] });
      if (propriedade === "setData") return (entrada: unknown, dados: unknown) => queryClient.setQueryData([caminho, entrada ?? null], dados);
      if (propriedade === "getData") return (entrada?: unknown) => queryClient.getQueryData([caminho, entrada ?? null]);
      return utilitarios(queryClient, [...caminho, propriedade]);
    },
  });
}

function construir(caminho: string[] = []): unknown {
  return new Proxy(() => undefined, {
    get(_alvo, propriedade) {
      if (typeof propriedade !== "string") return undefined;
      if (caminho.length === 0 && propriedade === "useUtils") {
        return () => utilitarios(useQueryClient());
      }
      if (propriedade === "useQuery" || propriedade === "useMutation") {
        return procedimento(caminho)[propriedade];
      }
      return construir([...caminho, propriedade]);
    },
  });
}

export const trpc = construir() as unknown as TrpcReal;
