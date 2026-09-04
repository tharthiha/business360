"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

function clean(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

async function requirePlatformAdmin() {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("is_platform_admin", {
    p_required_role: null,
  });

  if (error || data !== true) {
    redirect("/dashboard");
  }

  return supabase;
}

export async function updatePlanFeature(formData: FormData) {
  const supabase = await requirePlatformAdmin();

  const planKey = clean(formData.get("plan_key"));
  const featureKey = clean(formData.get("feature_key"));
  const enabled = clean(formData.get("enabled")) === "true";
  const rawLimit = clean(formData.get("limit_integer"));
  const limitInteger = rawLimit === "" ? null : Number(rawLimit);

  const { error } = await supabase.rpc("admin_update_plan_feature", {
    p_plan_key: planKey,
    p_feature_key: featureKey,
    p_enabled: enabled,
    p_limit_integer: Number.isFinite(limitInteger) ? limitInteger : null,
    p_limit_numeric: null,
    p_value_text: null,
  });

  if (error) {
    redirect(`/platform-admin?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/platform-admin");
  revalidatePath("/settings/plan");
  redirect("/platform-admin?saved=plan");
}

export async function assignCompanyPlan(formData: FormData) {
  const supabase = await requirePlatformAdmin();

  const companyId = Number(clean(formData.get("company_id")));
  const planKey = clean(formData.get("plan_key"));
  const billingSource = clean(formData.get("billing_source")) || "complimentary";
  const reason = clean(formData.get("reason"));

  const { error } = await supabase.rpc("admin_assign_company_plan", {
    p_company_id: companyId,
    p_plan_key: planKey,
    p_status: "active",
    p_billing_source: billingSource,
    p_reason: reason || null,
    p_current_period_end: null,
  });

  if (error) {
    redirect(`/platform-admin?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/platform-admin");
  revalidatePath(`/platform-admin/companies/${companyId}`);
  redirect("/platform-admin?saved=company");
}

export async function setCompanyOverride(formData: FormData) {
  const supabase = await requirePlatformAdmin();

  const companyId = Number(clean(formData.get("company_id")));
  const featureKey = clean(formData.get("feature_key"));
  const enabledRaw = clean(formData.get("enabled_override"));
  const enabledOverride =
    enabledRaw === "" ? null : enabledRaw === "true";

  const rawLimit = clean(formData.get("limit_integer_override"));
  const limitInteger =
    rawLimit === "" ? null : Number(rawLimit);

  const expiresAtRaw = clean(formData.get("expires_at"));
  const reason = clean(formData.get("reason"));

  const { error } = await supabase.rpc("admin_set_company_feature_override", {
    p_company_id: companyId,
    p_feature_key: featureKey,
    p_enabled_override: enabledOverride,
    p_limit_integer_override:
      Number.isFinite(limitInteger) ? limitInteger : null,
    p_limit_numeric_override: null,
    p_value_text_override: null,
    p_expires_at: expiresAtRaw ? new Date(expiresAtRaw).toISOString() : null,
    p_reason: reason || null,
  });

  if (error) {
    redirect(
      `/platform-admin/companies/${companyId}?error=${encodeURIComponent(
        error.message
      )}`
    );
  }

  revalidatePath(`/platform-admin/companies/${companyId}`);
  revalidatePath("/platform-admin");
  redirect(`/platform-admin/companies/${companyId}?saved=override`);
}

export async function clearCompanyOverride(formData: FormData) {
  const supabase = await requirePlatformAdmin();

  const companyId = Number(clean(formData.get("company_id")));
  const featureKey = clean(formData.get("feature_key"));

  const { error } = await supabase.rpc(
    "admin_clear_company_feature_override",
    {
      p_company_id: companyId,
      p_feature_key: featureKey,
    }
  );

  if (error) {
    redirect(
      `/platform-admin/companies/${companyId}?error=${encodeURIComponent(
        error.message
      )}`
    );
  }

  revalidatePath(`/platform-admin/companies/${companyId}`);
  revalidatePath("/platform-admin");
  redirect(`/platform-admin/companies/${companyId}?saved=override-cleared`);
}

export async function addCompanyNote(formData: FormData) {
  const supabase = await requirePlatformAdmin();

  const companyId = Number(clean(formData.get("company_id")));
  const note = clean(formData.get("note"));

  const { error } = await supabase.rpc("admin_add_company_note", {
    p_company_id: companyId,
    p_note: note,
  });

  if (error) {
    redirect(
      `/platform-admin/companies/${companyId}?error=${encodeURIComponent(
        error.message
      )}`
    );
  }

  revalidatePath(`/platform-admin/companies/${companyId}`);
  redirect(`/platform-admin/companies/${companyId}?saved=note`);
}

export async function setCompanySuspension(formData: FormData) {
  const supabase = await requirePlatformAdmin();

  const companyId = Number(clean(formData.get("company_id")));
  const suspended = clean(formData.get("is_suspended")) === "true";
  const reason = clean(formData.get("reason"));

  const { error } = await supabase.rpc("admin_set_company_suspension", {
    p_company_id: companyId,
    p_is_suspended: suspended,
    p_reason: reason || null,
  });

  if (error) {
    redirect(
      `/platform-admin/companies/${companyId}?error=${encodeURIComponent(
        error.message
      )}`
    );
  }

  revalidatePath(`/platform-admin/companies/${companyId}`);
  revalidatePath("/platform-admin");

  redirect(
    `/platform-admin/companies/${companyId}?saved=${
      suspended ? "suspended" : "reactivated"
    }`
  );
}

export async function updateBillingProfile(formData: FormData) {
  const supabase = await requirePlatformAdmin();

  const companyId = Number(clean(formData.get("company_id")));

  const { error } = await supabase.rpc(
    "admin_update_company_billing_profile",
    {
      p_company_id: companyId,
      p_billing_email: clean(formData.get("billing_email")) || null,
      p_provider: clean(formData.get("provider")) || null,
      p_provider_customer_id:
        clean(formData.get("provider_customer_id")) || null,
      p_provider_subscription_id:
        clean(formData.get("provider_subscription_id")) || null,
      p_tax_country_code:
        clean(formData.get("tax_country_code")) || null,
      p_tax_id: clean(formData.get("tax_id")) || null,
      p_billing_status:
        clean(formData.get("billing_status")) || "not_connected",
    }
  );

  if (error) {
    redirect(
      `/platform-admin/companies/${companyId}?error=${encodeURIComponent(
        error.message
      )}`
    );
  }

  revalidatePath(`/platform-admin/companies/${companyId}`);
  revalidatePath("/platform-admin");
  redirect(`/platform-admin/companies/${companyId}?saved=billing`);
}
