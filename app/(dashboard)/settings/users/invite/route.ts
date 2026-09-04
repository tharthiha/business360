import { NextRequest, NextResponse } from "next/server";
import {
  createClient as createAdminClient,
  type SupabaseClient,
} from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_ROLES = new Set([
  "admin",
  "accountant",
  "sales",
  "inventory",
  "staff",
  "viewer",
]);

type EffectiveUserLimit = {
  enabled: boolean;
  limit: number | null;
  currentUsage: number;
};

type FeatureRow = {
  id: number;
  default_enabled: boolean | null;
  default_integer: number | null;
};

type SubscriptionRow = {
  plan_id: number | null;
};

type PlanFeatureRow = {
  enabled: boolean | null;
  limit_integer: number | null;
};

type OverrideRow = {
  enabled_override: boolean | null;
  limit_integer_override: number | null;
  expires_at: string | null;
  updated_at: string | null;
};

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

    // Use an untyped admin client here because the project's generated
    // Supabase Database types do not yet include the SaaS entitlement tables.
    // Explicit row types below keep this route type-safe and avoid `never`.
    const admin = createAdminClient<any>(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const companyId = Number(actor.company_id);

    const entitlement = await getEffectiveUserLimit(
      admin,
      companyId
    );

    if (!entitlement.enabled) {
      return NextResponse.json(
        {
          error:
            "User invitations are not available for this company.",
          code: "USER_LIMIT_DISABLED",
        },
        { status: 403 }
      );
    }

    if (
      entitlement.limit !== null &&
      entitlement.currentUsage >= entitlement.limit
    ) {
      return NextResponse.json(
        {
          error: `You’ve reached your Maximum Users limit of ${entitlement.limit}. Increase the company limit or upgrade the subscription plan.`,
          code: "USER_LIMIT_REACHED",
          limit: entitlement.limit,
          usage: entitlement.currentUsage,
        },
        { status: 409 }
      );
    }

    const origin =
      request.headers.get("origin") ||
      new URL(request.url).origin;

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
          company_id: companyId,
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
      console.error(
        "[staff-invite] profile assignment failed",
        profileError
      );

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
      usage: entitlement.currentUsage + 1,
      limit: entitlement.limit,
    });
  } catch (error) {
    console.error("[staff-invite]", error);

    const message =
      error instanceof Error
        ? error.message
        : "Unexpected error while inviting staff.";

    if (message.includes("USER_LIMIT_NO_SUBSCRIPTION")) {
      return NextResponse.json(
        {
          error:
            "This company does not have an active subscription.",
          code: "USER_LIMIT_NO_SUBSCRIPTION",
        },
        { status: 403 }
      );
    }

    if (message.includes("USER_LIMIT_CONFIG_ERROR")) {
      return NextResponse.json(
        {
          error:
            "Maximum Users is not configured correctly for this company.",
          code: "USER_LIMIT_CONFIG_ERROR",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Unexpected error while inviting staff." },
      { status: 500 }
    );
  }
}

async function getEffectiveUserLimit(
  admin: SupabaseClient<any>,
  companyId: number
): Promise<EffectiveUserLimit> {
  const {
    data: featureData,
    error: featureError,
  } = await admin
    .from("saas_features")
    .select("id, default_enabled, default_integer")
    .eq("feature_key", "users_max")
    .eq("is_active", true)
    .maybeSingle();

  const feature =
    featureData as FeatureRow | null;

  if (featureError || !feature) {
    console.error(
      "[staff-invite] users_max feature error",
      featureError
    );

    throw new Error(
      "USER_LIMIT_CONFIG_ERROR: users_max feature is not configured."
    );
  }

  const {
    data: subscriptionData,
    error: subscriptionError,
  } = await admin
    .from("company_subscriptions")
    .select("plan_id")
    .eq("company_id", companyId)
    .eq("status", "active")
    .is("ended_at", null)
    .order("created_at", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  const subscription =
    subscriptionData as SubscriptionRow | null;

  if (subscriptionError) {
    console.error(
      "[staff-invite] subscription lookup error",
      subscriptionError
    );

    throw subscriptionError;
  }

  if (!subscription?.plan_id) {
    throw new Error(
      "USER_LIMIT_NO_SUBSCRIPTION: Company does not have an active subscription."
    );
  }

  const {
    data: planFeatureData,
    error: planFeatureError,
  } = await admin
    .from("saas_plan_features")
    .select("enabled, limit_integer")
    .eq("plan_id", subscription.plan_id)
    .eq("feature_id", feature.id)
    .maybeSingle();

  const planFeature =
    planFeatureData as PlanFeatureRow | null;

  if (planFeatureError) {
    console.error(
      "[staff-invite] plan feature lookup error",
      planFeatureError
    );

    throw planFeatureError;
  }

  const {
    data: overrideData,
    error: overrideError,
  } = await admin
    .from("company_feature_overrides")
    .select(
      "enabled_override, limit_integer_override, expires_at, updated_at"
    )
    .eq("company_id", companyId)
    .eq("feature_id", feature.id)
    .or(
      `expires_at.is.null,expires_at.gt.${new Date().toISOString()}`
    )
    .order("updated_at", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  const override =
    overrideData as OverrideRow | null;

  if (overrideError) {
    console.error(
      "[staff-invite] override lookup error",
      overrideError
    );

    throw overrideError;
  }

  const enabled =
    override?.enabled_override ??
    planFeature?.enabled ??
    feature.default_enabled ??
    false;

  const rawLimit =
    override?.limit_integer_override ??
    planFeature?.limit_integer ??
    feature.default_integer ??
    null;

  const limit =
    rawLimit === null
      ? null
      : Number(rawLimit);

  if (
    limit !== null &&
    (!Number.isFinite(limit) || limit < 0)
  ) {
    throw new Error(
      "USER_LIMIT_CONFIG_ERROR: Invalid users_max limit."
    );
  }

  const {
    count: currentUsage,
    error: usageError,
  } = await admin
    .from("profiles")
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq("company_id", companyId)
    .eq("is_active", true);

  if (usageError) {
    console.error(
      "[staff-invite] active-user count error",
      usageError
    );

    throw usageError;
  }

  return {
    enabled,
    limit,
    currentUsage: currentUsage ?? 0,
  };
}
