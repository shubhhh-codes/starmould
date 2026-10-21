import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { authenticateRequest } from "@/lib/auth";
import { getCached, invalidateCache } from "@/lib/cache";

// GET /api/vendors - fetch active vendors/transporters from public.vendors
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(req.url);
    const page = searchParams.get("page") ? Math.max(1, Number(searchParams.get("page"))) : null;
    const limit = Number(searchParams.get("limit") || searchParams.get("pageSize") || "500");
    const vendor_type = searchParams.get("vendor_type") || searchParams.get("usertype");
    const search = searchParams.get("search")?.trim();
    const checkInitial = searchParams.get("checkInitial");
    const checkVendorName = searchParams.get("checkVendorName") || searchParams.get("checkUsername");
    const checkVendorCode = searchParams.get("checkVendorCode");
    const excludeId = searchParams.get("excludeId");

    // 1. Initial existence check
    if (checkInitial) {
      const clean = checkInitial.replace(/\s+/g, "").toUpperCase();
      let query = supabaseAdmin
        .from("vendors")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .ilike("initials", clean);

      if (excludeId) {
        query = query.neq("id", excludeId);
      }

      const { count, error } = await query;
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ exists: (count ?? 0) > 0 });
    }

    // 2. Vendor name existence check
    if (checkVendorName) {
      const clean = checkVendorName.trim();
      let query = supabaseAdmin
        .from("vendors")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .ilike("vendor_name", clean);

      if (excludeId) {
        query = query.neq("id", excludeId);
      }

      const { count, error } = await query;
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ exists: (count ?? 0) > 0 });
    }

    // 3. Vendor code existence check
    if (checkVendorCode) {
      const clean = checkVendorCode.trim();
      let query = supabaseAdmin
        .from("vendors")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .ilike("vendor_code", clean);

      if (excludeId) {
        query = query.neq("id", excludeId);
      }

      const { count, error } = await query;
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ exists: (count ?? 0) > 0 });
    }

    // 4. Main listing query with pagination and server-side filtering
    const isDefaultQuery = !search && (!vendor_type || vendor_type === "All" || vendor_type === "ALL") && (!page || page === 1);
    const cacheKey = isDefaultQuery ? `vendors_default_${limit}` : null;

    const executeFetch = async () => {
      let query = supabaseAdmin
        .from("vendors")
        .select("*", { count: "exact" })
        .is("deleted_at", null)
        .order("id", { ascending: false });

      if (vendor_type && vendor_type !== "All" && vendor_type !== "ALL") {
        // Map legacy 'Vendor' to 'Supplier' and 'Transport' to 'Transporter' if requested
        const targetType = vendor_type === "Vendor" ? "Supplier" : vendor_type === "Transport" ? "Transporter" : vendor_type;
        query = query.eq("vendor_type", targetType);
      }

      if (search) {
        query = query.or(`vendor_name.ilike.%${search}%,initials.ilike.%${search}%,vendor_code.ilike.%${search}%,city.ilike.%${search}%,gstin.ilike.%${search}%,contact_person.ilike.%${search}%,mobile.ilike.%${search}%,email.ilike.%${search}%`);
      }

      if (page && page > 0) {
        const start = (page - 1) * limit;
        query = query.range(start, start + limit - 1);
      } else {
        query = query.limit(limit);
      }

      const { data, count, error } = await query;
      if (error) {
        throw new Error(error.message);
      }

      const vendors = data || [];
      const totalCount = count ?? vendors.length;
      const totalPages = Math.ceil(totalCount / limit) || 1;
      const currentPage = page || 1;

      return {
        vendors,
        totalCount,
        totalPages,
        currentPage,
        limit,
      };
    };

    const result = cacheKey ? await getCached(cacheKey, 30, executeFetch) : await executeFetch();

    const response = NextResponse.json({
      vendors: result.vendors,
      data: result.vendors,
      pagination: {
        page: result.currentPage,
        pageSize: result.limit,
        total: result.totalCount,
        totalPages: result.totalPages,
        hasNextPage: result.currentPage < result.totalPages,
        hasPreviousPage: result.currentPage > 1,
      },
    });
    response.headers.set("Cache-Control", "private, no-store, must-revalidate");
    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/vendors - create vendor in public.vendors (Admin, Manager only)
