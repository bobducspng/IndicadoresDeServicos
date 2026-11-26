/**
 * Ponte entre o React e o Code.gs (Google Apps Script).
 *
 * No build do Apps Script não existe servidor Express/tRPC: cada operação é uma
 * chamada `google.script.run.api(procedimento, entradaJson)`. O Code.gs responde
 * sempre com um texto JSON `{ ok: true, data }` ou `{ ok: false, error: { code, message } }`,
 * o que evita que a mensagem de erro chegue ao navegador com prefixos do Google.
 */

interface GasRunner {
  withSuccessHandler(callback: (value: string) => void): GasRunner;
  withFailureHandler(callback: (error: { message?: string }) => void): GasRunner;
  api(procedimento: string, entradaJson: string): void;
}

function obterRunner(): GasRunner | undefined {
  // Sem augmentar o `window` global: o tipo `google` já existe para o Google Maps.
  return (window as unknown as { google?: { script?: { run?: GasRunner } } }).google?.script?.run;
}

export class GasError extends Error {
  data: { code: string };
  constructor(message: string, code = "INTERNAL_SERVER_ERROR") {
    super(message);
    this.name = "GasError";
    this.data = { code };
  }
}

export function gasCall<T>(procedimento: string, entrada?: unknown): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const runner = obterRunner();
    if (!runner) {
      reject(new GasError("Este painel precisa ser aberto pelo link do Web App do Google Apps Script."));
      return;
    }
    runner
      .withSuccessHandler((texto) => {
        try {
          const resposta = JSON.parse(texto) as
            | { ok: true; data: T }
            | { ok: false; error: { code?: string; message?: string } };
          if (resposta.ok) resolve(resposta.data);
          else reject(new GasError(resposta.error?.message ?? "Falha no servidor.", resposta.error?.code));
        } catch {
          reject(new GasError("Resposta inválida do servidor."));
        }
      })
      .withFailureHandler((erro) => {
        const mensagem = (erro?.message ?? "Falha ao falar com o servidor.").replace(/^(Exception|Error):\s*/, "");
        reject(new GasError(mensagem));
      })
      .api(procedimento, JSON.stringify(entrada ?? null));
  });
}
