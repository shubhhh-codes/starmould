import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { authenticateRequest } from "@/lib/auth";

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
    type: "challan" | "dispatch" | "purchase" | "inward";
    id: number | string;
    label: string;
  };
  details?: {
    label: string;
    value: string;
  }[];
  subItems?: {
    name: string;
    status: string;
    note?: string;
  }[];
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
    type: "challan" | "dispatch" | "purchase" | "inward";
    id: number | string;
    label: string;
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
        .select("id, challanno, chdate, vendortid, status, challan_items(*)")
        .or(`projectid.eq.${projectCode},projectid.eq.${projectIdNum}`)
        .neq("status", "0"),
      supabaseAdmin
        .from("inward")
        .select("id, challanno, in_date, vendortid, status, inward_items(*)")
        .or(`projectid.eq.${projectCode},projectid.eq.${projectIdNum}`)
        .neq("status", "0"),
      supabaseAdmin
        .from("purchase")
        .select("id, srno, rdate, vname, status, purchase_items(*)")
        .or(`projectid.eq.${projectCode},projectid.eq.${projectIdNum}`)
        .neq("status", "0"),
      supabaseAdmin
        .from("dispatch")
        .select("id, challanno, chdate, invoiceno, vehicleno, vendortid, status, dispatch_items(*)")
        .or(`projectid.eq.${projectCode},projectid.eq.${projectIdNum}`)
        .neq("status", "0"),
    ]);

    const custMap = new Map((customersRes.data || []).map((c) => [c.id, c]));
    const userMap = new Map((usersRes.data || []).map((u) => [u.id, u]));
    const vendMap = new Map((vendorsRes.data || []).map((v) => [v.id, v.vendor_name]));

    const subplates = subplatesRes.data || [];
    const worklogs = worklogsRes.data || [];
    const challans = challansRes.data || [];
    const inwards = inwardsRes.data || [];
    const purchases = purchasesRes.data || [];
    const dispatches = dispatchesRes.data || [];

    const customer = custMap.get(project.customer_id) || custMap.get(Number(project.cname));
    const customerName = customer?.customername || project.cname || "Unknown Customer";
    const customerInitials = customer?.initials || "";

    // 3. Assemble Unified Chronological Timeline
    const events: TimelineEvent[] = [];

    // --- A. Project Creation Milestone ---
    const createdAt = project.created_at || (project.rdate ? `${project.rdate}T00:00:00.000Z` : new Date().toISOString());
    const creatorUser = userMap.get(project.scan_by);
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
      const vendorName = vendMap.get(po.vname) || `Vendor #${po.vname}`;
      const poDate = po.rdate ? `${po.rdate}T00:00:00.000Z` : createdAt;
      const itemCount = po.purchase_items?.length || 0;
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
          const user = userMap.get(Number(staffId));
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
      const vendorName = vendMap.get(ch.vendortid) || `Vendor #${ch.vendortid}`;
      const chDate = ch.chdate ? `${ch.chdate}T00:00:00.000Z` : createdAt;
      const chItems = ch.challan_items || [];
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
        },
        meta: {
          vendorName,
          items: chItems,
        },
      });
    }

    // --- F. Inward Jobwork Receipts ---
    for (const iw of inwards) {
      const vendorName = vendMap.get(iw.vendortid) || `Vendor #${iw.vendortid}`;
      const inDate = iw.in_date ? `${iw.in_date}T00:00:00.000Z` : createdAt;
      const iwItems = iw.inward_items || [];
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
      const transporterName = vendMap.get(d.vendortid) || `Transporter #${d.vendortid}`;

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
      const poVendors = Array.from(new Set(purchases.map((p) => vendMap.get(p.vname) || `Vendor #${p.vname}`))).join(", ");
      milestones.push({
        step: stepNumber++,
        id: `ms_purchases_${project.id}`,
        timestamp: firstPo.rdate ? `${firstPo.rdate}T00:00:00.000Z` : createdAt,
        title: `Raw Material Orders (${purchases.length} PO${purchases.length > 1 ? "s" : ""})`,
        badgeLabel: "Procurement",
        badgeColor: "teal",
        description: `Raw material ordered from ${poVendors}.`,
        documentLink: {
          type: "purchase",
          id: firstPo.id,
          label: firstPo.srno || `PO #${firstPo.id}`,
        },
        subItems: purchases.map((p) => ({
          name: p.srno || `PO #${p.id}`,
          status: vendMap.get(p.vname) || `Vendor #${p.vname}`,
          note: p.rdate || undefined,
        })),
      });
    }

    // Step 4: Outward Jobwork (if any outside processing)
    if (challans.length > 0) {
      const firstCh = challans[0];
      const chVendors = Array.from(new Set(challans.map((c) => vendMap.get(c.vendortid) || `Vendor #${c.vendortid}`))).join(", ");
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
        },
        subItems: challans.map((c) => ({
          name: c.challanno || `Challan #${c.id}`,
          status: vendMap.get(c.vendortid) || "Jobwork Vendor",
          note: c.chdate || undefined,
        })),
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
    };

    return NextResponse.json(responsePayload);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
