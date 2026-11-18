import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { ExportRequestV1 } from "@/lib/exports/contracts";
import { buildMouldsDataset } from "@/lib/exports/datasets/moulds";
import { buildProjectRegisterDataset } from "@/lib/exports/datasets/project-register";
import { buildCustomersDataset } from "@/lib/exports/datasets/customers";
import { buildVendorsDataset } from "@/lib/exports/datasets/vendors";
import { buildPurchaseInwardsDataset } from "@/lib/exports/datasets/purchase-inwards";
import { buildQuotationsDataset } from "@/lib/exports/datasets/quotations";
import { buildPurchasesDataset } from "@/lib/exports/datasets/purchases";
import { buildExpensesDataset } from "@/lib/exports/datasets/expenses";
import { buildUsersDataset } from "@/lib/exports/datasets/users";
import { buildSubplatesDataset } from "@/lib/exports/datasets/subplates";
import { buildWorklogsDataset } from "@/lib/exports/datasets/worklogs";
import { buildChallansDataset } from "@/lib/exports/datasets/challans";
import { buildDispatchesDataset } from "@/lib/exports/datasets/dispatches";
import { buildInwardsDataset } from "@/lib/exports/datasets/inwards";
import { renderXlsx, renderCsv } from "@/lib/exports/renderers/xlsx";
import { renderPdf } from "@/lib/exports/renderers/pdf";
import { loadEffectivePermissions, roleHasPermission } from "@/lib/permissions/loader";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();

  // 1. Authenticate user session
  const auth = await authenticateRequest(req, undefined);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body: ExportRequestV1 = await req.json();

    // 2. Validate contract version
    if (body.version !== 1) {
      return NextResponse.json({ error: "Unsupported export contract version. Expected version 1." }, { status: 400 });
    }

    const allowedDatasets = [
      "moulds",
      "project_register",
      "customers",
      "vendors",
      "purchase_inwards",
      "quotations",
      "purchases",
      "expenses",
      "users",
      "subplates",
      "worklogs",
      "challans",
      "dispatches",
      "inwards",
    ];
    if (!body.dataset || !allowedDatasets.includes(body.dataset)) {
      return NextResponse.json({ error: `Unsupported or unregistered dataset "${body.dataset}"` }, { status: 400 });
    }

    if (!["xlsx", "pdf", "csv"].includes(body.format)) {
      return NextResponse.json({ error: `Unsupported export format "${body.format}". Use xlsx, pdf, or csv.` }, { status: 400 });
    }

    // 3. Resolve permissions
    const matrix = await loadEffectivePermissions();
    const hasFinancialAccess =
      auth.user.role_id === 0 ||
      roleHasPermission(auth.user.role_id, "financial_view_amounts", matrix);

    // 4. Build authorized dataset
    let datasetResult;
    if (body.dataset === "moulds") {
      datasetResult = await buildMouldsDataset({
        filters: body.filters,
        search: body.search,
        scope: body.scope,
        selectedIds: body.selectedIds,
        hasFinancialAccess,
        format: body.format,
      });
    } else if (body.dataset === "project_register") {
      datasetResult = await buildProjectRegisterDataset({
        filters: body.filters,
        search: body.search,
        scope: body.scope,
        selectedIds: body.selectedIds,
        hasFinancialAccess,
        format: body.format,
      });
    } else if (body.dataset === "customers") {
      datasetResult = await buildCustomersDataset({
        filters: body.filters,
        search: body.search,
        scope: body.scope,
        selectedIds: body.selectedIds,
        hasFinancialAccess,
        format: body.format,
      });
    } else if (body.dataset === "vendors") {
      const canViewBanking =
        hasFinancialAccess ||
        roleHasPermission(auth.user.role_id, "financial_view_banking", matrix);
      datasetResult = await buildVendorsDataset({
        filters: body.filters,
        search: body.search,
        scope: body.scope,
        selectedIds: body.selectedIds,
        hasFinancialAccess: canViewBanking,
        format: body.format,
      });
    } else if (body.dataset === "purchase_inwards") {
      datasetResult = await buildPurchaseInwardsDataset({
        filters: body.filters,
        search: body.search,
        scope: body.scope,
        selectedIds: body.selectedIds,
        hasFinancialAccess,
        format: body.format,
      });
    } else if (body.dataset === "quotations") {
      datasetResult = await buildQuotationsDataset({
        filters: body.filters,
        search: body.search,
        scope: body.scope,
        selectedIds: body.selectedIds,
        hasFinancialAccess,
        format: body.format,
      });
    } else if (body.dataset === "purchases") {
      datasetResult = await buildPurchasesDataset({
        filters: body.filters,
        search: body.search,
        scope: body.scope,
        selectedIds: body.selectedIds,
        hasFinancialAccess,
        format: body.format,
      });
    } else if (body.dataset === "expenses") {
      datasetResult = await buildExpensesDataset({
        filters: body.filters,
        search: body.search,
        scope: body.scope,
        selectedIds: body.selectedIds,
        hasFinancialAccess,
        format: body.format,
      });
    } else if (body.dataset === "users") {
      datasetResult = await buildUsersDataset({
        filters: body.filters,
        search: body.search,
        scope: body.scope,
        selectedIds: body.selectedIds,
        hasFinancialAccess,
        format: body.format,
      });
    } else if (body.dataset === "subplates") {
      datasetResult = await buildSubplatesDataset({
        filters: body.filters,
        search: body.search,
        scope: body.scope,
        selectedIds: body.selectedIds,
        hasFinancialAccess,
        format: body.format,
      });
    } else if (body.dataset === "worklogs") {
      datasetResult = await buildWorklogsDataset({
        filters: body.filters,
        search: body.search,
        scope: body.scope,
        selectedIds: body.selectedIds,
        hasFinancialAccess,
        format: body.format,
      });
    } else if (body.dataset === "challans") {
      datasetResult = await buildChallansDataset({
        filters: body.filters,
        search: body.search,
        scope: body.scope,
        selectedIds: body.selectedIds,
        hasFinancialAccess,
        format: body.format,
      });
    } else if (body.dataset === "dispatches") {
      datasetResult = await buildDispatchesDataset({
        filters: body.filters,
        search: body.search,
        scope: body.scope,
        selectedIds: body.selectedIds,
        hasFinancialAccess,
        format: body.format,
      });
    } else if (body.dataset === "inwards") {
      datasetResult = await buildInwardsDataset({
        filters: body.filters,
        search: body.search,
        scope: body.scope,
        selectedIds: body.selectedIds,
        hasFinancialAccess,
        format: body.format,
      });
    } else {
      return NextResponse.json({ error: `Dataset ${body.dataset} not implemented` }, { status: 400 });
    }

    // 5. Generate formatted file buffer
    let fileBuffer: Buffer;
    let contentType: string;
    let extension: string;

    const dateStamp = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());

    if (body.format === "xlsx") {
      fileBuffer = await renderXlsx(datasetResult);
      contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      extension = "xlsx";
    } else if (body.format === "pdf") {
      fileBuffer = await renderPdf(datasetResult);
      contentType = "application/pdf";
      extension = "pdf";
    } else {
      fileBuffer = renderCsv(datasetResult);
      contentType = "text/csv; charset=utf-8";
      extension = "csv";
    }

    const filename = `${datasetResult.title.replace(/[^a-zA-Z0-9_\-]+/g, "_")}_${dateStamp}.${extension}`;

    return new NextResponse(fileBuffer as any, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store, must-revalidate",
        "X-Export-ID": requestId,
        "X-Export-Count": String(datasetResult.totalCount),
      },
    });
  } catch (err: any) {
    const message = err?.message || "Failed to generate export file";
    return NextResponse.json({ error: message, requestId }, { status: 500 });
  }
}
