import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import pg from "pg";

const { Client } = pg;
const root = process.cwd();
const migrationsDir = path.join(root, "supabase", "migrations");
const envLocalPath = path.join(root, ".env.local");

if (fs.existsSync(envLocalPath)) {
  const envLines = fs.readFileSync(envLocalPath, "utf8").split("\n");

  for (const line of envLines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    const key = trimmed.slice(0, separatorIndex);
    const value = trimmed.slice(separatorIndex + 1);
    process.env[key] ??= value;
  }
}

const databaseUrl = process.env.SUPABASE_DATABASE_URL;

if (!databaseUrl) {
  console.error("SUPABASE_DATABASE_URL is required.");
  process.exit(1);
}

const client = new Client({
  connectionString: databaseUrl,
  ssl: {
    rejectUnauthorized: false,
  },
});

const files = fs
  .readdirSync(migrationsDir)
  .filter((file) => file.endsWith(".sql"))
  .sort();

await client.connect();

try {
  await client.query(`
    create table if not exists public.schema_migrations (
      version text primary key,
      applied_at timestamptz not null default now()
    )
  `);

  for (const file of files) {
    const { rowCount } = await client.query("select 1 from public.schema_migrations where version = $1", [file]);

    if (rowCount) {
      console.log(`Skipping ${file}`);
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    console.log(`Applying ${file}`);
    await client.query("begin");
    await client.query(sql);
    await client.query("insert into public.schema_migrations (version) values ($1)", [file]);
    await client.query("commit");
  }
} catch (error) {
  await client.query("rollback").catch(() => {});
  throw error;
} finally {
  await client.end();
}
