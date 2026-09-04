"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

function clean(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

async function requirePlatformAdmin() {
  const supabase = await createClient();

  const { data, error } =
    await supabase.rpc(
      "is_platform_admin",
      {
        p_required_role: null,
      }
    );

  if (error || data !== true) {
    redirect("/dashboard");
  }

  return supabase;
}

export async function updatePlanFeature(
  formData: FormData
) {
  const supabase =
    await requirePlatformAdmin();

  const planKey =
    clean(formData.get("plan_key"));

  const featureKey =
    clean(formData.get("feature_key"));

  const enabled =
    clean(formData.get("enabled")) ===
    "true";

  const rawLimit =
    clean(
      formData.get("limit_integer")
    );

  const limitInteger =
    rawLimit === ""
      ? null
      : Number(rawLimit);

  const { error } =
    await supabase.rpc(
      "admin_update_plan_feature",
      {
        p_plan_key: planKey,
        p_feature_key: featureKey,
        p_enabled: enabled,
        p_limit_integer:
          Number.isFinite(limitInteger)
            ? limitInteger
            : null,
        p_limit_numeric: null,
        p_value_text: null,
      }
    );

  if (error) {
    redirect(
      `/platform-admin?error=${encodeURIComponent(
        error.message
      )}`
    );
  }

  revalidatePath(
    "/platform-admin"
  );
  revalidatePath(
    "/settings/plan"
  );

  redirect(
    "/platform-admin?saved=plan"
  );
}

export async function assignCompanyPlan(
  formData: FormData
) {
  const supabase =
    await requirePlatformAdmin();

  const companyId =
    Number(
      clean(
        formData.get("company_id")
      )
    );

  const planKey =
    clean(formData.get("plan_key"));

  const billingSource =
    clean(
      formData.get("billing_source")
    ) || "complimentary";

  const reason =
    clean(formData.get("reason"));

  const { error } =
    await supabase.rpc(
      "admin_assign_company_plan",
      {
        p_company_id: companyId,
        p_plan_key: planKey,
        p_status: "active",
        p_billing_source:
          billingSource,
        p_reason:
          reason || null,
        p_current_period_end:
          null,
      }
    );

  if (error) {
    redirect(
      `/platform-admin?error=${encodeURIComponent(
        error.message
      )}`
    );
  }

  revalidatePath(
    "/platform-admin"
  );

  redirect(
    "/platform-admin?saved=company"
  );
}
