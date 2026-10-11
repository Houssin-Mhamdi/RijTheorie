// One-off backup script: dumps DB tables to JSON and downloads all storage files locally.
// Run with: node scripts/backup-db.mjs
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { mkdirSync, writeFileSync } from "fs";
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

const TABLES = [
  "questions",
  "exams",
  "exam_questions",
  "courses",
  "lessons",
  "profiles",
  "subscription_plans",
  "user_subscriptions",
  "site_settings",
];

const STORAGE_BUCKETS = ["question-media"];

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupDir = path.join("backups", timestamp);
mkdirSync(backupDir, { recursive: true });

async function backupTables() {
  for (const table of TABLES) {
    const { data, error } = await supabase.from(table).select("*");
    if (error) {
      console.error(`[SKIP] ${table}: ${error.message}`);
      continue;
    }
    writeFileSync(
      path.join(backupDir, `${table}.json`),
      JSON.stringify(data, null, 2),
    );
    console.log(`[OK] ${table}: ${data.length} rows`);
  }
}

async function backupStorage() {
  for (const bucket of STORAGE_BUCKETS) {
    const bucketDir = path.join(backupDir, "storage", bucket);
    mkdirSync(bucketDir, { recursive: true });
    await downloadFolder(bucket, "", bucketDir);
  }
}

async function downloadFolder(bucket, folder, localDir) {
  const { data: entries, error } = await supabase.storage
    .from(bucket)
    .list(folder, { limit: 1000 });
  if (error) {
    console.error(`[SKIP] ${bucket}/${folder}: ${error.message}`);
    return;
  }
  for (const entry of entries) {
    const remotePath = folder ? `${folder}/${entry.name}` : entry.name;
    // Folders have no id/metadata in Supabase Storage listings.
    if (entry.id === null) {
      const subDir = path.join(localDir, entry.name);
      mkdirSync(subDir, { recursive: true });
      await downloadFolder(bucket, remotePath, subDir);
      continue;
    }
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(bucket)
      .download(remotePath);
    if (downloadError) {
      console.error(`[SKIP FILE] ${remotePath}: ${downloadError.message}`);
      continue;
    }
    const buffer = Buffer.from(await fileData.arrayBuffer());
    writeFileSync(path.join(localDir, entry.name), buffer);
    console.log(`[FILE] ${remotePath}`);
  }
}

async function main() {
  console.log(`Backing up to ${backupDir} ...`);
  await backupTables();
  await backupStorage();
  console.log("Done.");
}

main();
