const sessionSecret = process.env.SESSION_SECRET || process.env.JWT_SECRET || "";

export const ENV = {
  // SESSION_SECRET é o nome recomendado pela spec; JWT_SECRET permanece como
  // fallback para preservar sessões e instalações existentes.
  cookieSecret: sessionSecret,
  sessionSecret,
  databaseUrl: process.env.DATABASE_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  googleRedirectUri: process.env.GOOGLE_REDIRECT_URI ?? "",
  googleAuthUri: process.env.GOOGLE_AUTH_URI ?? "",
  googleTokenUri: process.env.GOOGLE_TOKEN_URI ?? "",
};
