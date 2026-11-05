const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, mocks = {}) {
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(source, {
    exports: module.exports, module,
    require: (name) => name in mocks ? mocks[name] : require(name),
    URL, Date, console,
  }, { filename: file });
  return module.exports;
}

const identity = load('src/lib/customer-identity.ts');
const { normalizeCustomerInitials, isValidCustomerInitials, generateCustomerInitials, customerCodeChanged } = identity;
assert.equal(normalizeCustomerInitials(' ab c '), 'ABC');
for (const value of ['', 'ABC123', 'ABCDEF', 'A_B', 'A%', 'É']) assert.equal(isValidCustomerInitials(value), false);
assert.equal(isValidCustomerInitials('KDSHL'), true);
assert.equal(normalizeCustomerInitials(null), '');
const used = new Set();
for (let i = 0; i < 500; i++) {
  const initials = generateCustomerInitials('123 Alpha & Company', used);
  assert.equal(isValidCustomerInitials(initials), true);
  assert.equal(used.has(initials), false);
  used.add(initials);
}
const current = { id: 7, customer_code: 'STC75IL9', pan_code: 'STC75IL9', initials: 'KDSHL' };
assert.equal(customerCodeChanged({}, current), false);
assert.equal(customerCodeChanged({ customer_code: ' stc75il9 ' }, current), false);
assert.equal(customerCodeChanged({ pan_code: 'OTHER' }, current), true);
assert.equal(customerCodeChanged({ customer_code: null }, current), true);
assert.equal(customerCodeChanged({ customer_code: '', pan_code: '' }, { customer_code: null }), false);

async function update(body, options = {}) {
  let payload;
  const api = load('src/app/api/customers/route.ts', {
    '@/lib/customer-identity': identity,
    '@/lib/auth': { authenticateRequest: async () => options.authError || { user: { id: 1 } } },
    '@/lib/cache': { invalidateCache() {} },
    '@/lib/supabase/admin': { supabaseAdmin: { from() {
      let field;
      let writing = false;
      const chain = {
        select() { return chain; }, eq() { return chain; }, is() { return chain; }, neq() { return chain; },
        ilike(name) { field = name; return chain; },
        limit() {
          return Promise.resolve(field === 'initials'
            ? { data: options.duplicate ? [{ id: 8 }] : [], error: options.lookupError ? { message: 'Unavailable' } : null }
            : { data: [], error: null });
        },
        maybeSingle() { return Promise.resolve({ data: options.missing ? null : current, error: null }); },
        update(value) { payload = value; writing = true; return chain; },
        single() { assert.ok(writing); return Promise.resolve({ data: { ...current, ...payload }, error: options.writeError || null }); },
      };
      return chain;
    } } },
  });
  const res = await api.PUT({ json: async () => ({ id: 7, customername: 'Customer', ...body }) });
  return { status: res.status, json: await res.json(), payload };
}

async function importCustomer(item, existing = [{ ...current, customername: 'Original Company' }]) {
  const writes = [];
  const api = load('src/app/api/customers/import/route.ts', {
    '@/lib/customer-identity': identity,
    '@/lib/auth': { authenticateRequest: async () => ({ user: { id: 1 } }) },
    '@/lib/cache': { invalidateCache() {} },
    '@/lib/supabase/admin': { supabaseAdmin: { from() {
      let payload;
      let inserted = false;
      const chain = {
        select() { return chain; },
        is() { return Promise.resolve({ data: existing, error: null }); },
        eq() { return chain; },
        update(value) { payload = value; return chain; },
        insert(value) { payload = value[0]; inserted = true; return chain; },
        maybeSingle() { writes.push(payload); return Promise.resolve({ data: { id: 7 }, error: null }); },
        single() { assert.ok(inserted); writes.push(payload); return Promise.resolve({ data: { id: 99 }, error: null }); },
      };
      return chain;
    } } },
  });
  const response = await api.POST({ json: async () => ({ customers: [item] }) });
  return { json: await response.json(), writes };
}

(async () => {
  const edited = await update({ initials: 'NEW', customer_code: current.customer_code });
  assert.equal(edited.status, 200);
  assert.equal(edited.payload.initials, 'NEW');
  assert.equal('customer_code' in edited.payload, false);
  assert.equal('pan_code' in edited.payload, false);
  const unchanged = await update({});
  assert.equal(unchanged.status, 200);
  assert.equal('initials' in unchanged.payload, false);
  assert.equal((await update({ initials: 'KDSHL' })).status, 200);
  for (const initials of ['', null, 'A1', 'ABCDEF', '%']) assert.equal((await update({ initials })).status, 400);
  for (const body of [{ customer_code: 'OTHER' }, { pan_code: 'OTHER' }, { customer_code: null }]) {
    const result = await update(body);
    assert.equal(result.status, 400);
    assert.equal(result.payload, undefined);
  }
  assert.equal((await update({ initials: 'NEW' }, { duplicate: true })).status, 400);
  assert.equal((await update({ initials: 'NEW' }, { lookupError: true })).status, 500);
  assert.equal((await update({}, { missing: true })).status, 404);
  assert.equal((await update({}, { authError: { error: 'Access denied', status: 403 } })).status, 403);
  assert.equal((await update({ initials: 'NEW' }, { writeError: { code: '23505', message: 'idx_customers_initials_active_unique' } })).status, 400);
  assert.equal((await update({}, { writeError: { code: '23514', message: 'Customer Code cannot be changed after creation.' } })).status, 400);
  const imported = await importCustomer({ companyName: 'Original Company', cusCode: current.customer_code, contactNo: '9876543210' });
  assert.equal(imported.json.updatedCount, 1);
  assert.equal('initials' in imported.writes[0], false);
  assert.equal('customer_code' in imported.writes[0], false);
  const changed = await importCustomer({ companyName: 'Original Company', cusCode: 'OTHER' });
  assert.equal(changed.json.failedCount, 1);
  assert.equal(changed.writes.length, 0);
  const ambiguous = await importCustomer({ companyName: 'Other Company', cusCode: current.customer_code }, [
    { ...current, customername: 'Original Company' },
    { ...current, id: 8, customername: 'Other Company', customer_code: 'OTHER', pan_code: 'OTHER' },
  ]);
  assert.equal(ambiguous.json.failedCount, 1);
  assert.equal(ambiguous.writes.length, 0);
  const added = await importCustomer({ companyName: '123 & New Company' });
  assert.equal(added.json.insertedCount, 1);
  assert.equal(isValidCustomerInitials(added.writes[0].initials), true);
  console.log('Customer identity checks passed: validation, import generation, API edits, unchanged initials, locked codes, duplicates, failures and access checks.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
