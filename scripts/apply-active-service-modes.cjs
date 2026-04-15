/**
 * Applies supabase/migrations/20260324120000_add_active_service_modes.sql to your hosted DB.
 *
 * Usage (from project root):
 *   DATABASE_URL="postgresql://postgres.[ref]:YOUR_PASSWORD@db.[ref].supabase.co:5432/postgres" \
 *     npm run db:apply-active-service-modes
 *
 * Get the URI in Supabase Dashboard → Project Settings → Database → Connection string → URI (direct, port 5432).
 * Do not commit DATABASE_URL or passwords.
 */
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

function readDatabaseUrlFromDotEnv() {
  try {
    const dotEnvPath = path.join(__dirname, "..", ".env");
    const raw = fs.readFileSync(dotEnvPath, "utf8");
    const line = raw
      .split("\n")
      .find((l) => l.startsWith("DATABASE_URL=") && !l.trimStart().startsWith("#"));
    if (!line) return null;
    let v = line.slice("DATABASE_URL=".length).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    return v || null;
  } catch {
    return null;
  }
}

const url = process.env.DATABASE_URL || readDatabaseUrlFromDotEnv();
if (!url || !url.startsWith("postgres")) {
  console.error(
    "Missing DATABASE_URL. Example:\n" +
      '  export DATABASE_URL="postgresql://postgres.[ref]:PASSWORD@db.[ref].supabase.co:5432/postgres"\n' +
      "  npm run db:apply-active-service-modes\n\n" +
      "Or add DATABASE_URL=postgresql://... to .env (do not commit).\n" +
      "Supabase: Dashboard → Project Settings → Database → Connection string → URI (Direct).\n" +
      "Local Docker: npx supabase start && npx supabase db reset --yes"
  );
  process.exit(1);
}

const sqlPath = path.join(
  __dirname,
  "..",
  "supabase",
  "migrations",
  "20260324120000_add_active_service_modes.sql"
);
const sql = fs.readFileSync(sqlPath, "utf8");

async function main() {
  const client = new Client({
    connectionString: url,
    ssl: url.includes("supabase") ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();
  try {
    await client.query(sql);
    console.log("OK: migration applied (column added or already exists).");
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error("Migration failed:", e.message);
  process.exit(1);
});
