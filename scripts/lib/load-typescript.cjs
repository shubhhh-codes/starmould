const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const ts = require('typescript');

// Offline test loader: application modules are real; database access is forbidden.
function createTypeScriptLoader(root = path.resolve(__dirname, '../..'), mocks = {}) {
  const cache = new Map();
  function load(filename) {
    const resolved = ['.ts', '.tsx', '.js', '.cjs', '/index.ts', ''].map((suffix) => filename + suffix)
      .find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
    if (!resolved) throw new Error(`Cannot resolve test module ${filename}`);
    if (cache.has(resolved)) return cache.get(resolved).exports;
    const module = { exports: {} };
    cache.set(resolved, module);
    const nativeRequire = createRequire(resolved);
    const source = ts.transpileModule(fs.readFileSync(resolved, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;
    vm.runInThisContext(`(function(require,module,exports,__filename,__dirname){${source}\n})`, { filename: resolved })(
      (name) => {
        if (Object.hasOwn(mocks, name)) return mocks[name];
        if (name === '@/lib/supabase/admin') return { supabaseAdmin: new Proxy({}, { get() { throw new Error('Database access is forbidden in offline regression tests'); } }) };
        if (name === 'server-only') return {};
        if (name.startsWith('@/')) return load(path.join(root, 'src', name.slice(2)));
        if (name.startsWith('.')) return load(path.resolve(path.dirname(resolved), name));
        return nativeRequire(name);
      }, module, module.exports, resolved, path.dirname(resolved),
    );
    return module.exports;
  }
  return load;
}
module.exports = { createTypeScriptLoader };
