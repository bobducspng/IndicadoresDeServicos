import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to ensure role enums");
}

const connection = await mysql.createConnection(databaseUrl);
try {
  const roleEnum = "enum('user','admin','super_admin')";
  for (const table of ["allowed_users", "users"]) {
    await connection.query(
      `ALTER TABLE \`${table}\` MODIFY COLUMN \`role\` ${roleEnum} NOT NULL DEFAULT 'user'`,
    );
  }
  console.log("Role enums garantidos: user, admin, super_admin");
} finally {
  await connection.end();
}
