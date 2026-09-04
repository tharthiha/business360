"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Member = {
  id: string;
  role: string;
  is_active: boolean;
  label: string;
  secondary: string;
};

const ROLE_OPTIONS = [
  ["owner", "Owner"],
  ["admin", "Admin"],
  ["accountant", "Accountant"],
  ["sales", "Sales"],
  ["inventory", "Inventory"],
  ["staff", "Staff"],
  ["viewer", "Viewer"],
] as const;

const INVITE_ROLE_OPTIONS = ROLE_OPTIONS.filter(
  ([value]) => value !== "owner"
);

export default function UsersRolesPage() {
  const supabase = createClient();

  const [members, setMembers] = useState<Member[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [currentRole, setCurrentRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState("staff");
  const [inviting, setInviting] = useState(false);
  const [message, setMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    loadMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadMembers() {
    setLoading(true);
    setMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setMessage("Please login first.");
        return;
      }

      setCurrentUserId(user.id);

      const { data: myProfile, error: myProfileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (myProfileError || !myProfile?.company_id) {
        setMessage("Company profile not found.");
        return;
      }

      setCurrentRole(
        String(myProfile.role || "staff").toLowerCase()
      );

      const { data: rows, error: membersError } = await supabase
        .from("profiles")
        .select("*")
        .eq("company_id", myProfile.company_id)
        .order("role", { ascending: true });

      if (membersError) {
        setMessage(membersError.message);
        return;
      }

      const normalized: Member[] = (rows || []).map((row: any) => ({
        id: String(row.id),
        role: String(row.role || "staff").toLowerCase(),
        is_active: row.is_active !== false,
        label:
          row.full_name ||
          row.display_name ||
          row.name ||
          row.email ||
          (String(row.id) === user.id ? "You" : "Team Member"),
        secondary:
          row.email ||
          row.job_title ||
          (String(row.id) === user.id
            ? "Current signed-in user"
            : String(row.id)),
      }));

      setMembers(normalized);
    } catch (error) {
      console.error(error);
      setMessage("Unexpected error while loading users and roles.");
    } finally {
      setLoading(false);
    }
  }

  const activeCount = useMemo(
    () => members.filter((member) => member.is_active).length,
    [members]
  );

  const ownerCount = useMemo(
    () =>
      members.filter(
        (member) =>
          member.role === "owner" &&
          member.is_active
      ).length,
    [members]
  );

  const canManage =
    currentRole === "owner";

  async function handleInvite(
    e: React.FormEvent
  ) {
    e.preventDefault();

    if (!canManage) {
      setMessage(
        "Only the company owner can invite staff."
      );
      return;
    }

    setInviting(true);
    setMessage("");
    setSuccessMessage("");

    try {
      const response = await fetch(
        "/api/settings/users/invite",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            email: inviteEmail,
            full_name: inviteName,
            role: inviteRole,
          }),
        }
      );

      const result =
        await response.json();

      if (!response.ok) {
        setMessage(
          result?.error ||
            "Could not invite staff."
        );
        return;
      }

      setSuccessMessage(
        result?.message ||
          "Staff invitation sent successfully."
      );

      setInviteEmail("");
      setInviteName("");
      setInviteRole("staff");
      setShowInvite(false);

      await loadMembers();
    } catch (error) {
      console.error(error);

      setMessage(
        "Unexpected error while inviting staff."
      );
    } finally {
      setInviting(false);
    }
  }

  async function saveMember(
    member: Member
  ) {
    if (!canManage) {
      setMessage(
        "Only the company owner can manage users and roles."
      );
      return;
    }

    setSavingId(member.id);
    setMessage("");
    setSuccessMessage("");

    try {
      const { error } =
        await supabase.rpc(
          "update_company_member_access",
          {
            p_profile_id: member.id,
            p_role: member.role,
            p_is_active:
              member.is_active,
          }
        );

      if (error) {
        setMessage(error.message);
        return;
      }

      setSuccessMessage(
        "Member access updated successfully."
      );

      await loadMembers();
    } catch (error) {
      console.error(error);

      setMessage(
        "Unexpected error while updating member access."
      );
    } finally {
      setSavingId("");
    }
  }

  function patchMember(
    id: string,
    patch: Partial<Member>
  ) {
    setMembers((current) =>
      current.map((member) =>
        member.id === id
          ? { ...member, ...patch }
          : member
      )
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <div className="text-sm text-gray-500">
          Loading users and roles...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-gray-400">
            <Link
              href="/settings"
              className="hover:text-gray-700"
            >
              Settings
            </Link>
            <span>/</span>
            <span>Users &amp; Roles</span>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            Users &amp; Roles
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Invite company staff and control their Business360 access.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/settings"
            className="inline-flex w-fit rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Back to Settings
          </Link>

          {canManage && (
            <button
              type="button"
              onClick={() =>
                setShowInvite(
                  (current) => !current
                )
              }
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
            >
              + Invite Staff
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard
          label="Team Members"
          value={String(members.length)}
        />
        <SummaryCard
          label="Active Users"
          value={String(activeCount)}
        />
        <SummaryCard
          label="Active Owners"
          value={String(ownerCount)}
        />
      </div>

      {showInvite && canManage && (
        <section className="overflow-hidden rounded-xl border border-gray-900 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="font-semibold text-gray-900">
              Invite Company Staff
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              The staff member will receive an email invitation and create their
              own password.
            </p>
          </div>

          <form
            onSubmit={handleInvite}
            className="p-6"
          >
            <div className="grid gap-5 md:grid-cols-3">
              <TextField
                label="Staff Name"
                value={inviteName}
                placeholder="Optional"
                onChange={setInviteName}
              />

              <TextField
                label="Email"
                value={inviteEmail}
                type="email"
                required
                placeholder="staff@company.com"
                onChange={setInviteEmail}
              />

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Role
                </label>

                <select
                  value={inviteRole}
                  onChange={(e) =>
                    setInviteRole(
                      e.target.value
                    )
                  }
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400"
                  style={{
                    backgroundColor:
                      "#ffffff",
                    color: "#111827",
                    colorScheme: "light",
                  }}
                >
                  {INVITE_ROLE_OPTIONS.map(
                    ([value, label]) => (
                      <option
                        key={value}
                        value={value}
                      >
                        {label}
                      </option>
                    )
                  )}
                </select>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() =>
                  setShowInvite(false)
                }
                className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={
                  inviting ||
                  !inviteEmail.trim()
                }
                className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-black disabled:opacity-50"
              >
                {inviting
                  ? "Sending Invite..."
                  : "Send Invitation"}
              </button>
            </div>
          </form>
        </section>
      )}

      {!canManage && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          You can view team access, but only the company owner can invite users,
          change roles or deactivate members.
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="font-semibold text-gray-900">
            Company Members
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Access changes are company-scoped and protected by owner-only server
            and database checks.
          </p>
        </div>

        {members.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-gray-500">
            No company members found.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {members.map((member) => {
              const isCurrentUser =
                member.id === currentUserId;

              const saving =
                savingId === member.id;

              const protectedOwner =
                isCurrentUser &&
                currentRole === "owner";

              return (
                <div
                  key={member.id}
                  className="grid gap-5 px-6 py-5 lg:grid-cols-[1fr_210px_180px_130px] lg:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="truncate text-sm font-semibold text-gray-900">
                        {member.label}
                      </div>

                      {isCurrentUser && (
                        <span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-blue-700">
                          You
                        </span>
                      )}

                      {protectedOwner && (
                        <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                          Protected Owner
                        </span>
                      )}

                      {!member.is_active && (
                        <span className="rounded-full bg-red-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-red-700">
                          Inactive
                        </span>
                      )}
                    </div>

                    <div className="mt-1 truncate text-xs text-gray-500">
                      {member.secondary}
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-gray-500">
                      Role
                    </label>

                    <select
                      value={member.role}
                      disabled={
                        !canManage ||
                        saving ||
                        protectedOwner
                      }
                      onChange={(e) =>
                        patchMember(
                          member.id,
                          {
                            role:
                              e.target.value,
                          }
                        )
                      }
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none disabled:bg-gray-50 disabled:text-gray-500"
                      style={{
                        backgroundColor:
                          "#ffffff",
                        color: "#111827",
                        colorScheme: "light",
                      }}
                    >
                      {ROLE_OPTIONS.map(
                        ([value, label]) => (
                          <option
                            key={value}
                            value={value}
                          >
                            {label}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-gray-500">
                      Access
                    </label>

                    <button
                      type="button"
                      disabled={
                        !canManage ||
                        saving ||
                        protectedOwner
                      }
                      onClick={() =>
                        patchMember(
                          member.id,
                          {
                            is_active:
                              !member.is_active,
                          }
                        )
                      }
                      className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-left disabled:opacity-60"
                    >
                      <span className="text-sm font-medium text-gray-700">
                        {member.is_active
                          ? "Active"
                          : "Inactive"}
                      </span>

                      <span
                        className={`relative inline-flex h-6 w-11 rounded-full ${
                          member.is_active
                            ? "bg-gray-900"
                            : "bg-gray-300"
                        }`}
                      >
                        <span
                          className={`mt-1 h-4 w-4 rounded-full bg-white transition ${
                            member.is_active
                              ? "ml-6"
                              : "ml-1"
                          }`}
                        />
                      </span>
                    </button>
                  </div>

                  <div className="lg:text-right">
                    <button
                      type="button"
                      disabled={
                        !canManage ||
                        saving ||
                        protectedOwner
                      }
                      onClick={() =>
                        saveMember(member)
                      }
                      className="w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-40 lg:w-auto"
                    >
                      {saving
                        ? "Saving..."
                        : "Save"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-amber-200 bg-amber-50 p-5">
        <div className="text-sm font-semibold text-amber-900">
          Owner protection
        </div>

        <p className="mt-1 text-xs leading-5 text-amber-800">
          The currently signed-in owner cannot demote or deactivate themselves here.
          This prevents a company from accidentally losing its last owner. Owner
          transfer can be added later as a separate confirmed workflow.
        </p>
      </section>

      <section className="rounded-xl border border-gray-200 bg-gray-50 p-5">
        <div className="text-sm font-semibold text-gray-900">
          Staff onboarding flow
        </div>

        <p className="mt-1 text-xs leading-5 text-gray-500">
          Owner sends invitation → staff receives email → invite link verifies
          the Supabase account → staff creates a password → Business360 dashboard.
        </p>
      </section>

      {message && (
  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
    {message}
  </div>
)}

{successMessage && (
  <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
    {successMessage}
  </div>
)}
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder = "",
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
        {required && (
          <span className="ml-1 text-red-500">
            *
          </span>
        )}
      </label>

      <input
        type={type}
        required={required}
        value={value}
        placeholder={placeholder}
        onChange={(e) =>
          onChange(e.target.value)
        }
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-gray-400"
        style={{
          backgroundColor: "#ffffff",
          color: "#111827",
          WebkitTextFillColor:
            "#111827",
          colorScheme: "light",
        }}
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="text-sm text-gray-500">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-gray-900">
        {value}
      </div>
    </div>
  );
}
