const assert = require('node:assert/strict');
const path = require('node:path');
const { createTypeScriptLoader } = require('./lib/load-typescript.cjs');

async function main() {
  const finishedPlate = {
    id: 11, platename: 'Cavity', sqty: 2, location: 'In-House', subplate_type: 'repair', po_bypassed: true,
    order_by: 7, received_workby: 7, received_qcby: 7, vmc_workby: 7, vmc_qcby: 7,
    drilltap_workby: 7, final_qcby: 7, packing_workby: 7,
  };
  const inHouseBalance = { plateid: 11, outward_jobwork_qty: 0, po_ordered_qty: 0, po_inward_qty: 0 };
  let plate = finishedPlate;
  let balance = inHouseBalance;
  let balanceError = null;
  let worktype = 'Rework';
  let updateError = null;
  let companion = null;
  let companionBalance = null;
  const updates = [];
  const load = createTypeScriptLoader(undefined, {
    '@/lib/auth': { authenticateRequest: async () => ({ user: { id: 7 } }) },
    '@/lib/cache': { invalidateCache() {} },
    '@/lib/r2/retention': { startProjectRetentionCycle: async () => {} },
    '@/lib/supabase/admin': {
      supabaseAdmin: {
        from(table) {
          if (table === 'scan') {
            return {
              select: () => ({ or: () => ({ maybeSingle: async () => ({ data: { id: 4, worktype } }) }) }),
              update: (values) => ({ eq: async () => { if (!updateError) updates.push(values); return { error: updateError }; } }),
            };
          }
          if (table === 'subplate') {
            return { select: () => ({ or: () => ({ is: async () => ({ data: companion ? [plate, companion] : [plate] }) }) }) };
          }
          assert.equal(table, 'view_subplate_jobwork_balance');
          return { select: () => ({ in: async () => ({ data: [balance, companionBalance].filter(Boolean), error: balanceError }) }) };
        },
      },
    },
  });
  const { POST } = load(path.resolve('src/app/api/projects/[id]/close/route.ts'));
  const close = (reason = {}) => POST(new Request('https://erp.test/api/projects/4/close', {
    method: 'POST', body: JSON.stringify({ closureReason: 'Kept In-House / Spare Tooling', ...reason }),
  }), { params: Promise.resolve({ id: '4' }) });

  balance = { ...inHouseBalance, outward_jobwork_qty: 1, active_vendors: 'Vendor A', customer_dispatched_qty: 2 };
  const outward = await close();
  assert.equal(outward.status, 400);
  assert.match((await outward.json()).error, /Vendor A.*Inward Challan/);
  assert.equal(updates.length, 0);

  balance = null;
  assert.equal((await close()).status, 500);
  balanceError = { message: 'Unavailable' };
  assert.equal((await close()).status, 500);
  balanceError = null;

  balance = { ...inHouseBalance, has_po: true, po_ordered_qty: 2, po_inward_qty: 1, pending_po_inward_qty: 1 };
  assert.equal((await close()).status, 400, 'A real PO still needs full inward receipt');

  balance = inHouseBalance;
  plate = { ...finishedPlate, final_qcby: null };
  assert.equal((await close()).status, 400, 'Incomplete manufacturing blocks direct closure');
  assert.equal(updates.length, 0);

  plate = finishedPlate;
  balance = { ...inHouseBalance, customer_dispatched_qty: 1 };
  assert.equal((await close()).status, 400, 'Partial customer dispatch blocks closure');

  balance = inHouseBalance;
  companion = { ...finishedPlate, id: 12, platename: 'Core' };
  companionBalance = { ...inHouseBalance, plateid: 12, outward_jobwork_qty: 1, active_vendors: 'Vendor B' };
  assert.match((await (await close()).json()).error, /Core.*Vendor B/);
  companionBalance = { ...inHouseBalance, plateid: 12 };

  updateError = { code: 'P0001', message: 'Record an Inward Challan first' };
  assert.equal((await close()).status, 409, 'A vendor movement during closure is surfaced as a conflict');
  updateError = null;
  assert.equal((await close({ closureReason: 'Other / Custom Note' })).status, 400);
  assert.equal(updates.length, 0);
  assert.equal((await close({ closureNotes: '  Kept for future repairs  ' })).status, 200);
  assert.equal(updates[0].status, 'completed');
  assert.equal(updates[0].register_closure_reason, 'Kept In-House / Spare Tooling');

  assert.equal(updates[0].register_closure_notes, 'Kept for future repairs');

  worktype = 'Pulp Mould';
  companion = null;
  companionBalance = null;
  plate = { ...finishedPlate, subplate_type: 'new_make', po_bypassed: false };
  balance = { ...inHouseBalance, has_po: true, po_ordered_qty: 2, po_inward_qty: 2 };
  assert.equal((await close()).status, 400, 'Regular manufacturing still requires dispatch');
  console.log('PASS: vendor holds, missing balances, pending PO, rework completion and regular dispatch rules');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
