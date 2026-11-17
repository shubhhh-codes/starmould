const assert = require('node:assert/strict');
const path = require('node:path');
const { createHash, webcrypto } = require('node:crypto');
const { createTypeScriptLoader } = require('./lib/load-typescript.cjs');
const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
const oldStorage = globalThis.sessionStorage;
const store = new Map();
const setCrypto = value => Object.defineProperty(globalThis, 'crypto', { configurable: true, value });
let current = true;
const load = createTypeScriptLoader(undefined, {
  '@/lib/cache/principal': { browserPrincipal: () => ({key:'7_5_fixture',generation:1}), principalIsCurrent: () => current },
});
const { createClientId, payloadSha256 } = load(path.resolve('src/lib/browser-crypto.ts'));
const { prepareInventoryRetry } = load(path.resolve('src/lib/query/inventory-retry.ts'));
async function run() {
  try {
    globalThis.sessionStorage = {getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,value),removeItem:key=>store.delete(key)};
    setCrypto(webcrypto);
    assert.match(createClientId(),/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    const body = {photoIds:[1,2],project:'TEST',items:[{qty:3,plateid:9}]};
    const first = await prepareInventoryRetry('/api/inward',{method:'POST',body:JSON.stringify(body)});
    const nativeKey = first.headers.get('Idempotency-Key');
    // Same API surface as Safari on a LAN HTTP origin: entropy exists, secure-context APIs do not.
    setCrypto({getRandomValues:webcrypto.getRandomValues.bind(webcrypto)});
    const ids = new Set();
    for(let i=0;i<1000;i++) {const id=createClientId();assert.match(id,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);ids.add(id);}
    assert.equal(ids.size,1000);
    const vectors=['','abc','हिन्दी material 📷','a'.repeat(55),'a'.repeat(56),'a'.repeat(63),'a'.repeat(64),'a'.repeat(65),'a'.repeat(1000000)];
    for(let i=0;i<100;i++)vectors.push(Array.from({length:i*17},(_,j)=>String.fromCharCode(32+(j*31+i)%90)).join(''));
    for(const value of vectors)assert.equal(await payloadSha256(value),createHash('sha256').update(value).digest('hex'));
    const retry = await prepareInventoryRetry('/api/inward',{method:'POST',body:JSON.stringify({items:body.items,project:'TEST',photoIds:[1,2]})});
    assert.equal(retry.headers.get('Idempotency-Key'),nativeKey,'HTTP fallback preserves native SHA-256 retry identity');
    retry.complete();
    const newRequest = await prepareInventoryRetry('/api/inward',{method:'POST',body:JSON.stringify(body)});
    assert.notEqual(newRequest.headers.get('Idempotency-Key'),nativeKey);
    const explicit = await prepareInventoryRetry('/api/purchase-inward',{method:'POST',headers:{'Idempotency-Key':'receipt_existing_key'},body:'{}'});
    assert.equal(explicit.headers.get('Idempotency-Key'),'receipt_existing_key');
    current=false; await assert.rejects(prepareInventoryRetry('/api/inward',{method:'POST',body:'{}'}),/Session changed/);current=true;
    setCrypto({getRandomValues:webcrypto.getRandomValues.bind(webcrypto),subtle:{digest:async()=>{throw Error('Disabled by browser policy');}}});
    assert.equal(await payloadSha256('abc'),createHash('sha256').update('abc').digest('hex'));
    setCrypto(undefined);assert.throws(createClientId,/updated browser/);
    console.log('PASS: native and HTTP UUIDs, entropy/format, SHA-256 vectors and boundary lengths, Unicode, stable retry keys, explicit keys and browser-policy fallback.');
  } finally {
    if(descriptor)Object.defineProperty(globalThis,'crypto',descriptor);else delete globalThis.crypto;
    if(oldStorage===undefined)delete globalThis.sessionStorage;else globalThis.sessionStorage=oldStorage;
  }
}
run().catch(error=>{console.error(error);process.exitCode=1;});
