import { describe, expect, it } from "vitest";
import { escolherFoto, FOTO_MAX_BYTES, urlDaFotoEnviada, validarFotoDataUrl } from "./colaboradoresFotos";
import { calcularRecorte, deslocamentoAposArrasto } from "../client/src/lib/colaboradores";

const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(40, 1)]);
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40, 1)]);
const webp = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP"), Buffer.alloc(20, 1)]);
const dataUrl = (mime: string, buf: Buffer) => `data:${mime};base64,${buf.toString("base64")}`;

describe("validarFotoDataUrl", () => {
  it("aceita JPG, PNG e WebP reais", () => {
    expect(validarFotoDataUrl(dataUrl("image/jpeg", jpeg)).mime).toBe("image/jpeg");
    expect(validarFotoDataUrl(dataUrl("image/png", png)).mime).toBe("image/png");
    expect(validarFotoDataUrl(dataUrl("image/webp", webp)).mime).toBe("image/webp");
  });

  it("rejeita tipos não permitidos (SVG, GIF, texto)", () => {
    expect(() => validarFotoDataUrl(dataUrl("image/svg+xml", Buffer.from("<svg onload=alert(1)/>")))).toThrow();
    expect(() => validarFotoDataUrl(dataUrl("image/gif", Buffer.from("GIF89a")))).toThrow();
    expect(() => validarFotoDataUrl("https://exemplo.com/foto.jpg")).toThrow();
  });

  it("rejeita arquivo cujo conteúdo não bate com o tipo declarado", () => {
    expect(() => validarFotoDataUrl(dataUrl("image/png", jpeg))).toThrow(/imagem válida/);
    expect(() => validarFotoDataUrl(dataUrl("image/jpeg", Buffer.from("<script>alert(1)</script>")))).toThrow(/imagem válida/);
  });

  it("rejeita imagens acima do limite", () => {
    const grande = Buffer.concat([jpeg, Buffer.alloc(FOTO_MAX_BYTES, 2)]);
    expect(() => validarFotoDataUrl(dataUrl("image/jpeg", grande))).toThrow(/grande demais/);
  });
});

describe("escolherFoto", () => {
  const enviada = { atualizadoEm: new Date("2026-11-03T12:00:00Z") };
  it("prioriza a foto enviada pelo admin", () => {
    const r = escolherFoto("ana@vena.app.br", { enviada, google: "https://lh3.googleusercontent.com/a", payload: "https://x/y.jpg" });
    expect(r.fotoOrigem).toBe("upload");
    expect(r.fotoUrl).toBe(urlDaFotoEnviada("ana@vena.app.br", enviada.atualizadoEm));
    expect(r.fotoUrl).toContain("/api/colaboradores/foto?email=ana%40vena.app.br&v=");
  });
  it("usa a foto do Google quando não há upload", () => {
    expect(escolherFoto("a@vena.app.br", { google: "https://lh3.googleusercontent.com/a", payload: "https://x/y.jpg" })).toEqual({
      fotoUrl: "https://lh3.googleusercontent.com/a",
      fotoOrigem: "google",
    });
  });
  it("cai para a foto do payload e, por fim, para nenhuma (iniciais)", () => {
    expect(escolherFoto("a@vena.app.br", { payload: "https://x/y.jpg" }).fotoOrigem).toBe("pipefy");
    expect(escolherFoto("a@vena.app.br", {})).toEqual({ fotoUrl: null, fotoOrigem: null });
  });
  it("ignora URLs inseguras", () => {
    expect(escolherFoto("a@vena.app.br", { google: "javascript:alert(1)", payload: "data:text/html,x" })).toEqual({ fotoUrl: null, fotoOrigem: null });
  });
});

describe("recorte da foto", () => {
  it("zoom 1 centraliza o maior quadrado", () => {
    expect(calcularRecorte(400, 200, 1, 0, 0)).toEqual({ sx: 100, sy: 0, lado: 200 });
  });
  it("deslocamentos extremos ficam dentro da imagem", () => {
    const r = calcularRecorte(400, 200, 2, 5, -5);
    expect(r.lado).toBe(100);
    expect(r.sx).toBe(300);
    expect(r.sy).toBe(0);
  });
  it("zoom é limitado entre 1 e 3", () => {
    expect(calcularRecorte(300, 300, 99, 0, 0).lado).toBe(100);
    expect(calcularRecorte(300, 300, 0.1, 0, 0).lado).toBe(300);
  });
  it("arrastar para a direita mostra mais da esquerda da imagem e respeita os limites", () => {
    const novo = deslocamentoAposArrasto(0, 20, 240, 400, 200);
    expect(novo).toBeLessThan(0);
    expect(deslocamentoAposArrasto(-0.9, 5000, 240, 400, 200)).toBe(-1);
    expect(deslocamentoAposArrasto(0, 50, 240, 200, 200)).toBe(0);
  });
});
