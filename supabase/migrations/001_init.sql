-- ==============================================================================
-- StarMould ERP - Phase 1 Migration: Supabase Schema, Views & RLS Policies
-- Target Database: PostgreSQL 15+ (Supabase)
-- Source: sm_prod_080723_280326_2pm_live.sql
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 0. EXTENSIONS & SCHEMA CONFIGURATION
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- CLEAN RE-CREATION: DROP EXISTING VIEWS & TABLES
-- ------------------------------------------------------------------------------
DROP VIEW IF EXISTS public.view_po_pending_outword_qty CASCADE;
DROP VIEW IF EXISTS public.view_po_pending_inward_qty CASCADE;
DROP VIEW IF EXISTS public.view_po_outword_items_qty CASCADE;
DROP VIEW IF EXISTS public.view_po_inward_items_qty CASCADE;
DROP VIEW IF EXISTS public.view_pending_outword_qty CASCADE;
DROP VIEW IF EXISTS public.view_pending_inward_qty CASCADE;
DROP VIEW IF EXISTS public.view_pending_dispatch_qty CASCADE;
DROP VIEW IF EXISTS public.view_outword_items_qty CASCADE;
DROP VIEW IF EXISTS public.view_inward_items_qty CASCADE;
DROP VIEW IF EXISTS public.view_dispatch_items_qty CASCADE;

DROP TABLE IF EXISTS public.scanning_models CASCADE;
DROP TABLE IF EXISTS public.print CASCADE;
DROP TABLE IF EXISTS public.gram_calc CASCADE;
DROP TABLE IF EXISTS public.expense CASCADE;
DROP TABLE IF EXISTS public.worklog CASCADE;
DROP TABLE IF EXISTS public.dispatch_items CASCADE;
DROP TABLE IF EXISTS public.dispatch CASCADE;
DROP TABLE IF EXISTS public.purchase_inward_items CASCADE;
DROP TABLE IF EXISTS public.po_inward CASCADE;
DROP TABLE IF EXISTS public.purchase_items CASCADE;
DROP TABLE IF EXISTS public.purchase CASCADE;
DROP TABLE IF EXISTS public.inward_items CASCADE;
DROP TABLE IF EXISTS public.inward CASCADE;
DROP TABLE IF EXISTS public.challan_items CASCADE;
DROP TABLE IF EXISTS public.challan CASCADE;
DROP TABLE IF EXISTS public.subplate CASCADE;
DROP TABLE IF EXISTS public.scan CASCADE;
DROP TABLE IF EXISTS public.customers CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.roles CASCADE;

-- ------------------------------------------------------------------------------
-- 1. ROLES & AUTH HELPER INFRASTRUCTURE
-- ------------------------------------------------------------------------------
-- Replaces old hardcoded role numbers ("0"=Admin, "1"=Manager, "2"=Supervisor, "3"=Designer, "4"=Worker/Machine)
CREATE TABLE IF NOT EXISTS public.roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,       -- 'admin', 'manager', 'supervisor', 'designer', 'worker'
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.roles (id, name, display_name, description) VALUES
(0, 'admin', 'Admin', 'Full administrative access across all modules and financial settings'),
(1, 'manager', 'Manager', 'Procurement, movement documents, dispatch, and reports access'),
(2, 'supervisor', 'Supervisor', 'Floor and workshop supervision, worklog, and QC approval'),
(3, 'designer', 'Designer', 'CAD/CAM design, plate programming, and scan assignments'),
(4, 'worker', 'Worker', 'Machine operator, workpiece progression, and personal worklog tracking')
ON CONFLICT (id) DO UPDATE 
SET name = EXCLUDED.name, 
    display_name = EXCLUDED.display_name, 
    description = EXCLUDED.description;

-- Reset sequence to ensure future insertions start properly
SELECT setval('roles_id_seq', (SELECT MAX(id) FROM public.roles));

