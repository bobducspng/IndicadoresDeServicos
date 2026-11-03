import type { Express } from "express";
import * as db from "./db";
import { sdk } from "./_core/sdk";
import { FOTO_ROTA } from "./colaboradoresFotos";

/**
 * Entrega a foto enviada por um administrador. Exige sessão válida (mesma regra
 * do restante do painel); o cache é longo porque a URL carrega a versão (?v=).
 */
export function registerColaboradoresFotoRoute(app: Express) {
  app.get(FOTO_ROTA, async (req, res) => {
    try {
      await sdk.authenticateRequest(req);
    } catch {
      res.status(401).end();
      return;
    }

    const email = typeof req.query.email === "string" ? req.query.email : "";
    if (!email || email.length > 320) {
      res.status(400).end();
      return;
    }

    try {
      const foto = await db.getCollaboratorPhoto(email);
      if (!foto) {
        res.status(404).end();
        return;
      }
      res.setHeader("Content-Type", foto.mime);
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Cache-Control", "private, max-age=31536000, immutable");
      res.send(Buffer.from(foto.data, "base64"));
    } catch (error) {
      console.warn("[Colaboradores] Falha ao entregar foto", String(error));
      res.status(500).end();
    }
  });
}
