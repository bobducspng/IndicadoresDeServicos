/**
 * Fotos de colaboradores: validação do upload e escolha da foto exibida.
 *
 * Prioridade da foto exibida:
 *   1. foto enviada por um administrador;
 *   2. foto da conta Google (guardada no login);
 *   3. foto que já veio no payload do Pipefy/Apps Script;
 *   4. nada → a tela mostra as iniciais.
 */

export const FOTO_MIMES = ["image/jpeg", "image/png", "image/webp"] as const;
export type FotoMime = (typeof FOTO_MIMES)[number];

/** Limite do arquivo já reduzido pelo navegador (~256 px). Folga ampla. */
export const FOTO_MAX_BYTES = 300 * 1024;

export const FOTO_ROTA = "/api/colaboradores/foto";

export interface FotoValidada {
  mime: FotoMime;
  base64: string;
  bytes: number;
}

function detectarMime(buffer: Buffer): FotoMime | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return "image/png";
  }
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") {
    return "image/webp";
  }
  return null;
}

/** Valida um data URL de imagem (tipo declarado, tamanho e assinatura real do arquivo). */
export function validarFotoDataUrl(dataUrl: string): FotoValidada {
  const correspondencia = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!correspondencia) {
    throw new Error("Envie uma imagem JPG, PNG ou WebP.");
  }
  const declarado = correspondencia[1] as FotoMime;
  const base64 = correspondencia[2];
  // Estimativa antes de decodificar, para não alocar memória à toa.
  if (base64.length > Math.ceil((FOTO_MAX_BYTES * 4) / 3) + 4) {
    throw new Error("A imagem é grande demais. Use uma foto menor.");
  }
  const buffer = Buffer.from(base64, "base64");
  if (buffer.length === 0 || buffer.length > FOTO_MAX_BYTES) {
    throw new Error("A imagem é grande demais. Use uma foto menor.");
  }
  const real = detectarMime(buffer);
  if (!real || real !== declarado) {
    throw new Error("O arquivo não é uma imagem válida.");
  }
  return { mime: real, base64, bytes: buffer.length };
}

export function urlDaFotoEnviada(email: string, atualizadoEm: Date | number): string {
  const versao = typeof atualizadoEm === "number" ? atualizadoEm : atualizadoEm.getTime();
  return `${FOTO_ROTA}?email=${encodeURIComponent(email)}&v=${versao}`;
}

export type FotoOrigem = "upload" | "google" | "pipefy";

export interface FotoEscolhida {
  fotoUrl: string | null;
  fotoOrigem: FotoOrigem | null;
}

export interface FontesDeFoto {
  enviada?: { atualizadoEm: Date | number } | null;
  google?: string | null;
  payload?: string | null;
}

export function escolherFoto(email: string, fontes: FontesDeFoto): FotoEscolhida {
  if (fontes.enviada) {
    return { fotoUrl: urlDaFotoEnviada(email, fontes.enviada.atualizadoEm), fotoOrigem: "upload" };
  }
  const google = fontes.google?.trim();
  if (google && /^https:\/\//i.test(google)) return { fotoUrl: google, fotoOrigem: "google" };
  const payload = fontes.payload?.trim();
  if (payload && /^https?:\/\//i.test(payload)) return { fotoUrl: payload, fotoOrigem: "pipefy" };
  return { fotoUrl: null, fotoOrigem: null };
}
