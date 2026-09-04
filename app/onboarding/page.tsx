import { redirect } from "next/navigation";
import { Suspense } from "react";

import { createClient } from "@/lib/supabase/server";

import { completeOnboarding } from "./actions";

type OnboardingSearchParams = Promise<{ error?: string }>;

export default function OnboardingPage({
  searchParams,
}: {
  searchParams: OnboardingSearchParams;
}) {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-12">
      <div className="mx-auto w-full max-w-2xl">
        <Brand />

        <Suspense fallback={<OnboardingCardFallback />}>
          <OnboardingContent searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

async function OnboardingContent({
  searchParams,
}: {
  searchParams: OnboardingSearchParams;
}) {
  const params = await searchParams;
  const error = params.error ? decodeURIComponent(params.error) : "";

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id, is_active, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.is_active === false) {
    redirect("/auth/disabled");
  }

  if (profile?.company_id) {
    redirect("/dashboard");
  }

  const fullName =
    profile?.full_name ||
    String(user.user_metadata?.full_name || "").trim();

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
      <div className="mb-7">
        <div className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          Company Setup
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-gray-900">
          Create your company workspace
        </h1>
        <p className="mt-2 text-sm leading-6 text-gray-500">
          Your account will become the company Owner and start on the
          Business360 Free plan. Plan limits can be changed later from the
          NetVilla platform controls.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form action={completeOnboarding} className="space-y-5">
        <div>
          <label
            htmlFor="full_name"
            className="mb-1.5 block text-sm font-medium text-gray-700"
          >
            Your name
          </label>
          <input
            id="full_name"
            name="full_name"
            type="text"
            required
            defaultValue={fullName}
            autoComplete="name"
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-gray-900"
          />
        </div>

        <div>
          <label
            htmlFor="company_name"
            className="mb-1.5 block text-sm font-medium text-gray-700"
          >
            Company name
          </label>
          <input
            id="company_name"
            name="company_name"
            type="text"
            required
            autoComplete="organization"
            placeholder="Your company"
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-gray-900"
          />
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          <div>
            <label
              htmlFor="country_code"
              className="mb-1.5 block text-sm font-medium text-gray-700"
            >
              Country
            </label>
            <select
              id="country_code"
              name="country_code"
              defaultValue="TH"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-gray-900"
            >
              <option value="TH">Thailand</option>
              <option value="MM">Myanmar</option>
              <option value="SG">Singapore</option>
              <option value="MY">Malaysia</option>
              <option value="VN">Vietnam</option>
              <option value="US">United States</option>
              <option value="GB">United Kingdom</option>
              <option value="AU">Australia</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="default_currency"
              className="mb-1.5 block text-sm font-medium text-gray-700"
            >
              Currency
            </label>
            <select
              id="default_currency"
              name="default_currency"
              defaultValue="THB"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-gray-900"
            >
              <option value="THB">THB</option>
              <option value="MMK">MMK</option>
              <option value="USD">USD</option>
              <option value="SGD">SGD</option>
              <option value="MYR">MYR</option>
              <option value="VND">VND</option>
              <option value="GBP">GBP</option>
              <option value="AUD">AUD</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="timezone"
              className="mb-1.5 block text-sm font-medium text-gray-700"
            >
              Timezone
            </label>
            <select
              id="timezone"
              name="timezone"
              defaultValue="Asia/Bangkok"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-gray-900"
            >
              <option value="Asia/Bangkok">Bangkok</option>
              <option value="Asia/Yangon">Yangon</option>
              <option value="Asia/Singapore">Singapore</option>
              <option value="Asia/Kuala_Lumpur">Kuala Lumpur</option>
              <option value="Asia/Ho_Chi_Minh">Ho Chi Minh City</option>
              <option value="UTC">UTC</option>
            </select>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <div className="text-sm font-medium text-gray-900">
            Starting plan: Free
          </div>
          <div className="mt-1 text-sm leading-6 text-gray-500">
            No payment is required now. Usage limits are controlled from the
            Business360 plan system and can be upgraded later.
          </div>
        </div>

        <button
          type="submit"
          className="w-full rounded-lg bg-gray-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-gray-800"
        >
          Create Company & Continue
        </button>
      </form>
    </div>
  );
}

function Brand() {
  return (
    <div className="mb-8">
      <div className="text-xl font-semibold tracking-tight text-gray-900">
        Business360
      </div>
      <div className="mt-1 text-sm text-gray-500">
        Business Operating System
      </div>
    </div>
  );
}

function OnboardingCardFallback() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
      <div className="h-3 w-28 animate-pulse rounded bg-gray-100" />
      <div className="mt-3 h-8 w-80 max-w-full animate-pulse rounded bg-gray-100" />
      <div className="mt-3 h-4 w-full animate-pulse rounded bg-gray-100" />
      <div className="mt-2 h-4 w-4/5 animate-pulse rounded bg-gray-100" />
      <div className="mt-8 space-y-5">
        <div className="h-11 animate-pulse rounded-lg bg-gray-100" />
        <div className="h-11 animate-pulse rounded-lg bg-gray-100" />
        <div className="grid gap-5 md:grid-cols-3">
          <div className="h-11 animate-pulse rounded-lg bg-gray-100" />
          <div className="h-11 animate-pulse rounded-lg bg-gray-100" />
          <div className="h-11 animate-pulse rounded-lg bg-gray-100" />
        </div>
      </div>
    </div>
  );
}