export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1], "action_create_vendor");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const {
      vendor_name,
      customername, // Fallback for backwards compatibility
      initials,
      vendor_code,
      vendor_type = "Supplier",
      usertype,
      city,
      gstin,
      pan,
      bank_name,
      account_no,
      ifsc_code,
      contact_person,
      status_of_beneficiary,
      mobile,
      mobile1,
      email,
      address,
    } = body;

    const cleanName = (vendor_name || customername)?.trim();
    const cleanInitials = initials?.replace(/\s+/g, "").toUpperCase().slice(0, 5);
    const targetType = (vendor_type === "Transporter" || usertype === "Transport") ? "Transporter" : "Supplier";

    if (!cleanName) {
      return NextResponse.json({ error: "Vendor name is required" }, { status: 400 });
    }
    if (!cleanInitials) {
      return NextResponse.json({ error: "Initials are required (max 5 letters)" }, { status: 400 });
    }
    if (targetType === "Supplier" && !vendor_code?.trim()) {
      return NextResponse.json({ error: "Vendor code is required" }, { status: 400 });
    }

    // Check duplicate initials against active vendors
    const { data: existingInitials } = await supabaseAdmin
      .from("vendors")
      .select("id")
      .is("deleted_at", null)
      .ilike("initials", cleanInitials)
      .limit(1);

    if (existingInitials && existingInitials.length > 0) {
      return NextResponse.json({ error: "Initial already exists!" }, { status: 400 });
    }

    // Check duplicate name against active vendors
    const { data: existingName } = await supabaseAdmin
      .from("vendors")
      .select("id")
      .is("deleted_at", null)
      .ilike("vendor_name", cleanName)
      .limit(1);

    if (existingName && existingName.length > 0) {
      return NextResponse.json({ error: "Vendor name already exists." }, { status: 400 });
    }

    // Check duplicate vendor_code if provided
    if (vendor_code?.trim()) {
      const { data: existingCode } = await supabaseAdmin
        .from("vendors")
        .select("id")
        .is("deleted_at", null)
        .ilike("vendor_code", vendor_code.trim())
        .limit(1);

      if (existingCode && existingCode.length > 0) {
        return NextResponse.json({ error: "Vendor code already exists." }, { status: 400 });
      }
    }

    const now = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from("vendors")
      .insert([
        {
          vendor_name: cleanName,
          initials: cleanInitials,
          vendor_code: vendor_code?.trim() || null,
          vendor_type: targetType,
          city: city?.trim() || null,
          gstin: gstin?.trim()?.toUpperCase() || null,
          pan: pan?.trim()?.toUpperCase() || null,
          bank_name: bank_name?.trim() || null,
          account_no: account_no?.trim() || null,
          ifsc_code: ifsc_code?.trim()?.toUpperCase() || null,
          contact_person: contact_person?.trim() || null,
          status_of_beneficiary: status_of_beneficiary?.trim() || null,
          mobile: mobile?.trim() || null,
          mobile1: mobile1?.trim() || null,
          email: email?.trim() || null,
          address: address?.trim() || null,
          created_at: now,
          updated_at: now,
          created_by: auth.user.id,
          updated_by: auth.user.id,
        },
      ])
      .select()
      .single();

    if (error) {
      if (
        error.code === "23505" ||
        error.message?.includes("unique constraint") ||
        error.message?.includes("duplicate key")
      ) {
        if (
          error.message?.includes("vendor_code") ||
          error.message?.includes("idx_vendors_vendor_code_unique")
        ) {
          return NextResponse.json({ error: "Vendor code already exists." }, { status: 400 });
        }
        if (error.message?.includes("initials")) {
          return NextResponse.json({ error: "Initial already exists!" }, { status: 400 });
        }
        if (error.message?.includes("vendor_name")) {
          return NextResponse.json({ error: "Vendor name already exists." }, { status: 400 });
        }
        return NextResponse.json({ error: "A vendor with this information already exists." }, { status: 400 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    invalidateCache("vendors_default_");
    invalidateCache("shared_vendors");
    invalidateCache("api_counts_all");

    return NextResponse.json({ vendor: data, message: "Vendor added successfully" }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT /api/vendors - update vendor in public.vendors (Admin, Manager only)
export async function PUT(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1], "action_create_vendor");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const {
      id,
      vendor_name,
      customername, // Fallback for backwards compatibility
      vendor_type,
      usertype,
      vendor_code,
      city,
      gstin,
      pan,
      bank_name,
      account_no,
      ifsc_code,
      contact_person,
      status_of_beneficiary,
      mobile,
      mobile1,
      email,
      address,
    } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing vendor id" }, { status: 400 });
    }

    const cleanName = (vendor_name || customername)?.trim();
    if (!cleanName) {
      return NextResponse.json({ error: "Vendor name is required" }, { status: 400 });
    }
    const targetType = (vendor_type === "Transporter" || usertype === "Transport") ? "Transporter" : "Supplier";
    if (targetType === "Supplier" && vendor_code !== undefined && !vendor_code?.trim()) {
      return NextResponse.json({ error: "Vendor code is required" }, { status: 400 });
    }

    // Check duplicate name against other active vendors
    const { data: existingName } = await supabaseAdmin
      .from("vendors")
      .select("id")
      .is("deleted_at", null)
      .neq("id", id)
      .ilike("vendor_name", cleanName)
      .limit(1);

    if (existingName && existingName.length > 0) {
      return NextResponse.json({ error: "Vendor name already exists." }, { status: 400 });
    }

    // Check duplicate vendor_code if updated
    if (vendor_code?.trim()) {
      const { data: existingCode } = await supabaseAdmin
        .from("vendors")
        .select("id")
        .is("deleted_at", null)
        .neq("id", id)
        .ilike("vendor_code", vendor_code.trim())
        .limit(1);

      if (existingCode && existingCode.length > 0) {
        return NextResponse.json({ error: "Vendor code already exists." }, { status: 400 });
      }
    }

    const now = new Date().toISOString();
    const updatePayload: Record<string, any> = {
      vendor_name: cleanName,
      vendor_code: vendor_code !== undefined ? (vendor_code?.trim() || null) : undefined,
      city: city !== undefined ? (city?.trim() || null) : undefined,
      gstin: gstin !== undefined ? (gstin?.trim()?.toUpperCase() || null) : undefined,
      pan: pan !== undefined ? (pan?.trim()?.toUpperCase() || null) : undefined,
      bank_name: bank_name !== undefined ? (bank_name?.trim() || null) : undefined,
      account_no: account_no !== undefined ? (account_no?.trim() || null) : undefined,
      ifsc_code: ifsc_code !== undefined ? (ifsc_code?.trim()?.toUpperCase() || null) : undefined,
      contact_person: contact_person !== undefined ? (contact_person?.trim() || null) : undefined,
      status_of_beneficiary: status_of_beneficiary !== undefined ? (status_of_beneficiary?.trim() || null) : undefined,
      mobile: mobile !== undefined ? (mobile?.trim() || null) : undefined,
      mobile1: mobile1 !== undefined ? (mobile1?.trim() || null) : undefined,
      email: email !== undefined ? (email?.trim() || null) : undefined,
      address: address !== undefined ? (address?.trim() || null) : undefined,
      updated_at: now,
      updated_by: auth.user.id,
    };

    if (vendor_type || usertype) {
      updatePayload.vendor_type = (vendor_type === "Transporter" || usertype === "Transport") ? "Transporter" : "Supplier";
    }

    // Clean undefined fields
    Object.keys(updatePayload).forEach((k) => updatePayload[k] === undefined && delete updatePayload[k]);

    const { data, error } = await supabaseAdmin
      .from("vendors")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (
        error.code === "23505" ||
        error.message?.includes("unique constraint") ||
        error.message?.includes("duplicate key")
      ) {
        if (
          error.message?.includes("vendor_code") ||
          error.message?.includes("idx_vendors_vendor_code_unique")
        ) {
          return NextResponse.json({ error: "Vendor code already exists." }, { status: 400 });
        }
        if (error.message?.includes("initials")) {
          return NextResponse.json({ error: "Initial already exists!" }, { status: 400 });
        }
        if (error.message?.includes("vendor_name")) {
          return NextResponse.json({ error: "Vendor name already exists." }, { status: 400 });
        }
        return NextResponse.json({ error: "A vendor with this information already exists." }, { status: 400 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    invalidateCache("vendors_default_");
    invalidateCache("shared_vendors");
    invalidateCache("api_counts_all");

    return NextResponse.json({ vendor: data, message: "Vendor updated successfully" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/vendors - soft-delete vendor in public.vendors (Admin, Manager only)
export async function DELETE(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1], "financial_soft_delete");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(req.url);
    let id = searchParams.get("id");

    if (!id) {
      const body = await req.json().catch(() => ({}));
      id = body.id;
    }

    if (!id) {
      return NextResponse.json({ error: "Missing vendor id" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("vendors")
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: auth.user.id,
      })
      .eq("id", id);

    if (error) {
      if (
        error.code === "23505" ||
        error.message?.includes("unique constraint") ||
        error.message?.includes("duplicate key")
      ) {
        if (
          error.message?.includes("idx_vendors_vendor_code_unique") ||
          error.message?.includes("vendor_code")
        ) {
          return NextResponse.json({ error: "Vendor code already exists." }, { status: 400 });
        }
        if (error.message?.includes("initials")) {
          return NextResponse.json({ error: "Initial already exists!" }, { status: 400 });
        }
        if (error.message?.includes("vendor_name")) {
          return NextResponse.json({ error: "Vendor name already exists." }, { status: 400 });
        }
        return NextResponse.json(
          { error: "A vendor with these details already exists." },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    invalidateCache("vendors_default_");
    invalidateCache("shared_vendors");
    invalidateCache("api_counts_all");

    return NextResponse.json({ success: true, message: "Vendor deleted successfully." });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
