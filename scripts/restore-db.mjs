// Restores a backup created by scripts/backup-db.mjs.
// Run with: node scripts/restore-db.mjs [backups/<timestamp>]
// Defaults to the most recent folder under backups/ if no path is given.
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import path from "path";
import ws from "ws";

config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  realtime: { transport: ws },
});

// Order matters: parents before children (foreign keys).
const TABLES = [
  "profiles",
  "courses",
  "lessons",
  "questions",
  "exams",
  "exam_questions",
  "subscription_plans",
  "user_subscriptions",
  "site_settings",
];

const STORAGE_BUCKETS = ["question-media"];

function resolveBackupDir() {
  const arg = process.argv[2];
  if (arg) return arg;
  const base = "backups";
  if (!existsSync(base)) {
    console.error("No backups/ folder found and no path given.");
    process.exit(1);
  }
  const folders = readdirSync(base).filter((f) =>
    statSync(path.join(base, f)).isDirectory(),
  );
  if (folders.length === 0) {
    console.error("No backup folders found under backups/.");
    process.exit(1);
  }
  folders.sort();
  return path.join(base, folders[folders.length - 1]);
}

async function restoreTables(backupDir) {
  for (const table of TABLES) {
    const file = path.join(backupDir, `${table}.json`);
    if (!existsSync(file)) {
      console.log(`[SKIP] ${table}: no backup file`);
      continue;
    }
    const rows = JSON.parse(readFileSync(file, "utf-8"));
    if (rows.length === 0) {
      console.log(`[OK] ${table}: 0 rows`);
      continue;
    }
    const { error } = await supabase
      .from(table)
      .upsert(rows, { onConflict: "id" });
    if (error) {
      console.error(`[FAIL] ${table}: ${error.message}`);
      continue;
    }
    console.log(`[OK] ${table}: ${rows.length} rows restored`);
  }
}

async function restoreStorage(backupDir) {
  for (const bucket of STORAGE_BUCKETS) {
    const bucketDir = path.join(backupDir, "storage", bucket);
    if (!existsSync(bucketDir)) {
      console.log(`[SKIP] storage/${bucket}: no backup folder`);
      continue;
    }
    await uploadFolder(bucket, bucketDir, "");
  }
}

async function uploadFolder(bucket, localDir, remoteFolder) {
  const entries = readdirSync(localDir);
  for (const entry of entries) {
    const localPath = path.join(localDir, entry);
    const remotePath = remoteFolder ? `${remoteFolder}/${entry}` : entry;
    if (statSync(localPath).isDirectory()) {
      await uploadFolder(bucket, localPath, remotePath);
      continue;
    }
    const fileBuffer = readFileSync(localPath);
    const { error } = await supabase.storage
      .from(bucket)
      .upload(remotePath, fileBuffer, { upsert: true });
    if (error) {
      console.error(`[FAIL FILE] ${remotePath}: ${error.message}`);
      continue;
    }
    console.log(`[FILE] ${remotePath}`);
  }
}

async function main() {
  const backupDir = resolveBackupDir();
  console.log(`Restoring from ${backupDir} ...`);
  await restoreTables(backupDir);
  await restoreStorage(backupDir);
  console.log("Done.");
}

main();
