import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { authenticateRequest } from "@/lib/auth";
import { invalidateCache } from "@/lib/cache";
import { customerCodeChanged, generateCustomerInitials } from "@/lib/customer-identity";

interface ImportCustomerItem {
  cusCode?: string;
  companyName: string;
  gstin?: string;
  pan?: string;
  contactPerson?: string;
  contactNo?: string;
  email?: string;
}

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1], "action_create_customer");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const items: ImportCustomerItem[] = body.customers;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "No customer records provided for import" }, { status: 400 });
    }

    // Fetch existing active customers
    const { data: existingCustomers, error: fetchErr } = await supabaseAdmin
      .from("customers")
      .select("id, customername, initials, customer_code, pan_code, gstin, pan, contact_person, mobile, email")
      .is("deleted_at", null);

    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    const normalize = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

    // Track existing codes and initials for uniqueness
    const usedCodes = new Set(
      (existingCustomers || [])
        .map((c) => (c.customer_code || c.pan_code || "").trim().toUpperCase())
        .filter(Boolean)
    );
    const usedInitials = new Set(
      (existingCustomers || []).map((c) => (c.initials || "").trim().toUpperCase()).filter(Boolean)
    );

    let insertedCount = 0;
    let updatedCount = 0;
    const failures: { rowIndex: number; code: string; message: string }[] = [];
    const now = new Date().toISOString();

    for (const [rowIndex, item] of items.entries()) {
      const name = (item.companyName || "").trim();
      if (!name) {
        failures.push({ rowIndex, code: "INVALID_NAME", message: "Company name is required" });
        continue;
      }

      const normName = normalize(name);
      let cusCode = (item.cusCode || "").trim().toUpperCase();
      const gstin = (item.gstin || "").trim().toUpperCase() || null;
      const pan = (item.pan || "").trim().toUpperCase() || null;
      const contactPerson = (item.contactPerson || "").trim() || null;
      const mobile = item.contactNo ? String(item.contactNo).replace(/\D/g, "").slice(0, 10) : null;
      const email = (item.email || "").trim() || null;

      // Find match by exact name or code
      const matches = (existingCustomers || []).filter(
        (c) =>
          normalize(c.customername) === normName ||
          (cusCode &&
            ((c.customer_code && c.customer_code.trim().toUpperCase() === cusCode) ||
              (c.pan_code && c.pan_code.trim().toUpperCase() === cusCode)))
      );
      if (matches.length > 1) {
        failures.push({ rowIndex, code: "AMBIGUOUS_CUSTOMER", message: "The name and code match different customers. Please check this row." });
        continue;
      }
      const match = matches[0];

      if (match) {
        // Update existing record
        const updatePayload: Record<string, any> = {
          customername: name,
          updated_at: now,
          updated_by: auth.user.id,
        };

        if (cusCode && customerCodeChanged({ customer_code: cusCode }, match)) {
          failures.push({ rowIndex, code: "IMMUTABLE_CUSTOMER_CODE", message: "Customer Code cannot be changed after creation." });
          continue;
        }
        if (gstin) updatePayload.gstin = gstin;
        if (pan) updatePayload.pan = pan;
        if (contactPerson) updatePayload.contact_person = contactPerson;
        if (mobile) updatePayload.mobile = mobile;
        if (email) updatePayload.email = email;

        const { data: updated, error: updateError } = await supabaseAdmin.from("customers").update(updatePayload).eq("id", match.id).select("id").maybeSingle();
        if (updateError || !updated) {
          failures.push({ rowIndex, code: updateError?.code || "NOT_UPDATED", message: "Customer update failed" });
          continue;
        }
        updatedCount++;
      } else {
        // Insert new record
        // Generate code if missing
        if (!cusCode) {
          const rnd = Math.random().toString(36).substring(2, 8).toUpperCase();
          cusCode = `STC${rnd}`;
          while (usedCodes.has(cusCode)) {
            const nextRnd = Math.random().toString(36).substring(2, 8).toUpperCase();
            cusCode = `STC${nextRnd}`;
          }
        }
        usedCodes.add(cusCode);

        const initCandidate = generateCustomerInitials(name, usedInitials);
        usedInitials.add(initCandidate);

        const insertPayload = {
          customername: name,
          initials: initCandidate,
          customer_code: cusCode,
          pan_code: cusCode,
          gstin,
          pan,
          contact_person: contactPerson,
          mobile,
          email,
          usertype: "Customer",
          created_at: now,
          updated_at: now,
          created_by: auth.user.id,
        };

        const { data: inserted, error: insErr } = await supabaseAdmin.from("customers").insert([insertPayload]).select("id").single();
        if (!insErr) {
          insertedCount++;
          existingCustomers?.push({ ...insertPayload, id: inserted.id });
        } else {
          failures.push({ rowIndex, code: insErr.code || "INSERT_FAILED", message: "Customer insert failed" });
        }
      }
    }

    invalidateCache("customers_default_");
    invalidateCache("shared_customers");
    invalidateCache("api_counts_all");

    return NextResponse.json({
      success: failures.length === 0,
      partial: failures.length > 0 && insertedCount + updatedCount > 0,
      failures,
      failedCount: failures.length,
      insertedCount,
      updatedCount,
      totalProcessed: items.length,
      message: `${insertedCount} added, ${updatedCount} updated, ${failures.length} failed.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
