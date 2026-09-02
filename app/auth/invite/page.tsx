"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AcceptInvitePage() {
  const supabase = createClient();
  const router = useRouter();

  const [password, setPassword] =
    useState("");

  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState("");

  async function handleSubmit(
    e: React.FormEvent
  ) {
    e.preventDefault();

    setMessage("");

    if (password.length < 8) {
      setMessage(
        "Password must be at least 8 characters."
      );
      return;
    }

    if (password !== confirmPassword) {
      setMessage(
        "Passwords do not match."
      );
      return;
    }

    setSaving(true);

    try {
      const { error } =
        await supabase.auth.updateUser({
          password,
        });

      if (error) {
        setMessage(error.message);
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    } catch (error) {
      console.error(error);

      setMessage(
        "Could not finish account setup."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-7 shadow-sm">
        <div className="mb-6">
          <div className="text-sm font-semibold text-gray-500">
            Business360
          </div>

          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-gray-900">
            Finish Staff Account Setup
          </h1>

          <p className="mt-2 text-sm leading-6 text-gray-500">
            Create a password for your company account. After setup you will be
            taken to the Business360 dashboard.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-5"
        >
          <PasswordField
            label="New Password"
            value={password}
            onChange={setPassword}
          />

          <PasswordField
            label="Confirm Password"
            value={confirmPassword}
            onChange={setConfirmPassword}
          />

          {message && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-gray-900 px-4 py-3 text-sm font-semibold text-white hover:bg-black disabled:opacity-50"
          >
            {saving
              ? "Setting Up Account..."
              : "Set Password & Continue"}
          </button>
        </form>
      </div>
    </main>
  );
}

function PasswordField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
      </label>

      <input
        type="password"
        value={value}
        autoComplete="new-password"
        onChange={(e) =>
          onChange(e.target.value)
        }
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-400"
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
