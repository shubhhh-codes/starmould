import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { authenticateRequest } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();

    if (!q || q.length < 1) {
      return NextResponse.json({ results: [] });
    }

    const term = `%${q}%`;
    const num = Number(q);
    const isNum = !isNaN(num) && num > 0;

    // Run parallel searches with resilience (Promise.allSettled)
    const [
      scanRes,
      subplateRes,
      custRes,
      purchaseRes,
      challanRes,
      printRes,
    ] = await Promise.allSettled([
      // 1. Search Scan / Mould Projects (Orders)
      (async () => {
        let query = supabaseAdmin
          .from("scan")
          .select("id, projectid, description, status, worktype, cname, amount, rdate");
        
        if (isNum) {
          query = query.or(`id.eq.${num},projectid.ilike.${term},description.ilike.${term}`);
        } else {
          query = query.or(`projectid.ilike.${term},description.ilike.${term}`);
        }
        return query.limit(8);
      })(),

      // 2. Search Subplates
      (async () => {
        let query = supabaseAdmin
          .from("subplate")
          .select("id, platename, subprojectid, projectid, material, location, length, width, height, unit");

        if (isNum) {
          query = query.or(`id.eq.${num},platename.ilike.${term},subprojectid.ilike.${term},projectid.ilike.${term}`);
        } else {
          query = query.or(`platename.ilike.${term},subprojectid.ilike.${term},projectid.ilike.${term}`);
        }
        return query.limit(8);
      })(),

      // 3. Search Customers & Vendors
      (async () => {
        return supabaseAdmin
          .from("customers")
          .select("id, customername, initials, usertype, mobile, email")
          .or(`customername.ilike.${term},initials.ilike.${term}`)
          .limit(6);
      })(),

      // 4. Search Purchase Orders
      (async () => {
        let query = supabaseAdmin
          .from("purchase")
          .select("id, srno, pno, projectid, odate, status");

        if (isNum) {
          query = query.or(`id.eq.${num},srno.ilike.${term},projectid.ilike.${term}`);
        } else {
          query = query.or(`srno.ilike.${term},projectid.ilike.${term}`);
        }
        return query.limit(6);
      })(),

      // 5. Search Outward Challans
      (async () => {
        let query = supabaseAdmin
          .from("challan")
          .select("id, challanno, projectid, chdate, status");

        if (isNum) {
          query = query.or(`id.eq.${num},challanno.ilike.${term},projectid.ilike.${term}`);
        } else {
          query = query.or(`challanno.ilike.${term},projectid.ilike.${term}`);
        }
        return query.limit(6);
      })(),

      // 6. Search 3D Printing
      (async () => {
        let query = supabaseAdmin
          .from("print")
          .select("id, projectid, cname, description, status, tdate");

        if (isNum) {
          query = query.or(`id.eq.${num},projectid.ilike.${term},description.ilike.${term}`);
        } else {
          query = query.or(`projectid.ilike.${term},description.ilike.${term}`);
        }
        return query.limit(6);
      })(),
    ]);

    const scans = scanRes.status === "fulfilled" ? scanRes.value.data || [] : [];
    const subplates = subplateRes.status === "fulfilled" ? subplateRes.value.data || [] : [];
    const customers = custRes.status === "fulfilled" ? custRes.value.data || [] : [];
    const purchases = purchaseRes.status === "fulfilled" ? purchaseRes.value.data || [] : [];
    const challans = challanRes.status === "fulfilled" ? challanRes.value.data || [] : [];
    const prints = printRes.status === "fulfilled" ? printRes.value.data || [] : [];

    // Fetch customer names for found scans
    let customerMap = new Map<number, string>();
    if (scans.length > 0) {
      const cids = Array.from(new Set(scans.map((s) => Number(s.cname)).filter(Boolean)));
      if (cids.length > 0) {
        const { data: custs } = await supabaseAdmin
          .from("customers")
          .select("id, customername")
          .in("id", cids);
        custs?.forEach((c) => customerMap.set(c.id, c.customername));
      }
    }

    // Format unified results
    const results: Array<{
      id: string;
      title: string;
      subtitle: string;
      category: string;
      href: string;
      meta?: string;
    }> = [];

    // Map Mould Orders
    scans.forEach((s) => {
      const custName = customerMap.get(Number(s.cname)) || (s.cname ? `Customer #${s.cname}` : "");
      const descPart = s.description ? ` · ${s.description}` : "";
      results.push({
        id: `scan-${s.id}`,
        title: s.projectid || `Mould #${s.id}`,
        subtitle: `${custName}${descPart} · Status: ${s.status || "pending"}`,
        category: "Mould Orders",
        href: `/scanning?search=${encodeURIComponent(s.projectid || String(s.id))}&highlight=${s.id}`,
        meta: s.worktype || "Mould",
      });
    });

    // Map Subplates
    subplates.forEach((sp) => {
      const dims = `${sp.length || 0}×${sp.width || 0}×${sp.height || 0} ${sp.unit || "mm"}`;
      results.push({
        id: `subplate-${sp.id}`,
        title: sp.platename,
        subtitle: `Project: ${sp.projectid || "—"} · ${dims} · ${sp.material || "MS"} · ${sp.location || "SM"}`,
        category: "Subplates",
        href: `/subplate?search=${encodeURIComponent(sp.platename)}&highlight=${sp.id}`,
        meta: sp.location || "SM",
      });
    });

    // Map Customers
    customers.forEach((c) => {
      results.push({
        id: `cust-${c.id}`,
        title: c.customername,
        subtitle: `${c.usertype || "Customer"} · Code: ${c.initials || "—"}${c.mobile ? ` · ${c.mobile}` : ""}`,
        category: "Customers & Parties",
        href: `/customer?search=${encodeURIComponent(c.customername)}&highlight=${c.id}`,
        meta: c.usertype || "Party",
      });
    });

    // Map Purchases
    purchases.forEach((po) => {
      results.push({
        id: `po-${po.id}`,
        title: po.srno ? `PO #${po.srno}` : `Purchase Order #${po.id}`,
        subtitle: `Project: ${po.projectid || "—"} · Date: ${po.odate || "—"} · Status: ${po.status || "Pending"}`,
        category: "Purchase Orders",
        href: `/purchase?search=${encodeURIComponent(po.srno || po.projectid || String(po.id))}&highlight=${po.id}`,
        meta: "PO",
      });
    });

    // Map Challans
    challans.forEach((ch) => {
      results.push({
        id: `ch-${ch.id}`,
        title: ch.challanno ? `Challan #${ch.challanno}` : `Challan #${ch.id}`,
        subtitle: `Project: ${ch.projectid || "—"} · Date: ${ch.chdate || "—"} · Status: ${ch.status || "Dispatched"}`,
        category: "Challans",
        href: `/challan?search=${encodeURIComponent(ch.challanno || ch.projectid || String(ch.id))}&highlight=${ch.id}`,
        meta: "Challan",
      });
    });

    // Map 3D Printing
    prints.forEach((pr) => {
      results.push({
        id: `pr-${pr.id}`,
        title: pr.projectid || `3D Print Job #${pr.id}`,
        subtitle: `${pr.description || "3D Printing"} · Date: ${pr.tdate || "—"} · Status: ${pr.status || "Pending"}`,
        category: "3D Printing",
        href: `/printing?search=${encodeURIComponent(pr.projectid || String(pr.id))}&highlight=${pr.id}`,
        meta: "Print",
      });
    });

    return NextResponse.json({ results });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal search error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
