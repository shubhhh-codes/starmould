import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { authenticateRequest } from "@/lib/auth";
import { getCached, invalidateCache } from "@/lib/cache";

// GET /api/customers - fetch active customers/vendors from Supabase
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(req.url);
    const page = searchParams.get("page") ? Math.max(1, Number(searchParams.get("page"))) : null;
    const limit = Number(searchParams.get("limit") || searchParams.get("pageSize") || "500");
    const usertype = searchParams.get("usertype");
    const search = searchParams.get("search")?.trim();
    const checkInitial = searchParams.get("checkInitial");
    const checkUsername = searchParams.get("checkUsername");
    const excludeId = searchParams.get("excludeId");
    const id = searchParams.get("id");

    // Single customer fetch by ID
    if (id) {
      const { data: customer, error: cErr } = await supabaseAdmin
        .from("customers")
        .select("*")
        .eq("id", Number(id))
        .is("deleted_at", null)
        .single();
      if (cErr || !customer) {
        return NextResponse.json({ error: "Customer not found" }, { status: 404 });
      }
      return NextResponse.json({ customer, data: customer });
    }

    // 1. Initial existence check (replicates checkinitials in CustomerController.php:44-50)
    if (checkInitial) {
      const clean = checkInitial.replace(/\s+/g, "").toUpperCase();
      let query = supabaseAdmin
        .from("customers")
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

    // 2. Username existence check (replicates checkusername in CustomerController.php:29-43)
    if (checkUsername) {
      const clean = checkUsername.trim();
      let query = supabaseAdmin
        .from("customers")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .ilike("customername", clean);

      if (excludeId) {
        query = query.neq("id", excludeId);
      }

      const { count, error } = await query;
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ exists: (count ?? 0) > 0 });
    }

    // 3. Main listing query with explicit columns and server-side filtering
    const isDefaultQuery = !search && (!usertype || usertype === "All" || usertype === "ALL") && (!page || page === 1);
    const cacheKey = isDefaultQuery ? `customers_default_${limit}` : null;

    const executeFetch = async () => {
      let query = supabaseAdmin
        .from("customers")
        .select("id, customername, initials, mobile, mobile1, email, address, usertype, vendor_code, city, gstin, pan, bank_name, account_no, ifsc_code, contact_person, status_of_beneficiary, created_at, updated_at", { count: "exact" })
        .is("deleted_at", null)
        .order("id", { ascending: false });

      if (usertype && usertype !== "All" && usertype !== "ALL") {
        query = query.eq("usertype", usertype);
      }
      if (search) {
        query = query.or(`customername.ilike.%${search}%,initials.ilike.%${search}%,vendor_code.ilike.%${search}%,city.ilike.%${search}%,gstin.ilike.%${search}%,contact_person.ilike.%${search}%,mobile.ilike.%${search}%,email.ilike.%${search}%`);
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

      const customers = data || [];
      const totalCount = count ?? customers.length;
      const totalPages = Math.ceil(totalCount / limit) || 1;
      const currentPage = page || 1;

      return {
        customers,
        totalCount,
        totalPages,
        currentPage,
        limit,
      };
    };

    const result = cacheKey ? await getCached(cacheKey, 30, executeFetch) : await executeFetch();

    const response = NextResponse.json({
      customers: result.customers,
      data: result.customers,
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

// POST /api/customers - create customer in Supabase (Admin, Manager only)
export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1], "action_create_vendor");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const {
      customername,
      mobile,
      mobile1,
      email,
      initials,
      address,
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
    } = body;

    const cleanName = customername?.trim();
    const cleanInitials = initials?.replace(/\s+/g, "").toUpperCase().slice(0, 5);

    if (!cleanName) {
      return NextResponse.json({ error: "Customer name is required" }, { status: 400 });
    }
    if (!cleanInitials) {
      return NextResponse.json({ error: "Initials are required (max 5 letters)" }, { status: 400 });
    }
    if (!usertype) {
      return NextResponse.json({ error: "Usertype is required" }, { status: 400 });
    }

    if (usertype === "Vendor" || usertype === "Transport") {
      return NextResponse.json(
        { error: "Invalid account type: Vendor and Transporter registrations must use /api/vendors." },
        { status: 400 }
      );
    }

    // RBAC: Only Admin (role_id === 0) can create 'Customer'. Other roles (Manager, etc.) can only create 'Other'.
    if (usertype === "Customer" && auth.user.role_id !== 0) {
      return NextResponse.json(
        { error: "Access Denied: Only Administrators are authorized to create Customer records. Other roles may only register Vendors, Transporters, or Other entities." },
        { status: 403 }
      );
    }

    // Check duplicate initials against active records
    const { data: existingInitials } = await supabaseAdmin
      .from("customers")
      .select("id")
      .is("deleted_at", null)
      .ilike("initials", cleanInitials)
      .limit(1);

    if (existingInitials && existingInitials.length > 0) {
      return NextResponse.json({ error: "Initial already exists!" }, { status: 400 });
    }

    // Check duplicate name against active records
    const { data: existingName } = await supabaseAdmin
      .from("customers")
      .select("id")
      .is("deleted_at", null)
      .ilike("customername", cleanName)
      .limit(1);

    if (existingName && existingName.length > 0) {
      return NextResponse.json({ error: "Customer name already exists." }, { status: 400 });
    }

    const now = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from("customers")
      .insert([
        {
          customername: cleanName,
          initials: cleanInitials,
          mobile: mobile?.trim() || null,
          mobile1: mobile1?.trim() || null,
          email: email?.trim() || null,
          address: address?.trim() || null,
          usertype,
          vendor_code: vendor_code?.trim() || null,
          city: city?.trim() || null,
          gstin: gstin?.trim()?.toUpperCase() || null,
          pan: pan?.trim()?.toUpperCase() || null,
          bank_name: bank_name?.trim() || null,
          account_no: account_no?.trim() || null,
          ifsc_code: ifsc_code?.trim()?.toUpperCase() || null,
          contact_person: contact_person?.trim() || null,
          status_of_beneficiary: status_of_beneficiary?.trim() || null,
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
        if (error.message?.includes("initials")) {
          return NextResponse.json({ error: "Initial already exists!" }, { status: 400 });
        }
        if (error.message?.includes("customername")) {
          return NextResponse.json({ error: "Customer name already exists." }, { status: 400 });
        }
        return NextResponse.json({ error: "A record with this information already exists." }, { status: 400 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    invalidateCache("customers_default_");
    invalidateCache("shared_customers");
    invalidateCache("api_counts_all");

    return NextResponse.json({ customer: data, message: "Data added successfully" }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PUT /api/customers - update customer in Supabase (Admin, Manager only)
export async function PUT(req: NextRequest) {
  const auth = await authenticateRequest(req, [0, 1], "action_create_vendor");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const {
      id,
      customername,
      mobile,
      mobile1,
      email,
      address,
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
    } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing customer id" }, { status: 400 });
    }

    const cleanName = customername?.trim();
    if (!cleanName) {
      return NextResponse.json({ error: "Customer name is required" }, { status: 400 });
    }

    // Check duplicate name against other active records
    const { data: existingName } = await supabaseAdmin
      .from("customers")
      .select("id")
      .is("deleted_at", null)
      .neq("id", id)
      .ilike("customername", cleanName)
      .limit(1);

    if (existingName && existingName.length > 0) {
      return NextResponse.json({ error: "Customer name already exists." }, { status: 400 });
    }

    // RBAC: Non-admins cannot update records of type Customer or change a record's type to Customer
    if (auth.user.role_id !== 0) {
      if (usertype === "Customer") {
        return NextResponse.json(
          { error: "Access Denied: Only Administrators are authorized to manage Customer records." },
          { status: 403 }
        );
      }
      const { data: currentRec } = await supabaseAdmin
        .from("customers")
        .select("usertype")
        .eq("id", id)
        .single();
      if (currentRec?.usertype === "Customer") {
        return NextResponse.json(
          { error: "Access Denied: Only Administrators are authorized to modify Customer records." },
          { status: 403 }
        );
      }
    }

    const now = new Date().toISOString();
    const updatePayload: Record<string, any> = {
      customername: cleanName,
      mobile: mobile?.trim() || null,
      mobile1: mobile1?.trim() || null,
      email: email?.trim() || null,
      address: address?.trim() || null,
      vendor_code: vendor_code !== undefined ? (vendor_code?.trim() || null) : undefined,
      city: city !== undefined ? (city?.trim() || null) : undefined,
      gstin: gstin !== undefined ? (gstin?.trim()?.toUpperCase() || null) : undefined,
      pan: pan !== undefined ? (pan?.trim()?.toUpperCase() || null) : undefined,
      bank_name: bank_name !== undefined ? (bank_name?.trim() || null) : undefined,
      account_no: account_no !== undefined ? (account_no?.trim() || null) : undefined,
      ifsc_code: ifsc_code !== undefined ? (ifsc_code?.trim()?.toUpperCase() || null) : undefined,
      contact_person: contact_person !== undefined ? (contact_person?.trim() || null) : undefined,
      status_of_beneficiary: status_of_beneficiary !== undefined ? (status_of_beneficiary?.trim() || null) : undefined,
      updated_at: now,
      updated_by: auth.user.id,
    };

    // Remove undefined properties
    Object.keys(updatePayload).forEach((k) => updatePayload[k] === undefined && delete updatePayload[k]);

    if (usertype) {
      updatePayload.usertype = usertype;
    }

    const { data, error } = await supabaseAdmin
      .from("customers")
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
        if (error.message?.includes("initials")) {
          return NextResponse.json({ error: "Initial already exists!" }, { status: 400 });
        }
        if (error.message?.includes("customername")) {
          return NextResponse.json({ error: "Customer name already exists." }, { status: 400 });
        }
        return NextResponse.json({ error: "A record with this information already exists." }, { status: 400 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    invalidateCache("customers_default_");
    invalidateCache("shared_customers");
    invalidateCache("api_counts_all");

    return NextResponse.json({ customer: data, message: "Data updated successfully" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/customers - soft-delete customer in Supabase (Admin, Manager only)
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
      return NextResponse.json({ error: "Missing customer id" }, { status: 400 });
    }

    // RBAC: Non-admins cannot delete records of type Customer
    if (auth.user.role_id !== 0) {
      const { data: currentRec } = await supabaseAdmin
        .from("customers")
        .select("usertype")
        .eq("id", id)
        .single();
      if (currentRec?.usertype === "Customer") {
        return NextResponse.json(
          { error: "Access Denied: Only Administrators are authorized to delete Customer records." },
          { status: 403 }
        );
      }
    }

    // Perform soft delete by setting deleted_at timestamp (replicates Eloquent SoftDeletes)
    const { error } = await supabaseAdmin
      .from("customers")
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
        if (error.message?.includes("initials")) {
          return NextResponse.json({ error: "Initial already exists!" }, { status: 400 });
        }
        if (error.message?.includes("customername")) {
          return NextResponse.json({ error: "Customer name already exists." }, { status: 400 });
        }
        return NextResponse.json({ error: "A record with this information already exists." }, { status: 400 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    invalidateCache("customers_default_");
    invalidateCache("shared_customers");
    invalidateCache("api_counts_all");

    return NextResponse.json({ success: true, message: "Customer deleted successfully." });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
