import type { ReactNode } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";

import AppSidebar from "@/components/app-sidebar";
import GlobalSearch from "@/components/global-search";
import { createClient } from "@/lib/supabase/server";
import { normalizeRole } from "@/lib/role-permissions";

export const instant = false;

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  await connection();

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.is_active === false) {
    redirect("/auth/disabled");
  }

  const role = normalizeRole(profile.role);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 print:min-h-0 print:bg-white">
      <div className="flex min-h-screen print:min-h-0 print:block">
        <div className="print:hidden">
          <AppSidebar role={role} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col print:block print:w-full print:min-w-0">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-gray-200 bg-white px-6 print:hidden">
            <div className="hidden w-full md:block">
              <GlobalSearch />
            </div>

            <div className="ml-auto flex shrink-0 gap-2">
              <button
                type="button"
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Notifications
              </button>

              <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700">
                {roleLabel(role)}
              </div>
            </div>
          </header>

          <main className="flex-1 p-6 lg:p-8 print:block print:w-full print:max-w-none print:flex-none print:p-0 print:m-0 print:overflow-visible">
            <div className="mx-auto w-full max-w-[1500px] print:mx-0 print:w-full print:max-w-none print:min-w-0 print:overflow-visible">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

function roleLabel(role: string) {
  return role.charAt(0).toUpperCase() + role.slice(1);
}
