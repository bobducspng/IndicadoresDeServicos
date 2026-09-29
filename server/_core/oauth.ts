import { createHash, randomBytes } from "node:crypto";
import { COOKIE_NAME, ONE_YEAR_MS, OAUTH_STATE_COOKIE } from "@shared/const";
import { parse as parseCookieHeader } from "cookie";
import type { Express, Request, Response } from "express";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import * as db from "../db";
import { ENV } from "./env";
import { sdk } from "./sdk";
import { getSessionCookieOptions } from "./cookies";

const GOOGLE_AUTHORIZATION_ENDPOINT = "https://accounts.google.com/o/oauth2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);
const GOOGLE_PKCE_COOKIE = "google_oauth_code_verifier";
const OAUTH_COOKIE_MAX_AGE = 10 * 60 * 1000;

export const GOOGLE_REDIRECT_URIS = [
  "https://santa-barbed-glorious.ngrok-free.dev/api/auth/google/callback",
  "http://localhost:3000/api/auth/google/callback",
] as const;

export function isAllowedGoogleRedirectUri(value: string): boolean {
  return (GOOGLE_REDIRECT_URIS as readonly string[]).includes(value);
}

export function createPkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

type GoogleIdentity = JWTPayload & {
  sub: string;
  email: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
};

function getForwardedValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]?.trim();
  return value?.split(",")[0]?.trim();
}

function getGoogleRedirectUri(req: Request): string {
  const configured = ENV.googleRedirectUri.trim();
  if (configured) {
    if (!isAllowedGoogleRedirectUri(configured)) {
      throw new Error("GOOGLE_REDIRECT_URI não está na allowlist da aplicação");
    }
    return configured;
  }

  const protocol =
    getForwardedValue(req.headers["x-forwarded-proto"]) || req.protocol || "http";
  const host = getForwardedValue(req.headers["x-forwarded-host"]) || req.get("host");
  if (!host) throw new Error("Não foi possível determinar o host do callback Google");

  const candidate = `${protocol}://${host}/api/auth/google/callback`;
  if (!isAllowedGoogleRedirectUri(candidate)) {
    throw new Error("O host atual não corresponde a um redirect URI Google autorizado");
  }
  return candidate;
}

function isSecureRequest(req: Request): boolean {
  if (req.protocol === "https") return true;
  const forwarded = getForwardedValue(req.headers["x-forwarded-proto"]);
  return forwarded === "https";
}

function getGoogleAuthorizationUri(): string {
  return ENV.googleAuthUri.trim() || GOOGLE_AUTHORIZATION_ENDPOINT;
}

function getGoogleTokenUri(): string {
  return ENV.googleTokenUri.trim() || GOOGLE_TOKEN_ENDPOINT;
}

function requireGoogleConfig(): void {
  if (!ENV.googleClientId || !ENV.googleClientSecret) {
    throw new Error(
      "GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET precisam estar configurados",
    );
  }
}

function getStringClaim(payload: JWTPayload, key: string): string | undefined {
  const value = payload[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

async function exchangeCodeForGoogleIdentity(
  code: string,
  redirectUri: string,
  codeVerifier: string,
): Promise<GoogleIdentity> {
  requireGoogleConfig();

  const tokenResponse = await fetch(getGoogleTokenUri(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: ENV.googleClientId,
      client_secret: ENV.googleClientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: codeVerifier,
    }),
  });

  const tokenPayload = (await tokenResponse.json()) as {
    id_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!tokenResponse.ok || !tokenPayload.id_token) {
    throw new Error(
      `Google token exchange failed: ${tokenPayload.error_description || tokenPayload.error || tokenResponse.status}`,
    );
  }

  const { payload } = await jwtVerify(tokenPayload.id_token, GOOGLE_JWKS, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: ENV.googleClientId,
  });

  const identity = payload as GoogleIdentity;
  const email = getStringClaim(identity, "email");
  const sub = getStringClaim(identity, "sub");
  if (!email || !sub || identity.email_verified !== true) {
    throw new Error("Google não retornou uma identidade verificada");
  }

  return {
    ...identity,
    sub,
    email,
    name: getStringClaim(identity, "name"),
    picture: getStringClaim(identity, "picture"),
  };
}

function oauthCookieOptions(req: Request) {
  return {
    httpOnly: true,
    path: "/",
    maxAge: OAUTH_COOKIE_MAX_AGE,
    sameSite: "lax" as const,
    secure: isSecureRequest(req),
  };
}

