"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

function clean(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function fail(message: string): never {
  redirect(`/onboarding?error=${encodeURIComponent(message)}`);
}

export async function completeOnboarding(formData: FormData) {
  const companyName = clean(formData.get("company_name"));
  const fullName = clean(formData.get("full_name"));
  const countryCode = clean(formData.get("country_code")) || "TH";
  const defaultCurrency = clean(formData.get("default_currency")) || "THB";
  const timezone = clean(formData.get("timezone")) || "Asia/Bangkok";

  if (!companyName) {
    fail("Company name is required.");
  }

  if (!fullName) {
    fail("Your name is required.");
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { error } = await supabase.rpc("complete_company_onboarding", {
    p_company_name: companyName,
    p_full_name: fullName,
    p_country_code: countryCode,
    p_default_currency: defaultCurrency,
    p_timezone: timezone,
  });

  if (error) {
    fail(error.message);
  }

  redirect("/dashboard");
}
