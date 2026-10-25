// Runs a command with a freshly minted, 1-hour Appwrite API key in its environment,
// so no long-lived secret ever sits on disk. Requires `appwrite login`.
//   node scripts/with-key.mjs <command> [...args]
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const cfg = JSON.parse(fs.readFileSync(path.join(root, 'appwrite.config.json'), 'utf8'));
const SCOPES = ['tables.read', 'rows.read', 'rows.write', 'buckets.read', 'files.read', 'files.write', 'functions.read', 'executions.read', 'executions.write', 'users.read', 'users.write'];

const raw = execFileSync('appwrite', ['project', 'create-ephemeral-key', '--duration', '3600', ...SCOPES.flatMap((s) => ['--scopes', s]), '-R', '--show-secrets'], {
  cwd: root,
  encoding: 'utf8',
  shell: process.platform === 'win32',
});
const { secret } = JSON.parse(raw);
if (!secret) throw new Error('Could not mint an API key. Run `appwrite login` first.');

const [cmd, ...args] = process.argv.slice(2);
const child = spawn(cmd, args, {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, APPWRITE_ENDPOINT: cfg.endpoint, APPWRITE_PROJECT_ID: cfg.projectId, APPWRITE_API_KEY: secret },
});
child.on('exit', (code) => process.exit(code ?? 1));
