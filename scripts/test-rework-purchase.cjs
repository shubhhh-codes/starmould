const assert = require('node:assert/strict');
const path = require('node:path');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { createTypeScriptLoader } = require('./lib/load-typescript.cjs');

async function main() {
  let role = 5;
  let authError = false;
  let rpcError = null;
  const calls = [];
  const load = createTypeScriptLoader(undefined, {
    '@/lib/photos/storage-moves': { tryPhotoStorageMoves() {} },
    '@/lib/auth': { authenticateRequest: async () => authError ? { error: 'Unauthorized', status: 401 } : { user: { id: 17, role_id: role } } },
    '@/lib/cache': { invalidateCache() {} },
    '@/lib/permissions/loader': {},
    '@/lib/print-token': {},
    '@/lib/supabase/admin': { supabaseAdmin: {
      async rpc(name, args) {
        calls.push({ name, args });
        return { data: rpcError ? null : { id: args.p_plate, po_bypassed: true }, error: rpcError };
      },
    } },
    '@/components/providers/auth-provider': { useAuth: () => ({ currentUser: { role_id: role } }) },
    '@/lib/query/hooks': { useUpdateSubplateMutation: () => ({ isPending: false }) },
    '@/components/ui/dialog': { Modal: ({ isOpen, title, children }) => isOpen ? React.createElement('section', null, title, children) : null },
  });

  const { PUT } = load(path.resolve('src/app/api/subplate/route.ts'));
  const request = (extra = {}) => PUT(new Request('https://erp.test/api/subplate', {
    method: 'PUT', body: JSON.stringify({ id: 41, action: 'bypass_purchase', ...extra }),
  }));
  authError = true;
  assert.equal((await request()).status, 401);
  authError = false;
  assert.equal((await request({ id: 'bad' })).status, 400);
  assert.equal((await request({ action: undefined, updates: { po_bypassed: true } })).status, 400);
  assert.equal(calls.length, 0);

  const result = await request({ actor: 99, order_by: 99 });
  assert.equal(result.status, 200);
  assert.equal((await result.json()).subplate.po_bypassed, true);
  assert.deepEqual(calls[0], { name: 'bypass_subplate_purchase', args: { p_plate: 41, p_actor: 17 } });
  for (const [code, status] of [['42501', 403], ['P0001', 409]]) {
    rpcError = { code, message: 'Rejected by purchase policy' };
    const rejected = await request();
    assert.equal(rejected.status, status);
    assert.equal((await rejected.json()).error, rpcError.message);
  }

  const { PurchaseRequiredModal } = load(path.resolve('src/features/subplates/components/purchase-required-modal.tsx'));
  const plate = { id: 41, platename: 'Cavity', subplate_type: 'new_make' };
  const render = (patch) => renderToStaticMarkup(React.createElement(PurchaseRequiredModal, {
    poRequiredModal: { ...plate, ...patch },
    setPoRequiredModal() {}, handleOpenCreatePOForPlate() {},
  }));
  for (const patch of [{ mould_worktype: ' rework ' }, { mould_worktype: 'Sample' }, { subplate_type: 'repair' }]) {
    assert.match(render(patch), /In-House Material/);
    assert.match(render(patch), /Purchase Order/);
  }
  assert.doesNotMatch(render({ mould_worktype: 'Pulp Mould' }), /In-House Material/);
  role = 4;
  assert.doesNotMatch(render({ mould_worktype: 'Rework' }), /In-House Material/);
  console.log('PASS: bypass permissions, server-owned fields, RPC errors and material choice rendering');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
