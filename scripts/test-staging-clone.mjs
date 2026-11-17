import test from 'node:test';
import assert from 'node:assert/strict';
import { visibleColumnPositions, canonicalConstraint, sqlForPg, sequenceValues } from './clone-production-data.mjs';

test('dropped internal column slots do not count as schema drift', () => {
  const source = [
    { schema: 'public', name: 'quotes', column: 'id', position: 1, type: 'bigint' },
    { schema: 'public', name: 'quotes', column: 'tax', position: 5, type: 'numeric' },
  ];
  const restored = source.map((row, i) => ({ ...row, position: i + 1 }));
  assert.deepEqual(visibleColumnPositions(source), visibleColumnPositions(restored));
  assert.notDeepEqual(visibleColumnPositions(source), visibleColumnPositions([...restored].reverse()));
  assert.notDeepEqual(visibleColumnPositions(source), visibleColumnPositions(restored.map(row => ({ ...row, type: 'text' }))));
});

test('equivalent array coercion notation compares equal without hiding actual CHECK changes', () => {
  const source = "CHECK (((vendor_type)::text = ANY ((ARRAY['Supplier'::character varying, 'Transporter'::character varying])::text[])))";
  const restored = "CHECK (((vendor_type)::text = ANY (ARRAY[('Supplier'::character varying)::text, ('Transporter'::character varying)::text])))";
  assert.equal(canonicalConstraint(source), canonicalConstraint(restored));
  assert.notEqual(canonicalConstraint(source), canonicalConstraint(restored.replace('Supplier', 'Other')));
  assert.notEqual(canonicalConstraint(source), canonicalConstraint(restored.replace(' = ANY ', ' <> ALL ')));
  assert.equal(canonicalConstraint('CHECK (amount > 0)'), 'CHECK (amount > 0)');
});

test('outer pg_dump guards are removed without changing multiline records', () => {
  const data = "INSERT INTO sample VALUES ('9007199254740993\n\\restrict PreserveMe\n\\unrestrict PreserveMe\nΩ');\n";
  const sql = '-- header\n\\restrict OuterKey\n' + data + '\\unrestrict OuterKey\n';
  assert.equal(sqlForPg(sql), '-- header\n' + data);
});

test('sequence verification preserves bigint precision', () => {
  assert.deepEqual(sequenceValues("SELECT pg_catalog.setval('public.ids', 9007199254740993, true);\n"),
    [{ name: 'public.ids', value: '9007199254740993', called: true }]);
});
