import { desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { allowedUsers, users, type AllowedUser, type InsertAllowedUser, type InsertUser, type User } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "avatarUrl", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string): Promise<User | undefined> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const normalized = email.trim().toLowerCase();
  const result = await db
    .select()
    .from(users)
    .where(sql`LOWER(${users.email}) = ${normalized}`)
    .limit(1);
  return result[0];
}

/* ========================================================================= */
/* Funções de Usuários Autorizados (Whitelist para Google SSO)               */
/* ========================================================================= */

export async function getAllowedUserByEmail(email: string): Promise<AllowedUser | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const normalized = email.trim().toLowerCase();
  const result = await db
    .select()
    .from(allowedUsers)
    .where(sql`LOWER(${allowedUsers.email}) = ${normalized}`)
    .limit(1);

  return result[0];
}

export async function listAllowedUsers(): Promise<AllowedUser[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(allowedUsers).orderBy(desc(allowedUsers.createdAt));
}

export async function addAllowedUser(data: {
  email: string;
  name: string;
  role?: "admin" | "super_admin" | "user";
  allowedServices?: string[] | null;
  avatarUrl?: string | null;
  addedBy?: string | null;
}): Promise<AllowedUser> {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");

  const normalizedEmail = data.email.trim().toLowerCase();
  if (!normalizedEmail.endsWith("@vena.app.br")) {
    throw new Error("Cadastre somente e-mails do domínio @vena.app.br.");
  }
  const role = data.role ?? "user";
  const serializedServices = Array.isArray(data.allowedServices)
    ? JSON.stringify(Array.from(new Set(data.allowedServices.map((s) => s.trim()).filter(Boolean))))
    : data.allowedServices === null
      ? null
      : undefined;

  const existing = await getAllowedUserByEmail(normalizedEmail);
  if (existing) {
    await db
      .update(allowedUsers)
      .set({
        name: data.name.trim(),
        role,
        allowedServices: serializedServices !== undefined ? serializedServices : existing.allowedServices,
        avatarUrl: data.avatarUrl ?? existing.avatarUrl,
        addedBy: data.addedBy ?? existing.addedBy,
        updatedAt: new Date(),
      })
      .where(eq(allowedUsers.id, existing.id));

    const updated = await getAllowedUserByEmail(normalizedEmail);
    if (!updated) throw new Error("Falha ao atualizar usuário autorizado");
    return updated;
  }

  const values: InsertAllowedUser = {
    email: normalizedEmail,
    name: data.name.trim(),
    role,
    allowedServices: serializedServices ?? null,
    avatarUrl: data.avatarUrl ?? null,
    addedBy: data.addedBy ?? null,
  };

  await db.insert(allowedUsers).values(values);

  const inserted = await getAllowedUserByEmail(normalizedEmail);
  if (!inserted) throw new Error("Falha ao cadastrar usuário autorizado");
  return inserted;
}

export async function removeAllowedUser(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");

  // Proteção: não permitir remover o último admin
  const user = await db.select().from(allowedUsers).where(eq(allowedUsers.id, id)).limit(1);
  if (!user.length) return false;

  if (user[0].role === "admin") {
    const admins = await db.select().from(allowedUsers).where(eq(allowedUsers.role, "admin"));
    if (admins.length <= 1) {
      throw new Error("Não é possível remover o único administrador do sistema.");
    }
  }

  await db.delete(allowedUsers).where(eq(allowedUsers.id, id));
  return true;
}

export async function updateAllowedUserRole(id: number, role: "admin" | "super_admin" | "user"): Promise<AllowedUser> {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");

  if (role === "user") {
    const current = await db.select().from(allowedUsers).where(eq(allowedUsers.id, id)).limit(1);
    if (current.length && current[0].role === "admin") {
      const admins = await db.select().from(allowedUsers).where(eq(allowedUsers.role, "admin"));
      if (admins.length <= 1) {
        throw new Error("O sistema precisa manter pelo menos um administrador.");
      }
    }
  }

  await db.update(allowedUsers).set({ role, updatedAt: new Date() }).where(eq(allowedUsers.id, id));

  const updated = await db.select().from(allowedUsers).where(eq(allowedUsers.id, id)).limit(1);
  if (!updated.length) throw new Error("Usuário não encontrado");
  return updated[0];
}

export async function updateAllowedUserName(id: number, name: string): Promise<AllowedUser> {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");

  const normalizedName = name.trim();
  if (normalizedName.length < 2) {
    throw new Error("Nome deve ter pelo menos 2 caracteres");
  }

  await db
    .update(allowedUsers)
    .set({ name: normalizedName, updatedAt: new Date() })
    .where(eq(allowedUsers.id, id));

  const updated = await db.select().from(allowedUsers).where(eq(allowedUsers.id, id)).limit(1);
  if (!updated.length) throw new Error("Usuário não encontrado");
  return updated[0];
}

export async function updateAllowedUserServices(id: number, allowedServices: string[] | null): Promise<AllowedUser> {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");

  const serialized = Array.isArray(allowedServices)
    ? JSON.stringify(Array.from(new Set(allowedServices.map((s) => s.trim()).filter(Boolean))))
    : null;

  await db
    .update(allowedUsers)
    .set({ allowedServices: serialized, updatedAt: new Date() })
    .where(eq(allowedUsers.id, id));

  const updated = await db.select().from(allowedUsers).where(eq(allowedUsers.id, id)).limit(1);
  if (!updated.length) throw new Error("Usuário não encontrado");
  return updated[0];
}

export function parseAllowedServices(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((s) => String(s).trim()).filter(Boolean) : [];
  } catch {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
}

export async function toggleAllowedUserStatus(id: number, isActive: number): Promise<AllowedUser> {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível");

  if (isActive === 0) {
    const current = await db.select().from(allowedUsers).where(eq(allowedUsers.id, id)).limit(1);
    if (current.length && current[0].role === "admin") {
      const activeAdmins = await db
        .select()
        .from(allowedUsers)
        .where(sql`${allowedUsers.role} = 'admin' AND ${allowedUsers.isActive} = 1`);
      if (activeAdmins.length <= 1) {
        throw new Error("O sistema precisa manter pelo menos um administrador ativo.");
      }
    }
  }

  await db.update(allowedUsers).set({ isActive, updatedAt: new Date() }).where(eq(allowedUsers.id, id));

  const updated = await db.select().from(allowedUsers).where(eq(allowedUsers.id, id)).limit(1);
  if (!updated.length) throw new Error("Usuário não encontrado");
  return updated[0];
}
