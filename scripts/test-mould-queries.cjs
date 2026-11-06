const assert = require('node:assert/strict');
const path = require('node:path');
const { QueryClient } = require('@tanstack/react-query');
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const requests = [];
const broadcasts = [];
const ingested = [];
let current = true;
let response = {};
let status = 200;
const principal = { id: 'offline-fixture' };
const load = require('./lib/load-typescript.cjs').createTypeScriptLoader(undefined, {
  react: { useMemo: (fn) => fn(), useEffect: () => {} },
  '@tanstack/react-query': { useQuery: (options) => options, useMutation: (options) => options, useQueryClient: () => client },
  '@/lib/query/client': { CACHE_TIERS: { OPERATIONAL: { staleTime: 30000, gcTime: 600000 } } },
  '@/lib/cache/principal': { browserPrincipal: () => principal, principalIsCurrent: () => current },
  './principal-fetch': { principalFetch: async (url, init) => { requests.push({ url, ...init }); return Response.json(response, { status }); } },
  './inventory-retry': { prepareInventoryRetry: async () => null },
  '@/lib/query/realtime': { broadcastQueryInvalidation: (key) => broadcasts.push(key) },
  '@/lib/realtime/subplate-sync': { ingestSubplateChange: (_client, change) => ingested.push(change) },
  '@/lib/cache/projects-local-store': {},
  '@/lib/cache/projects-stream-store': {},
});
const projects = load(path.resolve('src/features/moulds/queries/projects.ts'));
const plates = load(path.resolve('src/features/moulds/queries/subplates.ts'));
const legacy = load(path.resolve('src/lib/query/hooks.ts'));
const { queryKeys } = load(path.resolve('src/lib/query/keys.ts'));

async function run() {
  for (const [name, value] of Object.entries({ ...projects, ...plates })) assert.equal(legacy[name], value, `Legacy export ${name}`);
  const list = projects.useProjectsQuery({ page: 2, pageSize: 15, customer: 'Alpha', worktype: 'TF', status: 'pending', search: 'test plate' });
  response = { scans: [{ id: 1 }], users: [{ id: 2 }] };
  const data = await list.queryFn({ signal: undefined });
  assert.equal(requests.at(-1).url, '/api/scanning?page=2&limit=15&status=pending&search=test+plate&customer=Alpha&worktype=TF');
  assert.equal(data.pagination.page, 2);
  assert.equal(data.pagination.pageSize, 15);
  assert.equal(list.staleTime, 30000);
  assert.equal(list.refetchOnMount, true);
  assert.equal(list.refetchOnWindowFocus, true);
  assert.equal(projects.useProjectsQuery({ enabled: false }).enabled, false);
  const sublist = plates.useSubplatesQuery();
  response = { data: [{ id: 3 }] };
  const subdata = await sublist.queryFn();
  assert.equal(subdata.pagination.pageSize, 1000);
  assert.deepEqual(subdata.subplates, [{ id: 3 }]);
  assert.equal(sublist.staleTime, 5000);
  const lazy = plates.useSubplatesByProjectQuery('A/B');
  await lazy.queryFn();
  assert.equal(requests.at(-1).url, '/api/subplate?projectid=A%2FB');
  assert.equal(lazy.staleTime, 300000);
  assert.equal(plates.useSubplatesByProjectQuery('0').enabled, false);
  assert.equal(plates.useSubplatesByProjectQuery(1, { enabled: false }).enabled, false);
  await projects.useNextProjectIdQuery(4, 'KEEP').queryFn();
  assert.equal(requests.at(-1).url, '/api/scanning/preview-id?customerId=4&initials=KEEP');

  const create = projects.useCreateProjectMutation();
  await create.mutationFn({ projectid: '0042_KEEP_003' });
  assert.equal(requests.at(-1).method, 'POST');
  assert.deepEqual(JSON.parse(requests.at(-1).body), { projectid: '0042_KEEP_003' });
  create.onSuccess();
  assert.deepEqual(broadcasts, [queryKeys.projects.all(), queryKeys.subplates.all(), queryKeys.purchases.all(), queryKeys.dashboard.counts()]);
  const key = queryKeys.subplates.byProject(42);
  const before = [{ id: 7, platename: 'Original', projectid: 42 }];
  client.setQueryData(key, before);
  const update = plates.useUpdateSubplateMutation();
  const body = { id: 7, updates: { platename: 'Edited' } };
  const context = await update.onMutate(body);
  assert.equal(client.getQueryData(key)[0].platename, 'Edited');
  update.onError(new Error('Offline failure'), body, context);
  assert.deepEqual(client.getQueryData(key), before);
  update.onSuccess({ subplate: { ...before[0], platename: 'Saved' } }, body);
  assert.equal(ingested.at(-1).plate.platename, 'Saved');
  const remove = plates.useDeleteSubplateMutation();
  const removalContext = await remove.onMutate(7);
  assert.deepEqual(client.getQueryData(key), []);
  assert.equal(removalContext.cachedPlate.id, 7);
  remove.onError(new Error('Offline failure'), 7, removalContext);
  assert.deepEqual(client.getQueryData(key), before);
  await projects.useDeleteProjectMutation().mutationFn({ id: 42, force: true });
  assert.equal(requests.at(-1).url, '/api/scanning?id=42&force=true');
  assert.equal(requests.at(-1).method, 'DELETE');
  status = 403; response = { error: 'Fixture access denied' };
  await assert.rejects(lazy.queryFn(), /Fixture access denied/);
  current = false;
  const count = requests.length;
  await assert.rejects(lazy.queryFn(), { name: 'AbortError' });
  assert.equal(requests.length, count, 'Stale principal must not send a request');
  client.clear();
  console.log('PASS: legacy query exports, URLs, cache options, payloads, broadcasts, optimistic rollback and session guard');
}
run().catch((error) => { client.clear(); console.error(error); process.exitCode = 1; });
