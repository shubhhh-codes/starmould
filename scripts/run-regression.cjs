const path = require('node:path');
const { spawnSync } = require('node:child_process');

if (process.argv.includes('--libraries')) {
  process.env.SESSION_SECRET = 'offline_regression_secret_at_least_32_characters';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'offline-test-key';
  global.fetch = async () => { throw new Error('Network access is forbidden in offline regression tests'); };
  require('./lib/load-typescript.cjs').createTypeScriptLoader()(path.join(__dirname, 'regression_suite.ts'));
} else {
  const checks = [
    ['Existing library regressions', [__filename, '--libraries']],
    ['Customer identity', [path.join(__dirname, 'test-customer-identity.cjs')]],
    ['Mould model', [path.join(__dirname, 'test-mould-model.cjs')]],
    ['Mould queries', [path.join(__dirname, 'test-mould-queries.cjs')]],
    ['Photo history', [path.join(__dirname, 'test-photo-history.cjs')]],
    ['Photo storage layout', [path.join(__dirname, 'test-photo-storage-layout.cjs')]],
    ['Photo storage worker', [path.join(__dirname, 'test-photo-storage-worker.cjs')]],
    ['Photo storage ZIP', [path.join(__dirname, 'test-photo-storage-zip.cjs')]],
    ['HTTP browser compatibility', [path.join(__dirname, 'test-browser-crypto.cjs')]],
    ['Database backup contracts', ['--test', path.join(__dirname, 'test-database-backups.cjs')]],
    ['Database backup access', [path.join(__dirname, 'test-backup-routes.cjs')]],
  ];
  for (const [label, args] of checks) {
    console.log(`\nRunning ${label}`);
    const result = spawnSync(process.execPath, args, { cwd: path.resolve(__dirname, '..'), stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status || 1);
  }
}
