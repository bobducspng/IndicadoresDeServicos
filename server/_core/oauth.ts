import { COOKIE_NAME, ONE_YEAR_MS, OAUTH_STATE_COOKIE } from "@shared/const";
import { parse as parseCookieHeader } from "cookie";
import type { Express, Request, Response } from "express";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import * as db from "../db";
import { ENV } from "./env";
import { sdk } from "./sdk";
import { getSessionCookieOptions } from "./cookies";

const GOOGLE_AUTHORIZATION_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);

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
  if (ENV.googleRedirectUri) return ENV.googleRedirectUri;

  const protocol =
    getForwardedValue(req.headers["x-forwarded-proto"]) || req.protocol || "http";
  const host = getForwardedValue(req.headers["x-forwarded-host"]) || req.get("host");
  if (!host) throw new Error("Não foi possível determinar o host do callback Google");

  return `${protocol}://${host}/api/auth/google/callback`;
}

function isSecureRequest(req: Request): boolean {
  if (req.protocol === "https") return true;
  const forwarded = getForwardedValue(req.headers["x-forwarded-proto"]);
  return forwarded === "https";
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
): Promise<GoogleIdentity> {
  requireGoogleConfig();

  const tokenResponse = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: ENV.googleClientId,
      client_secret: ENV.googleClientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
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

export function registerOAuthRoutes(app: Express) {
  app.get("/api/auth/google/start", (req: Request, res: Response) => {
    try {
      requireGoogleConfig();
      const state = crypto.randomUUID();
      const redirectUri = getGoogleRedirectUri(req);
      const secure = isSecureRequest(req);

      res.cookie(OAUTH_STATE_COOKIE, state, {
        httpOnly: true,
        path: "/",
        maxAge: 10 * 60 * 1000,
        sameSite: "lax",
        secure,
      });

      const authorizationUrl = new URL(GOOGLE_AUTHORIZATION_ENDPOINT);
      authorizationUrl.search = new URLSearchParams({
        client_id: ENV.googleClientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "openid email profile",
        state,
        prompt: "select_account",
      }).toString();

      res.redirect(302, authorizationUrl.toString());
    } catch (error) {
      console.error("[Google OAuth] Não foi possível iniciar o login", error);
      res.redirect(302, "/?authError=configuration");
    }
  });

  app.get("/api/auth/google/callback", async (req: Request, res: Response) => {
    const code = typeof req.query.code === "string" ? req.query.code : undefined;
    const state = typeof req.query.state === "string" ? req.query.state : undefined;
    const googleError = typeof req.query.error === "string" ? req.query.error : undefined;

    if (googleError) {
      console.warn(`[Google OAuth] Login cancelado: ${googleError}`);
      res.redirect(302, "/?authError=cancelled");
      return;
    }

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    const cookies = parseCookieHeader(req.headers.cookie ?? "");
    const expectedState = cookies[OAUTH_STATE_COOKIE];
    res.clearCookie(OAUTH_STATE_COOKIE, {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: isSecureRequest(req),
    });

    if (!expectedState || state !== expectedState) {
      res.status(403).json({ error: "invalid google oauth state" });
      return;
    }

    try {
      const redirectUri = getGoogleRedirectUri(req);
      const identity = await exchangeCodeForGoogleIdentity(code, redirectUri);
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
}
