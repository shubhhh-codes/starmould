import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');

let databaseUrl = '';
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (trimmed.startsWith('DATABASE_URL=')) {
    databaseUrl = trimmed.substring('DATABASE_URL='.length).trim();
    if ((databaseUrl.startsWith('"') && databaseUrl.endsWith('"')) ||
        (databaseUrl.startsWith("'") && databaseUrl.endsWith("'"))) {
      databaseUrl = databaseUrl.slice(1, -1);
    }
    break;
  }
}

const client = new pg.Client({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log('Connecting to PostgreSQL database...');
  await client.connect();
  console.log('Connected successfully to database.\n');

  try {
    // 1. Fetch masters
    const custRes = await client.query('SELECT id, customername, initials FROM customers WHERE customername IS NOT NULL LIMIT 5');
    const userRes = await client.query('SELECT id, name, initials, role_id FROM users WHERE status = 1 LIMIT 5');
    const vendRes = await client.query('SELECT id, vendor_name FROM vendors LIMIT 5');

    const customers = custRes.rows;
    const users = userRes.rows;
    const vendors = vendRes.rows;

    const cust1 = customers[0] || { id: 1, customername: 'Sunpack Industries', initials: 'SUNPA' };
    const cust2 = customers[1] || { id: 2, customername: 'Miracle Plastics', initials: 'MRCL' };
    const cust3 = customers[2] || { id: 3, customername: 'Yash Laxmi Eco Pack', initials: 'YSHLX' };

    const adminUser = users.find(u => u.role_id === 0) || users[0] || { id: 1, name: 'Admin', initials: 'AD' };
    const akshayUser = users.find(u => u.name?.toLowerCase().includes('akshay')) || users[1] || adminUser;
    const designerUser = users.find(u => u.role_id === 3) || users[2] || adminUser;

    const supplierVendor = vendors[0] || { id: 1, vendor_name: 'Steel Masters India' };
    const jobworkVendor = vendors[1] || { id: 2, vendor_name: 'Precision Heat Treaters' };
    const transportVendor = vendors[2] || { id: 3, vendor_name: 'Yuvraj Logistics' };

    console.log(`Using Masters:`);
    console.log(`- Customers: ${cust1.customername}, ${cust2.customername}, ${cust3.customername}`);
    console.log(`- Users: ${adminUser.name}, ${akshayUser.name}, ${designerUser.name}`);
    console.log(`- Vendors: ${supplierVendor.vendor_name}, ${jobworkVendor.vendor_name}\n`);

    // Clean up any old demo records with these specific project codes
    const demoCodes = ['0004_SUNP_001', '0005_MRCL_001', '0006_YSHL_001'];
    for (const code of demoCodes) {
      await client.query('DELETE FROM dispatch_items WHERE project = $1', [code]);
      await client.query('DELETE FROM dispatch WHERE projectid = $1', [code]);
      await client.query('DELETE FROM challan_items WHERE project = $1', [code]);
      await client.query('DELETE FROM challan WHERE projectid = $1', [code]);
      await client.query('DELETE FROM inward_items WHERE project = $1', [code]);
      await client.query('DELETE FROM inward WHERE projectid = $1', [code]);
      await client.query('DELETE FROM purchase WHERE projectid = $1', [code]);
      await client.query('DELETE FROM worklog WHERE projectid = $1', [code]);
      await client.query('DELETE FROM subplate WHERE projectid = $1 OR mold_code = $1', [code]);
      await client.query('DELETE FROM scan WHERE projectid = $1', [code]);
    }

    // =========================================================================
    // MOULD 1: 0004_SUNP_001 (COMPLETED & 100% DISPATCHED - 5 PLATES)
    // =========================================================================
    console.log('Inserting Mould 1: 0004_SUNP_001 (Completed & 100% Dispatched)...');
    const m1Res = await client.query(`
      INSERT INTO scan (
        projectid, description, worktype, customer_id, cname, status,
        scan_by, qc_by, modeldesign_by, rdate, cdate, dispatchdate, scan_hr, model_hr, note
      ) VALUES (
        '0004_SUNP_001', '8-Cavity Shampoo Flip-Top Cap Mould', 'TF', $1, $2, 'completed',
        $3, $3, $4, '2026-10-10', '2026-10-28', '2026-10-29', 18, 4,
        'High-precision tooling with mirror polish inserts and multi-stage ejection.'
      ) RETURNING id
    `, [cust1.id, cust1.customername, adminUser.id, designerUser.id]);
    const m1Id = m1Res.rows[0].id;

    // Subplates for Mould 1
    const m1PlateNames = [
      'Top Clamping Plate',
      'Cavity Insert Plate',
      'Core Insert Plate',
      'Ejector Retainer Plate',
      'Bottom Clamping Plate',
    ];
    const m1PlateIds = [];
    for (let i = 0; i < m1PlateNames.length; i++) {
      const pRes = await client.query(`
        INSERT INTO subplate (
          platename, projectid, subprojectid, mold_id, mold_code, shape,
          length, width, height, weight, unit, material, sqty, location,
          design_by, order_by, received_workby, received_qcby, vmc_workby, vmc_qcby, drilltap_workby, final_qcby, packing_workby,
          design_at, order_at, received_work_at, received_qc_at, vmc_work_at, vmc_qc_at, drilltap_at, final_qc_at, packing_at,
          dispatch_status
        ) VALUES (
          $1, '0004_SUNP_001', $2, $3, '0004_SUNP_001', 'Rectangle',
          350, 250, 45, 31.0, 'mm', 'P-20', 1, 'Customer',
          $4, $4, $4, $4, $5, $4, $5, $4, $5,
          '2026-10-11 10:00:00+05:30', '2026-10-12 14:00:00+05:30', '2026-10-15 11:30:00+05:30',
          '2026-10-16 16:00:00+05:30', '2026-10-20 18:00:00+05:30', '2026-10-21 11:00:00+05:30',
          '2026-10-24 17:00:00+05:30', '2026-10-26 15:30:00+05:30', '2026-10-28 17:45:00+05:30',
          'dispatched'
        ) RETURNING id
      `, [m1PlateNames[i], `0004_SUNP_001_00${i + 1}`, m1Id, designerUser.id, akshayUser.id]);
      m1PlateIds.push(pRes.rows[0].id);
    }

    // Worklogs for Mould 1
    await client.query(`
      INSERT INTO worklog (scan_print_id, projectid, userid, customerid, rdate, work_hr, machine_hr, workdescription)
      VALUES 
      ($1, '0004_SUNP_001', $2, $3, '2026-10-18', '08:00:00', 8, 'VMC Roughing Cavity Inserts'),
      ($1, '0004_SUNP_001', $2, $3, '2026-10-19', '06:00:00', 6, 'VMC Semi-Finishing & Pocketing'),
      ($1, '0004_SUNP_001', $4, $3, '2026-10-24', '04:00:00', 4, 'Radial Drill & Tapping M12/M16')
    `, [m1Id, akshayUser.id, cust1.id, adminUser.id]);

    // Outward Jobwork Challan for Mould 1
    const ch1Res = await client.query(`
      INSERT INTO challan (challanno, chdate, customerid, vendorid, vendortid, projectid, status)
      VALUES ('SMJC22102026001', '2026-10-22', $1, $2, $2, '0004_SUNP_001', '1')
      RETURNING id
    `, [cust1.id, jobworkVendor.id]);
    await client.query(`
      INSERT INTO challan_items (challanid, plateid, customer, project, particulars, qty)
      VALUES ($1, $2, $3, '0004_SUNP_001', 'Core and Cavity Block set - Vacuum Hardening', 2)
    `, [ch1Res.rows[0].id, m1PlateIds[1], cust1.id]);

    // Dispatch Delivery Challan for Mould 1 (All 5 Plates Dispatched)
    const d1Res = await client.query(`
      INSERT INTO dispatch (
        challanno, chdate, customerid, vendortid, projectid, invoiceno, vehicleno, deliverytype, freightmode, freightcharge, status, noofcases
      ) VALUES (
        'SMDC29102026001', '2026-10-29', $1, $2, '0004_SUNP_001', 'STPL/2026/088', 'GJ03CU1839', 'Door Delivery', 'Paid', '1500', '1', '3'
      ) RETURNING id
    `, [cust1.id, transportVendor.id]);

    for (let i = 0; i < m1PlateIds.length; i++) {
      await client.query(`
        INSERT INTO dispatch_items (dispatchid, plateid, customer, project, particulars, condition, work, qty)
        VALUES ($1, $2, $3, '0004_SUNP_001', $4, 'FINISHED', 'NEW MADE', 1)
      `, [d1Res.rows[0].id, m1PlateIds[i], cust1.id, m1PlateNames[i]]);
    }

    // =========================================================================
    // MOULD 2: 0005_MRCL_001 (COMPLETED WITH PARTIAL DISPATCH: 3 DISP, 2 DIRECT CLOSE)
    // =========================================================================
    console.log('Inserting Mould 2: 0005_MRCL_001 (Completed with Partial Dispatch: 3 Dispatched, 2 Direct Closed)...');
    const m2Res = await client.query(`
      INSERT INTO scan (
        projectid, description, worktype, customer_id, cname, status,
        scan_by, qc_by, modeldesign_by, rdate, cdate, dispatchdate, scan_hr, model_hr, note
      ) VALUES (
        '0005_MRCL_001', '4-Cavity 500ml Wide-Mouth Jar Mould', 'Plastic', $1, $2, 'completed',
        $3, $3, $4, '2026-10-15', '2026-10-30', '2026-10-30', 22, 6,
        'Customer requested early delivery of primary plates. 2 spare inserts retained in-house as requested.'
      ) RETURNING id
    `, [cust2.id, cust2.customername, adminUser.id, designerUser.id]);
    const m2Id = m2Res.rows[0].id;

    // Subplates for Mould 2
    const m2PlatesData = [
      { name: 'Front Cavity Plate', loc: 'Customer', disp: 'dispatched', reason: null },
      { name: 'Rear Core Plate', loc: 'Customer', disp: 'dispatched', reason: null },
      { name: 'Stripper Ejection Plate', loc: 'Customer', disp: 'dispatched', reason: null },
      { name: 'Spare Cavity Insert Block', loc: 'SM', disp: 'closed_without_challan', reason: 'Customer Cancelled / Return - Client deferred spare insert' },
      { name: 'Backup Core Pin Set', loc: 'SM', disp: 'closed_without_challan', reason: 'Kept In-House / Spare Tooling - Stored in Star Mould toolroom rack B3' },
    ];
    const m2PlateIds = [];
    for (let i = 0; i < m2PlatesData.length; i++) {
      const p = m2PlatesData[i];
      const pRes = await client.query(`
        INSERT INTO subplate (
          platename, projectid, subprojectid, mold_id, mold_code, shape,
          length, width, height, weight, unit, material, sqty, location,
          design_by, order_by, received_workby, received_qcby, vmc_workby, vmc_qcby, drilltap_workby, final_qcby, packing_workby,
          design_at, order_at, received_work_at, received_qc_at, vmc_work_at, vmc_qc_at, drilltap_at, final_qc_at, packing_at,
          dispatch_status, closure_reason, closed_at, closed_by
        ) VALUES (
          $1, '0005_MRCL_001', $2, $3, '0005_MRCL_001', 'Rectangle',
          400, 300, 60, 56.5, 'mm', 'H-13', 1, $4,
          $5, $5, $5, $5, $6, $5, $6, $5, $6,
          '2026-10-16 11:00:00+05:30', '2026-10-17 15:00:00+05:30', '2026-10-20 12:00:00+05:30',
          '2026-10-21 17:00:00+05:30', '2026-10-25 18:00:00+05:30', '2026-10-26 10:30:00+05:30',
          '2026-10-28 16:30:00+05:30', '2026-10-29 14:00:00+05:30', '2026-10-30 11:00:00+05:30',
          $7, $8, $9, $10
        ) RETURNING id
      `, [
        p.name,
        `0005_MRCL_001_00${i + 1}`,
        m2Id,
        p.loc,
        designerUser.id,
        akshayUser.id,
        p.disp,
        p.reason,
        p.reason ? '2026-10-30 14:30:00+05:30' : null,
        p.reason ? adminUser.id : null,
      ]);
      m2PlateIds.push(pRes.rows[0].id);
    }

    // Worklogs for Mould 2
    await client.query(`
      INSERT INTO worklog (scan_print_id, projectid, userid, customerid, rdate, work_hr, machine_hr, workdescription)
      VALUES 
      ($1, '0005_MRCL_001', $2, $3, '2026-10-22', '10:00:00', 10, '3D Cavity Profiling on Hartford VMC'),
      ($1, '0005_MRCL_001', $2, $3, '2026-10-23', '08:00:00', 8, '3D Core Finishing & Rib EDM Electrode'),
      ($1, '0005_MRCL_001', $4, $3, '2026-10-27', '04:00:00', 4, 'Cooling Line Deep Hole Drilling')
    `, [m2Id, akshayUser.id, cust2.id, adminUser.id]);

    // Dispatch Delivery Challan for Mould 2 (Only 3 Plates Dispatched)
    const d2Res = await client.query(`
      INSERT INTO dispatch (
        challanno, chdate, customerid, vendortid, projectid, invoiceno, vehicleno, deliverytype, freightmode, freightcharge, status, noofcases
      ) VALUES (
        'SMDC30102026002', '2026-10-30', $1, $2, '0005_MRCL_001', 'STPL/2026/091', 'MH04AB5512', 'Door Delivery', 'To Pay', '800', '1', '2'
      ) RETURNING id
    `, [cust2.id, transportVendor.id]);

    for (let i = 0; i < 3; i++) {
      await client.query(`
        INSERT INTO dispatch_items (dispatchid, plateid, customer, project, particulars, condition, work, qty)
        VALUES ($1, $2, $3, '0005_MRCL_001', $4, 'FINISHED', 'NEW MADE', 1)
      `, [d2Res.rows[0].id, m2PlateIds[i], cust2.id, m2PlatesData[i].name]);
    }

    // =========================================================================
    // MOULD 3: 0006_YSHL_001 (ACTIVE LIVE IN-PROGRESS - 6 SUBPLATES)
    // =========================================================================
    console.log('Inserting Mould 3: 0006_YSHL_001 (Active Live Pipeline - 6 Plates across varied stages)...');
    const m3Res = await client.query(`
      INSERT INTO scan (
        projectid, description, worktype, customer_id, cname, status,
        scan_by, qc_by, modeldesign_by, rdate, cdate, scan_hr, model_hr, note
      ) VALUES (
        '0006_YSHL_001', '16-Cavity Thermoforming Blister Tooling', 'Pulp', $1, $2, 'pending',
        $3, 0, $4, '2026-10-25', '2026-11-12', 12, 5,
        'High cavitation pulp thermoform tooling under active machining and floor progression.'
      ) RETURNING id
    `, [cust3.id, cust3.customername, adminUser.id, designerUser.id]);
    const m3Id = m3Res.rows[0].id;

    // Subplates for Mould 3 across varied stages
    const m3PlatesData = [
      {
        name: 'Main Vacuum Forming Base',
        design: designerUser.id, order: adminUser.id, recw: akshayUser.id, recqc: adminUser.id,
        vmcw: akshayUser.id, vmcqc: adminUser.id, drill: akshayUser.id, fqc: adminUser.id, pack: akshayUser.id,
        loc: 'SM',
      },
      {
        name: 'Upper Die Cutting Frame',
        design: designerUser.id, order: adminUser.id, recw: akshayUser.id, recqc: adminUser.id,
        vmcw: akshayUser.id, vmcqc: adminUser.id, drill: akshayUser.id, fqc: null, pack: null,
        loc: 'SM',
      },
      {
        name: 'Lower Vacuum Chamber Insert',
        design: designerUser.id, order: adminUser.id, recw: akshayUser.id, recqc: adminUser.id,
        vmcw: akshayUser.id, vmcqc: null, drill: null, fqc: null, pack: null,
        loc: 'SM',
      },
      {
        name: 'Side Guide Rail Set (Outward)',
        design: designerUser.id, order: adminUser.id, recw: akshayUser.id, recqc: null,
        vmcw: null, vmcqc: null, drill: null, fqc: null, pack: null,
        loc: jobworkVendor.vendor_name,
      },
      {
        name: 'Ejection Grid Plate',
        design: designerUser.id, order: adminUser.id, recw: null, recqc: null,
        vmcw: null, vmcqc: null, drill: null, fqc: null, pack: null,
        loc: 'SM',
      },
      {
        name: 'Mounting Flange Plate',
        design: designerUser.id, order: null, recw: null, recqc: null,
        vmcw: null, vmcqc: null, drill: null, fqc: null, pack: null,
        loc: 'SM',
      },
    ];

    const m3PlateIds = [];
    for (let i = 0; i < m3PlatesData.length; i++) {
      const p = m3PlatesData[i];
      const pRes = await client.query(`
        INSERT INTO subplate (
          platename, projectid, subprojectid, mold_id, mold_code, shape,
          length, width, height, weight, unit, material, sqty, location,
          design_by, order_by, received_workby, received_qcby, vmc_workby, vmc_qcby, drilltap_workby, final_qcby, packing_workby,
          design_at, order_at, received_work_at, received_qc_at, vmc_work_at, vmc_qc_at, drilltap_at, final_qc_at, packing_at
        ) VALUES (
          $1, '0006_YSHL_001', $2, $3, '0006_YSHL_001', 'Rectangle',
          500, 350, 40, 54.9, 'mm', 'Aluminium', 1, $4,
          $5, $6, $7, $8, $9, $10, $11, $12, $13,
          $14, $15, $16, $17, $18, $19, $20, $21, $22
        ) RETURNING id
      `, [
        p.name,
        `0006_YSHL_001_00${i + 1}`,
        m3Id,
        p.loc,
        p.design, p.order, p.recw, p.recqc, p.vmcw, p.vmcqc, p.drill, p.fqc, p.pack,
        p.design ? '2026-10-26 10:00:00+05:30' : null,
        p.order ? '2026-10-27 12:00:00+05:30' : null,
        p.recw ? '2026-10-28 14:00:00+05:30' : null,
        p.recqc ? '2026-10-28 17:00:00+05:30' : null,
        p.vmcw ? '2026-10-29 18:30:00+05:30' : null,
        p.vmcqc ? '2026-10-30 11:00:00+05:30' : null,
        p.drill ? '2026-10-30 16:00:00+05:30' : null,
        p.fqc ? '2026-10-31 10:00:00+05:30' : null,
        p.pack ? '2026-10-31 12:30:00+05:30' : null,
      ]);
      m3PlateIds.push(pRes.rows[0].id);
    }

    // Worklogs for Mould 3
    await client.query(`
      INSERT INTO worklog (scan_print_id, projectid, userid, customerid, rdate, work_hr, machine_hr, workdescription)
      VALUES 
      ($1, '0006_YSHL_001', $2, $3, '2026-10-28', '07:00:00', 7, 'Base Plate Roughing on BFW VMC'),
      ($1, '0006_YSHL_001', $2, $3, '2026-10-29', '05:00:00', 5, 'Vacuum Manifold Cavity 3D Surfacing')
    `, [m3Id, akshayUser.id, cust3.id]);

    // Outward Jobwork Challan for Mould 3 (Side Guide Rail Set)
    const ch3Res = await client.query(`
      INSERT INTO challan (challanno, chdate, customerid, vendorid, vendortid, projectid, status)
      VALUES ('SMJC29102026002', '2026-10-29', $1, $2, $2, '0006_YSHL_001', '1')
      RETURNING id
    `, [cust3.id, jobworkVendor.id]);
    await client.query(`
      INSERT INTO challan_items (challanid, plateid, customer, project, particulars, qty)
      VALUES ($1, $2, $3, '0006_YSHL_001', 'Guide Rail Bar Set - Surface Grinding & Hard Chrome', 1)
    `, [ch3Res.rows[0].id, m3PlateIds[3], cust3.id]);

    // Sync app_config in database to ensure nav_project_register is active and present in menu orders
    console.log('Syncing database app_config menu orders & permissions with nav_project_register...');
    const configRes = await client.query("SELECT key, value FROM app_config WHERE key IN ('role_permissions', 'role_menu_orders')");
    let currentPerms = {};
    let currentOrders = {};
    for (const r of configRes.rows) {
      if (r.key === 'role_permissions') currentPerms = r.value || {};
      if (r.key === 'role_menu_orders') currentOrders = r.value || {};
    }

    // Update permissions
    const allowedRoles = [0, 1, 2, 3, 4, 5, 6, 7, 9, 10];
    for (const rId of allowedRoles) {
      if (!currentPerms[rId]) currentPerms[rId] = {};
      currentPerms[rId].nav_project_register = true;
    }
    await client.query("UPDATE app_config SET value = $1 WHERE key = 'role_permissions'", [JSON.stringify(currentPerms)]);

    // Update menu orders
    for (const rId of allowedRoles) {
      const order = currentOrders[rId];
      if (Array.isArray(order) && !order.includes('nav_project_register')) {
        const scanIdx = order.indexOf('nav_scanning');
        if (scanIdx !== -1) {
          order.splice(scanIdx + 1, 0, 'nav_project_register');
        } else {
          order.push('nav_project_register');
        }
      }
    }
    await client.query("UPDATE app_config SET value = $1 WHERE key = 'role_menu_orders'", [JSON.stringify(currentOrders)]);
    console.log('Database app_config updated successfully with nav_project_register.');

    console.log('\n========================================');
    console.log('MOCK DATA SEEDING COMPLETE SUCCESSFULLY!');
    console.log('========================================');
    console.log('1. Mould 0004_SUNP_001: COMPLETED (5/5 Dispatched via SMDC29102026001)');
    console.log('2. Mould 0005_MRCL_001: COMPLETED (3 Dispatched via SMDC30102026002, 2 Closed Direct)');
    console.log('3. Mould 0006_YSHL_001: ACTIVE PIPELINE (6 Subplates in progress at various stages)');
  } catch (err) {
    console.error('Error seeding demo moulds:', err);
  } finally {
    await client.end();
  }
}

main();
