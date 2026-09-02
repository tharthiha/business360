"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

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
          <RoleNavItem role={normalizedRole} href="/customers" label="Customers" />
          <RoleNavItem role={normalizedRole} href="/products" label="Products" />
        </NavSection>

        <NavSection title="Operations">
          <RoleNavItem role={normalizedRole} href="/quotations" label="Quotations" />
          <RoleNavItem role={normalizedRole} href="/sales" label="Sales" />
          <RoleNavItem role={normalizedRole} href="/inventory" label="Inventory" />
          <RoleNavItem role={normalizedRole} href="/purchase" label="Purchase" />
          <RoleNavItem role={normalizedRole} href="/supplier-bills" label="Supplier Bills" />
          <RoleNavItem role={normalizedRole} href="/expenses" label="Expenses" />
        </NavSection>

        <NavSection title="Insights">
          <RoleNavItem role={normalizedRole} href="/reports" label="Reports" />
          <RoleNavItem role={normalizedRole} href="/ai" label="AI Assistant" />
        </NavSection>
      </nav>

      {canAccessPath(normalizedRole, "/settings") && (
        <div className="border-t border-gray-200 p-4">
          <RoleNavItem role={normalizedRole} href="/settings" label="Settings" />
        </div>
      )}
    </aside>
  );
}

function RoleNavItem({
  role,
  href,
  label,
}: {
  role: Business360Role;
  href: string;
  label: string;
}) {
  if (!canAccessPath(role, href)) {
    return null;
  }

  return <NavItem href={href} label={label} />;
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
}: {
  href: string;
  label: string;
}) {
  const pathname = usePathname();

  const active =
    pathname === href ||
    (href !== "/dashboard" && pathname.startsWith(`${href}/`));

  return (
    <Link
      href={href}
      className={`block rounded-lg px-3 py-2.5 text-sm font-medium transition ${
        active
          ? "bg-gray-900 text-white shadow-sm"
          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
      }`}
    >
      {label}
    </Link>
  );
}
