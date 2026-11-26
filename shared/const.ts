export const COOKIE_NAME = "app_session_id";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = "Please login (10001)";
export const NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";

// Cookie de curta duração que vincula o início do login Google ao callback.
// Sem Domain e com Path=/, ele permanece restrito ao host da aplicação.
export const OAUTH_STATE_COOKIE = "google_oauth_state";

export type OAuthState = { redirectUri: string; nonce?: string };

export const encodeOAuthState = (state: OAuthState): string =>
  btoa(JSON.stringify(state));

export const decodeOAuthState = (state: string): OAuthState => {
  try {
    const decoded = atob(state);
    const parsed = JSON.parse(decoded);
    if (parsed && typeof parsed.redirectUri === "string") return parsed;
    return { redirectUri: decoded };
  } catch {
    return { redirectUri: "" };
  }
};
