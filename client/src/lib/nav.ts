/**
 * Atualiza o caminho mostrado na barra de endereço sem recarregar a página.
 * Dentro do Google Apps Script a página roda em um iframe e o navegador pode
 * recusar a troca de URL; nesse caso simplesmente seguimos sem alterá-la.
 */
export function setBrowserPath(path: string): void {
  try {
    window.history.replaceState({}, "", path);
  } catch {
    /* iframe do Apps Script: sem URL própria, a navegação continua pelo estado da tela */
  }
}
