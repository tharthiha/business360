import Link from "next/link";
import type {
  ReactNode,
} from "react";
import {
  connection,
} from "next/server";
import {
  redirect,
} from "next/navigation";

import AppSidebar from "@/components/app-sidebar";
import GlobalSearch from "@/components/global-search";
import SignOutButton from "@/components/sign-out-button";
import {
  createClient,
} from "@/lib/supabase/server";
import {
  canAccessPath,
  normalizeRole,
} from "@/lib/role-permissions";

export const instant = false;

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  await connection();

  const supabase =
    await createClient();

  const {
    data: { user },
  } =
    await supabase.auth.getUser();

  if (!user) {
    redirect(
      "/auth/login"
    );
  }

  const {
    data: profile,
  } = await supabase
    .from("profiles")
    .select(`
      company_id,
      role,
      is_active,
      full_name,
      email
    `)
    .eq(
      "id",
      user.id
    )
    .maybeSingle();

  if (
    !profile ||
    !profile.company_id
  ) {
    redirect(
      "/onboarding"
    );
  }

  if (
    profile.is_active === false
  ) {
    redirect(
      "/auth/disabled"
    );
  }

  const role =
    normalizeRole(
      profile.role
    );

  const roleLabel =
    role.charAt(0).toUpperCase() +
    role.slice(1);

  const { data: subscriptionRows } =
    await supabase.rpc(
      "current_company_subscription"
    );

  const subscription =
    Array.isArray(subscriptionRows)
      ? subscriptionRows[0]
      : subscriptionRows;

  const planName =
    subscription?.plan_name ||
    subscription?.plan_key ||
    "Free";

  const planStatus =
    subscription?.status || "active";

  const canOpenAnySettings =
    role === "owner" ||
    canAccessPath(role, "/settings/company") ||
    canAccessPath(role, "/settings/business") ||
    canAccessPath(role, "/settings/accounting") ||
    canAccessPath(role, "/settings/documents") ||
    canAccessPath(role, "/settings/users") ||
    canAccessPath(role, "/settings/security");

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 print:min-h-0 print:bg-white">
      <div className="flex min-h-screen print:min-h-0 print:block">
        <div className="print:hidden">
          <AppSidebar
            role={role}
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col print:block print:w-full print:min-w-0">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-gray-200 bg-white px-6 print:hidden">
            <div className="hidden w-full md:block">
              <GlobalSearch />
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-2">
              <div
                title={`Subscription status: ${planStatus}`}
                className="hidden rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 sm:block"
              >
                Plan: {planName}
              </div>

              <Link
                href="/notifications"
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Notifications
              </Link>

              {canOpenAnySettings ? (
                <Link
                  href="/settings"
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  {roleLabel}
                </Link>
              ) : (
                <span className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-600">
                  {roleLabel}
                </span>
              )}

              <SignOutButton />
            </div>
          </header>

          <main className="flex-1 p-6 lg:p-8 print:m-0 print:block print:w-full print:max-w-none print:flex-none print:overflow-visible print:p-0">
            <div className="mx-auto w-full max-w-[1500px] print:mx-0 print:w-full print:max-w-none print:min-w-0 print:overflow-visible">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
