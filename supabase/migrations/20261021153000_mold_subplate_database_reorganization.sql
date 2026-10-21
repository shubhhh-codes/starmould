-- Migration 013: Mold & Subplate Database Reorganization & Master Views
-- Version: 2.0 (Dual Reference + Auto Categorization + Master Views)

-- 1. Add new columns to subplate
ALTER TABLE public.subplate
    ADD COLUMN IF NOT EXISTS plate_category VARCHAR(100) DEFAULT 'General Component',
    ADD COLUMN IF NOT EXISTS mold_id INT,
    ADD COLUMN IF NOT EXISTS mold_code VARCHAR(100);

-- 2. Backfill mold_id and mold_code from scan table
-- Exact match by numeric scan id
UPDATE public.subplate sp
SET 
    mold_id = sc.id,
    mold_code = sc.projectid
FROM public.scan sc
WHERE sp.projectid ~ '^[0-9]+$' AND sp.projectid::bigint = sc.id;

-- Exact match by project code string
UPDATE public.subplate sp
SET 
    mold_id = sc.id,
    mold_code = sc.projectid
FROM public.scan sc
WHERE sp.mold_id IS NULL AND sp.projectid = sc.projectid;

-- Prefix match fallback (e.g. legacy test rows)
UPDATE public.subplate sp
SET 
    mold_id = sc.id,
    mold_code = sc.projectid
FROM public.scan sc
WHERE sp.mold_id IS NULL AND sc.projectid LIKE (sp.projectid || '_%');

-- 3. Auto-tag plate categories using intelligent pattern matching
UPDATE public.subplate
SET plate_category = CASE
    WHEN platename ~* '(core|cavity|kvt|insert|injetor|injector|forming|punch|parting|plug|cutting|blade|trimming)' 
        THEN 'Core & Cavity Inserts'
    WHEN platename ~* '(top|bottom|bottam|clamp|base|hotpress|press|spacer|bolster|support|mount|heater)' 
        THEN 'Base & Clamping Plates'
    WHEN platename ~* '(eject|ejection|pusher|return|knockout)' 
        THEN 'Ejection System'
    WHEN platename ~* '(slide|lifter|wedge|heel|cam)' 
        THEN 'Slides & Lifters'
    WHEN platename ~* '(guide|pillar|bush|dowel|interlock|wear|locating|lock|shaft|saft|kayda)' 
        THEN 'Guiding & Alignment'
    ELSE 'General Component'
END
WHERE plate_category IS NULL OR plate_category = 'General Component';

-- 4. Create performance indexes
CREATE INDEX IF NOT EXISTS idx_subplate_mold_id ON public.subplate(mold_id);
CREATE INDEX IF NOT EXISTS idx_subplate_mold_code ON public.subplate(mold_code);
CREATE INDEX IF NOT EXISTS idx_subplate_category ON public.subplate(plate_category);

-- 5. Master View 1: view_molds_overview (Mold level summary with progress)
CREATE OR REPLACE VIEW public.view_molds_overview WITH (security_invoker = true) AS
SELECT 
    sc.id AS mold_id,
    sc.projectid AS mold_code,
    sc.description AS mold_name,
    c.customername AS customer_name,
    c.initials AS customer_initials,
    sc.worktype AS work_type,
    sc.rdate AS order_date,
    sc.cdate AS target_date,
    sc.dispatchdate AS dispatch_date,
    sc.status AS status,
    COUNT(sp.id) AS total_subplates,
    COUNT(CASE WHEN sp.packing_workby IS NOT NULL AND sp.packing_workby > 0 THEN 1 END) AS completed_subplates,
    CASE 
        WHEN COUNT(sp.id) = 0 THEN 0
        ELSE ROUND((COUNT(CASE WHEN sp.packing_workby IS NOT NULL AND sp.packing_workby > 0 THEN 1 END)::numeric / COUNT(sp.id)::numeric) * 100, 1)
    END AS completion_percentage
FROM public.scan sc
LEFT JOIN public.customers c ON sc.cname = c.id::text OR sc.cname = c.customername
LEFT JOIN public.subplate sp ON (sp.mold_id = sc.id OR (sp.projectid ~ '^[0-9]+$' AND sp.projectid::bigint = sc.id) OR sp.projectid = sc.projectid) AND sp.deleted_at IS NULL
GROUP BY sc.id, sc.projectid, sc.description, c.customername, c.initials, sc.worktype, sc.rdate, sc.cdate, sc.dispatchdate, sc.status;

-- 6. Master View 2: view_subplates_detail (Detailed subplates grouped under mold)
CREATE OR REPLACE VIEW public.view_subplates_detail WITH (security_invoker = true) AS
SELECT 
    sp.id AS subplate_id,
    COALESCE(sp.mold_id, sc.id) AS mold_id,
    COALESCE(sp.mold_code, sc.projectid) AS mold_code,
    sc.description AS mold_name,
    c.customername AS customer_name,
    sp.subprojectid AS subplate_code,
    sp.platename AS plate_name,
    sp.plate_category AS category,
    sp.material AS material,
    sp.shape AS shape,
    CONCAT(COALESCE(sp.length, 0), ' x ', COALESCE(sp.width, 0), ' x ', COALESCE(sp.height, 0), ' ', COALESCE(sp.unit, 'mm')) AS dimensions,
    COALESCE(sp.weight, 0) AS weight_kg,
    sp.sqty AS ordered_qty,
    CASE 
        WHEN sp.packing_workby IS NOT NULL AND sp.packing_workby > 0 THEN '9. Packing Completed'
        WHEN sp.final_qcby IS NOT NULL AND sp.final_qcby > 0 THEN '8. Final QC'
        WHEN sp.drilltap_workby IS NOT NULL AND sp.drilltap_workby > 0 THEN '7. Drill & Tap'
        WHEN sp.vmc_qcby IS NOT NULL AND sp.vmc_qcby > 0 THEN '6. VMC QC'
        WHEN sp.vmc_workby IS NOT NULL AND sp.vmc_workby > 0 THEN '5. VMC Work'
        WHEN sp.received_qcby IS NOT NULL AND sp.received_qcby > 0 THEN '4. Programming'
        WHEN sp.received_workby IS NOT NULL AND sp.received_workby > 0 THEN '3. Material Inward'
        WHEN sp.order_by IS NOT NULL AND sp.order_by > 0 THEN '2. Purchase'
        WHEN sp.design_by IS NOT NULL AND sp.design_by > 0 THEN '1. Design'
        ELSE '0. Pending Design'
    END AS current_stage,
    CASE 
        WHEN sp.location = 'SM' OR sp.location IS NULL OR sp.location = '' THEN 'In-House (StarMould)'
        ELSE CONCAT('At Vendor (', sp.location, ')')
    END AS current_location
FROM public.subplate sp
LEFT JOIN public.scan sc ON (sp.mold_id = sc.id OR (sp.projectid ~ '^[0-9]+$' AND sp.projectid::bigint = sc.id) OR sp.projectid = sc.projectid)
LEFT JOIN public.customers c ON sc.cname = c.id::text OR sc.cname = c.customername
WHERE sp.deleted_at IS NULL;

-- 7. Permissions
GRANT SELECT ON public.view_molds_overview TO anon, authenticated, service_role;
GRANT SELECT ON public.view_subplates_detail TO anon, authenticated, service_role;