function clearOAuthCookies(req: Request, res: Response): void {
  const options = {
    httpOnly: true,
    path: "/",
    sameSite: "lax" as const,
    secure: isSecureRequest(req),
  };
  res.clearCookie(OAUTH_STATE_COOKIE, options);
  res.clearCookie(GOOGLE_PKCE_COOKIE, options);
}

async function getSessionUser(req: Request) {
  return sdk.authenticateRequest(req);
}

export function registerOAuthRoutes(app: Express) {
  const startGoogleLogin = (req: Request, res: Response) => {
    try {
      requireGoogleConfig();
      const state = randomBytes(32).toString("base64url");
      const pkce = createPkcePair();
      const redirectUri = getGoogleRedirectUri(req);

      res.cookie(OAUTH_STATE_COOKIE, state, oauthCookieOptions(req));
      res.cookie(GOOGLE_PKCE_COOKIE, pkce.verifier, oauthCookieOptions(req));

      const authorizationUrl = new URL(getGoogleAuthorizationUri());
      authorizationUrl.search = new URLSearchParams({
        client_id: ENV.googleClientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "openid email profile",
        state,
        code_challenge: pkce.challenge,
        code_challenge_method: "S256",
        prompt: "select_account",
      }).toString();

      res.redirect(302, authorizationUrl.toString());
    } catch (error) {
      console.error("[Google OAuth] Não foi possível iniciar o login", error);
      res.redirect(302, "/?authError=configuration");
    }
  };

  // Rota especificada no contrato. A rota /start é mantida para compatibilidade
  // com versões já publicadas do frontend.
  app.get("/api/auth/google", startGoogleLogin);
  app.get("/api/auth/google/start", startGoogleLogin);

  app.get("/api/auth/google/callback", async (req: Request, res: Response) => {
    const code = typeof req.query.code === "string" ? req.query.code : undefined;
    const state = typeof req.query.state === "string" ? req.query.state : undefined;
    const googleError = typeof req.query.error === "string" ? req.query.error : undefined;

    if (googleError) {
      clearOAuthCookies(req, res);
      console.warn(`[Google OAuth] Login cancelado: ${googleError}`);
      res.redirect(302, "/?authError=cancelled");
      return;
    }

    if (!code || !state) {
      clearOAuthCookies(req, res);
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    const cookies = parseCookieHeader(req.headers.cookie ?? "");
    const expectedState = cookies[OAUTH_STATE_COOKIE];
    const codeVerifier = cookies[GOOGLE_PKCE_COOKIE];
    clearOAuthCookies(req, res);

    if (!expectedState || state !== expectedState || !codeVerifier) {
      res.status(403).json({ error: "invalid google oauth state" });
      return;
    }

    try {
      const redirectUri = getGoogleRedirectUri(req);
      const identity = await exchangeCodeForGoogleIdentity(code, redirectUri, codeVerifier);
      const normalizedEmail = identity.email.trim().toLowerCase();
      const allowedUser = await db.getAllowedUserByEmail(normalizedEmail);

      if (!allowedUser || allowedUser.isActive !== 1) {
        console.warn(`[Google OAuth] Acesso negado para: ${normalizedEmail}`);
        res.redirect(302, "/?authError=unauthorized");
        return;
      }

      const openId = `google:${identity.sub}`;
      const name = identity.name || allowedUser.name;
      const avatarUrl = identity.picture || allowedUser.avatarUrl || null;

      await db.upsertUser({
        openId,
        name,
        email: normalizedEmail,
        avatarUrl,
        loginMethod: "google",
        role: allowedUser.role,
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(openId, {
        name,
        expiresInMs: ONE_YEAR_MS,
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, {
        ...cookieOptions,
        sameSite: "lax",
        maxAge: ONE_YEAR_MS,
      });

      res.redirect(302, "/");
    } catch (error) {
      console.error("[Google OAuth] Callback failed", error);
      res.redirect(302, "/?authError=oauth_failed");
    }
  });

  // Endpoints REST de compatibilidade e verificação definidos na especificação.
  app.get("/api/auth/me", async (req: Request, res: Response) => {
    try {
      const user = await getSessionUser(req);
      const sub = user.openId.startsWith("google:")
        ? user.openId.slice("google:".length)
        : user.openId;
      res.json({
        id: user.id,
        sub,
        openId: user.openId,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        role: user.role,
        lastSignedIn: user.lastSignedIn,
      });
    } catch {
      res.status(401).json({ user: null });
    }
  });

  const logout = (req: Request, res: Response) => {
    const cookieOptions = getSessionCookieOptions(req);
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
  };

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    logout(req, res);
    res.json({ success: true });
  });

  app.get("/api/auth/logout", (req: Request, res: Response) => {
    logout(req, res);
    res.redirect(302, "/");
  });
}
