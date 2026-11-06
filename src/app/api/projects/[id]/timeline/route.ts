import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { authenticateRequest } from "@/lib/auth";
import { createSecurePrintToken } from "@/lib/print-token";

export interface LifecycleMilestone {
  step: number;
  id: string;
  timestamp: string;
  title: string;
  badgeLabel: string;
  badgeColor: "purple" | "blue" | "teal" | "emerald" | "amber" | "slate" | "rose";
  description: string;
  authorName?: string;
  documentLink?: {
    type: "challan" | "dispatch" | "purchase" | "inward" | "work" | "quotation";
    id: number | string;
    label: string;
    viewUrl?: string;
  };
  details?: {
    label: string;
    value: string;
  }[];
  subItems?: {
    name: string;
    status: string;
    note?: string;
    docType?: "challan" | "dispatch" | "purchase" | "inward" | "work" | "quotation";
    docId?: number | string;
    viewUrl?: string;
  }[];
}

export interface ProjectDocumentItem {
  id: number | string;
  docType: "dispatch" | "purchase" | "challan" | "inward" | "work" | "quotation";
  docCategory: "Delivery Challan" | "Purchase Order" | "Job Work Challan" | "Job Work Inward" | "Work Order" | "Quotation";
  docNumber: string;
  docDate: string;
  partyName: string;
  transporter?: string;
  invoiceNo?: string;
  vehicleNo?: string;
  deliveryType?: string;
  itemCount: number;
  totalAmount?: number;
  workHours?: string;
  description?: string;
  status?: string;
  items?: {
    name: string;
    particulars?: string;
    qty?: number;
    rate?: number | null;
  }[];
  viewUrl: string;
  downloadUrl: string;
}

export interface ProjectDocumentsSummary {
  total: number;
  dispatchesCount: number;
  purchasesCount: number;
  challansCount: number;
  inwardsCount: number;
  workOrdersCount: number;
  quotationsCount: number;
}

