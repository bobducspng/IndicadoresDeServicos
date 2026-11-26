import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { ForbiddenError } from "@shared/_core/errors";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

export type SessionPayload = {
  openId: string;
  provider: "google";
  name: string;
};

class SessionService {
  private getSessionSecret() {
    if (!ENV.cookieSecret) {
      throw new Error("JWT_SECRET não está configurado");
    }
    return new TextEncoder().encode(ENV.cookieSecret);
  }

  async createSessionToken(
    openId: string,
    options: { expiresInMs?: number; name?: string } = {},
  ): Promise<string> {
    return this.signSession(
      {
        openId,
        provider: "google",
        name: options.name || "",
      },
      options,
    );
  }

  async signSession(
    payload: SessionPayload,
    options: { expiresInMs?: number } = {},
  ): Promise<string> {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1000);

    return new SignJWT({
      openId: payload.openId,
      provider: payload.provider,
      name: payload.name,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuedAt(Math.floor(issuedAt / 1000))
      .setExpirationTime(expirationSeconds)
      .sign(this.getSessionSecret());
  }

  async verifySession(
    cookieValue: string | undefined | null,
  ): Promise<SessionPayload | null> {
    if (!cookieValue) return null;

    try {
      const { payload } = await jwtVerify(cookieValue, this.getSessionSecret(), {
        algorithms: ["HS256"],
      });
      const { openId, provider, name } = payload as Record<string, unknown>;

      if (
        !isNonEmptyString(openId) ||
        provider !== "google" ||
        !isNonEmptyString(name)
      ) {
        return null;
      }

      return { openId, provider: "google", name };
    } catch (error) {
      console.warn("[Auth] Sessão Google inválida", String(error));
      return null;
    }
  }

  async authenticateRequest(req: Request): Promise<AuthenticatedUser> {
    const cookies = parseCookieHeader(req.headers.cookie ?? "");
    let sessionToken = cookies[COOKIE_NAME];

    // Mantém suporte a Authorization: Bearer para clientes que não conseguem
    // persistir cookies, sem reintroduzir qualquer sessão da plataforma Manus.
    if (!sessionToken) {
      const authHeader = req.headers.authorization;
      if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
        sessionToken = authHeader.slice(7);
      }
    }

    const session = await this.verifySession(sessionToken);
    if (!session) {
      throw ForbiddenError("Sessão Google inválida");
    }

    const user = await db.getUserByOpenId(session.openId);
    if (!user) {
      throw ForbiddenError("Usuário não encontrado");
    }

    // A whitelist é revalidada em todas as requisições protegidas. Assim,
    // desativar um e-mail no Cadastro revoga o acesso sem esperar novo login.
    const normalizedEmail = user.email?.trim().toLowerCase();
    const allowedUser = normalizedEmail
      ? await db.getAllowedUserByEmail(normalizedEmail)
      : undefined;
    if (!allowedUser || allowedUser.isActive !== 1) {
      throw ForbiddenError("Usuário não autorizado");
    }

    await db.upsertUser({
      openId: user.openId,
      lastSignedIn: new Date(),
      role: allowedUser.role,
    });

    return {
      ...user,
      role: allowedUser.role,
    };
  }
}

export type AuthenticatedUser = User;

export const sdk = new SessionService();