-- ------------------------------------------------------------------------------
-- 2. CORE USERS & PROFILES TABLE
-- ------------------------------------------------------------------------------
-- Dropped plaintext 'password2' completely.
-- Integrates with Supabase Auth (auth_id UUID referencing auth.users.id).
CREATE TABLE IF NOT EXISTS public.users (
    id BIGSERIAL PRIMARY KEY,
    auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
    name VARCHAR(191) NOT NULL,
    email VARCHAR(191) NOT NULL UNIQUE,
    email_verified_at TIMESTAMPTZ,
    password_hash VARCHAR(255),               -- Retains existing $2y$10$... bcrypt hashes for migration
    role_id INT NOT NULL DEFAULT 4 REFERENCES public.roles(id),
    status INT NOT NULL DEFAULT 1,             -- 1: Active, 0: Inactive
    username VARCHAR(100) NOT NULL,
    initials VARCHAR(20) NOT NULL,
    usertype VARCHAR(50) NOT NULL DEFAULT 'User',      -- 'Admin', 'Manager', 'Supervisor', 'Designer', 'User'
    usersubtype VARCHAR(50) NOT NULL DEFAULT 'Skilled MP', -- 'Skilled MP', 'Machine', etc.
    remember_token VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    deleted_by BIGINT
);

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role_id ON public.users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON public.users(auth_id);

-- Helper function to fetch current authenticated user's role name
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS VARCHAR AS $$
    SELECT r.name 
    FROM public.users u
    JOIN public.roles r ON u.role_id = r.id
    WHERE u.auth_id = auth.uid() OR u.email = (auth.jwt() ->> 'email')
    LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper function to check if current authenticated user is an admin or manager
CREATE OR REPLACE FUNCTION public.is_admin_or_manager()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM public.users u
        WHERE (u.auth_id = auth.uid() OR u.email = (auth.jwt() ->> 'email'))
          AND u.role_id IN (0, 1)
          AND u.status = 1
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ------------------------------------------------------------------------------
-- 3. CUSTOMERS & VENDORS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customers (
    id SERIAL PRIMARY KEY,
    customername VARCHAR(255) NOT NULL,
    mobile VARCHAR(50),
    mobile1 VARCHAR(50),
    email VARCHAR(191),
    initials VARCHAR(50) NOT NULL,
    address TEXT,
    usertype VARCHAR(50) NOT NULL,            -- 'Customer', 'Vendor', 'Transporter'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by INT NOT NULL DEFAULT 0,
    deleted_at TIMESTAMPTZ,
    deleted_by INT
);

CREATE INDEX IF NOT EXISTS idx_customers_usertype ON public.customers(usertype);
CREATE INDEX IF NOT EXISTS idx_customers_customername ON public.customers(customername);

-- ------------------------------------------------------------------------------
-- 4. SCANNING & PROJECT MASTER TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.scan (
    id SERIAL PRIMARY KEY,
    rdate DATE NOT NULL,
    cdate DATE NOT NULL,
    dispatchdate DATE NOT NULL DEFAULT CURRENT_DATE,
    cname TEXT NOT NULL,                      -- Customer ID or Name reference
    description TEXT NOT NULL,
    note TEXT,
    scan_by INT NOT NULL DEFAULT 0,
    qc_by INT DEFAULT 0,
    modeldesign_by INT NOT NULL DEFAULT 0,
    payment INT NOT NULL DEFAULT 0,
    mail_done INT DEFAULT 0,
    worktype VARCHAR(100),
    scan_hr INT DEFAULT 0,
    model_hr INT DEFAULT 0,
    sr_scanhr INT NOT NULL DEFAULT 0,
    sr_modelhr INT NOT NULL DEFAULT 0,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'pending', -- 'pending', 'registered', 'completed'
    projectid TEXT,
    subnote TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by INT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by INT
);

CREATE INDEX IF NOT EXISTS idx_scan_status ON public.scan(status);
CREATE INDEX IF NOT EXISTS idx_scan_projectid ON public.scan(projectid);

