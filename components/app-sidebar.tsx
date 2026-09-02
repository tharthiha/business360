"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export default function AppSidebar() {
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
          <NavItem href="/dashboard" label="Dashboard" />
          <NavItem href="/customers" label="Customers" />
          <NavItem href="/products" label="Products" />
        </NavSection>

        <NavSection title="Operations">
          <NavItem href="/quotations" label="Quotations" />
          <NavItem href="/sales" label="Sales" />
          <NavItem href="/inventory" label="Inventory" />
          <NavItem href="/purchase" label="Purchase" />
          <NavItem href="/supplier-bills" label="Supplier Bills" />
          <NavItem href="/expenses" label="Expenses" />
        </NavSection>

        <NavSection title="Insights">
          <NavItem href="/reports" label="Reports" />
          <NavItem href="/ai" label="AI Assistant" />
        </NavSection>
      </nav>

      <div className="border-t border-gray-200 p-4">
        <NavItem href="/settings" label="Settings" />
      </div>
    </aside>
  );
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

      <div className="space-y-1">
        {children}
      </div>
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