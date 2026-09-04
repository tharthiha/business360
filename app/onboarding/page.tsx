import { redirect } from "next/navigation";
import { Suspense } from "react";

import { createClient } from "@/lib/supabase/server";

import OnboardingForm from "./onboarding-form";

type OnboardingSearchParams = Promise<{ error?: string }>;

export default function OnboardingPage({
  searchParams,
}: {
  searchParams: OnboardingSearchParams;
}) {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#eef2ff,_#f8fafc_42%,_#f8fafc)] px-4 py-10 sm:py-16">
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <div className="text-xl font-semibold tracking-tight text-slate-950">
              Business360
            </div>
            <div className="mt-1 text-sm text-slate-500">
              Business Operating System
            </div>
          </div>

          <div className="hidden rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-500 shadow-sm sm:block">
            by NetVilla
          </div>
        </div>

        <Suspense fallback={<OnboardingFallback />}>
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
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60">
      <div className="grid lg:grid-cols-[0.9fr_1.45fr]">
        <aside className="bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-600 p-8 text-white lg:p-10">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-100">
            Company setup
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">
            Create your Business360 workspace.
          </h1>
          <p className="mt-4 text-sm leading-7 text-indigo-100">
            Set the company basics once. You can refine tax, documents,
            accounting and team settings after setup.
          </p>

          <div className="mt-8 space-y-4">
            {[
              ["1", "Company profile", "Name, country, currency and timezone"],
              ["2", "Owner access", "Your verified account becomes the Owner"],
              ["3", "Free plan", "Start immediately with backend-controlled limits"],
            ].map(([number, title, description]) => (
              <div key={number} className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs font-semibold ring-1 ring-white/20">
                  {number}
                </div>
                <div>
                  <div className="text-sm font-semibold">{title}</div>
                  <div className="mt-0.5 text-xs leading-5 text-indigo-100">
                    {description}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </aside>

        <div className="p-7 sm:p-9 lg:p-10">
          <div className="mb-7">
            <div className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
              Welcome to Business360
            </div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              Tell us about your company
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              These defaults will be used across documents, reporting and dates.
            </p>
          </div>

          {error && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <OnboardingForm fullName={fullName} />
        </div>
      </div>
    </section>
  );
}

function OnboardingFallback() {
  return (
    <div className="h-[560px] animate-pulse rounded-3xl border border-slate-200 bg-white shadow-sm" />
  );
}
