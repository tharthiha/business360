import { NextRequest, NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_ROLES = new Set([
  "admin",
  "accountant",
  "sales",
  "inventory",
  "staff",
  "viewer",
]);

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "You must be signed in." },
        { status: 401 }
      );
    }

    const { data: actor, error: actorError } = await supabase
      .from("profiles")
      .select("company_id, role, is_active")
      .eq("id", user.id)
      .single();

    if (
      actorError ||
      !actor?.company_id ||
      String(actor.role || "").toLowerCase() !== "owner" ||
      actor.is_active === false
    ) {
      return NextResponse.json(
        { error: "Only an active company owner can invite staff." },
        { status: 403 }
      );
    }

    const body = await request.json();

    const email = String(body?.email || "")
      .trim()
      .toLowerCase();

    const fullName = String(body?.full_name || "").trim();

    const role = String(body?.role || "staff")
      .trim()
      .toLowerCase();

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "Enter a valid email address." },
        { status: 400 }
      );
    }

    if (!ALLOWED_ROLES.has(role)) {
      return NextResponse.json(
        { error: "Choose a valid staff role." },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        {
          error:
            "Server invitation credentials are not configured. Add SUPABASE_SERVICE_ROLE_KEY.",
        },
        { status: 500 }
      );
    }

    const admin = createAdminClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const origin =
      request.headers.get("origin") ||
      new URL(request.url).origin;

    // IMPORTANT:
    // We are using Supabase's default invite email template.
    // The default ConfirmationURL already verifies the invite token.
    // Therefore redirect directly to the password setup page after verification.
    const redirectTo = `${origin}/auth/invite`;

    const { data: inviteData, error: inviteError } =
      await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo,
        data: {
          full_name: fullName || undefined,
        },
      });

    if (inviteError || !inviteData.user) {
      return NextResponse.json(
        {
          error:
            inviteError?.message ||
            "Could not create staff invitation.",
        },
        { status: 400 }
      );
    }

    const invitedUserId = inviteData.user.id;

    const { error: profileError } = await admin
      .from("profiles")
      .upsert(
        {
          id: invitedUserId,
          company_id: Number(actor.company_id),
          role,
          is_active: true,
          email,
          full_name: fullName || null,
          invited_by: user.id,
          invited_at: new Date().toISOString(),
        },
        {
          onConflict: "id",
        }
      );

    if (profileError) {
      return NextResponse.json(
        {
          error:
            "Invitation email was created, but the staff profile could not be assigned: " +
            profileError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: `Invitation sent to ${email}.`,
    });
  } catch (error) {
    console.error("[staff-invite]", error);

    return NextResponse.json(
      { error: "Unexpected error while inviting staff." },
      { status: 500 }
    );
  }
}
