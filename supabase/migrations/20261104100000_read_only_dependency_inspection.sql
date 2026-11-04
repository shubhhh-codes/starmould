CREATE OR REPLACE FUNCTION public.inspect_mould_project_dependencies(
    p_ids BIGINT[]
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

    RETURN jsonb_build_object(
      'success', true,
      'hasDependencies', v_dep_count > 0,
      'dependencyCount', v_dep_count,
      'dependencies', v_dependencies
    );
END;
$$ LANGUAGE plpgsql STABLE SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION public.inspect_mould_project_dependencies(BIGINT[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inspect_mould_project_dependencies(BIGINT[]) TO service_role;
REVOKE ALL ON FUNCTION public.delete_mould_projects_cascade(BIGINT[], BOOLEAN) FROM PUBLIC, anon, authenticated;
