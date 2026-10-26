import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { authenticateRequest } from "@/lib/auth";
import { amountInWords } from "@/lib/number-to-words";
import { calculateGST } from "@/lib/gst-calculation";

export async function generateNextQuotationNo(): Promise<string> {
  const nowIST = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );
  const dd = String(nowIST.getDate()).padStart(2, "0");
  const mm = String(nowIST.getMonth() + 1).padStart(2, "0");
  const yyyy = String(nowIST.getFullYear());
  const todayPrefix = `SMQT${dd}${mm}${yyyy}`;

  const { count: todayCount } = await supabaseAdmin
    .from("quotations")
    .select("id", { count: "exact", head: true })
    .like("quotation_no", `${todayPrefix}%`);

  const seq = String((todayCount ?? 0) + 1).padStart(3, "0");
  return `${todayPrefix}${seq}`;
}

// GET /api/quotations - list quotations or get next quotation number
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1, 5], "nav_quotation");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(req.url);

    if (searchParams.get("action") === "next-number") {
      const nextNo = await generateNextQuotationNo();
      return NextResponse.json({ nextNumber: nextNo });
    }

    const page = searchParams.get("page") ? Math.max(1, Number(searchParams.get("page"))) : null;
    const limit = Number(searchParams.get("limit") || searchParams.get("pageSize") || "50");
    const search = searchParams.get("search")?.trim();
    const status = searchParams.get("status")?.trim();
    const id = searchParams.get("id");

    // Single quotation fetch
    if (id) {
      const { data: quote, error: qErr } = await supabaseAdmin
        .from("quotations")
        .select("*")
        .eq("id", id)
        .is("deleted_at", null)
        .single();

      if (qErr) {
        return NextResponse.json({ error: qErr.message }, { status: 404 });
      }

      const { data: items } = await supabaseAdmin
        .from("quotation_items")
        .select("*")
        .eq("quotation_id", id)
        .order("sr_no", { ascending: true });

      let customerCode = quote.customer_code || null;
      if (!customerCode && quote.customer_id) {
        const { data: cust } = await supabaseAdmin
          .from("customers")
          .select("customer_code, initials")
          .eq("id", quote.customer_id)
          .single();
        if (cust) {
          customerCode = cust.customer_code || cust.initials || null;
        }
      }

      return NextResponse.json({ quotation: { ...quote, customer_code: customerCode, items: items || [] } });
    }

    let query = supabaseAdmin
      .from("quotations")
      .select("*", { count: "exact" })
      .is("deleted_at", null)
      .order("id", { ascending: false });

    if (status && status !== "ALL" && status !== "All") {
      query = query.eq("status", status);
    }

    if (search) {
      query = query.or(`quotation_no.ilike.%${search}%,consignee_name.ilike.%${search}%,subject.ilike.%${search}%`);
    }

    if (page && page > 0) {
      const start = (page - 1) * limit;
      query = query.range(start, start + limit - 1);
    } else {
      query = query.limit(limit);
    }

    const { data: quotes, count, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const quotationList = quotes || [];
    const quoteIds = quotationList.map((q) => q.id);

    let allItems: any[] = [];
    if (quoteIds.length > 0) {
      const { data: itemsData } = await supabaseAdmin
        .from("quotation_items")
        .select("*")
        .in("quotation_id", quoteIds)
        .order("sr_no", { ascending: true });
      allItems = itemsData || [];
    }

    const customerIds = Array.from(new Set(quotationList.map((q: any) => q.customer_id).filter(Boolean)));
    const custMap = new Map<number, string>();
    if (customerIds.length > 0) {
      const { data: custs } = await supabaseAdmin
        .from("customers")
        .select("id, customer_code, initials")
        .in("id", customerIds);
      for (const c of custs || []) {
        custMap.set(c.id, c.customer_code || c.initials || "");
      }
    }

    const enrichedQuotes = quotationList.map((q: any) => ({
      ...q,
      customer_code: q.customer_code || (q.customer_id ? custMap.get(q.customer_id) : null) || null,
      items: allItems.filter((it: any) => it.quotation_id === q.id),
    }));

    const totalCount = count ?? quotationList.length;
    const totalPages = Math.ceil(totalCount / limit) || 1;
    const currentPage = page || 1;

    return NextResponse.json({
      quotations: enrichedQuotes,
      pagination: {
        page: currentPage,
        pageSize: limit,
        total: totalCount,
        totalPages,
        hasNextPage: currentPage < totalPages,
        hasPreviousPage: currentPage > 1,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/quotations - create new quotation with line items
export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1, 5], "nav_quotation");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const {
      quotation_no: customNo,
      quotation_date,
      customer_id,
      consignee_name,
      consignee_address,
      consignee_gstin,
      consignee_pan,
      consignee_phone,
      consignee_email,
      subject,
      reference,
      tax_type,
      tax_rate,
      taxable_amount,
      cgst_amount,
      sgst_amount,
      igst_amount,
      grand_total,
      bank_name,
      bank_account_no,
      bank_ifsc,
      bank_branch,
      bank_address,
      price_terms,
      delivery_terms,
      payment_terms,
      validity_terms,
      order_confirmation,
      warranty_terms,
      jurisdiction_terms,
      force_majeure,
      notes,
      include_digital_stamp,
      status,
      items,
    } = body;

    if (!consignee_name || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Customer name and at least one item are required" },
        { status: 400 }
      );
    }

    let finalQuotationNo = customNo?.trim();
    if (!finalQuotationNo) {
      finalQuotationNo = await generateNextQuotationNo();
    }

    const discountVal = Number(body.discount_amount) || 0;
    const gst = calculateGST(items, tax_type || "gst_18", 18, discountVal);
    const calculatedWords = amountInWords(gst.grandTotal);

    const { data: newQuote, error: qErr } = await supabaseAdmin
      .from("quotations")
      .insert({
        quotation_no: finalQuotationNo,
        quotation_date: quotation_date || new Date().toISOString().split("T")[0],
        customer_id: customer_id ? Number(customer_id) : null,
        consignee_name: consignee_name.trim(),
        consignee_address: consignee_address || null,
        consignee_gstin: consignee_gstin || null,
        consignee_pan: consignee_pan || null,
        consignee_phone: consignee_phone || null,
        consignee_email: consignee_email || null,
        subject: subject || null,
        reference: reference || null,
        tax_type: gst.taxType,
        tax_rate: gst.taxRate,
        taxable_amount: gst.taxableAmount,
        discount_amount: discountVal,
        cgst_amount: gst.cgstAmount,
        sgst_amount: gst.sgstAmount,
        igst_amount: gst.igstAmount,
        grand_total: gst.grandTotal,
        amount_in_words: calculatedWords,
        bank_name: bank_name || "Central Bank Of India",
        bank_account_no: bank_account_no || "5875819245",
        bank_ifsc: bank_ifsc || "CBIN0281313",
        bank_branch: bank_branch || "Saurashtra University Branch",
        bank_address: bank_address || "Saurashtra University Campus, Rajkot",
        price_terms: price_terms || "Prices are in Indian Rupees (₹), firm and fixed, Ex-Works Rajkot. GST @ [18]% extra as applicable. Freight and transit insurance [extra at actuals / included].",
        delivery_terms: delivery_terms || "[__] days from receipt of a clear Purchase Order together with the advance payment; subject to material availability and production capacity.",
        payment_terms: payment_terms || "[50% advance along with Purchase Order, balance 50% before dispatch / within __ days of invoice]. Payment by NEFT / RTGS / cheque in favour of Starmould Technology Pvt. Ltd.",
        validity_terms: validity_terms || "This quotation is valid for [15] days from the date of issue. Prices and delivery are subject to change thereafter.",
        order_confirmation: order_confirmation || "Manufacturing starts only after receipt of advance payment and a written Purchase Order.",
        warranty_terms: warranty_terms || "[__ months] against manufacturing defects only; excludes misuse, mishandling, overloading or external damage.",
        jurisdiction_terms: jurisdiction_terms || "Subject to Rajkot, Gujarat jurisdiction only.",
        force_majeure: force_majeure || "This Clause Is Applicable.",
        notes: notes || null,
        include_digital_stamp: include_digital_stamp !== false,
        status: status || "Draft",
        created_by: auth.user.username || "System",
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (qErr) {
      return NextResponse.json({ error: qErr.message }, { status: 500 });
    }

    const itemsToInsert = items.map((it: any, index: number) => ({
      quotation_id: newQuote.id,
      sr_no: index + 1,
      product_description: it.product_description || "",
      qty: Number(it.qty) || 1,
      unit: it.unit || "Nos",
      unit_price: Number(it.unit_price) || 0,
      total_amount: Number(it.total_amount) || (Number(it.qty) || 1) * (Number(it.unit_price) || 0),
    }));

    const { data: insertedItems, error: itErr } = await supabaseAdmin
      .from("quotation_items")
      .insert(itemsToInsert)
      .select();

    if (itErr) {
      return NextResponse.json({ error: itErr.message }, { status: 500 });
    }

    return NextResponse.json({
      quotation: {
        ...newQuote,
        items: insertedItems || [],
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH /api/quotations - update quotation and its items
export async function PATCH(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1, 5], "nav_quotation");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const {
      id,
      quotation_no,
      quotation_date,
      customer_id,
      consignee_name,
      consignee_address,
      consignee_gstin,
      consignee_pan,
      consignee_phone,
      consignee_email,
      subject,
      reference,
      tax_type,
      tax_rate,
      taxable_amount,
      cgst_amount,
      sgst_amount,
      igst_amount,
      grand_total,
      bank_name,
      bank_account_no,
      bank_ifsc,
      bank_branch,
      bank_address,
      price_terms,
      delivery_terms,
      payment_terms,
      validity_terms,
      order_confirmation,
      warranty_terms,
      jurisdiction_terms,
      force_majeure,
      notes,
      include_digital_stamp,
      status,
      items,
    } = body;

    if (!id) {
      return NextResponse.json({ error: "Quotation ID is required" }, { status: 400 });
    }

    // Direct status-only update handler
    if (status && !items) {
      const validStatuses = ["Draft", "Sent", "Accepted", "Rejected", "Expired"];
      if (!validStatuses.includes(status)) {
        return NextResponse.json({ error: "Invalid quotation status" }, { status: 400 });
      }

      const { data: updatedQuote, error: sErr } = await supabaseAdmin
        .from("quotations")
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (sErr) {
        return NextResponse.json({ error: sErr.message }, { status: 400 });
      }

      return NextResponse.json({ success: true, quotation: updatedQuote });
    }

    const gst = calculateGST(items || [], tax_type || "gst_18");
    const calculatedWords = amountInWords(gst.grandTotal);

    const { data: updatedQuote, error: qErr } = await supabaseAdmin
      .from("quotations")
      .update({
        quotation_no: quotation_no?.trim(),
        quotation_date,
        customer_id: customer_id ? Number(customer_id) : null,
        consignee_name: consignee_name?.trim(),
        consignee_address,
        consignee_gstin,
        consignee_pan,
        consignee_phone,
        consignee_email,
        subject,
        reference,
        tax_type: gst.taxType,
        tax_rate: gst.taxRate,
        taxable_amount: gst.taxableAmount,
        cgst_amount: gst.cgstAmount,
        sgst_amount: gst.sgstAmount,
        igst_amount: gst.igstAmount,
        grand_total: gst.grandTotal,
        amount_in_words: calculatedWords,
        bank_name,
        bank_account_no,
        bank_ifsc,
        bank_branch,
        bank_address,
        price_terms,
        delivery_terms,
        payment_terms,
        validity_terms,
        order_confirmation,
        warranty_terms,
        jurisdiction_terms,
        force_majeure,
        notes,
        include_digital_stamp: Boolean(include_digital_stamp),
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (qErr) {
      return NextResponse.json({ error: qErr.message }, { status: 500 });
    }

    // If items are provided, replace them
    if (items && Array.isArray(items)) {
      await supabaseAdmin.from("quotation_items").delete().eq("quotation_id", id);

      const itemsToInsert = items.map((it: any, index: number) => ({
        quotation_id: id,
        sr_no: index + 1,
        product_description: it.product_description || "",
        qty: Number(it.qty) || 1,
        unit: it.unit || "Nos",
        unit_price: Number(it.unit_price) || 0,
        total_amount: Number(it.total_amount) || (Number(it.qty) || 1) * (Number(it.unit_price) || 0),
      }));

      await supabaseAdmin.from("quotation_items").insert(itemsToInsert);
    }

    const { data: updatedItems } = await supabaseAdmin
      .from("quotation_items")
      .select("*")
      .eq("quotation_id", id)
      .order("sr_no", { ascending: true });

    return NextResponse.json({
      quotation: {
        ...updatedQuote,
        items: updatedItems || [],
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/quotations - soft delete quotation
export async function DELETE(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1, 5], "nav_quotation");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Quotation ID is required" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("quotations")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
