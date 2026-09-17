import { describe, expect, it, vi } from "vitest";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

const { state, clone } = vi.hoisted(() => {
  type MemoryAllowedUser = {
    id: number;
    email: string;
    name: string;
    role: "admin" | "user";
    isActive: number;
    allowedServices: string | null;
    avatarUrl: string | null;
    addedBy: string | null;
    createdAt: Date;
    updatedAt: Date;
  };

  const state: { nextId: number; users: MemoryAllowedUser[] } = {
    nextId: 2,
    users: [
      {
        id: 1,
        email: "ederlei.pereira@vena.app.br",
        name: "Ederlei Pereira",
        role: "admin",
        isActive: 1,
        allowedServices: null,
        avatarUrl: null,
        addedBy: "test",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  };

  const clone = <T,>(value: T): T => structuredClone(value);
  return { state, clone };
});

vi.mock("./db", () => ({
  getAllowedUserByEmail: async (email: string) => {
    const normalized = email.trim().toLowerCase();
    const user = state.users.find((item) => item.email === normalized);
    return user ? clone(user) : undefined;
  },
  listAllowedUsers: async () => clone(state.users),
  parseAllowedServices: (raw: string | null | undefined) => {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return raw.split(",").map((item) => item.trim()).filter(Boolean);
    }
  },
  addAllowedUser: async (data: {
    email: string;
    name: string;
    role?: "admin" | "user";
    allowedServices?: string[] | null;
    avatarUrl?: string | null;
    addedBy?: string | null;
  }) => {
    const user = {
      id: state.nextId++,
      email: data.email.trim().toLowerCase(),
      name: data.name.trim(),
      role: data.role ?? "user",
      isActive: 1,
      allowedServices: Array.isArray(data.allowedServices) ? JSON.stringify(data.allowedServices) : null,
      avatarUrl: data.avatarUrl ?? null,
      addedBy: data.addedBy ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    state.users.push(user);
    return clone(user);
  },
  updateAllowedUserRole: async (id: number, role: "admin" | "user") => {
    const user = state.users.find((item) => item.id === id);
    if (!user) throw new Error("Usuário não encontrado");
    user.role = role;
    return clone(user);
  },
  updateAllowedUserName: async (id: number, name: string) => {
    const user = state.users.find((item) => item.id === id);
    if (!user) throw new Error("Usuário não encontrado");
    user.name = name.trim();
    return clone(user);
  },
  updateAllowedUserServices: async (id: number, allowedServices: string[]) => {
    const user = state.users.find((item) => item.id === id);
    if (!user) throw new Error("Usuário não encontrado");
    user.allowedServices = JSON.stringify(allowedServices);
    return clone(user);
  },
  toggleAllowedUserStatus: async (id: number, isActive: number) => {
    const user = state.users.find((item) => item.id === id);
    if (!user) throw new Error("Usuário não encontrado");
    user.isActive = isActive;
    return clone(user);
  },
  removeAllowedUser: async (id: number) => {
    const index = state.users.findIndex((item) => item.id === id);
    if (index < 0) return false;
    state.users.splice(index, 1);
    return true;
  },
}));

import { appRouter } from "./routers";

type CookieCall = {
  name: string;
  value?: string;
  options: Record<string, unknown>;
};

function createMockContext(user?: TrpcContext["user"]): {
  ctx: TrpcContext;
  clearedCookies: CookieCall[];
} {
  const clearedCookies: CookieCall[] = [];

  const ctx: TrpcContext = {
    user: user ?? null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown> ) => {
        clearedCookies.push({ name, options });
      },
    } as unknown as TrpcContext["res"],
  };

  return { ctx, clearedCookies };
}

const adminUser = {
  id: 1,
  openId: "sample-admin",
  email: "ederlei.pereira@vena.app.br",
  name: "Ederlei Pereira",
  loginMethod: "google",
  role: "admin" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

describe("Autenticação e Controle de Acesso (Google SSO)", () => {
  it("permite logout e limpa o cookie de sessão", async () => {
    const { ctx, clearedCookies } = createMockContext(adminUser);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.logout();

    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
  });

  it("retorna a permissão admin do usuário autorizado", async () => {
    const { ctx } = createMockContext(adminUser);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.me();

    expect(result?.email).toBe("ederlei.pereira@vena.app.br");
    expect(result?.role).toBe("admin");
    expect(result?.isAllowed).toBe(true);
  });

  it("bloqueia a gestão de acessos para usuário sem perfil admin", async () => {
    const { ctx } = createMockContext({
      ...adminUser,
      id: 2,
      openId: "sample-user",
      email: "usuario@vena.app.br",
      role: "user",
    });
    const caller = appRouter.createCaller(ctx);

    await expect(caller.accessControl.list()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("permite ao administrador listar, adicionar e remover e-mails autorizados", async () => {
    const { ctx } = createMockContext(adminUser);
    const caller = appRouter.createCaller(ctx);

    const initialList = await caller.accessControl.list();
    expect(initialList.length).toBeGreaterThanOrEqual(1);

    const testEmail = `teste.${Date.now()}@vena.app.br`;
    const added = await caller.accessControl.add({
      email: testEmail,
      name: "Usuário Teste",
      role: "user",
      allowedServices: ["BPO Financeiro", "Contabilidade"],
    });
    expect(added.email).toBe(testEmail);
    expect(added.role).toBe("user");

    const updated = await caller.accessControl.updateRole({
      id: added.id,
      role: "admin",
    });
    expect(updated.role).toBe("admin");

    const renamed = await caller.accessControl.updateName({
      id: added.id,
      name: "Nome Atualizado",
    });
    expect(renamed.name).toBe("Nome Atualizado");

    const updatedServices = await caller.accessControl.updateServices({
      id: added.id,
      allowedServices: ["BPO Operacional Receitas"],
    });
    expect(updatedServices.allowedServices).toContain("BPO Operacional Receitas");

    const deactivated = await caller.accessControl.toggleStatus({
      id: added.id,
      isActive: 0,
    });
    expect(deactivated.isActive).toBe(0);

    const reactivated = await caller.accessControl.toggleStatus({
      id: added.id,
      isActive: 1,
    });
    expect(reactivated.isActive).toBe(1);

    const removed = await caller.accessControl.remove({ id: added.id });
    expect(removed).toBe(true);
  });
});
