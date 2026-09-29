import { describe, expect, it } from "vitest";
import {
  createPkcePair,
  isAllowedGoogleRedirectUri,
  registerOAuthRoutes,
} from "./_core/oauth";

function captureRoutes() {
  const routes = new Map<string, (req: any, res: any) => unknown>();
  const app = {
    get(path: string, handler: (req: any, res: any) => unknown) {
      routes.set(`GET ${path}`, handler);
    },
    post(path: string, handler: (req: any, res: any) => unknown) {
      routes.set(`POST ${path}`, handler);
    },
  };
  registerOAuthRoutes(app as any);
  return routes;
}

describe("Google OAuth conforme a especificação", () => {
  it("aceita somente os dois redirects autorizados", () => {
    expect(isAllowedGoogleRedirectUri("https://santa-barbed-glorious.ngrok-free.dev/api/auth/google/callback")).toBe(true);
    expect(isAllowedGoogleRedirectUri("http://localhost:3000/api/auth/google/callback")).toBe(true);
    expect(isAllowedGoogleRedirectUri("https://outro.example.com/api/auth/google/callback")).toBe(false);
    expect(isAllowedGoogleRedirectUri("https://santa-barbed-glorious.ngrok-free.dev/api/auth/google/callback/")).toBe(false);
  });

  it("gera um par PKCE válido", async () => {
    const first = createPkcePair();
    const second = createPkcePair();
    expect(first.verifier).toHaveLength(43);
    expect(first.challenge).toHaveLength(43);
    expect(first.verifier).not.toBe(second.verifier);
    expect(first.challenge).not.toBe(second.challenge);
  });

  it("expõe as rotas especificadas e mantém o alias /start", () => {
    const routes = captureRoutes();
    expect(routes.has("GET /api/auth/google")).toBe(true);
    expect(routes.has("GET /api/auth/google/start")).toBe(true);
    expect(routes.has("GET /api/auth/google/callback")).toBe(true);
    expect(routes.has("GET /api/auth/me")).toBe(true);
    expect(routes.has("POST /api/auth/logout")).toBe(true);
    expect(routes.has("GET /api/auth/logout")).toBe(true);
  });

  it("falha fechado no callback quando state ou verifier não conferem", async () => {
    const callback = captureRoutes().get("GET /api/auth/google/callback");
    expect(callback).toBeDefined();

    const response = {
      statusCode: 200,
      body: undefined as unknown,
      cleared: [] as string[],
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(value: unknown) {
        this.body = value;
        return this;
      },
      clearCookie(name: string) {
        this.cleared.push(name);
      },
    };

    await callback!({
      query: { code: "authorization-code", state: "wrong-state" },
      headers: { cookie: "google_oauth_state=expected-state" },
      protocol: "https",
    }, response);

    expect(response.statusCode).toBe(403);
    expect(response.body).toEqual({ error: "invalid google oauth state" });
    expect(response.cleared).toContain("google_oauth_state");
    expect(response.cleared).toContain("google_oauth_code_verifier");
  });
});
