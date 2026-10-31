-- ==============================================================================
-- Migration: Atomic Batch & Single Cascade Deletion RPC with Pre-Check
-- Date: 2026-10-31
-- Description:
--   Creates PostgreSQL stored procedure `public.delete_mould_projects_cascade`
--   which performs atomic (all-or-nothing) inspection and cascading deletion
--   of mould projects, their linked challans, dispatches, purchase orders,
--   child subplates, and operator worklogs.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.delete_mould_projects_cascade(
    p_ids BIGINT[],
    p_force BOOLEAN DEFAULT FALSE
)
RETURNS JSONB AS $$
DECLARE
    v_project_codes TEXT[];
    v_dependencies JSONB := '[]'::JSONB;
    v_dep_count INT := 0;
    v_deleted_count INT := 0;
    r RECORD;
BEGIN
    -- 1. Gather project codes for all requested mould IDs
    SELECT array_agg(projectid) INTO v_project_codes
    FROM public.scan
    WHERE id = ANY(p_ids) AND projectid IS NOT NULL;

    -- 2. Inspect active dependencies (Challans, POs, Dispatches)
    FOR r IN (
        SELECT 
            sc.id,
            sc.projectid,
            sc.description,
            (SELECT count(*) FROM public.subplate sp WHERE sp.mold_id = sc.id OR sp.projectid = sc.projectid) AS subplate_count,
            COALESCE((
                SELECT jsonb_agg(jsonb_build_object('id', ch.id, 'challanno', ch.challanno))
                FROM public.challan ch
                WHERE (ch.projectid = sc.projectid OR ch.projectid = sc.id::text) AND ch.status != '0'
            ), '[]'::jsonb) AS active_challans,
            COALESCE((
                SELECT jsonb_agg(jsonb_build_object('id', po.id, 'srno', po.srno))
                FROM public.purchase po
                WHERE (po.projectid = sc.projectid OR po.projectid = sc.id::text) AND po.status != '0'
            ), '[]'::jsonb) AS active_pos,
            COALESCE((
                SELECT jsonb_agg(jsonb_build_object('id', dp.id, 'challanno', dp.challanno))
                FROM public.dispatch dp
                WHERE (dp.projectid = sc.projectid OR dp.projectid = sc.id::text) AND dp.status != '0'
            ), '[]'::jsonb) AS active_dispatches
        FROM public.scan sc
        WHERE sc.id = ANY(p_ids)
    ) LOOP
        DECLARE
            has_deps BOOLEAN := false;
            c_len INT := jsonb_array_length(r.active_challans);
            p_len INT := jsonb_array_length(r.active_pos);
            d_len INT := jsonb_array_length(r.active_dispatches);
        BEGIN
            IF c_len > 0 OR p_len > 0 OR d_len > 0 THEN
                has_deps := true;
                v_dep_count := v_dep_count + c_len + p_len + d_len;
            END IF;

            v_dependencies := v_dependencies || jsonb_build_object(
                'id', r.id,
                'projectid', r.projectid,
                'description', r.description,
                'subplate_count', r.subplate_count,
                'active_challans', r.active_challans,
                'active_pos', r.active_pos,
                'active_dispatches', r.active_dispatches,
                'has_dependencies', has_deps
            );
        END;
    END LOOP;

    -- 3. If NOT force and dependencies exist, stop and return details without deleting
    IF NOT p_force AND v_dep_count > 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'blocked', true,
            'dependency_count', v_dep_count,
            'dependencies', v_dependencies
        );
    END IF;

    -- 4. FORCE DELETE OR CLEAN DELETE: Execute in atomic transaction
    IF v_project_codes IS NOT NULL AND array_length(v_project_codes, 1) > 0 THEN
        -- Delete Challan items & Challans
        DELETE FROM public.challan_items ci
        WHERE ci.project = ANY(v_project_codes) 
           OR ci.challanid IN (SELECT id FROM public.challan WHERE projectid = ANY(v_project_codes));

        DELETE FROM public.challan
        WHERE projectid = ANY(v_project_codes);

        -- Delete Dispatch items & Dispatches
        DELETE FROM public.dispatch_items di
        WHERE di.project = ANY(v_project_codes) 
           OR di.dispatchid IN (SELECT id FROM public.dispatch WHERE projectid = ANY(v_project_codes));

        DELETE FROM public.dispatch
        WHERE projectid = ANY(v_project_codes);

        -- Delete Purchase items & Purchases
        DELETE FROM public.purchase_items pi
        WHERE pi.pid IN (SELECT id FROM public.purchase WHERE projectid = ANY(v_project_codes));

        DELETE FROM public.purchase
        WHERE projectid = ANY(v_project_codes);
    END IF;

    -- Delete Subplates & Worklogs (also protected by cascade triggers)
    DELETE FROM public.worklog
    WHERE scan_print_id = ANY(p_ids)
       OR (v_project_codes IS NOT NULL AND projectid = ANY(v_project_codes));

    DELETE FROM public.subplate
    WHERE mold_id = ANY(p_ids)
       OR (v_project_codes IS NOT NULL AND (mold_code = ANY(v_project_codes) OR projectid = ANY(v_project_codes)));

    -- Finally delete from scan table
    DELETE FROM public.scan
    WHERE id = ANY(p_ids);
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    RETURN jsonb_build_object(
        'success', true,
        'blocked', false,
        'deleted_count', v_deleted_count,
        'dependency_count', v_dep_count,
        'dependencies', v_dependencies
    );
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.delete_mould_projects_cascade(BIGINT[], BOOLEAN) TO authenticated, service_role;
