import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { authenticateRequest } from "@/lib/auth";
import { invalidateCache } from "@/lib/cache";

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
    const now = new Date().toISOString();

    for (const item of items) {
      const name = (item.companyName || "").trim();
      if (!name) continue;

      const normName = normalize(name);
      let cusCode = (item.cusCode || "").trim().toUpperCase();
      const gstin = (item.gstin || "").trim().toUpperCase() || null;
      const pan = (item.pan || "").trim().toUpperCase() || null;
      const contactPerson = (item.contactPerson || "").trim() || null;
      const mobile = item.contactNo ? String(item.contactNo).replace(/\D/g, "").slice(0, 10) : null;
      const email = (item.email || "").trim() || null;

      // Find match by exact name or code
      const match = (existingCustomers || []).find(
        (c) =>
          normalize(c.customername) === normName ||
          (cusCode &&
            ((c.customer_code && c.customer_code.trim().toUpperCase() === cusCode) ||
              (c.pan_code && c.pan_code.trim().toUpperCase() === cusCode)))
      );

      if (match) {
        // Update existing record
        const updatePayload: Record<string, any> = {
          customername: name,
          updated_at: now,
          updated_by: auth.user.id,
        };

        if (cusCode) {
          updatePayload.customer_code = cusCode;
          updatePayload.pan_code = cusCode;
        }
        if (gstin) updatePayload.gstin = gstin;
        if (pan) updatePayload.pan = pan;
        if (contactPerson) updatePayload.contact_person = contactPerson;
        if (mobile) updatePayload.mobile = mobile;
        if (email) updatePayload.email = email;

        await supabaseAdmin.from("customers").update(updatePayload).eq("id", match.id);
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

        // Generate initials
        let initials = name
          .split(/\s+/)
          .map((w) => w[0])
          .join("")
          .toUpperCase()
          .slice(0, 5);

        if (!initials || initials.length < 2) {
          initials = name.slice(0, 5).toUpperCase();
        }

        let initCandidate = initials;
        let suffix = 1;
        while (usedInitials.has(initCandidate)) {
          initCandidate = `${initials.slice(0, 4)}${suffix++}`.slice(0, 5);
        }
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

        const { error: insErr } = await supabaseAdmin.from("customers").insert([insertPayload]);
        if (!insErr) {
          insertedCount++;
        }
      }
    }

    invalidateCache("customers_default_");
    invalidateCache("shared_customers");
    invalidateCache("api_counts_all");

    return NextResponse.json({
      success: true,
      insertedCount,
      updatedCount,
      totalProcessed: items.length,
      message: `Successfully processed ${items.length} records (${insertedCount} added, ${updatedCount} updated).`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
