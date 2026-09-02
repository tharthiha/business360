import Link from "next/link";

export const instant = false;

type SettingCardProps = {
  title: string;
  description: string;
  href?: string;
  status?: "ready" | "coming";
  icon: React.ReactNode;
};

export default function SettingsPage() {
  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
          Settings
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Configure your company, accounting preferences, documents, users and
          Business360 workspace.
        </p>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-gray-900">
              Business360 Workspace
            </div>
            <p className="mt-1 text-sm text-gray-500">
              Central control center for company-wide settings and permissions.
            </p>
          </div>

          <span className="inline-flex w-fit rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
            Production
          </span>
        </div>
      </section>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <SettingCard
          title="Company Profile"
          description="Company details, logo, contact information, tax ID, currency and quotation template."
          href="/settings/company"
          status="ready"
          icon={<BuildingIcon />}
        />

        <SettingCard
          title="Business Settings"
          description="Timezone, date preferences, fiscal year, language and general workspace behavior."
          href="/settings/business"
          status="ready"
          icon={<SlidersIcon />}
        />

        <SettingCard
          title="Accounting Settings"
          description="Tax defaults, accounting periods and financial workflow preferences."
          href="/settings/accounting"
          status="ready"
          icon={<CalculatorIcon />}
        />

        <SettingCard
          title="Document Settings"
          description="Document numbering, terms, footers and defaults for quotations, invoices and purchase orders."
          href="/settings/documents"
          status="ready"
          icon={<DocumentIcon />}
        />

        <SettingCard
          title="Users & Roles"
          description="Manage team members, access levels and company permissions."
          href="/settings/users"
          status="ready"
          icon={<UsersIcon />}
        />

        <SettingCard
          title="Security"
          description="Password, account access, active session and security controls."
          href="/settings/security"
          status="ready"
          icon={<ShieldIcon />}
        />
      </div>

      <section className="rounded-xl border border-gray-200 bg-gray-50 px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-lg bg-white p-2 shadow-sm">
            <SparklesIcon />
          </div>

          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              Settings foundation complete
            </h2>
            <p className="mt-1 text-sm leading-6 text-gray-500">
              Company, business, accounting, document, team and security settings
              are now available. The next module is the Business360 AI Assistant.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function SettingCard({
  title,
  description,
  href,
  status = "coming",
  icon,
}: SettingCardProps) {
  const body = (
    <div
      className={`group h-full rounded-xl border bg-white p-5 shadow-sm transition ${
        href
          ? "border-gray-200 hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md"
          : "border-gray-200"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-700">
          {icon}
        </div>

        {status === "ready" ? (
          <span className="rounded-full bg-green-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-green-700">
            Ready
          </span>
        ) : (
          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
            Coming Soon
          </span>
        )}
      </div>

      <h2 className="mt-5 text-base font-semibold text-gray-900">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-gray-500">{description}</p>

      <div className="mt-5 border-t border-gray-100 pt-4">
        {href ? (
          <div className="text-sm font-semibold text-gray-900">
            Open Settings <span aria-hidden>→</span>
          </div>
        ) : (
          <div className="text-sm font-medium text-gray-400">
            Module not enabled yet
          </div>
        )}
      </div>
    </div>
  );

  return href ? (
    <Link href={href} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}

function BuildingIcon() {
  return <Icon path="M4 21h16M6 21V5l6-2 6 2v16M9 8h1M14 8h1M9 12h1M14 12h1M9 16h1M14 16h1" />;
}
function SlidersIcon() {
  return <Icon path="M4 7h10M18 7h2M4 17h4M12 17h8M14 4v6M8 14v6" />;
}
function CalculatorIcon() {
  return <Icon path="M5 3h14v18H5zM8 7h8M8 12h2M14 12h2M8 16h2M14 16h2" />;
}
function DocumentIcon() {
  return <Icon path="M7 3h7l4 4v14H7zM14 3v5h5M10 12h5M10 16h5" />;
}
function UsersIcon() {
  return <Icon path="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM17 11a3 3 0 1 0 0-6M19 21v-2a4 4 0 0 0-3-3.87" />;
}
function ShieldIcon() {
  return <Icon path="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Zm-3-10 2 2 4-4" />;
}
function SparklesIcon() {
  return <Icon path="m12 3-1.2 3.2L8 7.5l2.8 1.3L12 12l1.2-3.2L16 7.5l-2.8-1.3L12 3Zm6 10-.8 2.2L15 16l2.2.8L18 19l.8-2.2L21 16l-2.2-.8L18 13Z" />;
}

function Icon({ path }: { path: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d={path} />
    </svg>
  );
}
