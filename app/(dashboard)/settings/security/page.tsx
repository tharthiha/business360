"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type AccountInfo = {
  email: string;
  role: string;
  companyId: number | null;
  isActive: boolean;
};

export default function SecuritySettingsPage() {
  const supabase = createClient();
  const router = useRouter();

  const [account, setAccount] = useState<AccountInfo>({
    email: "",
    role: "",
    companyId: null,
    isActive: true,
  });

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingPassword, setSavingPassword] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [message, setMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    async function loadAccount() {
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

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("company_id, role, is_active")
          .eq("id", user.id)
          .single();

        if (profileError) {
          setMessage(profileError.message);
          return;
        }

        setAccount({
          email: user.email || "",
          role: String(profile?.role || "staff"),
          companyId: profile?.company_id ? Number(profile.company_id) : null,
          isActive: profile?.is_active !== false,
        });
      } catch (error) {
        console.error(error);
        setMessage("Unexpected error while loading security settings.");
      } finally {
        setLoading(false);
      }
    }

    loadAccount();
  }, []);

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();

    setMessage("");
    setSuccessMessage("");

    if (newPassword.length < 8) {
      setMessage("Password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage("New password and confirmation do not match.");
      return;
    }

    setSavingPassword(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      setNewPassword("");
      setConfirmPassword("");
      setSuccessMessage("Password updated successfully.");
    } catch (error) {
      console.error(error);
      setMessage("Unexpected error while updating password.");
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    setMessage("");
    setSuccessMessage("");

    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        setMessage(error.message);
        return;
      }

      router.replace("/auth/login");
      router.refresh();
    } catch (error) {
      console.error(error);
      setMessage("Unexpected error while signing out.");
    } finally {
      setSigningOut(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <div className="text-sm text-gray-500">
          Loading security settings...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-gray-400">
            <Link href="/settings" className="hover:text-gray-700">
              Settings
            </Link>
            <span>/</span>
            <span>Security</span>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            Security
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Manage your Business360 account password, access status and session.
          </p>
        </div>

        <Link
          href="/settings"
          className="inline-flex w-fit rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Back to Settings
        </Link>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <InfoCard
          label="Account"
          value={account.email || "No email"}
          hint="Supabase authenticated user"
        />

        <InfoCard
          label="Role"
          value={labelize(account.role)}
          hint="Company access role"
        />

        <InfoCard
          label="Access"
          value={account.isActive ? "Active" : "Inactive"}
          hint={
            account.companyId
              ? `Company #${account.companyId}`
              : "No company assigned"
          }
          tone={account.isActive ? "positive" : "danger"}
        />
      </div>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="font-semibold text-gray-900">Change Password</h2>
          <p className="mt-1 text-sm text-gray-500">
            Update the password for your currently signed-in Business360 account.
          </p>
        </div>

        <form onSubmit={handlePasswordChange} className="p-6">
          <div className="grid gap-5 md:grid-cols-2">
            <PasswordField
              label="New Password"
              value={newPassword}
              onChange={setNewPassword}
              autoComplete="new-password"
            />

            <PasswordField
              label="Confirm New Password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              autoComplete="new-password"
            />
          </div>

          <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-xs leading-5 text-gray-500">
            Use at least 8 characters. A longer unique password is recommended.
          </div>

          <div className="mt-5 flex justify-end">
            <button
              type="submit"
              disabled={savingPassword}
              className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-black disabled:opacity-50"
            >
              {savingPassword ? "Updating..." : "Update Password"}
            </button>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="font-semibold text-gray-900">Security Controls</h2>
          <p className="mt-1 text-sm text-gray-500">
            Current protections already active in the Business360 architecture.
          </p>
        </div>

        <div className="grid gap-4 p-6 md:grid-cols-2">
          <SecurityItem
            title="Company Data Isolation"
            text="Business data is protected by company-scoped Row Level Security policies."
          />

          <SecurityItem
            title="Owner-only Administration"
            text="Sensitive company and team administration is restricted to authorized owners."
          />

          <SecurityItem
            title="Accounting Period Protection"
            text="Closed accounting periods remain protected by database-level safeguards."
          />

          <SecurityItem
            title="Append-only Financial Ledgers"
            text="Critical payment and inventory ledger records are protected from normal update/delete workflows."
          />
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-red-200 bg-white shadow-sm">
        <div className="border-b border-red-100 px-6 py-4">
          <h2 className="font-semibold text-gray-900">Session</h2>
          <p className="mt-1 text-sm text-gray-500">
            End the current Business360 session on this browser.
          </p>
        </div>

        <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-medium text-gray-900">
              Sign out of Business360
            </div>
            <p className="mt-1 text-xs leading-5 text-gray-500">
              You will need to authenticate again to access the dashboard.
            </p>
          </div>

          <button
            type="button"
            disabled={signingOut}
            onClick={handleSignOut}
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
          >
            {signingOut ? "Signing Out..." : "Sign Out"}
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-gray-50 p-5">
        <div className="text-sm font-semibold text-gray-900">
          Multi-factor authentication
        </div>
        <p className="mt-1 text-xs leading-5 text-gray-500">
          MFA is not enabled by this page yet. It should be added as a separate
          Supabase Auth flow so enrollment and verification are enforced
          correctly rather than stored as a simple preference.
        </p>
      </section>

      {message && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {message}
        </div>
      )}

      {successMessage && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {successMessage}
        </div>
      )}
    </div>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
      </label>

      <input
        type="password"
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400"
        style={{
          backgroundColor: "#ffffff",
          color: "#111827",
          WebkitTextFillColor: "#111827",
          colorScheme: "light",
        }}
      />
    </div>
  );
}

function InfoCard({
  label,
  value,
  hint,
  tone = "normal",
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "normal" | "positive" | "danger";
}) {
  const valueClass =
    tone === "positive"
      ? "text-green-700"
      : tone === "danger"
      ? "text-red-700"
      : "text-gray-900";

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="text-sm text-gray-500">{label}</div>
      <div className={`mt-2 truncate text-lg font-semibold ${valueClass}`}>
        {value}
      </div>
      <div className="mt-2 text-xs text-gray-400">{hint}</div>
    </div>
  );
}

function SecurityItem({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-green-50 text-xs font-bold text-green-700">
          ✓
        </span>
        <div className="text-sm font-semibold text-gray-900">{title}</div>
      </div>

      <p className="mt-2 text-xs leading-5 text-gray-500">{text}</p>
    </div>
  );
}

function labelize(value: string) {
  return String(value || "-")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
