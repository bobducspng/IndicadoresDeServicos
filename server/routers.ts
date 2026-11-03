import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import * as db from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { prepararPayloadParaUsuario } from "@shared/colaboradores";
import { carregarColaboradores } from "./colaboradores";
import { escolherFoto, validarFotoDataUrl } from "./colaboradoresFotos";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(async ({ ctx }) => {
      if (!ctx.user) return null;

      const email = ctx.user.email?.toLowerCase();
      const allowed = email ? await db.getAllowedUserByEmail(email) : undefined;
      const parsedAllowedServices = allowed?.allowedServices == null
        ? null
        : db.parseAllowedServices(allowed.allowedServices);

      return {
        id: ctx.user.id,
        openId: ctx.user.openId,
        name: ctx.user.name,
        email: ctx.user.email,
        avatarUrl: ctx.user.avatarUrl || allowed?.avatarUrl || null,
        role: allowed?.role ?? ctx.user.role,
        allowedServices: parsedAllowedServices,
        isAllowed: Boolean(allowed && allowed.isActive === 1),
        lastSignedIn: ctx.user.lastSignedIn,
      };
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  colaboradores: router({
    /**
     * Colaboradores e carteira (vínculos colaborador x cliente), já filtrados
     * pelas permissões de quem pediu: serviços permitidos e telefone só para admin.
     */
    carteira: protectedProcedure.query(async ({ ctx }) => {
      const email = ctx.user.email?.toLowerCase();
      const allowed = email ? await db.getAllowedUserByEmail(email) : undefined;
      if (!allowed || allowed.isActive !== 1) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Acesso não autorizado." });
      }

      const restrito = allowed.role === "user" && allowed.allowedServices != null;
      const payload = await carregarColaboradores();
      const visivel = prepararPayloadParaUsuario(payload, {
        role: allowed.role,
        allowedServices: restrito ? db.parseAllowedServices(allowed.allowedServices) : null,
      });

      // Foto: enviada por admin > foto do Google (login) > foto do payload > iniciais.
      // Se a leitura das fotos falhar, a tela segue com as iniciais.
      let enviadas = new Map<string, Date>();
      let google = new Map<string, string>();
      try {
        [enviadas, google] = await Promise.all([db.listCollaboratorPhotoVersions(), db.listGoogleAvatarsByEmail()]);
      } catch (error) {
        console.warn("[Colaboradores] Não foi possível ler as fotos", String(error));
      }
      return {
        ...visivel,
        colaboradores: visivel.colaboradores.map((colaborador) => {
          const chave = colaborador.email.toLowerCase();
          const enviada = enviadas.get(chave);
          return {
            ...colaborador,
            ...escolherFoto(colaborador.email, {
              enviada: enviada ? { atualizadoEm: enviada } : null,
              google: google.get(chave),
              payload: colaborador.fotoUrl,
            }),
          };
        }),
      };
    }),
    /** Envia ou substitui a foto de um colaborador (somente administradores). */
    salvarFoto: adminProcedure
      .input(z.object({ email: z.string().email().max(320), imagem: z.string().max(500_000) }))
      .mutation(async ({ ctx, input }) => {
        const email = input.email.trim().toLowerCase();
        const payload = await carregarColaboradores();
        if (!payload.colaboradores.some((c) => c.email.toLowerCase() === email)) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Colaborador não encontrado." });
        }
        let foto;
        try {
          foto = validarFotoDataUrl(input.imagem);
        } catch (error) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Imagem inválida." });
        }
        await db.saveCollaboratorPhoto({
          email,
          mime: foto.mime,
          data: foto.base64,
          updatedBy: ctx.user.email ?? ctx.user.name ?? "admin",
        });
        return { ok: true as const };
      }),
    /** Remove a foto enviada; o colaborador volta à foto do Google ou às iniciais. */
    removerFoto: adminProcedure
      .input(z.object({ email: z.string().email().max(320) }))
      .mutation(async ({ input }) => {
        await db.deleteCollaboratorPhoto(input.email);
        return { ok: true as const };
      }),
  }),
  accessControl: router({
    list: adminProcedure.query(async () => {
      const users = await db.listAllowedUsers();
      return users.map((u) => ({
        ...u,
        allowedServicesList: db.parseAllowedServices(u.allowedServices),
      }));
    }),
    add: adminProcedure
      .input(
        z.object({
          email: z.string().email().refine((value) => value.trim().toLowerCase().endsWith("@vena.app.br"), {
            message: "Cadastre somente e-mails do domínio @vena.app.br.",
          }),
          name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
          role: z.enum(["user", "admin", "super_admin"]).default("user"),
          allowedServices: z.array(z.string()).optional(),
          avatarUrl: z.string().url().optional().or(z.string().nullable()),
        })
      )
      .mutation(async ({ ctx, input }) =>
        db.addAllowedUser({
          email: input.email,
          name: input.name,
          role: input.role,
          allowedServices: input.allowedServices,
          avatarUrl: input.avatarUrl ?? null,
          addedBy: ctx.user.email || ctx.user.name || "admin",
        })
      ),
    updateRole: adminProcedure
      .input(z.object({ id: z.number().int(), role: z.enum(["user", "admin", "super_admin"]) }))
      .mutation(async ({ input }) => db.updateAllowedUserRole(input.id, input.role)),
    updateName: adminProcedure
      .input(z.object({ id: z.number().int(), name: z.string().trim().min(2, "Nome deve ter pelo menos 2 caracteres").max(255) }))
      .mutation(async ({ input }) => db.updateAllowedUserName(input.id, input.name)),
    updateServices: adminProcedure
      .input(
        z.object({
          id: z.number().int(),
          allowedServices: z.array(z.string()),
        })
      )
      .mutation(async ({ input }) => db.updateAllowedUserServices(input.id, input.allowedServices)),
    toggleStatus: adminProcedure
      .input(z.object({ id: z.number().int(), isActive: z.number().int().min(0).max(1) }))
      .mutation(async ({ input }) => db.toggleAllowedUserStatus(input.id, input.isActive)),
    remove: adminProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ input }) => db.removeAllowedUser(input.id)),
  }),
});

export type AppRouter = typeof appRouter;