-- ------------------------------------------------------------------------------
-- 5. SUBPLATE (WORKPIECES & MOULD COMPONENTS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subplate (
    id SERIAL PRIMARY KEY,
    platename TEXT NOT NULL,
    projectid TEXT NOT NULL,                   -- Refers to scan project
    subprojectid VARCHAR(255),
    shape VARCHAR(100),
    width DOUBLE PRECISION,
    height DOUBLE PRECISION,
    length DOUBLE PRECISION,
    weight DOUBLE PRECISION,
    unit VARCHAR(50),
    material VARCHAR(100),
    sqty INT NOT NULL DEFAULT 1,
    photo TEXT,
    design_by INT,
    order_by INT,
    received_workby INT,
    received_qcby INT,
    vmc_workby INT,
    vmc_qcby INT,
    drilltap_workby INT,
    final_qcby INT,
    packing_workby INT,
    packing_photo TEXT,
    location VARCHAR(50) NOT NULL DEFAULT 'SM',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_subplate_projectid ON public.subplate(projectid);
CREATE INDEX IF NOT EXISTS idx_subplate_location ON public.subplate(location);

-- ------------------------------------------------------------------------------
-- 6. CHALLAN & CHALLAN ITEMS (OUTWARD MOVEMENT)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.challan (
    id SERIAL PRIMARY KEY,
    challanno TEXT NOT NULL,
    customerid INT NOT NULL,
    vendorid INT NOT NULL,
    vendortid INT NOT NULL,
    projectid TEXT,
    subprojectid INT DEFAULT 0,
    chdate DATE NOT NULL,
    status VARCHAR(2) NOT NULL DEFAULT '1',    -- '1': Active, '0': Inactive/Cancelled
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by INT
);

CREATE INDEX IF NOT EXISTS idx_challan_status ON public.challan(status);
CREATE INDEX IF NOT EXISTS idx_challan_challanno ON public.challan(challanno);

CREATE TABLE IF NOT EXISTS public.challan_items (
    id SERIAL PRIMARY KEY,
    challanid INT REFERENCES public.challan(id) ON DELETE CASCADE,
    plateid INT REFERENCES public.subplate(id) ON DELETE SET NULL,
    particulars TEXT,
    customer INT,
    project TEXT,
    qty INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_by INT
);

CREATE INDEX IF NOT EXISTS idx_challan_items_challanid ON public.challan_items(challanid);
CREATE INDEX IF NOT EXISTS idx_challan_items_plateid ON public.challan_items(plateid);

-- ------------------------------------------------------------------------------
-- 7. INWARD & INWARD ITEMS (RETURN FROM VENDOR/PROCESSING)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inward (
    id SERIAL PRIMARY KEY,
    challanid INT NOT NULL,
    inchallanno TEXT NOT NULL,
    customerid INT,
    vendorid INT,
    vendortid INT NOT NULL,
    projectid TEXT,
    subprojectid INT DEFAULT 0,
    chdate DATE,
    status VARCHAR(2) NOT NULL DEFAULT '1',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by INT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by INT
);

CREATE INDEX IF NOT EXISTS idx_inward_challanid ON public.inward(challanid);
CREATE INDEX IF NOT EXISTS idx_inward_status ON public.inward(status);

CREATE TABLE IF NOT EXISTS public.inward_items (
    id SERIAL PRIMARY KEY,
    challanid INT,
    inchallanid INT REFERENCES public.inward(id) ON DELETE CASCADE,
    plateid INT REFERENCES public.subplate(id) ON DELETE SET NULL,
    particulars TEXT,
    customer INT,
    project TEXT,
    cdescription TEXT,
    qty INT DEFAULT 0,
    inward_qty INT DEFAULT 0,
    pending_qty INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inward_items_inchallanid ON public.inward_items(inchallanid);
CREATE INDEX IF NOT EXISTS idx_inward_items_plateid ON public.inward_items(plateid);
CREATE INDEX IF NOT EXISTS idx_inward_items_challanid ON public.inward_items(challanid);

-- ------------------------------------------------------------------------------
-- 8. PURCHASE & PURCHASE ITEMS (PROCUREMENT ORDERS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.purchase (
    id SERIAL PRIMARY KEY,
    srno TEXT NOT NULL,
    purchaseid INT NOT NULL DEFAULT 0,
    pno TEXT,
    vname INT NOT NULL,                        -- Vendor customer ID
    cname INT NOT NULL,                        -- Client/Customer ID
    odate DATE NOT NULL,
    projectid TEXT NOT NULL,
    idate DATE,
    imaterial TEXT,
    status VARCHAR(2) NOT NULL DEFAULT '1',    -- '1': Active, '0': Inactive
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchase_status ON public.purchase(status);
CREATE INDEX IF NOT EXISTS idx_purchase_projectid ON public.purchase(projectid);

CREATE TABLE IF NOT EXISTS public.purchase_items (
    id SERIAL PRIMARY KEY,
    pid INT NOT NULL REFERENCES public.purchase(id) ON DELETE CASCADE,
    plateid INT NOT NULL REFERENCES public.subplate(id) ON DELETE CASCADE,
    material TEXT NOT NULL,
    materialtype TEXT NOT NULL,
    qty INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchase_items_pid ON public.purchase_items(pid);
CREATE INDEX IF NOT EXISTS idx_purchase_items_plateid ON public.purchase_items(plateid);

-- ------------------------------------------------------------------------------
-- 9. PO INWARD & PURCHASE INWARD ITEMS (RECEIVING RAW MATERIAL)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.po_inward (
    id SERIAL PRIMARY KEY,
    pid INT NOT NULL,                          -- Original purchase order ID
    insrno TEXT NOT NULL,
    inpono TEXT,
    cname INT NOT NULL,
    vname INT,
    projectid TEXT,
    subprojectid INT DEFAULT 0,
    odate DATE,
    status VARCHAR(2) NOT NULL DEFAULT '1',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by INT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by INT
);

CREATE INDEX IF NOT EXISTS idx_po_inward_pid ON public.po_inward(pid);
CREATE INDEX IF NOT EXISTS idx_po_inward_status ON public.po_inward(status);

CREATE TABLE IF NOT EXISTS public.purchase_inward_items (
    id SERIAL PRIMARY KEY,
    pid INT,                                   -- Purchase ID
    inpid INT REFERENCES public.po_inward(id) ON DELETE CASCADE,
    plateid INT REFERENCES public.subplate(id) ON DELETE SET NULL,
    imaterial TEXT NOT NULL,
    material TEXT,
    materialtype TEXT,
    qty INT DEFAULT 0,
    inward_qty INT DEFAULT 0,
    pending_qty INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchase_inward_items_inpid ON public.purchase_inward_items(inpid);
CREATE INDEX IF NOT EXISTS idx_purchase_inward_items_plateid ON public.purchase_inward_items(plateid);

-- ------------------------------------------------------------------------------
-- 10. DISPATCH & DISPATCH ITEMS (FINISHED MOULD / GOODS DELIVERY)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dispatch (
    id SERIAL PRIMARY KEY,
    challanno TEXT NOT NULL,
    customerid INT NOT NULL,
    vendorid INT,
    vendortid INT NOT NULL,
    projectid TEXT,
    subprojectid INT DEFAULT 0,
    chdate DATE NOT NULL,
    invoiceno TEXT NOT NULL,
    vehicleno TEXT NOT NULL,
    deliverytype TEXT NOT NULL,
    freightmode TEXT NOT NULL,
    freightcharge TEXT NOT NULL,
    noofcases TEXT NOT NULL,
    status VARCHAR(2) NOT NULL DEFAULT '1',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by INT
);

CREATE INDEX IF NOT EXISTS idx_dispatch_status ON public.dispatch(status);

CREATE TABLE IF NOT EXISTS public.dispatch_items (
    id SERIAL PRIMARY KEY,
    dispatchid INT REFERENCES public.dispatch(id) ON DELETE CASCADE,
    plateid INT REFERENCES public.subplate(id) ON DELETE SET NULL,
    custom_plate_name VARCHAR(250),
    custom_plate_qty INT DEFAULT 0,
    particulars TEXT,
    condition TEXT,
    work TEXT,
    customer INT,
    project TEXT,
    qty INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_by INT
);

CREATE INDEX IF NOT EXISTS idx_dispatch_items_dispatchid ON public.dispatch_items(dispatchid);
CREATE INDEX IF NOT EXISTS idx_dispatch_items_plateid ON public.dispatch_items(plateid);

-- ------------------------------------------------------------------------------
-- 11. WORKLOG (LABOR / MACHINE HOURLY TRACKING)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.worklog (
    id SERIAL PRIMARY KEY,
    scan_print_id INT NOT NULL DEFAULT 0,
    customerid INT NOT NULL DEFAULT 0,
    projectid VARCHAR(50) NOT NULL,
    subplateid TEXT,
    work_hr TIME DEFAULT '00:00:00',
    sdate DATE,
    edate DATE,
    starttime TIME NOT NULL DEFAULT '00:00:00',
    endtime TIME NOT NULL DEFAULT '00:00:00',
    workdescription TEXT NOT NULL,
    design_hr DOUBLE PRECISION DEFAULT 0,
    program_hr DOUBLE PRECISION DEFAULT 0,
    machine_hr DOUBLE PRECISION DEFAULT 0,
    driltap_hr DOUBLE PRECISION DEFAULT 0,
    qc_hr DOUBLE PRECISION DEFAULT 0,
    userid INT NOT NULL,
    rdate DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_worklog_userid ON public.worklog(userid);
CREATE INDEX IF NOT EXISTS idx_worklog_projectid ON public.worklog(projectid);
CREATE INDEX IF NOT EXISTS idx_worklog_rdate ON public.worklog(rdate);

-- ------------------------------------------------------------------------------
-- 12. EXPENSE / FINANCIAL ENTRIES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.expense (
    id SERIAL PRIMARY KEY,
    customerid INT NOT NULL,
    description TEXT NOT NULL,
    payment_mode VARCHAR(50),
    payment_type VARCHAR(50),
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
    rdate DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expense_customerid ON public.expense(customerid);
CREATE INDEX IF NOT EXISTS idx_expense_rdate ON public.expense(rdate);

-- ------------------------------------------------------------------------------
-- 13. MATERIAL & PRINT MASTER DATA
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gram_calc (
    id SERIAL PRIMARY KEY,
    fix NUMERIC(12, 2) NOT NULL DEFAULT 0,
    multiply NUMERIC(12, 2) NOT NULL DEFAULT 0,
    lessthan NUMERIC(12, 2) NOT NULL DEFAULT 0,
    graterthan NUMERIC(12, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.print (
    id SERIAL PRIMARY KEY,
    cname INT,
    tdate DATE,
    cdate DATE,
    gram NUMERIC(12, 2) DEFAULT 0,
    hr NUMERIC(12, 2) DEFAULT 0,
    print_by INT DEFAULT 0,
    pr_printhr INT DEFAULT 0,
    ramount NUMERIC(12, 2) DEFAULT 0,
    dispatch INT DEFAULT 0,
    qc_by INT DEFAULT 0,
    payment INT DEFAULT 0,
    projectid VARCHAR(100),
    description TEXT,
    amount NUMERIC(12, 2) DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by INT
);

CREATE TABLE IF NOT EXISTS public.scanning_models (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 14. POSTGRES VIEWS (ALL 10 PENDING QUANTITY & SUMMARY VIEWS)
-- ------------------------------------------------------------------------------

-- 1. view_dispatch_items_qty
CREATE OR REPLACE VIEW public.view_dispatch_items_qty AS
SELECT 
    di.plateid AS plateid,
    COALESCE(SUM(di.qty), 0) AS qty,
    di.project AS projectid
FROM public.dispatch_items di
JOIN public.dispatch d ON di.dispatchid = d.id
WHERE d.status = '1'
GROUP BY di.plateid, di.project;

-- 2. view_inward_items_qty
CREATE OR REPLACE VIEW public.view_inward_items_qty AS
SELECT 
    ii.challanid AS challanid,
    ii.plateid AS plateid,
    ii.particulars AS particulars,
    COALESCE(SUM(ii.inward_qty), 0) AS inward_qty
FROM public.inward_items ii
GROUP BY ii.challanid, ii.plateid, ii.particulars;

-- 3. view_outword_items_qty
CREATE OR REPLACE VIEW public.view_outword_items_qty AS
SELECT 
    ci.plateid AS plateid,
    COALESCE(SUM(ci.qty), 0) AS qty,
    ci.project AS projectid
FROM public.challan_items ci
JOIN public.challan c ON ci.challanid = c.id
WHERE c.status = '1'
GROUP BY ci.plateid, ci.project;

-- 4. view_pending_dispatch_qty
CREATE OR REPLACE VIEW public.view_pending_dispatch_qty AS
SELECT 
    sp.projectid AS projectid,
    sc.projectid AS projectname,
    sp.id AS plateid,
    sp.platename AS platename,
    COALESCE(sp.sqty, 0) AS sqty,
    COALESCE(sp.sqty, 0) - COALESCE(vdi.qty, 0) AS pqty,
    COALESCE(vdi.qty, 0) AS oqty
FROM public.subplate sp
LEFT JOIN public.view_dispatch_items_qty vdi ON sp.id = vdi.plateid
JOIN public.scan sc ON (sp.projectid = sc.id::text OR sp.projectid = sc.projectid)
WHERE sc.status <> 'completed'
  AND sp.design_by IS NOT NULL
  AND sp.order_by IS NOT NULL
  AND sp.received_workby IS NOT NULL
  AND sp.received_qcby IS NOT NULL
  AND sp.vmc_workby IS NOT NULL
  AND sp.vmc_qcby IS NOT NULL
  AND sp.drilltap_workby IS NOT NULL
  AND sp.final_qcby IS NOT NULL
  AND sp.packing_workby IS NOT NULL
  AND sp.location = 'SM';

-- 5. view_pending_inward_qty
CREATE OR REPLACE VIEW public.view_pending_inward_qty AS
SELECT 
    c.id AS id,
    (SELECT customername FROM public.customers WHERE customers.id = ci.customer) AS customername,
    (SELECT customername FROM public.customers WHERE customers.id = c.vendorid) AS vendorname,
    (SELECT customername FROM public.customers WHERE customers.id = c.vendortid) AS transportername,
    c.vendorid AS vendorid,
    ci.customer AS customer,
    c.challanno AS challanno,
    c.vendortid AS vendortid,
    ci.project AS projectid,
    c.created_by AS created_by,
    c.chdate AS chdate,
    ci.plateid AS plateid,
    ci.particulars AS particulars,
    ci.qty AS qty,
    COALESCE(vii.inward_qty, 0) AS inward_qty,
    COALESCE(ci.qty, 0) - COALESCE(vii.inward_qty, 0) AS pending_qty,
    sp.platename AS platename
FROM public.challan c
JOIN public.challan_items ci ON c.id = ci.challanid
LEFT JOIN public.view_inward_items_qty vii ON (
    ci.plateid = vii.plateid 
    AND ci.particulars = vii.particulars 
    AND c.id = vii.challanid
)
JOIN public.subplate sp ON ci.plateid = sp.id
WHERE c.status = '1';

-- 6. view_pending_outword_qty
CREATE OR REPLACE VIEW public.view_pending_outword_qty AS
SELECT 
    sp.projectid AS projectid,
    sc.projectid AS projectname,
    sp.id AS plateid,
    sp.platename AS platename,
    COALESCE(sp.sqty, 0) AS sqty,
    COALESCE(sp.sqty, 0) - COALESCE(voi.qty, 0) + COALESCE((
        SELECT SUM(vii.inward_qty)
        FROM public.view_inward_items_qty vii
        WHERE sp.id = vii.plateid
    ), 0) AS pqty,
    COALESCE(voi.qty, 0) AS oqty
FROM public.subplate sp
LEFT JOIN public.view_outword_items_qty voi ON sp.id = voi.plateid
JOIN public.scan sc ON (sp.projectid = sc.id::text OR sp.projectid = sc.projectid)
WHERE sc.status <> 'completed';

-- 7. view_po_inward_items_qty
CREATE OR REPLACE VIEW public.view_po_inward_items_qty AS
SELECT 
    pii.pid AS pid,
    pii.plateid AS plateid,
    pii.material AS material,
    pii.materialtype AS materialtype,
    COALESCE(SUM(pii.inward_qty), 0) AS inward_qty
FROM public.purchase_inward_items pii
GROUP BY pii.pid, pii.plateid, pii.material, pii.materialtype;

-- 8. view_po_outword_items_qty
CREATE OR REPLACE VIEW public.view_po_outword_items_qty AS
SELECT 
    pi.plateid AS plateid,
    COALESCE(SUM(pi.qty), 0) AS qty,
    p.projectid AS projectid
FROM public.purchase_items pi
JOIN public.purchase p ON pi.pid = p.id
WHERE p.status = '1'
GROUP BY pi.plateid, p.projectid;

-- 9. view_po_pending_inward_qty
CREATE OR REPLACE VIEW public.view_po_pending_inward_qty AS
SELECT 
    p.id AS id,
    (SELECT customername FROM public.customers WHERE customers.id = p.cname) AS customername,
    (SELECT customername FROM public.customers WHERE customers.id = p.vname) AS vendorname,
    p.vname AS vname,
    p.cname AS cname,
    p.srno AS srno,
    p.pno AS pno,
    p.projectid AS projectid,
    p.odate AS odate,
    pi.plateid AS plateid,
    pi.material AS material,
    pi.materialtype AS materialtype,
    pi.qty AS qty,
    COALESCE(vpi.inward_qty, 0) AS inward_qty,
    COALESCE(pi.qty, 0) - COALESCE(vpi.inward_qty, 0) AS pending_qty,
    sp.platename AS platename
FROM public.purchase p
JOIN public.purchase_items pi ON p.id = pi.pid
LEFT JOIN public.view_po_inward_items_qty vpi ON (
    pi.plateid = vpi.plateid 
    AND pi.material = vpi.material 
    AND pi.materialtype = vpi.materialtype 
    AND p.id = vpi.pid
)
JOIN public.subplate sp ON pi.plateid = sp.id
WHERE p.status = '1';

-- 10. view_po_pending_outword_qty
CREATE OR REPLACE VIEW public.view_po_pending_outword_qty AS
SELECT 
    sp.projectid AS projectid,
    sc.projectid AS projectname,
    sp.id AS plateid,
    sp.platename AS platename,
    sp.unit AS unit,
    sp.material AS material,
    sp.length AS length,
    sp.width AS width,
    sp.height AS height,
    COALESCE(sp.sqty, 0) AS sqty,
    COALESCE(sp.sqty, 0) - COALESCE(vpo.qty, 0) + COALESCE((
        SELECT SUM(vpi.inward_qty)
        FROM public.view_po_inward_items_qty vpi
        WHERE sp.id = vpi.plateid
    ), 0) AS pqty,
    COALESCE(vpo.qty, 0) AS oqty
FROM public.subplate sp
LEFT JOIN public.view_po_outword_items_qty vpo ON sp.id = vpo.plateid
JOIN public.scan sc ON (sp.projectid = sc.id::text OR sp.projectid = sc.projectid)
WHERE sc.status <> 'completed';

-- ------------------------------------------------------------------------------
-- 15. AUTOMATIC TIMESTAMP UPDATE TRIGGER
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
    t text;
BEGIN
    FOR t IN 
        SELECT table_name 
        FROM information_schema.columns 
        WHERE column_name = 'updated_at' 
          AND table_schema = 'public' 
          AND table_name NOT IN ('view_dispatch_items_qty', 'view_inward_items_qty', 'view_outword_items_qty', 'view_pending_dispatch_qty', 'view_pending_inward_qty', 'view_pending_outword_qty', 'view_po_inward_items_qty', 'view_po_outword_items_qty', 'view_po_pending_inward_qty', 'view_po_pending_outword_qty')
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trigger_updated_at_%I ON public.%I', t, t);
        EXECUTE format('CREATE TRIGGER trigger_updated_at_%I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at()', t, t);
    END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- 16. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------
-- Enable RLS on every table
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subplate ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inward ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inward_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.po_inward ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_inward_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worklog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gram_calc ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.print ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scanning_models ENABLE ROW LEVEL SECURITY;

-- Policy: Roles Table (Read by all authenticated users, manage by Admin)
CREATE POLICY "Roles are viewable by authenticated users" 
ON public.roles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Roles manageable only by admin" 
ON public.roles FOR ALL TO authenticated 
USING (public.get_auth_role() = 'admin')
WITH CHECK (public.get_auth_role() = 'admin');

-- Policy: Users / Profiles Table
CREATE POLICY "Users viewable by authenticated users" 
ON public.users FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile" 
ON public.users FOR UPDATE TO authenticated 
USING (auth_id = auth.uid() OR public.is_admin_or_manager())
WITH CHECK (auth_id = auth.uid() OR public.is_admin_or_manager());

CREATE POLICY "Users insert/delete only by admin" 
ON public.users FOR ALL TO authenticated 
USING (public.get_auth_role() = 'admin')
WITH CHECK (public.get_auth_role() = 'admin');

-- Policy: Customers & Vendors
CREATE POLICY "Customers viewable by authenticated users" 
ON public.customers FOR SELECT TO authenticated USING (true);

CREATE POLICY "Customers manageable by admin and managers" 
ON public.customers FOR ALL TO authenticated 
USING (public.is_admin_or_manager())
WITH CHECK (public.is_admin_or_manager());

-- Policy: Scan / Projects
CREATE POLICY "Scan viewable by authenticated users" 
ON public.scan FOR SELECT TO authenticated USING (true);

CREATE POLICY "Scan creatable and updatable by authenticated users" 
ON public.scan FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Scan updatable by authenticated users" 
ON public.scan FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Scan delete only by admin" 
ON public.scan FOR DELETE TO authenticated 
USING (public.get_auth_role() = 'admin');

-- Policy: Subplate
CREATE POLICY "Subplate viewable by authenticated users" 
ON public.subplate FOR SELECT TO authenticated USING (true);

CREATE POLICY "Subplate insert/update by authenticated users" 
ON public.subplate FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Subplate update by authenticated users" 
ON public.subplate FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Subplate delete only by admin" 
ON public.subplate FOR DELETE TO authenticated 
USING (public.get_auth_role() = 'admin');

-- Policy: Challan & Challan Items
CREATE POLICY "Challan viewable by authenticated users" 
ON public.challan FOR SELECT TO authenticated USING (true);

CREATE POLICY "Challan manageable by admin and managers" 
ON public.challan FOR ALL TO authenticated 
USING (public.is_admin_or_manager())
WITH CHECK (public.is_admin_or_manager());

CREATE POLICY "Challan items viewable by authenticated users" 
ON public.challan_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "Challan items manageable by admin and managers" 
ON public.challan_items FOR ALL TO authenticated 
USING (public.is_admin_or_manager())
WITH CHECK (public.is_admin_or_manager());

-- Policy: Inward & Inward Items
CREATE POLICY "Inward viewable by authenticated users" 
ON public.inward FOR SELECT TO authenticated USING (true);

CREATE POLICY "Inward manageable by admin and managers" 
ON public.inward FOR ALL TO authenticated 
USING (public.is_admin_or_manager())
WITH CHECK (public.is_admin_or_manager());

CREATE POLICY "Inward items viewable by authenticated users" 
ON public.inward_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "Inward items manageable by admin and managers" 
ON public.inward_items FOR ALL TO authenticated 
USING (public.is_admin_or_manager())
WITH CHECK (public.is_admin_or_manager());

-- Policy: Purchase & Purchase Items
CREATE POLICY "Purchase viewable by authenticated users" 
ON public.purchase FOR SELECT TO authenticated USING (true);

CREATE POLICY "Purchase manageable by admin and managers" 
ON public.purchase FOR ALL TO authenticated 
USING (public.is_admin_or_manager())
WITH CHECK (public.is_admin_or_manager());

CREATE POLICY "Purchase items viewable by authenticated users" 
ON public.purchase_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "Purchase items manageable by admin and managers" 
ON public.purchase_items FOR ALL TO authenticated 
USING (public.is_admin_or_manager())
WITH CHECK (public.is_admin_or_manager());

-- Policy: PO Inward & Purchase Inward Items
CREATE POLICY "PO Inward viewable by authenticated users" 
ON public.po_inward FOR SELECT TO authenticated USING (true);

CREATE POLICY "PO Inward manageable by admin and managers" 
ON public.po_inward FOR ALL TO authenticated 
USING (public.is_admin_or_manager())
WITH CHECK (public.is_admin_or_manager());

CREATE POLICY "Purchase inward items viewable by authenticated users" 
ON public.purchase_inward_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "Purchase inward items manageable by admin and managers" 
ON public.purchase_inward_items FOR ALL TO authenticated 
USING (public.is_admin_or_manager())
WITH CHECK (public.is_admin_or_manager());

-- Policy: Dispatch & Dispatch Items
CREATE POLICY "Dispatch viewable by authenticated users" 
ON public.dispatch FOR SELECT TO authenticated USING (true);

CREATE POLICY "Dispatch manageable by admin and managers" 
ON public.dispatch FOR ALL TO authenticated 
USING (public.is_admin_or_manager())
WITH CHECK (public.is_admin_or_manager());

CREATE POLICY "Dispatch items viewable by authenticated users" 
ON public.dispatch_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "Dispatch items manageable by admin and managers" 
ON public.dispatch_items FOR ALL TO authenticated 
USING (public.is_admin_or_manager())
WITH CHECK (public.is_admin_or_manager());

-- Policy: Worklog
CREATE POLICY "Worklog viewable by authenticated users" 
ON public.worklog FOR SELECT TO authenticated USING (true);

CREATE POLICY "Workers can insert and update their own worklogs" 
ON public.worklog FOR INSERT TO authenticated 
WITH CHECK (true);

CREATE POLICY "Workers can update own worklog, managers/admin update any" 
ON public.worklog FOR UPDATE TO authenticated 
USING (
    public.is_admin_or_manager() OR 
    userid IN (SELECT id FROM public.users WHERE auth_id = auth.uid() OR email = (auth.jwt() ->> 'email'))
)
WITH CHECK (
    public.is_admin_or_manager() OR 
    userid IN (SELECT id FROM public.users WHERE auth_id = auth.uid() OR email = (auth.jwt() ->> 'email'))
);

CREATE POLICY "Worklog delete only by admin" 
ON public.worklog FOR DELETE TO authenticated 
USING (public.get_auth_role() = 'admin');

-- Policy: Expense
CREATE POLICY "Expense accessible only by admin and managers" 
ON public.expense FOR ALL TO authenticated 
USING (public.is_admin_or_manager())
WITH CHECK (public.is_admin_or_manager());

-- Policy: Gram Calc & Print
CREATE POLICY "Gram Calc viewable by all, manageable by admin" 
ON public.gram_calc FOR SELECT TO authenticated USING (true);

CREATE POLICY "Gram Calc update only by admin" 
ON public.gram_calc FOR ALL TO authenticated 
USING (public.get_auth_role() = 'admin')
WITH CHECK (public.get_auth_role() = 'admin');

CREATE POLICY "Print records viewable by authenticated users" 
ON public.print FOR SELECT TO authenticated USING (true);

CREATE POLICY "Print records insert/update by authenticated users" 
ON public.print FOR ALL TO authenticated 
USING (true)
WITH CHECK (true);

-- Policy: Scanning Models
CREATE POLICY "Scanning Models viewable by authenticated users" 
ON public.scanning_models FOR ALL TO authenticated 
USING (true)
WITH CHECK (true);
