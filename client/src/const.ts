export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

/**
 * Inicia o Google OAuth da própria aplicação. O servidor monta a URL com o
 * client secret e grava o nonce em cookie; nenhum endpoint Manus é usado.
 */
export const startLogin = () => {
  window.location.assign("/api/auth/google/start");
};

/** true no build do Google Apps Script (index.html único), false no build normal. */
export const IS_GAS = (import.meta.env.VITE_TARGET as string | undefined) === "gas";
