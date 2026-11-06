const assert = require('node:assert/strict');
const path = require('node:path');
const load = require('./lib/load-typescript.cjs').createTypeScriptLoader();
const model = load(path.resolve('src/features/moulds/model/subplate-form.ts'));
const { filterMoulds } = load(path.resolve('src/features/moulds/model/filter-moulds.ts'));

const project = { id: 42, projectid: '0042_KEEP_003', total_plates: 2 };
const form = model.createNewSubplateForm(project);
assert.deepEqual(form, {
  platename: 'Plate 3', subprojectid: '0042_KEEP_003_003', material: 'MS-Bright', shape: 'Plate',
  length: '', width: '', height: '', weight: '', unit: 'mm', sqty: '1', location: 'SM',
});
assert.equal(model.isSubplateFormValid(form, false), true, 'Existing blank-dimension behavior');
for (const patch of [{ platename: '  ' }, { sqty: '0' }, { sqty: '' }, { length: '-1' }, { width: 'bad' }, { height: '-1' }]) {
  assert.equal(model.isSubplateFormValid({ ...form, ...patch }, false), false);
}
assert.equal(model.isSubplateFormValid({ ...form, height: '-1' }, true), true);
assert.equal(model.isSubplateFormValid(model.createEmptySubplateForm(), false), false);
assert.equal(model.createNewSubplateForm({ id: 1 }).subprojectid, '');
const editing = model.createEditingSubplateForm({ id: 7, length: 0, width: null, height: 0, weight: 0, sqty: 0 });
assert.equal(editing.length, '0');
assert.equal(editing.width, '');
assert.equal(editing.sqty, '0');
assert.deepEqual(model.createSubplatePayload(form, null, project, false, false), {
  ...form, length: null, width: null, height: null, weight: null, sqty: 1, projectid: 42,
});
const changed = { ...form, platename: '  Edited plate  ', length: '100', width: '50', height: '20', weight: '0.781', sqty: '2' };
assert.deepEqual(model.createSubplatePayload(changed, { id: 7 }, project, false, true), {
  id: 7, updates: { platename: 'Edited plate', subprojectid: '0042_KEEP_003_003', shape: 'Plate', material: 'MS-Bright',
    length: 100, width: 50, height: 20, weight: 0.781, unit: 'mm', sqty: 2, location: 'SM' },
});
assert.equal(model.createSubplatePayload(changed, null, project, true, false).height, null);
const records = [{ id: 1, cname: 'Alpha', worktype: 'TF' }, { id: 2, customername: 'Beta', customer_id: 9, worktype: 'Pulp Mould' }];
assert.deepEqual(filterMoulds(records, 'ALL', 'ALL'), records);
assert.deepEqual(filterMoulds(records, 'Alpha', 'TF'), [records[0]]);
assert.deepEqual(filterMoulds(records, 'Beta', 'ALL'), [records[1]]);
assert.deepEqual(filterMoulds(records, '9', 'Pulp Mould'), [records[1]]);
assert.deepEqual(filterMoulds(records, 'Alpha', 'Pulp Mould'), []);
assert.equal(project.projectid, '0042_KEEP_003');
console.log('PASS: mould filters, form defaults, validation, zero values and exact create/edit payloads');
