"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { createClient } from "@/lib/supabase/client";

import {
  canAccessPath,
  normalizeRole,
  type Business360Role,
} from "@/lib/role-permissions";

export default function AppSidebar({
  role,
}: {
  role: Business360Role | string;
}) {
  const normalizedRole = normalizeRole(role);
  const pathname = usePathname();
  const router = useRouter();

  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkOnboarding() {
      const supabase = createClient();

      const { data, error } = await supabase.rpc(
        "current_company_onboarding_status"
      );

      if (cancelled || error) return;

      const status = Array.isArray(data) ? data[0] : data;

      if (
        status &&
        status.onboarding_completed === false &&
        pathname !== "/settings/company"
      ) {
        router.replace("/settings/company");
      }
    }

    void checkOnboarding();

    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  useEffect(() => {
    let cancelled = false;

    async function refreshNotifications() {
      const supabase = createClient();

      const { error: refreshError } = await supabase.rpc(
        "refresh_business_notifications"
      );

      if (refreshError) {
        console.error("[notifications-refresh]", refreshError);
      }

      if (
        pathname === "/notifications" ||
        pathname.startsWith("/notifications/")
      ) {
        if (!cancelled) setUnreadNotifications(0);
        return;
      }

      const { count, error: countError } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .eq("is_read", false);

      if (!cancelled && !countError) {
        setUnreadNotifications(count || 0);
      }
    }

    void refreshNotifications();

    const interval = window.setInterval(refreshNotifications, 60_000);

    function handleFocus() {
      void refreshNotifications();
    }

    window.addEventListener("focus", handleFocus);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [pathname]);

  async function handleSignOut() {
    if (signingOut) return;

    setSigningOut(true);

    try {
      const supabase = createClient();
      await supabase.auth.signOut();

      router.replace("/auth/login");
      router.refresh();
    } catch (error) {
      console.error("[sign-out]", error);
      setSigningOut(false);
    }
  }

  const canOpenAnySettings =
    normalizedRole === "owner" ||
    canAccessPath(normalizedRole, "/settings/company") ||
    canAccessPath(normalizedRole, "/settings/business") ||
    canAccessPath(normalizedRole, "/settings/accounting") ||
    canAccessPath(normalizedRole, "/settings/documents") ||
    canAccessPath(normalizedRole, "/settings/users") ||
    canAccessPath(normalizedRole, "/settings/security");

  return (
    <aside className="hidden w-64 flex-col border-r border-gray-200 bg-white lg:flex">
      <div className="flex h-16 items-center border-b border-gray-200 px-6">
        <div>
          <div className="text-lg font-semibold tracking-tight text-gray-900">
            Business360
          </div>
          <div className="text-xs text-gray-400">
            Business Operating System
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-4">
        <NavSection title="Workspace">
          <RoleNavItem role={normalizedRole} href="/dashboard" label="Dashboard" />
          <RoleNavItem
            role={normalizedRole}
            href="/notifications"
            label="Notifications"
            badge={unreadNotifications}
          />
          <RoleNavItem role={normalizedRole} href="/customers" label="Customers" />
          <RoleNavItem role={normalizedRole} href="/products" label="Products" />
        </NavSection>

        <NavSection title="Operations">
          <RoleNavItem role={normalizedRole} href="/quotations" label="Quotations" />
          <RoleNavItem role={normalizedRole} href="/sales" label="Sales" />
          <RoleNavItem
            role={normalizedRole}
            href="/sales-returns"
            label="Sales Returns"
          />
          <RoleNavItem role={normalizedRole} href="/inventory" label="Inventory" />
          <RoleNavItem role={normalizedRole} href="/purchase" label="Purchase" />
          <RoleNavItem
            role={normalizedRole}
            href="/supplier-bills"
            label="Supplier Bills"
          />
          <RoleNavItem role={normalizedRole} href="/expenses" label="Expenses" />
        </NavSection>

        <NavSection title="Insights">
          <RoleNavItem role={normalizedRole} href="/reports" label="Reports" />
          <RoleNavItem role={normalizedRole} href="/ai" label="AI Assistant" />
          <RoleNavItem role={normalizedRole} href="/audit-log" label="Activity Log" />
        </NavSection>
      </nav>

      <div className="border-t border-gray-200 p-4">
        {canOpenAnySettings && (
          <Link
            href="/settings"
            className="mb-2 flex items-center rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"
          >
            Settings
          </Link>
        )}

        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span>{signingOut ? "Signing out..." : "Sign Out"}</span>
          <span aria-hidden="true">↗</span>
        </button>
      </div>
    </aside>
  );
}

function RoleNavItem({
  role,
  href,
  label,
  badge = 0,
}: {
  role: Business360Role;
  href: string;
  label: string;
  badge?: number;
}) {
  if (!canAccessPath(role, href)) return null;

  return <NavItem href={href} label={label} badge={badge} />;
}

function NavSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="pb-4">
      <div className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
        {title}
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function NavItem({
  href,
  label,
  badge = 0,
}: {
  href: string;
  label: string;
  badge?: number;
}) {
  const pathname = usePathname();

  const active =
    pathname === href ||
    (href !== "/dashboard" && pathname.startsWith(`${href}/`));

  return (
    <Link
      href={href}
      className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
        active
          ? "bg-gray-900 text-white shadow-sm"
          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
      }`}
    >
      <span>{label}</span>

      {badge > 0 && (
        <span
          className={`min-w-5 rounded-full px-1.5 py-0.5 text-center text-[10px] font-semibold ${
            active
              ? "bg-white text-gray-900"
              : "bg-red-50 text-red-700"
          }`}
        >
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Link>
  );
}
