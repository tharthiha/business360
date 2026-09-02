import Link from "next/link";

import {
  createClient,
} from "@/lib/supabase/server";

export const instant = false;

type AuditRow = {
  id: number;
  actor_email: string | null;
  module: string;
  action: "create" | "update" | "delete";
  record_table: string;
  record_id: string | null;
  record_label: string | null;
  changed_fields: string[] | null;
  created_at: string;
};

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{
    module?: string;
    action?: string;
  }>;
}) {
  const params =
    await searchParams;

  const moduleFilter =
    String(
      params.module || ""
    ).trim();

  const actionFilter =
    String(
      params.action || ""
    ).trim();

  const supabase =
    await createClient();

  let query = supabase
    .from("audit_logs")
    .select(`
      id,
      actor_email,
      module,
      action,
      record_table,
      record_id,
      record_label,
      changed_fields,
      created_at
    `)
    .order("created_at", {
      ascending: false,
    })
    .limit(250);

  if (moduleFilter) {
    query = query.eq(
      "module",
      moduleFilter
    );
  }

  if (
    actionFilter ===
      "create" ||
    actionFilter ===
      "update" ||
    actionFilter ===
      "delete"
  ) {
    query = query.eq(
      "action",
      actionFilter
    );
  }

  const {
    data,
    error,
  } = await query;

  if (error) {
    throw new Error(
      `Could not load audit log: ${error.message}`
    );
  }

  const rows =
    (data || []) as AuditRow[];

  const modules =
    Array.from(
      new Set(
        rows.map(
          (row) =>
            row.module
        )
      )
    ).sort();

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-gray-900 px-3 py-1 text-xs font-medium text-white">
                Business360
              </span>

              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                Audit Trail
              </span>
            </div>

            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
              Activity Log
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
              Review who changed business records, what changed, and when the
              activity happened.
            </p>
          </div>

          <div className="text-sm text-gray-500">
            Showing {rows.length} recent event
            {rows.length === 1 ? "" : "s"}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <form className="flex flex-col gap-3 sm:flex-row">
          <select
            name="module"
            defaultValue={
              moduleFilter
            }
            className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700"
          >
            <option value="">
              All modules
            </option>

            {modules.map(
              (module) => (
                <option
                  key={module}
                  value={module}
                >
                  {labelize(
                    module
                  )}
                </option>
              )
            )}
          </select>

          <select
            name="action"
            defaultValue={
              actionFilter
            }
            className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700"
          >
            <option value="">
              All actions
            </option>

            <option value="create">
              Created
            </option>

            <option value="update">
              Updated
            </option>

            <option value="delete">
              Deleted
            </option>
          </select>

          <button
            type="submit"
            className="rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white"
          >
            Filter
          </button>

          {(moduleFilter ||
            actionFilter) && (
            <Link
              href="/audit-log"
              className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-center text-sm font-medium text-gray-700"
            >
              Clear
            </Link>
          )}
        </form>
      </section>

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        {rows.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="text-base font-semibold text-gray-900">
              No audit activity yet
            </div>

            <p className="mt-2 text-sm text-gray-500">
              New create, update and delete actions will appear here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {rows.map(
              (row) => (
                <div
                  key={row.id}
                  className="p-5"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <ActionBadge
                          action={
                            row.action
                          }
                        />

                        <span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-600">
                          {labelize(
                            row.module
                          )}
                        </span>

                        <span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                          {
                            row.record_table
                          }
                        </span>
                      </div>

                      <h2 className="mt-3 text-sm font-semibold text-gray-900">
                        {row.actor_email ||
                          "System"}{" "}
                        {actionSentence(
                          row.action
                        )}{" "}
                        {row.record_label ||
                          row.record_id ||
                          "record"}
                      </h2>

                      {row.action ===
                        "update" &&
                        row.changed_fields &&
                        row.changed_fields.length >
                          0 && (
                          <p className="mt-2 text-sm text-gray-500">
                            Changed:{" "}
                            {row.changed_fields
                              .slice(
                                0,
                                10
                              )
                              .map(
                                labelize
                              )
                              .join(
                                ", "
                              )}
                            {row.changed_fields.length >
                            10
                              ? "…"
                              : ""}
                          </p>
                        )}
                    </div>

                    <div className="shrink-0 text-xs text-gray-400">
                      {formatDateTime(
                        row.created_at
                      )}
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </section>

      <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-xs leading-5 text-gray-500">
        Audit logs are append-only for normal authenticated users. They are
        intended for operational traceability and should not be treated as a
        substitute for database backups.
      </div>
    </div>
  );
}

function ActionBadge({
  action,
}: {
  action:
    | "create"
    | "update"
    | "delete";
}) {
  const className =
    action === "create"
      ? "bg-green-50 text-green-700"
      : action === "delete"
      ? "bg-red-50 text-red-700"
      : "bg-blue-50 text-blue-700";

  return (
    <span
      className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${className}`}
    >
      {action}
    </span>
  );
}

function actionSentence(
  action: string
) {
  if (action === "create") {
    return "created";
  }

  if (action === "delete") {
    return "deleted";
  }

  return "updated";
}

function labelize(
  value: string
) {
  return String(
    value || "-"
  )
    .replaceAll(
      "_",
      " "
    )
    .replaceAll(
      "-",
      " "
    )
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase()
    );
}

function formatDateTime(
  value: string
) {
  return new Intl.DateTimeFormat(
    undefined,
    {
      dateStyle:
        "medium",
      timeStyle:
        "short",
    }
  ).format(
    new Date(value)
  );
}