export interface TimelineEvent {
  id: string;
  timestamp: string;
  eventType:
    | "PROJECT_CREATED"
    | "SUBPLATES_ADDED"
    | "PURCHASE_ORDER"
    | "MATERIAL_INWARD"
    | "STAGE_MILESTONE"
    | "JOBWORK_OUTWARD"
    | "JOBWORK_INWARD"
    | "WORKLOG_HOURS"
    | "DISPATCH_CHALLAN"
    | "DIRECT_CLOSURE";
  category: "Stages & QC" | "Jobwork & Inwards" | "Machining Logs" | "Dispatch & Closures" | "General";
  title: string;
  description: string;
  authorName?: string;
  authorInitials?: string;
  badgeLabel: string;
  badgeColor: "purple" | "blue" | "emerald" | "amber" | "slate" | "rose" | "teal";
  meta?: Record<string, any>;
  documentLink?: {
    type: "challan" | "dispatch" | "purchase" | "inward" | "work" | "quotation";
    id: number | string;
    label: string;
    viewUrl?: string;
  };
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateRequest(req, undefined, "nav_scanning");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: "Missing project identifier" }, { status: 400 });
    }

    const trimmedId = decodeURIComponent(id).trim();

    // 1. Fetch Project Master
    let projectQuery = supabaseAdmin.from("scan").select("*");
    if (!isNaN(Number(trimmedId))) {
      projectQuery = projectQuery.or(`id.eq.${trimmedId},projectid.eq.${trimmedId}`);
    } else {
      projectQuery = projectQuery.eq("projectid", trimmedId);
    }

    const { data: project, error: projErr } = await projectQuery.maybeSingle();
    if (projErr || !project) {
      return NextResponse.json({ error: "Mould project not found" }, { status: 404 });
    }

    const projectIdNum = project.id;
    const projectCode = project.projectid || String(projectIdNum);

    // 2. Concurrently fetch all associated operational records
    const [
      customersRes,
      usersRes,
      vendorsRes,
      subplatesRes,
      worklogsRes,
      challansRes,
      inwardsRes,
      purchasesRes,
      dispatchesRes,
    ] = await Promise.all([
      supabaseAdmin.from("customers").select("id, customername, initials"),
      supabaseAdmin.from("users").select("id, name, initials, usertype"),
      supabaseAdmin.from("vendors").select("id, vendor_name"),
      supabaseAdmin
        .from("subplate")
        .select("*")
        .or(`projectid.eq.${projectCode},mold_id.eq.${projectIdNum},projectid.eq.${projectIdNum}`)
        .order("id", { ascending: true }),
      supabaseAdmin
        .from("worklog")
        .select("*")
        .or(`scan_print_id.eq.${projectIdNum},projectid.eq.${projectCode}`)
        .order("rdate", { ascending: false }),
      supabaseAdmin
        .from("challan")
        .select("id, challanno, chdate, vendorid, vendortid, status, challan_items(*)")
        .or(`projectid.eq.${projectCode},projectid.eq.${projectIdNum}`)
        .neq("status", "0"),
      supabaseAdmin
        .from("inward")
        .select("id, challanno, inchallanno, in_date, chdate, vendorid, vendortid, status, inward_items(*)")
        .or(`projectid.eq.${projectCode},projectid.eq.${projectIdNum}`)
        .neq("status", "0"),
      supabaseAdmin
        .from("purchase")
        .select("id, srno, odate, idate, vname, cname, status, purchase_items(*)")
        .or(`projectid.eq.${projectCode},projectid.eq.${projectIdNum}`)
        .neq("status", "0"),
      supabaseAdmin
        .from("dispatch")
        .select("id, challanno, chdate, invoiceno, vehicleno, customerid, vendortid, deliverytype, freightmode, noofcases, status, dispatch_items(*)")
        .or(`projectid.eq.${projectCode},projectid.eq.${projectIdNum}`)
        .neq("status", "0"),
    ]);

    const custMap = new Map((customersRes.data || []).map((c) => [String(c.id), c]));
    const userMap = new Map((usersRes.data || []).map((u) => [String(u.id), u]));
    const vendMap = new Map((vendorsRes.data || []).map((v) => [String(v.id), v.vendor_name]));

    const subplates = subplatesRes.data || [];
    const worklogs = worklogsRes.data || [];
    const challans = challansRes.data || [];
    const inwards = inwardsRes.data || [];
    const purchases = purchasesRes.data || [];
    const dispatches = dispatchesRes.data || [];

    // Query extra records linked via subplate IDs if not already captured
    const subplateIds = subplates.map((sp) => sp.id).filter(Boolean);
    const subplateNameMap = new Map(subplates.map((sp) => [sp.id, sp.platename]));

    if (subplateIds.length > 0) {
      const existingDispIds = new Set(dispatches.map((d) => d.id));
      const existingChallanIds = new Set(challans.map((c) => c.id));
      const existingPoIds = new Set(purchases.map((p) => p.id));
      const existingInwardIds = new Set(inwards.map((i) => i.id));

      const [extraDispItemsRes, extraChallanItemsRes, extraPoItemsRes, extraInwardItemsRes] = await Promise.all([
        supabaseAdmin.from("dispatch_items").select("dispatchid").in("plateid", subplateIds),
        supabaseAdmin.from("challan_items").select("challanid").in("plateid", subplateIds),
        supabaseAdmin.from("purchase_items").select("pid").in("plateid", subplateIds),
        supabaseAdmin.from("inward_items").select("inchallanid").in("plateid", subplateIds),
      ]);

      const extraDispIds = Array.from(new Set((extraDispItemsRes.data || []).map((i: any) => i.dispatchid).filter((id: any) => id && !existingDispIds.has(id))));
      const extraChallanIds = Array.from(new Set((extraChallanItemsRes.data || []).map((i: any) => i.challanid).filter((id: any) => id && !existingChallanIds.has(id))));
      const extraPoIds = Array.from(new Set((extraPoItemsRes.data || []).map((i: any) => i.pid).filter((id: any) => id && !existingPoIds.has(id))));
      const extraInwardIds = Array.from(new Set((extraInwardItemsRes.data || []).map((i: any) => i.inchallanid).filter((id: any) => id && !existingInwardIds.has(id))));

      const [extraDispatchesRes, extraChallansRes, extraPurchasesRes, extraInwardsRes] = await Promise.all([
        extraDispIds.length > 0
          ? supabaseAdmin
              .from("dispatch")
              .select("id, challanno, chdate, invoiceno, vehicleno, customerid, vendortid, deliverytype, freightmode, noofcases, status, dispatch_items(*)")
              .in("id", extraDispIds)
              .neq("status", "0")
          : Promise.resolve({ data: [] }),
        extraChallanIds.length > 0
          ? supabaseAdmin
              .from("challan")
              .select("id, challanno, chdate, vendorid, vendortid, status, challan_items(*)")
              .in("id", extraChallanIds)
              .neq("status", "0")
          : Promise.resolve({ data: [] }),
        extraPoIds.length > 0
          ? supabaseAdmin
              .from("purchase")
              .select("id, srno, odate, idate, vname, cname, status, purchase_items(*)")
              .in("id", extraPoIds)
              .neq("status", "0")
          : Promise.resolve({ data: [] }),
        extraInwardIds.length > 0
          ? supabaseAdmin
              .from("inward")
              .select("id, challanno, inchallanno, in_date, chdate, vendorid, vendortid, status, inward_items(*)")
              .in("id", extraInwardIds)
              .neq("status", "0")
          : Promise.resolve({ data: [] }),
      ]);

      if (extraDispatchesRes.data) dispatches.push(...extraDispatchesRes.data);
      if (extraChallansRes.data) challans.push(...extraChallansRes.data);
      if (extraPurchasesRes.data) purchases.push(...extraPurchasesRes.data);
      if (extraInwardsRes.data) inwards.push(...extraInwardsRes.data);
    }

    const customer = custMap.get(String(project.customer_id)) || custMap.get(String(project.cname));
    const customerName = customer?.customername || project.cname || "Unknown Customer";
    const customerInitials = customer?.initials || "";

    // 3. Assemble Unified Chronological Timeline
    const events: TimelineEvent[] = [];

    // --- A. Project Creation Milestone ---
    const createdAt = project.created_at || (project.rdate ? `${project.rdate}T00:00:00.000Z` : new Date().toISOString());
    const creatorUser = userMap.get(String(project.scan_by));
    events.push({
      id: `mould_create_${project.id}`,
      timestamp: createdAt,
      eventType: "PROJECT_CREATED",
      category: "General",
      title: `Mould Project Registered (${projectCode})`,
      description: `Project registered for ${customerName} • Work Type: ${project.worktype || "Tooling"} • ${project.description || "No description"}`,
      authorName: creatorUser?.name || "System",
      authorInitials: creatorUser?.initials || "SM",
      badgeLabel: "Created",
      badgeColor: "purple",
      meta: {
        committedDate: project.cdate,
        receivedDate: project.rdate,
        note: project.note,
      },
    });

    // --- B. Subplates Added Milestone ---
    if (subplates.length > 0) {
      const earliestSubplate = subplates[0].created_at || createdAt;
      events.push({
        id: `subplates_added_${project.id}`,
        timestamp: earliestSubplate,
        eventType: "SUBPLATES_ADDED",
        category: "Stages & QC",
        title: `${subplates.length} Subplates Configured`,
        description: `Tooling breakdown registered: ${subplates.map((sp) => sp.platename).join(", ")}`,
        badgeLabel: `${subplates.length} Plates`,
        badgeColor: "blue",
        meta: {
          plates: subplates.map((sp) => ({
            id: sp.id,
            name: sp.platename,
            dimensions: `${sp.length || 0} x ${sp.width || 0} x ${sp.height || 0} mm`,
            weight: `${sp.weight || 0} kg`,
            material: sp.material || "Steel",
          })),
        },
      });
    }

    // --- C. Raw Material Purchase Orders ---
    for (const po of purchases) {
      const vendorName = vendMap.get(String(po.vname)) || (typeof po.vname === "string" ? po.vname : `Vendor #${po.vname}`);
      const poDate = po.odate || po.idate ? `${po.odate || po.idate}T00:00:00.000Z` : createdAt;
      const itemCount = po.purchase_items?.length || 0;
      const poToken = createSecurePrintToken({ type: "purchase", id: po.id });
      events.push({
        id: `po_${po.id}`,
        timestamp: poDate,
        eventType: "PURCHASE_ORDER",
        category: "Jobwork & Inwards",
        title: `Purchase Order Issued (${po.srno || `#${po.id}`})`,
        description: `Raw material ordered from ${vendorName} for ${itemCount} plate items`,
        badgeLabel: "PO Issued",
        badgeColor: "teal",
        documentLink: {
          type: "purchase",
          id: po.id,
          label: po.srno || `PO #${po.id}`,
          viewUrl: `/print/purchase/${poToken}`,
        },
        meta: {
          vendorName,
          items: po.purchase_items,
        },
      });
    }

    // --- D. Production Stages & QC Sign-offs ---
    const stageDefs = [
      { key: "design", label: "Design Release", byField: "design_by", atField: "design_at", badgeColor: "purple" as const },
      { key: "order", label: "Material Order Released", byField: "order_by", atField: "order_at", badgeColor: "blue" as const },
      { key: "received_work", label: "Material Received Machining", byField: "received_workby", atField: "received_work_at", badgeColor: "teal" as const },
      { key: "received_qc", label: "Material Received QC Approved", byField: "received_qcby", atField: "received_qc_at", badgeColor: "emerald" as const },
      { key: "vmc_work", label: "VMC Machining Completed", byField: "vmc_workby", atField: "vmc_work_at", badgeColor: "blue" as const },
      { key: "vmc_qc", label: "VMC QC Approved", byField: "vmc_qcby", atField: "vmc_qc_at", badgeColor: "emerald" as const },
      { key: "drilltap", label: "Drill & Tap Completed", byField: "drilltap_workby", atField: "drilltap_at", badgeColor: "teal" as const },
      { key: "final_qc", label: "Final QC Approved", byField: "final_qcby", atField: "final_qc_at", badgeColor: "emerald" as const },
      { key: "packing", label: "Packing Completed", byField: "packing_workby", atField: "packing_at", badgeColor: "rose" as const },
    ];

    for (const sp of subplates) {
      for (const st of stageDefs) {
        const staffId = sp[st.byField as keyof typeof sp];
        const timestamp = sp[st.atField as keyof typeof sp] as string | null;
        if (staffId && timestamp) {
          const user = userMap.get(String(staffId));
          events.push({
            id: `stage_${sp.id}_${st.key}`,
            timestamp,
            eventType: "STAGE_MILESTONE",
            category: "Stages & QC",
            title: `${st.label} — ${sp.platename}`,
            description: `Stage sign-off completed by ${user?.name || "Staff"} (${user?.initials || "SM"}) for plate ${sp.platename}`,
            authorName: user?.name,
            authorInitials: user?.initials,
            badgeLabel: st.label,
            badgeColor: st.badgeColor,
            meta: {
              subplateId: sp.id,
              platename: sp.platename,
              stage: st.key,
            },
          });
        }
      }

      // Check Direct Closure on Subplate
      if (sp.dispatch_status === "closed_without_challan") {
        const closer = userMap.get(sp.closed_by || 0);
        events.push({
          id: `direct_closure_${sp.id}`,
          timestamp: sp.closed_at || project.updated_at || new Date().toISOString(),
          eventType: "DIRECT_CLOSURE",
          category: "Dispatch & Closures",
          title: `Direct Closure: ${sp.platename}`,
          description: `Archived directly without dispatch challan • Reason: ${sp.closure_reason || "Direct Handover / Return"}`,
          authorName: closer?.name || "Supervisor",
          authorInitials: closer?.initials || "SM",
          badgeLabel: "Direct Close",
          badgeColor: "amber",
          meta: {
            subplateId: sp.id,
            platename: sp.platename,
            reason: sp.closure_reason,
          },
        });
      }
    }

    // --- E. Outward Jobwork Challans ---
    for (const ch of challans) {
      const vendorName = vendMap.get(String(ch.vendorid)) || vendMap.get(String(ch.vendortid)) || `Vendor #${ch.vendortid}`;
      const chDate = ch.chdate ? `${ch.chdate}T00:00:00.000Z` : createdAt;
      const chItems = ch.challan_items || [];
      const chToken = createSecurePrintToken({ type: "challan", id: ch.id });
      events.push({
        id: `challan_${ch.id}`,
        timestamp: chDate,
        eventType: "JOBWORK_OUTWARD",
        category: "Jobwork & Inwards",
        title: `Outward Jobwork Challan (${ch.challanno || `#${ch.id}`})`,
        description: `Sent ${chItems.length} plate(s) to ${vendorName} for outside jobwork / processing`,
        badgeLabel: "Outward Challan",
        badgeColor: "amber",
        documentLink: {
          type: "challan",
          id: ch.id,
          label: ch.challanno || `Challan #${ch.id}`,
          viewUrl: `/print/challan/${chToken}`,
        },
        meta: {
          vendorName,
          items: chItems,
        },
      });
    }

    // --- F. Inward Jobwork Receipts ---
    for (const iw of inwards) {
      const vendorName = vendMap.get(String(iw.vendorid)) || vendMap.get(String(iw.vendortid)) || `Vendor #${iw.vendortid}`;
      const inDate = iw.in_date ? `${iw.in_date}T00:00:00.000Z` : createdAt;
      const iwItems = iw.inward_items || [];
      const iwToken = createSecurePrintToken({ type: "inward", id: iw.id });
      events.push({
        id: `inward_${iw.id}`,
        timestamp: inDate,
        eventType: "JOBWORK_INWARD",
        category: "Jobwork & Inwards",
        title: `Inward Jobwork Receipt (${iw.challanno || `#${iw.id}`})`,
        description: `Received ${iwItems.length} plate(s) returned back from ${vendorName}`,
        badgeLabel: "Jobwork Inward",
        badgeColor: "teal",
        documentLink: {
          type: "inward",
          id: iw.id,
          label: iw.challanno || `Inward #${iw.id}`,
          viewUrl: `/print/inward/${iwToken}`,
        },
        meta: {
          vendorName,
          items: iwItems,
        },
      });
    }

    // --- G. Machining & Labor Worklog Entries ---
    let totalWorklogSeconds = 0;
    for (const wl of worklogs) {
      const operator = userMap.get(wl.userid);
      const wlDate = wl.rdate ? `${wl.rdate}T00:00:00.000Z` : createdAt;

      // Parse work_hr format (e.g. "02:30" or hours float)
      let sec = 0;
      if (typeof wl.work_hr === "string" && wl.work_hr.includes(":")) {
        const parts = wl.work_hr.split(":");
        sec = Number(parts[0] || 0) * 3600 + Number(parts[1] || 0) * 60;
      } else if (!isNaN(Number(wl.work_hr))) {
        sec = Number(wl.work_hr) * 3600;
      }
      totalWorklogSeconds += sec;

      events.push({
        id: `worklog_${wl.id}`,
        timestamp: wlDate,
        eventType: "WORKLOG_HOURS",
        category: "Machining Logs",
        title: `Machining Work Log (${wl.work_hr || "0"} hr)`,
        description: `Operation: ${wl.projectid || "Mould work"} • Program: ${wl.program_name || "VMC milling"} logged by ${operator?.name || "Operator"}`,
        authorName: operator?.name,
        authorInitials: operator?.initials,
        badgeLabel: `${wl.work_hr || "0"} hrs`,
        badgeColor: "blue",
        meta: {
          hours: wl.work_hr,
          program: wl.program_name,
        },
      });
    }

    // --- H. Customer Delivery Dispatch Challans ---
    const allDispatchedPlateIds = new Set<number>();
    for (const d of dispatches) {
      const dDate = d.chdate ? `${d.chdate}T00:00:00.000Z` : createdAt;
      const dItems = d.dispatch_items || [];
      const transporterName = vendMap.get(String(d.vendortid)) || `Transporter #${d.vendortid}`;
      const dToken = createSecurePrintToken({ type: "dispatch", id: d.id });

      for (const it of dItems) {
        if (it.plateid) allDispatchedPlateIds.add(Number(it.plateid));
      }

      events.push({
        id: `dispatch_${d.id}`,
        timestamp: dDate,
        eventType: "DISPATCH_CHALLAN",
        category: "Dispatch & Closures",
        title: `Customer Delivery Challan (${d.challanno || `#${d.id}`})`,
        description: `Dispatched ${dItems.length} plate(s) to ${customerName} • Transporter: ${transporterName} • Vehicle: ${d.vehicleno || "N/A"}`,
        badgeLabel: "Dispatched",
        badgeColor: "emerald",
        documentLink: {
          type: "dispatch",
          id: d.id,
          label: d.challanno || `Dispatch #${d.id}`,
          viewUrl: `/print/dispatch/${dToken}`,
        },
        meta: {
          invoiceNo: d.invoiceno,
          vehicleNo: d.vehicleno,
          transporterName,
          items: dItems,
        },
      });
    }

    // Sort all events chronologically (newest first)
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // 4. Calculate Key Performance & Coverage Metrics
    const totalPlates = subplates.length;
    let dispatchedPlatesCount = 0;
    let directClosedPlatesCount = 0;

    for (const sp of subplates) {
      if (allDispatchedPlateIds.has(sp.id) || sp.location === "Customer" || sp.dispatch_status === "dispatched") {
        dispatchedPlatesCount++;
      } else if (sp.dispatch_status === "closed_without_challan") {
        directClosedPlatesCount++;
      }
    }

    const pendingPlatesCount = Math.max(0, totalPlates - dispatchedPlatesCount - directClosedPlatesCount);

    const mHrHours = Math.floor(totalWorklogSeconds / 3600);
    const mHrMins = Math.floor((totalWorklogSeconds % 3600) / 60);
    const formattedMachineTime = `${String(mHrHours).padStart(2, "0")}:${String(mHrMins).padStart(2, "0")}`;

    // Calculate turnaround duration
    const startDate = new Date(project.rdate || project.created_at || new Date());
    const endDate = project.dispatchdate ? new Date(project.dispatchdate) : new Date();
    const durationDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
    const isCompleted = String(project.status).toLowerCase() === "completed" || String(project.status).toLowerCase() === "registered";

    // 5. Construct Clean, Step-by-Step Lifecycle Milestones (High-Level Progression Story)
    const milestones: LifecycleMilestone[] = [];
    let stepNumber = 1;

    // Step 1: Mould Project Created
    milestones.push({
      step: stepNumber++,
      id: `ms_created_${project.id}`,
      timestamp: createdAt,
      title: "Mould Project Created",
      badgeLabel: "Created",
      badgeColor: "purple",
      description: `Mould project registered for ${customerName} (${project.worktype || "Tooling"}). ${project.description || "Mould set"}`,
      authorName: creatorUser?.name || "System",
      details: [
        { label: "Received Date", value: project.rdate || "N/A" },
        { label: "Committed Date", value: project.cdate || "N/A" },
        { label: "Work Type", value: project.worktype || "Tooling" },
      ],
    });

    // Step 2: Subplates Configured
    if (subplates.length > 0) {
      milestones.push({
        step: stepNumber++,
        id: `ms_subplates_${project.id}`,
        timestamp: subplates[0].created_at || createdAt,
        title: `${subplates.length} Subplates Configured`,
        badgeLabel: `${subplates.length} Subplates`,
        badgeColor: "blue",
        description: `Subplate tooling breakdown registered with dimensions and raw steel specifications.`,
        subItems: subplates.map((sp) => ({
          name: sp.platename,
          status: `${sp.length || 0}x${sp.width || 0}x${sp.height || 0} mm • ${sp.material || "Steel"}`,
          note: sp.location ? `Loc: ${sp.location}` : undefined,
        })),
      });
    }

    // Step 3: Raw Material Procurement (PO)
    if (purchases.length > 0) {
      const firstPo = purchases[0];
      const poVendors = Array.from(new Set(purchases.map((p) => vendMap.get(String(p.vname)) || p.vname || `Vendor #${p.vname}`))).join(", ");
      const firstPoToken = createSecurePrintToken({ type: "purchase", id: firstPo.id });
      milestones.push({
        step: stepNumber++,
        id: `ms_purchases_${project.id}`,
        timestamp: (firstPo.odate || firstPo.idate) ? `${firstPo.odate || firstPo.idate}T00:00:00.000Z` : createdAt,
        title: `Raw Material Orders (${purchases.length} PO${purchases.length > 1 ? "s" : ""})`,
        badgeLabel: "Procurement",
        badgeColor: "teal",
        description: `Raw material ordered from ${poVendors}.`,
        documentLink: {
          type: "purchase",
          id: firstPo.id,
          label: firstPo.srno || `PO #${firstPo.id}`,
          viewUrl: `/print/purchase/${firstPoToken}`,
        },
        subItems: purchases.map((p) => {
          const token = createSecurePrintToken({ type: "purchase", id: p.id });
          return {
            name: p.srno || `PO #${p.id}`,
            status: vendMap.get(String(p.vname)) || p.vname || `Vendor #${p.vname}`,
            note: p.odate || p.idate || undefined,
            docType: "purchase" as const,
            docId: p.id,
            viewUrl: `/print/purchase/${token}`,
          };
        }),
      });
    }

    // Step 4: Outward Jobwork (if any outside processing)
    if (challans.length > 0) {
      const firstCh = challans[0];
      const chVendors = Array.from(new Set(challans.map((c) => vendMap.get(String(c.vendorid || c.vendortid)) || `Vendor #${c.vendortid}`))).join(", ");
      const firstChToken = createSecurePrintToken({ type: "challan", id: firstCh.id });
      milestones.push({
        step: stepNumber++,
        id: `ms_challans_${project.id}`,
        timestamp: firstCh.chdate ? `${firstCh.chdate}T00:00:00.000Z` : createdAt,
        title: `Outward Jobwork (${challans.length} Challan${challans.length > 1 ? "s" : ""})`,
        badgeLabel: "Jobwork Sent",
        badgeColor: "amber",
        description: `Plates sent for outside specialized processes to ${chVendors}.`,
        documentLink: {
          type: "challan",
          id: firstCh.id,
          label: firstCh.challanno || `Challan #${firstCh.id}`,
          viewUrl: `/print/challan/${firstChToken}`,
        },
        subItems: challans.map((c) => {
          const token = createSecurePrintToken({ type: "challan", id: c.id });
          return {
            name: c.challanno || `Challan #${c.id}`,
            status: vendMap.get(String(c.vendorid || c.vendortid)) || "Jobwork Vendor",
            note: c.chdate || undefined,
            docType: "challan" as const,
            docId: c.id,
            viewUrl: `/print/challan/${token}`,
          };
        }),
      });
    }

    // Step 5: Shopfloor Machining & Stage Progress
    const packedCount = subplates.filter((sp) => !!sp.packing_workby).length;
    const vmcCount = subplates.filter((sp) => !!sp.vmc_workby).length;
    const designCount = subplates.filter((sp) => !!sp.design_by).length;
    const hasShopfloorActivity = worklogs.length > 0 || packedCount > 0 || vmcCount > 0;

    if (hasShopfloorActivity) {
      milestones.push({
        step: stepNumber++,
        id: `ms_machining_${project.id}`,
        timestamp: worklogs[0]?.rdate ? `${worklogs[0].rdate}T00:00:00.000Z` : createdAt,
        title: "Shopfloor Machining & Production Stages",
        badgeLabel: `${formattedMachineTime} Machining hrs`,
        badgeColor: "blue",
        description: `${totalPlates} components progressed: ${designCount}/${totalPlates} Designed, ${vmcCount}/${totalPlates} VMC Machined, ${packedCount}/${totalPlates} Packed.`,
        details: [
          { label: "Total Machining Time", value: `${formattedMachineTime} hrs` },
          { label: "Operations Logged", value: `${worklogs.length} sessions` },
        ],
        subItems: worklogs.map((wl) => ({
          name: wl.workdescription || wl.program_name || "Machining Operation",
          status: `${wl.work_hr || "0"} hrs • Operator: ${userMap.get(wl.userid)?.name || "Worker"}`,
          note: wl.rdate || undefined,
        })),
      });
    }

    // Step 6: Delivery Dispatch Challan (if any customer shipment)
    if (dispatches.length > 0) {
      const firstDisp = dispatches[0];
      const transporter = vendMap.get(firstDisp.vendortid) || "Logistics";
      milestones.push({
        step: stepNumber++,
        id: `ms_dispatch_${project.id}`,
        timestamp: firstDisp.chdate ? `${firstDisp.chdate}T00:00:00.000Z` : (project.dispatchdate ? `${project.dispatchdate}T00:00:00.000Z` : createdAt),
        title: "Customer Delivery Challan Issued",
        badgeLabel: `${dispatchedPlatesCount} Dispatched`,
        badgeColor: "emerald",
        description: `${dispatchedPlatesCount} component(s) dispatched to ${customerName} via Challan ${firstDisp.challanno || ""}. Transporter: ${transporter}.`,
        documentLink: {
          type: "dispatch",
          id: firstDisp.id,
          label: firstDisp.challanno || `Dispatch #${firstDisp.id}`,
        },
        details: [
          { label: "Challan No", value: firstDisp.challanno },
          { label: "Invoice No", value: firstDisp.invoiceno || "N/A" },
          { label: "Vehicle", value: firstDisp.vehicleno || "N/A" },
        ],
      });
    }

    // Step 7: Direct Closures (if plates were archived without challan)
    const directClosedPlates = subplates.filter((sp) => sp.dispatch_status === "closed_without_challan");
    if (directClosedPlates.length > 0) {
      milestones.push({
        step: stepNumber++,
        id: `ms_direct_closure_${project.id}`,
        timestamp: directClosedPlates[0].closed_at || project.updated_at || createdAt,
        title: `${directClosedPlates.length} Subplate(s) Closed Directly`,
        badgeLabel: "Direct Closed (No Challan)",
        badgeColor: "amber",
        description: `${directClosedPlates.length} component(s) moved to Project Register without challan (deferred/in-house).`,
        subItems: directClosedPlates.map((sp) => ({
          name: sp.platename,
          status: sp.closure_reason || "Direct Closure / Return",
          note: sp.closed_at ? new Date(sp.closed_at).toLocaleDateString("en-IN") : undefined,
        })),
      });
    }

    // Step 8: Completed & Moved to Project Register
    if (isCompleted) {
      milestones.push({
        step: stepNumber++,
        id: `ms_completed_${project.id}`,
        timestamp: project.updated_at || project.dispatchdate || createdAt,
        title: "Project Completed & Moved to Register",
        badgeLabel: "Archived in Register",
        badgeColor: "emerald",
        description: `All ${totalPlates} subplates fully accounted for (${dispatchedPlatesCount} dispatched, ${directClosedPlates.length} direct closed). Permanent historical dossier preserved.`,
      });
    }

    // Deduplicate documents by ID
    const uniqueDispatches = Array.from(new Map(dispatches.map((d: any) => [d.id, d])).values());
    const uniquePurchases = Array.from(new Map(purchases.map((p: any) => [p.id, p])).values());
    const uniqueChallans = Array.from(new Map(challans.map((c: any) => [c.id, c])).values());
    const uniqueInwards = Array.from(new Map(inwards.map((i: any) => [i.id, i])).values());
    const uniqueWorklogs = Array.from(new Map(worklogs.map((w: any) => [w.id, w])).values());

    const documentRecords: ProjectDocumentItem[] = [
      ...uniqueDispatches.map((d: any) => ({
        id: d.id,
        docType: "dispatch" as const,
        docCategory: "Delivery Challan" as const,
        docNumber: d.challanno || `DC-${d.id}`,
        docDate: d.chdate || "",
        partyName: customerName,
        transporter: vendMap.get(d.vendortid) || "",
        invoiceNo: d.invoiceno || "",
        vehicleNo: d.vehicleno || "",
        deliveryType: d.deliverytype || "",
        itemCount: d.dispatch_items?.length || 0,
        status: d.status,
        items: (d.dispatch_items || []).map((it: any) => ({
          name: it.custom_plate_name || subplateNameMap.get(it.plateid) || it.particulars || "Mould Plate",
          particulars: it.particulars || it.condition || "",
          qty: it.qty || 1,
        })),
        viewUrl: `/print/dispatch/${createSecurePrintToken({ type: "dispatch", id: d.id })}`,
        downloadUrl: `/api/download-dispatch-pdf?id=${d.id}`,
      })),
      ...uniquePurchases.map((p: any) => ({
        id: p.id,
        docType: "purchase" as const,
        docCategory: "Purchase Order" as const,
        docNumber: p.srno || `PO-${p.id}`,
        docDate: p.odate || p.idate || "",
        partyName: vendMap.get(p.vname) || custMap.get(p.vname)?.customername || "Vendor",
        transporter: "",
        invoiceNo: "",
        vehicleNo: "",
        deliveryType: "",
        itemCount: p.purchase_items?.length || 0,
        status: p.status,
        items: (p.purchase_items || []).map((it: any) => ({
          name: subplateNameMap.get(it.plateid) || it.material || "Plate Material",
          particulars: it.material || it.materialtype || "",
          qty: it.qty || 1,
          rate: it.rate,
        })),
        viewUrl: `/print/purchase/${createSecurePrintToken({ type: "purchase", id: p.id })}`,
        downloadUrl: `/api/download-po-pdf?type=purchase&id=${p.id}`,
      })),
      ...uniqueChallans.map((c: any) => ({
        id: c.id,
        docType: "challan" as const,
        docCategory: "Job Work Challan" as const,
        docNumber: c.challanno || `JC-${c.id}`,
        docDate: c.chdate || "",
        partyName: vendMap.get(c.vendorid || c.vendortid) || "Vendor",
        transporter: vendMap.get(c.vendortid) || "",
        invoiceNo: "",
        vehicleNo: "",
        deliveryType: "",
        itemCount: c.challan_items?.length || 0,
        status: c.status,
        items: (c.challan_items || []).map((it: any) => ({
          name: subplateNameMap.get(it.plateid) || it.particulars || "Jobwork Plate",
          particulars: it.particulars || "",
          qty: it.qty || 1,
        })),
        viewUrl: `/print/challan/${createSecurePrintToken({ type: "challan", id: c.id })}`,
        downloadUrl: `/api/download-challan-pdf?id=${c.id}`,
      })),
      ...uniqueInwards.map((inw: any) => ({
        id: inw.id,
        docType: "inward" as const,
        docCategory: "Job Work Inward" as const,
        docNumber: inw.inchallanno || inw.challanno || `INW-${inw.id}`,
        docDate: inw.in_date || inw.chdate || "",
        partyName: vendMap.get(inw.vendorid || inw.vendortid) || "Vendor",
        transporter: "",
        invoiceNo: "",
        vehicleNo: "",
        deliveryType: "",
        itemCount: inw.inward_items?.length || 0,
        status: inw.status,
        items: (inw.inward_items || []).map((it: any) => ({
          name: subplateNameMap.get(it.plateid) || it.particulars || "Inward Component",
          particulars: it.particulars || "",
          qty: it.inward_qty || it.qty || 1,
        })),
        viewUrl: `/print/inward/${createSecurePrintToken({ type: "inward", id: inw.id })}`,
        downloadUrl: `/print/inward/${inw.id}`,
      })),
      ...uniqueWorklogs.map((w: any) => ({
        id: w.id,
        docType: "work" as const,
        docCategory: "Work Order" as const,
        docNumber: `WO-${w.id}`,
        docDate: w.rdate || w.sdate || "",
        partyName: userMap.get(w.userid)?.name || `Operator #${w.userid}`,
        transporter: "",
        invoiceNo: "",
        vehicleNo: "",
        deliveryType: "",
        itemCount: 1,
        workHours: w.work_hr || "00:00:00",
        description: w.workdescription || "",
        status: "1",
        items: [
          {
            name: `${subplateNameMap.get(w.subplateid) || "Mould Plate"} — ${w.workdescription || "Machining"}`,
            particulars: `Work: ${w.work_hr || "00:00:00"} | Machine: ${w.machine_hr || 0}hr | Design: ${w.design_hr || 0}hr`,
            qty: 1,
          },
        ],
        viewUrl: `/print/work/${createSecurePrintToken({ type: "work", id: w.id })}`,
        downloadUrl: `/print/work/${w.id}`,
      })),
    ];

    const documentsSummary: ProjectDocumentsSummary = {
      total: documentRecords.length,
      dispatchesCount: uniqueDispatches.length,
      purchasesCount: uniquePurchases.length,
      challansCount: uniqueChallans.length,
      inwardsCount: uniqueInwards.length,
      workOrdersCount: uniqueWorklogs.length,
      quotationsCount: 0,
    };

    const responsePayload = {
      project: {
        id: project.id,
        projectid: projectCode,
        description: project.description,
        worktype: project.worktype,
        customerName,
        customerInitials,
        status: project.status,
        receivedDate: project.rdate,
        committedDate: project.cdate,
        dispatchDate: project.dispatchdate,
        note: project.note,
        subnote: project.subnote,
      },
      stats: {
        totalPlates,
        dispatchedPlatesCount,
        directClosedPlatesCount,
        pendingPlatesCount,
        totalMachiningHours: formattedMachineTime,
        durationDays,
        isCompleted,
        dispatchCoverage: {
          total: totalPlates,
          dispatched: dispatchedPlatesCount,
          directClosed: directClosedPlatesCount,
          pending: pendingPlatesCount,
          percentage: totalPlates > 0 ? Math.round(((dispatchedPlatesCount + directClosedPlatesCount) / totalPlates) * 100) : 100,
        },
      },
      subplates: subplates.map((sp) => ({
        id: sp.id,
        platename: sp.platename,
        subprojectid: sp.subprojectid,
        shape: sp.shape,
        length: sp.length,
        width: sp.width,
        height: sp.height,
        weight: sp.weight,
        material: sp.material,
        location: sp.location,
        isDispatched: allDispatchedPlateIds.has(sp.id) || sp.location === "Customer" || sp.dispatch_status === "dispatched",
        isDirectClosed: sp.dispatch_status === "closed_without_challan",
        closureReason: sp.closure_reason,
        closedAt: sp.closed_at,
      })),
      milestones,
      events,
      documents: {
        summary: documentsSummary,
        items: documentRecords,
      },
    };

    return NextResponse.json(responsePayload);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
