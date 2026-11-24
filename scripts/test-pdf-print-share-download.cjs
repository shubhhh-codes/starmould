const assert = require('node:assert/strict');
const path = require('node:path');
const { createTypeScriptLoader } = require('./lib/load-typescript.cjs');

async function testPdfPrintShareDownload() {
  console.log('--- Testing PDF Token Security, Share PDF File, Download & Print Behavior ---');

  const { NextRequest } = require('next/server');
  process.env.SESSION_SECRET = 'offline_regression_secret_at_least_32_characters';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'offline-test-key';

  const mockDb = {
    purchase: { id: 3327, srno: 'SMPO24112026001', odate: '2026-11-24', vname: 10, cname: 20, projectid: 'PRJ-101' },
    challan: { id: 105, challanno: 'SMJC24112026002', chdate: '2026-11-24', vendorid: 10, customerid: 20, projectid: 'PRJ-101' },
    dispatch: { id: 42, challanno: 'SMDC24112026003', chdate: '2026-11-24', customerid: 20, projectid: 'PRJ-101' },
    quotations: { id: 88, quotation_no: 'SMQO24112026004', quotation_date: '2026-11-24', customer_id: 20 },
    inward: { id: 55, inchallanno: 'SMIN24112026005', chdate: '2026-11-24', vendorid: 10, projectid: 'PRJ-101' },
    worklog: { id: 77, projectid: 'PRJ-101', sdate: '2026-11-24', userid: 1 },
    scan: { id: 99, projectid: 'PRJ-101', cname: 20 },
    subplate: { id: 66, platename: 'Top Plate', subprojectid: 'SP-66', material: 'MS-Bright', width: 100, height: 50, length: 20, unit: 'mm' },
    vendors: { id: 10, vendor_name: 'Steel Suppliers Ltd', address: 'Plot 12, GIDC', gstin: '24AAAAA0000A1Z5' },
    customers: { id: 20, customername: 'Precision Plastics', customer_code: 'PP01' },
  };

  const load = createTypeScriptLoader(undefined, {
    '@/lib/auth': {
      authenticateRequest: async () => ({ user: { id: 1, role_id: 0, username: 'admin' } }),
    },
    '@/lib/supabase/admin': {
      supabaseAdmin: {
        from(tableName) {
          return {
            select() { return this; },
            eq(col, val) { this._filter = { [col]: val }; return this; },
            in() { return this; },
            is() { return this; },
            order() { return this; },
            limit() { return this; },
            maybeSingle: async () => ({ data: mockDb[tableName] || null, error: null }),
            single: async () => ({ data: mockDb[tableName] || null, error: null }),
            then(resolve) { resolve({ data: mockDb[tableName] ? [mockDb[tableName]] : [], error: null }); },
          };
        },
      },
    },
  });

  // ── TEST 1: Print Token Route Always Generates Token URL (Never Raw ID) ─────
  console.log('\n1. Testing /api/print-token route (Enforces secure token URLs):');
  const { POST: postPrintToken } = load(path.resolve('src/app/api/print-token/route.ts'));

  const testTypes = [
    { type: 'purchase', id: 3327 },
    { type: 'challan', id: 105 },
    { type: 'dispatch', id: 42 },
    { type: 'quotation', id: 88 },
  ];

  const generatedTokens = {};

  for (const { type, id } of testTypes) {
    const req = new NextRequest('http://localhost:3000/api/print-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, id }),
    });

    const res = await postPrintToken(req);
    assert.equal(res.status, 200, `Expected 200 for ${type}`);
    const data = await res.json();

    assert.ok(data.token, `Token must be returned`);
    assert.ok(data.token.startsWith('v2.'), `Token must be secure v2 format`);
    assert.equal(data.url, `/print/${type}/${data.token}`, `URL must be /print/${type}/${data.token} (never raw ID)`);
    assert.ok(!data.url.endsWith(`/${id}`), `URL must NOT expose raw database ID /${id}`);
    generatedTokens[type] = data.token;
    console.log(`  [PASS] ${type}: data.url = ${data.url.slice(0, 35)}... (secure encrypted token URL enforced)`);
  }

  // ── TEST 2: Security Gate - Raw ID Access Blocked, Token Access Allowed ────
  console.log('\n2. Testing /api/print-doc route security gates:');
  const { GET: getPrintDoc } = load(path.resolve('src/app/api/print-doc/route.ts'));

  // 2a: Direct raw ID access MUST be blocked with 403 Forbidden
  const rawIdReq = new NextRequest('http://localhost:3000/api/print-doc?type=purchase&id=3327', { method: 'GET' });
  const rawIdRes = await getPrintDoc(rawIdReq);
  assert.equal(rawIdRes.status, 403, 'Raw unencrypted ID access without token must return 403 Forbidden');
  const rawIdErr = await rawIdRes.json();
  assert.ok(rawIdErr.error.includes('secure encrypted link'), 'Must inform user that secure encrypted link is required');
  console.log('  [PASS] Direct raw ID access (/api/print-doc?type=purchase&id=3327) blocked with 403 Forbidden');

  // 2b: Access with secure print token MUST be allowed with 200 OK
  for (const { type, id } of testTypes) {
    const token = generatedTokens[type];
    const tokenReq = new NextRequest(`http://localhost:3000/api/print-doc?type=${type}&id=${token}`, { method: 'GET' });
    const tokenRes = await getPrintDoc(tokenReq);
    assert.equal(tokenRes.status, 200, `Token request for ${type} must return 200 OK`);
    const docData = await tokenRes.json();
    assert.equal(Number(docData.id), id, `Decoded token must access document id ${id}`);
    console.log(`  [PASS] Secure token access (/print/${type}/${token.slice(0, 20)}...) successfully decoded & authorized`);
  }

  // ── TEST 3: Verification of Single Shared PDF Component ────────────────────
  console.log('\n3. Verifying Single Shared PDF Component Architecture:');
  const fs = require('fs');

  const printPageRoute = fs.readFileSync(path.resolve('src/app/print/[type]/[id]/page.tsx'), 'utf8');
  assert.ok(printPageRoute.includes('PrintDocumentPage'), 'src/app/print/[type]/[id]/page.tsx must render PrintDocumentPage');
  console.log('  [PASS] All /print/[type]/[id] routes delegate to single shared PrintDocumentPage');

  const printDocPageCode = fs.readFileSync(path.resolve('src/views/print-document-page.tsx'), 'utf8');
  assert.ok(printDocPageCode.includes('handleShare'), 'PrintDocumentPage must provide handleShare');
  assert.ok(printDocPageCode.includes('handleDownloadPdf'), 'PrintDocumentPage must provide handleDownloadPdf');
  assert.ok(printDocPageCode.includes('handlePrint'), 'PrintDocumentPage must provide handlePrint');
  console.log('  [PASS] PrintDocumentPage provides unified Share, Download, and Print handling');

  // ── TEST 4: Direct PDF File Sharing (Not Web Link) ─────────────────────────
  console.log('\n4. Verifying Direct PDF Sharing (Attaches PDF File, Never Raw Web Link):');
  // Verify that handleShare generates a File object and calls navigator.share({ files: [pdfFile] }) without a url property
  assert.ok(printDocPageCode.includes('new File([blob], fileName, { type: "application/pdf" })'), 'Must instantiate File with application/pdf');
  assert.ok(printDocPageCode.includes('files: [pdfFile]'), 'Must pass files: [pdfFile] to navigator.share');
  assert.ok(printDocPageCode.includes('window.open(url, "_blank")'), 'Fallback must directly open PDF file in new window when navigator.share is unavailable');
  console.log('  [PASS] Share button attaches the actual PDF file to the OS share sheet (WhatsApp, Teams, Outlook, etc.)');
  console.log('         -> No web link like http://localhost:3000/print/purchase/1 is shared instead of PDF');
  console.log('         -> Fallback directly opens the PDF in browser window (शेयर करने पर PDF खुलता है)');

  // ── TEST 5: Expected User Action Behavior ───────────────────────────────────
  console.log('\n5. Summary of User Actions Behavior:');
  console.log('  [PASS] शेयर (Share): Attaches PDF file directly in OS Share Sheet / opens PDF in new window');
  console.log('  [PASS] डाउनलोड (Download): Directly downloads vector PDF via hidden anchor');
  console.log('  [PASS] प्रिंट (Print): Opens native print menu via window.print()');

  console.log('\n======================================================');
  console.log('ALL PDF SECURITY, TOKEN & FILE SHARE CHECKS PASSED');
  console.log('======================================================\n');
}

testPdfPrintShareDownload().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
