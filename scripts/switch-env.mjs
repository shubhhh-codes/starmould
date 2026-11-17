// Manage and inspect local environment selection (.env.local)
// Usage:
//   npm run env:status
//   npm run env:staging
//   npm run env:prod

import fs from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envLocalPath = path.join(root, '.env.local');
const envProdPath = path.join(root, '.env.production.local');
const envStagingPath = path.join(root, '.env.staging.local');

const EXPECTED_PROJECTS = {
  tvfqhdhxwnpkhhrvxvfi: 'PRODUCTION',
  vyhtiwqvblwnbaiqhewh: 'STAGING',
};

function readEnv(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return parseEnv(fs.readFileSync(filePath, 'utf8'));
}

function detectEnvironment(env) {
  if (!env) return { name: 'NONE', ref: 'none', label: 'Missing .env.local' };
  
  const url = env.NEXT_PUBLIC_SUPABASE_URL || '';
  const dbUrl = env.DATABASE_URL || '';
  
  for (const [ref, name] of Object.entries(EXPECTED_PROJECTS)) {
    if (url.includes(ref) || dbUrl.includes(ref)) {
      return { name, ref, label: name };
    }
  }
  return { name: 'CUSTOM', ref: 'unknown', label: 'Custom / Unrecognized' };
}

function printStatus() {
  const env = readEnv(envLocalPath);
  if (!env) {
    console.log('No .env.local file found.');
    console.log('Run "npm run env:prod" or "npm run env:staging" to initialize.');
    return;
  }

  const { name, ref } = detectEnvironment(env);
  const color = name === 'PRODUCTION' ? '\x1b[31m' : name === 'STAGING' ? '\x1b[32m' : '\x1b[33m';
  const reset = '\x1b[0m';
  const bold = '\x1b[1m';

  console.log('====================================================');
  console.log(` Active Dev Environment: ${bold}${color}${name}${reset}`);
  console.log('====================================================');
  console.log(` Supabase Project Ref : ${ref}`);
  console.log(` Supabase URL         : ${env.NEXT_PUBLIC_SUPABASE_URL || '(not set)'}`);
  
  if (env.DATABASE_URL) {
    try {
      const parsed = new URL(env.DATABASE_URL);
      console.log(` Database Host        : ${parsed.hostname}`);
    } catch {
      console.log(` Database Host        : (configured)`);
    }
  } else {
    console.log(` Database Host        : (not set)`);
  }

  console.log(` R2 Bucket            : ${env.R2_BUCKET_NAME || '(not set)'}`);
  console.log('----------------------------------------------------');
  console.log(' Switch commands:');
  console.log('   npm run env:staging  -> Switch active environment to Staging');
  console.log('   npm run env:prod     -> Switch active environment to Production');
  console.log('   npm run env:status   -> Show this status screen');
  console.log('====================================================');
}

function switchTo(target) {
  const isProd = target === 'prod' || target === 'production';
  const isStaging = target === 'staging';

  if (!isProd && !isStaging) {
    console.error(`Unknown target "${target}". Expected "prod" or "staging".`);
    process.exit(1);
  }

  const targetFile = isProd ? envProdPath : envStagingPath;
  const targetLabel = isProd ? 'PRODUCTION' : 'STAGING';

  if (!fs.existsSync(targetFile)) {
    console.error(`Source template ${path.basename(targetFile)} does not exist.`);
    process.exit(1);
  }

  // Ensure current production keys are never lost: auto-sync .env.production.local if currently in prod
  const currentEnv = readEnv(envLocalPath);
  if (currentEnv && detectEnvironment(currentEnv).name === 'PRODUCTION' && !isProd) {
    fs.copyFileSync(envLocalPath, envProdPath);
  }

  // Copy target file to .env.local
  fs.copyFileSync(targetFile, envLocalPath);

  const color = isProd ? '\x1b[31m' : '\x1b[32m';
  const reset = '\x1b[0m';
  const bold = '\x1b[1m';

  console.log(`Successfully switched .env.local to ${bold}${color}${targetLabel}${reset}.`);
  console.log('Please restart your dev server (npm run dev) for changes to take effect.');
}

const command = process.argv[2] || 'status';

if (command === 'status' || command === '--status') {
  printStatus();
} else if (['prod', 'production', 'staging'].includes(command)) {
  switchTo(command);
} else {
  console.error(`Invalid argument: ${command}`);
  console.log('Usage:');
  console.log('  node scripts/switch-env.mjs [status|staging|prod]');
  process.exit(1);
}

