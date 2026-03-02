#!/usr/bin/env node
/**
 * wegoviral.ai — Project Initializer
 * Run: npm run init
 *
 * 1. npm install (all workspaces)
 * 2. Copy .env files
 * 3. Generate Prisma client
 * 4. Print next steps
 */

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

function run(cmd, cwd = ROOT) {
  console.log(`\n  → ${cmd}`);
  const result = spawnSync(cmd, { shell: true, stdio: "inherit", cwd });
  if (result.status !== 0) {
    console.error(`\n  ✗ Failed: ${cmd}`);
    console.error("  Fix the error above then re-run: npm run init\n");
    process.exit(result.status ?? 1);
  }
}

function copyEnv(src, dest) {
  if (fs.existsSync(dest)) {
    console.log(`  ✓ ${path.relative(ROOT, dest)} already exists — skipped`);
    return false;
  }
  if (!fs.existsSync(src)) {
    console.warn(`  ⚠  ${path.relative(ROOT, src)} not found — skipped`);
    return false;
  }
  fs.copyFileSync(src, dest);
  console.log(`  ✓ Created ${path.relative(ROOT, dest)}`);
  return true;
}

function section(title) {
  console.log(`\n${"─".repeat(60)}\n  ${title}\n${"─".repeat(60)}`);
}

// ─── Run ──────────────────────────────────────────────────────────────────────

console.log("\n🔥  wegoviral.ai — Project Initializer\n");

section("1/4  Installing dependencies");
run("npm install");

section("2/4  Setting up environment files");
const apiCreated = copyEnv(
  path.join(ROOT, "apps/api/.env.example"),
  path.join(ROOT, "apps/api/.env")
);
copyEnv(
  path.join(ROOT, "apps/web/.env.local.example"),
  path.join(ROOT, "apps/web/.env.local")
);

section("3/4  Generating Prisma client");
run("npx prisma generate", path.join(ROOT, "apps/api"));

section("4/4  Done!");

console.log(`
  Next steps:
${apiCreated ? "  • Edit apps/api/.env — add DATABASE_URL, ANTHROPIC_API_KEY, REDIS_URL\n" : ""}
  • Make sure PostgreSQL is running:
      createdb wegoviral

  • Make sure Redis is running:
      redis-server --daemonize yes

  • Run the DB migration:
      npm run db:migrate

  • Start the dev servers:
      npm run dev

  Web → http://localhost:3000
  API → http://localhost:3001
`);
