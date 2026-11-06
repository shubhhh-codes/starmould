const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { webpack } = require('next/dist/compiled/webpack/webpack');
const postcss = require('postcss');
const tailwind = require('@tailwindcss/postcss');

async function browserPreview(entry, aliases = {}) {
  const root = path.resolve(__dirname, '../..');
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'starmould-dashboard-'));
  const loader = path.join(output, 'typescript-loader.cjs');
  fs.writeFileSync(loader, `const ts=require(${JSON.stringify(require.resolve('typescript'))}); module.exports=function(source){return ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;};`);
  await new Promise((resolve, reject) => {
    const compiler = webpack({ mode: 'development', devtool: false, context: root, entry,
      output: { path: output, filename: 'preview.js' },
      resolve: { extensions: ['.tsx', '.ts', '.js'], modules: [path.join(root, 'node_modules'), 'node_modules'], alias: { ...aliases, '@': path.join(root, 'src') } },
      module: { rules: [{ test: /\.tsx?$/, exclude: /node_modules/, use: loader }] },
    });
    compiler.run((error, stats) => compiler.close(() => error || stats.hasErrors() ? reject(error || Error(stats.toString({ all: false, errors: true }))) : resolve()));
  });
  const css = (await postcss([tailwind({ base: root })]).process(fs.readFileSync(path.join(root, 'src/app/globals.css'), 'utf8'), { from: path.join(root, 'src/app/globals.css') })).css;
  const bundle = fs.readFileSync(path.join(output, 'preview.js'));
  const server = http.createServer((req, res) => {
    if (req.url === '/preview.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(bundle); }
    else if (req.url === '/preview.css') { res.setHeader('Content-Type', 'text/css'); res.end(css); }
    else { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/preview.css"></head><body><div id="root"></div><script src="/preview.js"></script></body></html>'); }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${server.address().port}`, output, close: () => new Promise((resolve) => server.close(resolve)) };
}
module.exports = { browserPreview };
