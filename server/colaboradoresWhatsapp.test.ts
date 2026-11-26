import { describe, expect, it } from "vitest";
import { numeroWhatsapp, urlDoWhatsapp } from "../client/src/lib/colaboradores";

describe("WhatsApp do colaborador", () => {
  it("monta o numero so com digitos e DDI", () => {
    expect(numeroWhatsapp("+55 11 90000-0001")).toBe("5511900000001");
    expect(numeroWhatsapp("(11) 91234-5678")).toBe("5511912345678");
    expect(numeroWhatsapp("011 91234-5678")).toBe("5511912345678");
    expect(numeroWhatsapp("11 3333-4444")).toBe("551133334444");
    expect(numeroWhatsapp("+1 415 555 2671")).toBe("14155552671");
  });

  it("rejeita telefone vazio ou invalido", () => {
    expect(numeroWhatsapp(null)).toBeNull();
    expect(numeroWhatsapp("")).toBeNull();
    expect(numeroWhatsapp("123")).toBeNull();
  });

  it("monta o link wa.me com a mensagem pronta", () => {
    const url = urlDoWhatsapp(
      { email: "ana@vena.app.br", nome: "Ana", cargo: "Consultora", departamento: "BPO Gerencial", telefone: "+55 11 90000-0001", fotoUrl: null },
      "Carlos Silva",
    );
    expect(url).not.toBeNull();
    expect(url!.startsWith("https://wa.me/5511900000001?text=")).toBe(true);
    const texto = decodeURIComponent(url!.split("?text=")[1]);
    expect(texto).toContain("Olá, Ana!");
    expect(texto).toContain("Aqui é Carlos.");
  });

  it("nao gera link sem telefone", () => {
    expect(
      urlDoWhatsapp({ email: "c@vena.app.br", nome: "Caio", cargo: "", departamento: "", telefone: null, fotoUrl: null }),
    ).toBeNull();
  });
});
