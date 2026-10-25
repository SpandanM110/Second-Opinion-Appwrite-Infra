// Deletes every old build of the site and the Functions, keeping only the active one.
// Each site deploy stores a full Next.js build (about 230 MB); the free plan's 2 GB of storage fills after nine deploys.
//   npm run prune            (also runs automatically after `npm run deploy:web`)
import { execFileSync } from 'node:child_process';

const run = (args) => execFileSync('appwrite', [...args, '-R'], { encoding: 'utf8', shell: true, maxBuffer: 1 << 28 });
const json = (args) => JSON.parse(run(args));
const mb = (n) => `${(n / 1048576).toFixed(0)} MB`;

let freed = 0;
let kept = 0;
function prune(kind, id, listArgs, getArgs, deleteArgs, key) {
  const active = json(getArgs).deploymentId;
  const list = json(listArgs).deployments ?? [];
  for (const d of list) {
    if (d.$id === active) {
      kept++;
      continue;
    }
    try {
      run([...deleteArgs, key, d.$id]);
      freed += d.totalSize || 0;
      console.log(`deleted ${kind} ${id} ${d.$id} (${mb(d.totalSize || 0)})`);
    } catch (e) {
      console.log(`could not delete ${d.$id}: ${String(e.message).split('\n').find((l) => l.includes('Error')) ?? 'error'}`);
    }
  }
}

prune('site', 'web', ['sites', 'list-deployments', '--site-id', 'web'], ['sites', 'get', '--site-id', 'web'], ['sites', 'delete-deployment', '--site-id', 'web'], '--deployment-id');
for (const f of ['worker', 'fair-range']) {
  prune('function', f, ['functions', 'list-deployments', '--function-id', f], ['functions', 'get', '--function-id', f], ['functions', 'delete-deployment', '--function-id', f], '--deployment-id');
}
console.log(`\nfreed ${mb(freed)}, kept ${kept} active deployments`);
