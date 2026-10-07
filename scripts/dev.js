import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { access, readFile, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const backend = resolve(root, 'backend');
const frontend = resolve(root, 'frontend');
const rootEnv = resolve(root, '.env');
const backendEnv = resolve(backend, '.env');
const rootExample = resolve(root, '.env.example');
const node = process.execPath;
const children = new Set();
let shuttingDown = false;
function parseEnv(text) {
  return Object.fromEntries(text.split(/\r\n?|\n/)
    .map((line) => line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/))
    .filter(Boolean)
    .map(([, key, raw]) => {
      const value = raw.trim();
      return [key, value.replace(/^(['"])(.*)\1$/, '$2')];
    }));
}

function strongPassword() {
  return `Aa1!${randomBytes(24).toString('base64url')}`;
}

function serializeEnv(value) {
  return `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function saveSetting(path, key, value) {
  const contents = await readFile(path, 'utf8');
  const newline = contents.match(/\r\n|\r|\n/)?.[0] || '\n';
  const lines = contents.split(/\r\n?|\n/);
  const hasFinalNewline = /(?:\r\n|\r|\n)$/.test(contents);
  if (hasFinalNewline) lines.pop();
  const settingIndex = lines.findIndex((line) => {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    return match?.[1] === key;
  });
  const line = `${key}=${serializeEnv(value)}`;
  if (settingIndex === -1) lines.push(line);
  else lines[settingIndex] = line;
  const updated = lines.join(newline)
    + (hasFinalNewline || settingIndex === -1 ? newline : '');
  await writeFile(path, updated, { mode: 0o600 });
}

async function prepareEnvironment() {
  if (!(await exists(rootEnv)) && !(await exists(backendEnv))) {
    const sample = await readFile(rootExample, 'utf8');
    await writeFile(rootEnv, sample, { mode: 0o600 });
    console.log('Created local .env. This file is ignored by Git.');
  }

  const envPath = await exists(backendEnv) ? backendEnv : rootEnv;
  let values = parseEnv(await readFile(envPath, 'utf8'));
  const config = createInterface({ input: stdin, output: stdout });

  try {
    const databaseUrl = process.env.DATABASE_URL || values.DATABASE_URL || '';
    if (!databaseUrl || databaseUrl.includes('USERNAME:PASSWORD') || databaseUrl.startsWith('DATABASE_URL=')) {
      const value = await config.question(
        'Enter your local PostgreSQL connection URL (stored only in .env): '
      );
      if (!value.trim()) {
        throw new Error('A PostgreSQL connection URL is required before the app can start.');
      }
      await saveSetting(envPath, 'DATABASE_URL', value.trim());
      values.DATABASE_URL = value.trim();
    }
  } finally {
    config.close();
  }

  if (!values.JWT_SECRET || values.JWT_SECRET.startsWith('replace-with-')) {
    const value = randomBytes(48).toString('hex');
    await saveSetting(envPath, 'JWT_SECRET', value);
    values.JWT_SECRET = value;
  }
  if (!values.SEED_USERS_PASSWORD || values.SEED_USERS_PASSWORD.startsWith('replace-with-')) {
    const value = strongPassword();
    await saveSetting(envPath, 'SEED_USERS_PASSWORD', value);
    values.SEED_USERS_PASSWORD = value;
  }
  for (const [key, value] of Object.entries(values)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
  process.env.NODE_ENV ||= 'development';
  if (process.env.NODE_ENV === 'production') {
    throw new Error('The root development launcher cannot run with NODE_ENV=production.');
  }
  const connectionString = process.env.DATABASE_URL || values.DATABASE_URL;
  let database;
  try {
    database = new URL(connectionString);
  } catch {
    throw new Error('DATABASE_URL is not a valid PostgreSQL connection URL.');
  }
  if (!['postgres:', 'postgresql:'].includes(database.protocol)) {
    throw new Error('DATABASE_URL must use the postgres:// or postgresql:// scheme.');
  }
  if (!['localhost', '127.0.0.1', '[::1]'].includes(database.hostname)) {
    throw new Error('The automatic development launcher only runs against a local PostgreSQL server.');
  }
}

function run(command, args, cwd) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, { cwd, env: process.env, stdio: 'inherit' });
    child.once('error', rejectRun);
    child.once('exit', (code, signal) => {
      if (code === 0) resolveRun();
      else rejectRun(new Error(`${command} exited with ${signal || `code ${code}`}.`));
    });
  });
}

async function stopChildren() {
  shuttingDown = true;
  const running = [...children];
  children.clear();
  for (const child of running) child.kill('SIGTERM');
}

async function startServers() {
  const backendWatch = spawn(node, ['--watch', 'src/server.js'], {
    cwd: backend, env: process.env, stdio: 'inherit'
  });
  const frontendVite = spawn(node, ['node_modules/vite/bin/vite.js'], {
    cwd: frontend, env: process.env, stdio: 'inherit'
  });
  children.add(backendWatch);
  children.add(frontendVite);

  for (const child of children) {
    child.once('exit', (code) => {
      if (shuttingDown || !children.has(child)) return;
      console.error(`A development server stopped${code === 0 ? '' : ` (exit ${code})`}.`);
      void stopChildren();
      process.exitCode = code || 1;
    });
  }
  console.log('API and frontend are starting. Press Ctrl+C to stop both.');
}

try {
  await prepareEnvironment();
  console.log('Applying database migrations...');
  await run(node, ['src/database/migrate.js'], backend);
  console.log('Preparing development roles and administrator account...');
  await run(node, ['src/database/seed.js'], backend);
  await startServers();
} catch (error) {
  console.error(`Development startup failed: ${error.message}`);
  process.exitCode = 1;
  await stopChildren();
}

process.once('SIGINT', () => { void stopChildren(); });
process.once('SIGTERM', () => { void stopChildren(); });
