import Link from "next/link";

import {
  createClient,
} from "@/lib/supabase/server";

export const instant = false;

export default async function NotificationsPage() {
  const supabase =
    await createClient();

  /*
    1. Refresh live business signals.
    2. Opening Notifications means the user has seen
       the current active notifications, so mark them read.
  */
  const {
    error: refreshError,
  } = await supabase.rpc(
    "refresh_business_notifications"
  );

  if (refreshError) {
    console.error(
      "[notifications-refresh]",
      refreshError
    );
  }

  const {
    error: readError,
  } = await supabase.rpc(
    "mark_all_notifications_read"
  );

  if (readError) {
    console.error(
      "[notifications-open-read]",
      readError
    );
  }

  const {
    data: notifications,
    error,
  } = await supabase
    .from("notifications")
    .select(`
      id,
      title,
      message,
      severity,
      source_module,
      href,
      is_read,
      is_active,
      created_at,
      read_at,
      resolved_at
    `)
    .order("is_active", {
      ascending: false,
    })
    .order("created_at", {
      ascending: false,
    })
    .limit(100);

  if (error) {
    throw new Error(
      `Could not load notifications: ${error.message}`
    );
  }

  const rows =
    notifications || [];

  const activeRows =
    rows.filter(
      (row) =>
        row.is_active !== false
    );

  const resolvedRows =
    rows.filter(
      (row) =>
        row.is_active === false
    );

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-gray-900 px-3 py-1 text-xs font-medium text-white">
              Business360
            </span>

            <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
              0 unread
            </span>

            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
              {activeRows.length} unresolved
            </span>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            Notifications Center
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            Opening this page marks current notifications as read.
            Unresolved business conditions remain visible until the underlying issue is resolved.
          </p>
        </div>
      </section>

      <NotificationSection
        title="Unresolved Alerts"
        description="Current business conditions that are still active and may require action."
        rows={activeRows}
        emptyText="No active alerts. Current operational signals look clear."
      />

      {resolvedRows.length >
        0 && (
        <NotificationSection
          title="Resolved History"
          description="Previous business signals that are no longer active."
          rows={resolvedRows}
          emptyText="No resolved notifications yet."
          resolved
        />
      )}
    </div>
  );
}

function NotificationSection({
  title,
  description,
  rows,
  emptyText,
  resolved = false,
}: {
  title: string;
  description: string;
  rows: any[];
  emptyText: string;
  resolved?: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-6 py-5">
        <h2 className="text-lg font-semibold text-gray-900">
          {title}
        </h2>

        <p className="mt-1 text-sm text-gray-500">
          {description}
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="px-6 py-14 text-center text-sm text-gray-500">
          {emptyText}
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {rows.map(
            (notification) => {
              const severity =
                String(
                  notification.severity ||
                    "info"
                ).toLowerCase();

              return (
                <div
                  key={
                    notification.id
                  }
                  className={
                    resolved
                      ? "bg-gray-50/50 p-5"
                      : "bg-white p-5"
                  }
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <SeverityBadge
                          severity={
                            severity
                          }
                        />

                        {notification.source_module && (
                          <span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                            {
                              notification.source_module
                            }
                          </span>
                        )}

                        {resolved && (
                          <span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                            Resolved
                          </span>
                        )}
                      </div>

                      <h3 className="mt-3 text-sm font-semibold text-gray-900">
                        {
                          notification.title
                        }
                      </h3>

                      <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500">
                        {
                          notification.message
                        }
                      </p>

                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
                        <span>
                          Created{" "}
                          {formatDateTime(
                            notification.created_at
                          )}
                        </span>

                        {resolved &&
                          notification.resolved_at && (
                          <span>
                            Resolved{" "}
                            {formatDateTime(
                              notification.resolved_at
                            )}
                          </span>
                        )}
                      </div>
                    </div>

                    {notification.href &&
                      !resolved && (
                      <Link
                        href={
                          notification.href
                        }
                        className="shrink-0 rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-gray-800"
                      >
                        Open
                      </Link>
                    )}
                  </div>
                </div>
              );
            }
          )}
        </div>
      )}
    </section>
  );
}

function SeverityBadge({
  severity,
}: {
  severity: string;
}) {
  const className =
    severity ===
    "critical"
      ? "bg-red-50 text-red-700"
      : severity ===
        "warning"
      ? "bg-amber-50 text-amber-700"
      : severity ===
        "success"
      ? "bg-green-50 text-green-700"
      : "bg-blue-50 text-blue-700";

  return (
    <span
      className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${className}`}
    >
      {severity}
    </span>
  );
}

function formatDateTime(
  value:
    | string
    | null
) {
  if (!value) {
    return "-";
  }

  const date =
    new Date(value);

  return new Intl.DateTimeFormat(
    undefined,
    {
      dateStyle:
        "medium",
      timeStyle:
        "short",
    }
  ).format(date);
}
