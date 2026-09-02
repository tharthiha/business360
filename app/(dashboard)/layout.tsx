import type { ReactNode } from "react";

import AppSidebar from "@/components/app-sidebar";
import GlobalSearch from "@/components/global-search";

export const instant = false;

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 print:min-h-0 print:bg-white">
      <div className="flex min-h-screen print:min-h-0 print:block">
        {/* SIDEBAR
            Never print application navigation.
        */}
        <div className="print:hidden">
          <AppSidebar />
        </div>

        <div className="flex min-w-0 flex-1 flex-col print:block print:w-full print:min-w-0">
          {/* TOP APP HEADER
              Search / Notifications / Owner are screen-only.
          */}
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

              <button
                type="button"
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Owner
              </button>
            </div>
          </header>

          {/* MAIN CONTENT
              During print:
              - remove dashboard padding
              - remove dashboard width constraints
              - allow wide report tables to use full printable width
          */}
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